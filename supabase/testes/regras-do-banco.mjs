// Roda as migrações num Postgres local (PGlite) com um "auth" falso, imitando o Supabase,
// e confere regras de acesso, gatilho "mais recente vence" e as consultas do app.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const MIG = new URL('../migrations', import.meta.url).pathname;
const db = new PGlite();
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create role anon; create role authenticated;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  insert into auth.users values ('${U1}'), ('${U2}');
`);
for (const f of fs.readdirSync(MIG).sort()) {
  await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8'));
  console.log('migração aplicada:', f);
}
await db.exec(`insert into public.convites (email) values ('Breno@Gmail.com');`);

const como = async (sub, email) => {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub, email, role: 'authenticated' })]);
  await db.exec(`set role authenticated`);
};
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
const erro = async (sql, p = []) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };

// Rotina padrão
await db.exec('reset role');
ok((await rows('select count(*)::int n from public.treinos'))[0].n === 6, '6 treinos na rotina padrão');
ok((await rows('select count(*)::int n from public.exercicios'))[0].n === 40, '40 exercícios');
ok((await rows("select ordem from public.treinos where id='pernas-b'"))[0].ordem === 4, 'Pernas B é o 4º da sequência');

// Usuário sem convite
await como(U2, 'pedro@gmail.com');
ok((await rows('select public.tem_convite() c'))[0].c === false, 'sem convite: tem_convite() = false');
ok((await rows('select * from public.treinos')).length === 0, 'sem convite: não vê a rotina');
ok(!!(await erro(`insert into public.series (user_id,data,treino_id,exercicio_id,indice,reps) values ('${U2}','2026-11-10','pernas-a','agachamento',0,8)`)), 'sem convite: não grava série');
ok(!!(await erro('select * from public.convites')) || (await rows('select * from public.convites')).length === 0, 'sem convite: não lê a lista de convites');

// Usuário convidado (e-mail com outra caixa)
await como(U1, 'breno@gmail.com');
ok((await rows('select public.tem_convite() c'))[0].c === true, 'convidado: tem_convite() ignora maiúsculas');
ok((await rows('select * from public.treinos')).length === 6, 'convidado: vê a rotina');
ok((await rows('select * from public.convites')).length === 1, 'convidado: lê só o próprio convite');
ok(!!(await erro(`update public.treinos set nome='x'`)) || (await rows(`select count(*)::int n from public.treinos where nome='x'`))[0].n === 0, 'convidado: não altera a rotina');

const up = (data, treino, ex, i, carga, reps, feita, quando) => db.query(
  `insert into public.series (user_id,data,treino_id,exercicio_id,indice,carga,reps,feita,alterado_em)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
   on conflict (user_id,data,treino_id,exercicio_id,indice) do update set
     carga=excluded.carga, reps=excluded.reps, feita=excluded.feita, alterado_em=excluded.alterado_em`,
  [U1, data, treino, ex, i, carga, reps, feita, quando]);

// Sessão antiga e mais recente do agachamento
await up('2026-11-02', 'pernas-a', 'agachamento', 0, 60, 10, true, '2026-11-02T10:00:00Z');
await up('2026-11-02', 'pernas-a', 'agachamento', 1, 60, 10, true, '2026-11-02T10:03:00Z');
await up('2026-11-09', 'pernas-a', 'agachamento', 0, 62.5, 8, true, '2026-11-09T10:00:00Z');
await up('2026-11-09', 'pernas-a', 'agachamento', 1, 62.5, 7, true, '2026-11-09T10:03:00Z');
await up('2026-11-09', 'pernas-a', 'agachamento', 2, null, null, false, '2026-11-09T10:05:00Z');
await up('2026-11-10', 'peito-costas-a', 'supino-reto', 0, 40, 10, true, '2026-11-10T10:00:00Z');

// Gatilho: mais antigo não sobrescreve; mais recente sim
await up('2026-11-09', 'pernas-a', 'agachamento', 1, 50, 5, true, '2026-11-09T09:00:00Z');
let s = (await rows(`select carga::float, reps from public.series where data='2026-11-09' and exercicio_id='agachamento' and indice=1`))[0];
ok(s.carga === 62.5 && s.reps === 7, 'alteração mais antiga que chega depois é ignorada');
await up('2026-11-09', 'pernas-a', 'agachamento', 1, 62.5, 9, true, '2026-11-09T20:00:00Z');
s = (await rows(`select carga::float, reps from public.series where data='2026-11-09' and exercicio_id='agachamento' and indice=1`))[0];
ok(s.reps === 9, 'alteração mais recente substitui');

// ultima_vez
const uv = await rows(`select exercicio_id, data::text, indice, carga::float, reps from public.ultima_vez('2026-11-12')`);
const agach = uv.filter((r) => r.exercicio_id === 'agachamento');
ok(agach.length === 2 && agach.every((r) => r.data === '2026-11-09'), 'ultima_vez: só a última sessão, sem séries vazias');
ok(uv.some((r) => r.exercicio_id === 'supino-reto'), 'ultima_vez: inclui outros exercícios');
const uvAntes = await rows(`select data::text from public.ultima_vez('2026-11-09') where exercicio_id='agachamento'`);
ok(uvAntes.length === 2 && uvAntes.every((r) => r.data === '2026-11-02'), 'ultima_vez: respeita a data escolhida');

// resumo_sessoes
const rs = await rows(`select data::text, treino_id, feitas::int, registradas::int from public.resumo_sessoes order by data desc`);
ok(rs.length === 3 && rs[0].treino_id === 'peito-costas-a', 'resumo: sessão mais recente primeiro');
ok(rs.find((r) => r.data === '2026-11-09').registradas === 2, 'resumo: série vazia não conta como registrada');

// Isolamento entre usuários
await db.exec(`reset role; insert into public.convites values ('pedro@gmail.com');`);
await como(U2, 'pedro@gmail.com');
ok((await rows('select * from public.series')).length === 0, 'outro usuário não vê minhas séries');
ok((await rows('select * from public.resumo_sessoes')).length === 0, 'outro usuário não vê meu resumo');
ok((await rows(`select * from public.ultima_vez('2026-12-01')`)).length === 0, 'outro usuário não vê minha última vez');
ok(!!(await erro(`insert into public.series (user_id,data,treino_id,exercicio_id,indice,reps) values ('${U1}','2026-11-11','pernas-a','agachamento',0,8)`)), 'não grava em nome de outro usuário');

// Perfil e medições
ok(!(await erro(`insert into public.perfis (sexo,nascimento,altura_cm,tipo_trabalho,objetivo) values ('M','2002-01-01',180,'bracal','ganhar')`)), 'perfil: grava com user_id padrão = auth.uid()');
ok(!!(await erro(`insert into public.perfis (user_id,sexo,nascimento,altura_cm,tipo_trabalho,objetivo) values ('${U1}','M','2002-01-01',180,'x','ganhar')`)), 'perfil: tipo de trabalho inválido é recusado');
ok(!(await erro(`insert into public.medicoes (data,peso) values ('2026-11-12', 80)`)), 'medição: grava');
ok(!(await erro(`delete from public.medicoes where data='2026-11-12'`)), 'medição: apaga');

await db.exec('reset role');
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
