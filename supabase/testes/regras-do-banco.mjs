// Roda as migrações num Postgres local (PGlite) com um "auth" falso, imitando o Supabase,
// e confere a migração da v1 para a v2, as regras de acesso de cada papel, o gatilho
// "mais recente vence" e as consultas do app.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const MIG = new URL('../migrations', import.meta.url).pathname;
const db = new PGlite();
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };

const ADMIN = '11111111-1111-1111-1111-111111111111';
const PERSONAL = '22222222-2222-2222-2222-222222222222';
const ALUNO = '33333333-3333-3333-3333-333333333333'; // tem personal
const SOLO = '44444444-4444-4444-4444-444444444444'; // aluno sem personal
const ESTRANHO = '55555555-5555-5555-5555-555555555555'; // sem convite
const EMAIL = {
  [ADMIN]: 'brenovambaster5@gmail.com',
  [PERSONAL]: 'personal@gmail.com',
  [ALUNO]: 'aluno@gmail.com',
  [SOLO]: 'solo@gmail.com',
  [ESTRANHO]: 'estranho@gmail.com',
};

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create role anon; create role authenticated;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
for (const [id, email] of Object.entries(EMAIL)) {
  await db.query(`insert into auth.users values ($1, $2, $3)`, [id, email, { full_name: `Nome ${email.split('@')[0]}` }]);
}

const migracoes = fs.readdirSync(MIG).sort();
const iV2 = migracoes.findIndex((f) => f.endsWith('_v2_fichas_e_papeis.sql'));
const aplicar = async (lista) => {
  for (const f of lista) {
    await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8'));
    console.log('migração aplicada:', f);
  }
};

const como = async (sub) => {
  await db.exec(`reset role`);
  const claims = { sub, email: EMAIL[sub], role: 'authenticated', user_metadata: { full_name: `Nome ${EMAIL[sub].split('@')[0]}` } };
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims)]);
  await db.exec(`set role authenticated`);
};
const raiz = async () => db.exec('reset role');
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
const um = async (sql, p = []) => (await rows(sql, p))[0];
const erro = async (sql, p = []) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };
const ficha = async (user = null) => (await um('select public.ficha_de($1) f', [user])).f;
const salvar = (id, treinos) => erro('select public.salvar_ficha($1, $2)', [id, JSON.stringify(treinos)]);
const rascunho = (f) =>
  f.treinos.map((t) => ({
    id: t.id, nome: t.nome, apelido: t.apelido, foco: t.foco, cardio: t.cardio,
    exercicios: t.exercicios.map((e) => ({ id: e.id, series: e.series, repsMin: e.repsMin, repsMax: e.repsMax, descansoSeg: e.descansoSeg })),
  }));

//------------------------------------------------------------------ v1 com dados de quem já usa
await aplicar(migracoes.slice(0, iV2));
await db.exec(`insert into public.convites (email) values (' BrenoVambaster5@Gmail.com ');`);
const up = (user, data, treino, ex, i, carga, reps, feita, quando) => db.query(
  `insert into public.series (user_id,data,treino_id,exercicio_id,indice,carga,reps,feita,alterado_em)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
   on conflict (user_id,data,treino_id,exercicio_id,indice) do update set
     carga=excluded.carga, reps=excluded.reps, feita=excluded.feita, alterado_em=excluded.alterado_em`,
  [user, data, treino, ex, i, carga, reps, feita, quando]);
await up(ADMIN, '2026-11-02', 'pernas-a', 'agachamento', 0, 60, 10, true, '2026-11-02T10:00:00Z');
await up(ADMIN, '2026-11-02', 'pernas-a', 'agachamento', 1, 60, 10, true, '2026-11-02T10:03:00Z');
await up(ADMIN, '2026-11-03', 'peito-costas-a', 'supino-reto', 0, 40, 10, true, '2026-11-03T10:00:00Z');
await db.exec(`
  insert into public.sessoes (user_id, data, treino_id, cardio_min) values ('${ADMIN}', '2026-11-02', 'pernas-a', 10);
  insert into public.perfis (user_id, sexo, nascimento, altura_cm, tipo_trabalho, objetivo) values ('${ADMIN}', 'M', '2002-01-01', 175, 'sentado', 'ganhar');
`);

//------------------------------------------------------------------ v2
await aplicar(migracoes.slice(iV2));

console.log('\n# Migração dos dados');
ok((await um(`select papel, user_id::text, nome from public.usuarios where email = 'brenovambaster5@gmail.com'`)).papel === 'admin', 'convite antigo vira o Admin (e-mail normalizado)');
ok((await um(`select user_id::text u from public.usuarios where email = 'brenovambaster5@gmail.com'`)).u === ADMIN, 'usuário ligado à conta de login pelo e-mail');
ok((await um(`select count(*)::int n from public.exercicios`)).n === 40, 'catálogo com os 40 exercícios');
ok((await um(`select count(*)::int n from public.exercicios where grupo is null`)).n === 0, 'todo exercício tem grupo');
ok((await um(`select count(*)::int n from public.treinos where ficha_id = 'padrao'`)).n === 6, 'Ficha padrão com 6 treinos');
ok((await um(`select count(*)::int n from public.treino_exercicios te join public.treinos t on t.id = te.treino_id where t.ficha_id = 'padrao'`)).n === 40, 'Ficha padrão com os 40 exercícios prescritos');
const fichaAdmin = (await um(`select id from public.fichas where user_id = '${ADMIN}'`))?.id;
ok(!!fichaAdmin, 'quem já usava ganhou a própria ficha');
const pernasAdmin = (await um(`select id from public.treinos where ficha_id = $1 and ordem = 1`, [fichaAdmin])).id;
ok((await um(`select count(*)::int n from public.series where treino_id = $1`, [pernasAdmin])).n === 2, 'séries antigas passaram para o treino da própria ficha');
ok((await um(`select count(*)::int n from public.series s join public.treinos t on t.id = s.treino_id where t.ficha_id = 'padrao'`)).n === 0, 'nenhuma série ficou apontando para a ficha padrão');
ok((await um(`select treino_id from public.sessoes where user_id = '${ADMIN}'`)).treino_id === pernasAdmin, 'cardio antigo também mudou de treino');

console.log('\n# Sem convite');
await como(ESTRANHO);
ok((await um('select public.meu_acesso() a')).a.convidado === false, 'meu_acesso: não convidado');
ok((await rows('select * from public.exercicios')).length === 0, 'não vê o catálogo');
ok(!!(await erro('select public.ficha_de()')), 'não abre ficha');
ok(!!(await erro(`insert into public.usuarios (email) values ('estranho@gmail.com')`)), 'não se convida');

console.log('\n# Admin convida e gerencia');
await como(ADMIN);
ok((await um('select public.meu_acesso() a')).a.papel === 'admin', 'meu_acesso: admin');
ok(!(await erro(`insert into public.usuarios (email, papel) values ('personal@gmail.com', 'personal')`)), 'convida um personal');
ok(!(await erro(`insert into public.usuarios (email, personal_email) values ('aluno@gmail.com', 'personal@gmail.com')`)), 'convida um aluno já com personal');
ok(!(await erro(`insert into public.usuarios (email) values ('solo@gmail.com'), ('errado@gmail.com')`)), 'convida aluno sem personal');
ok(!!(await erro(`insert into public.usuarios (email, papel) values ('outro@gmail.com', 'admin')`)), 'não existe outro admin');
ok(!!(await erro(`update public.usuarios set ativo = false where email = 'brenovambaster5@gmail.com'`)), 'admin não se desativa');
ok(!!(await erro(`update public.usuarios set papel = 'aluno' where email = 'brenovambaster5@gmail.com'`)), 'admin não perde o papel');
ok(!!(await erro(`update public.usuarios set personal_email = 'solo@gmail.com' where email = 'errado@gmail.com'`)), 'personal tem que ter o papel Personal');
ok(!(await erro(`delete from public.usuarios where email = 'errado@gmail.com'`)), 'cancela convite de quem não entrou');
ok((await um(`select count(*)::int n from public.usuarios where email = 'errado@gmail.com'`)).n === 0, 'convite cancelado some');

console.log('\n# Primeiro acesso de cada um');
for (const u of [PERSONAL, ALUNO, SOLO]) {
  await como(u);
  const a = (await um('select public.meu_acesso() a')).a;
  ok(a.convidado && a.ativo, `meu_acesso: ${EMAIL[u]} ativo (${a.papel})`);
}
await raiz();
ok((await um(`select count(*)::int n from public.usuarios where user_id is not null`)).n === 4, 'meu_acesso liga o usuário à conta de login');
ok((await um(`select nome from public.usuarios where email = 'aluno@gmail.com'`)).nome === 'Nome aluno', 'meu_acesso guarda o nome do Google');

await como(PERSONAL);
ok(!!(await erro(`insert into public.usuarios (email) values ('amigo@gmail.com')`)), 'personal não convida');
ok(!!(await erro(`update public.usuarios set ativo = false where email = 'aluno@gmail.com'`)) || (await um(`select ativo from public.usuarios where email = 'aluno@gmail.com'`)).ativo, 'personal não desativa aluno');
const vistosPersonal = (await rows(`select email from public.painel_usuarios order by email`)).map((r) => r.email);
ok(vistosPersonal.join() === 'aluno@gmail.com,personal@gmail.com', 'personal vê só os alunos dele (e a si mesmo)');

await como(SOLO);
ok((await rows(`select email from public.painel_usuarios`)).length === 1, 'aluno vê só a própria linha');

console.log('\n# Fichas');
await como(ALUNO);
let fAluno = await ficha();
ok(fAluno.treinos.length === 6 && fAluno.userId === ALUNO, 'no primeiro acesso, a ficha é uma cópia da padrão');
ok(fAluno.treinos[0].id !== 'pernas-a' && fAluno.treinos[0].exercicios.length === 7, 'cópia tem treinos próprios com os exercícios');
ok(fAluno.podeEditar === false, 'aluno com personal não edita a própria ficha');
ok(!!(await salvar(fAluno.id, rascunho(fAluno))), 'aluno com personal: salvar é recusado');
ok(!!(await erro(`select public.ficha_de('${SOLO}')`)), 'aluno não abre a ficha de outro');
ok((await um('select public.ficha_padrao() f')).f.treinos.length === 6, 'aluno vê a ficha padrão');
ok((await um('select public.ficha_padrao() f')).f.podeEditar === false, 'aluno não edita a ficha padrão');

await como(SOLO);
const fSolo = await ficha();
ok(fSolo.podeEditar === true, 'aluno sem personal edita a própria ficha');
const r = rascunho(fSolo);
r[0].exercicios = r[0].exercicios.filter((e) => e.id !== 'agachamento');
r[0].exercicios.push({ id: 'hip-thrust', series: 4, repsMin: 8, repsMax: 12, descansoSeg: 120 });
ok(!(await salvar(fSolo.id, r)), 'troca um exercício: remove o agachamento e adiciona o hip thrust');
const fSolo2 = await ficha();
ok(!fSolo2.treinos[0].exercicios.some((e) => e.id === 'agachamento') && fSolo2.treinos[0].exercicios.at(-1).id === 'hip-thrust', 'a troca ficou salva');
ok((await ficha(null)).id === fSolo.id && (await um(`select count(*)::int n from public.fichas where user_id = $1`, [SOLO])).n === 1, 'abrir de novo não duplica a ficha');
ok((await rows(`select id from public.fichas`)).length === 2, 'aluno só enxerga a própria ficha e a padrão');
ok(!!(await salvar(fSolo.id, [])), 'ficha sem treinos é recusada');
ok(!!(await salvar(fSolo.id, [{ ...r[0], exercicios: [] }])), 'treino sem exercícios é recusado');
ok(!!(await salvar(fSolo.id, Array.from({ length: 8 }, () => ({ ...r[0], id: null })))), 'mais de 7 treinos é recusado');
const dup = rascunho(fSolo2);
dup[1].exercicios.push({ ...dup[1].exercicios[0] });
ok(!!(await salvar(fSolo.id, dup)), 'exercício repetido no mesmo treino é recusado');

console.log('\n# Personal e a ficha dos alunos');
await como(PERSONAL);
fAluno = await ficha(ALUNO);
ok(fAluno.podeEditar === true, 'personal edita a ficha do aluno dele');
ok(!!(await erro(`select public.ficha_de('${SOLO}')`)), 'personal não abre ficha de quem não é aluno dele');
// Começa a ficha do aluno copiando da padrão: 3 treinos só
const padrao = (await um('select public.ficha_padrao() f')).f;
const abc = rascunho(padrao).slice(0, 3);
ok(!(await salvar(fAluno.id, abc)), 'personal monta a ficha copiando 3 treinos da padrão');
fAluno = await ficha(ALUNO);
ok(fAluno.treinos.length === 3 && !fAluno.treinos.some((t) => ['pernas-a', 'peito-costas-a'].includes(t.id)), 'cópia vira treinos novos, sem mexer na padrão');
ok(fAluno.arquivados.length === 0, 'treinos sem histórico que saíram foram apagados');
ok(!!(await salvar('padrao', rascunho(padrao))), 'personal não altera a ficha padrão');
ok(!(await erro(`insert into public.exercicios (nome, grupo, incremento) values ('Remada cavalinho', 'costas', 5)`)), 'personal cadastra exercício no catálogo');
ok(!!(await erro(`insert into public.exercicios (nome, grupo, incremento) values ('remada CAVALINHO ', 'costas', 5)`)), 'nome repetido no catálogo é recusado');
await erro(`update public.exercicios set nome = 'X' where nome = 'Remada cavalinho'`);
ok((await um(`select count(*)::int n from public.exercicios where nome = 'X'`)).n === 0, 'personal não corrige exercício do catálogo');

await como(ALUNO);
ok(!!(await erro(`insert into public.exercicios (nome, grupo, incremento) values ('Inventado', 'peito', 5)`)), 'aluno não cadastra exercício');
ok((await ficha()).treinos.length === 3, 'aluno vê a ficha montada pelo personal');

console.log('\n# Admin');
await como(ADMIN);
ok((await ficha(ALUNO)).podeEditar === true, 'admin edita a ficha de qualquer um');
ok((await um('select public.ficha_padrao() f')).f.podeEditar === true, 'admin edita a ficha padrão');
const fAdmin = await ficha();
ok(fAdmin.id === fichaAdmin && fAdmin.treinos[0].id === pernasAdmin, 'ficha do admin é a criada na migração');
// Tira o Pernas A (tem histórico) e o Ombros A (sem histórico)
const semPernas = rascunho(fAdmin).filter((t) => t.id !== pernasAdmin && t.nome !== 'Ombros e Braços A');
ok(!(await salvar(fAdmin.id, semPernas)), 'remove dois treinos da própria ficha');
const fAdmin2 = await ficha();
ok(fAdmin2.treinos.length === 4 && fAdmin2.treinos[0].ordem === 1, 'ficha fica com 4 treinos, reordenados');
ok(fAdmin2.arquivados.length === 1 && fAdmin2.arquivados[0].id === pernasAdmin, 'treino com histórico é arquivado, não apagado');
ok((await um(`select count(*)::int n from public.series where treino_id = $1`, [pernasAdmin])).n === 2, 'histórico do treino arquivado continua');
ok(!(await salvar(fAdmin.id, [{ ...rascunho(fAdmin).find((t) => t.id === pernasAdmin) }, ...rascunho(fAdmin2)])), 'treino arquivado volta para a ficha');
ok((await ficha()).arquivados.length === 0, 'voltou: não está mais arquivado');
ok(!(await erro(`update public.exercicios set dica = 'Dica nova' where nome = 'Remada cavalinho'`)), 'admin corrige exercício do catálogo');
ok(!!(await erro(`delete from public.exercicios where id = 'agachamento'`)), 'exercício em uso não é apagado');
ok(!(await erro(`delete from public.exercicios where nome = 'Remada cavalinho'`)), 'exercício sem uso é apagado');
ok((await rows(`select * from public.painel_usuarios`)).length === 4, 'admin vê todos os usuários');

console.log('\n# Séries, sugestão e resumo');
await como(ALUNO);
const tA = (await ficha()).treinos[0];
const upA = (data, ex, i, carga, reps, quando) => db.query(
  `insert into public.series (user_id,data,treino_id,exercicio_id,indice,carga,reps,feita,alterado_em)
   values ($1,$2,$3,$4,$5,$6,$7,true,$8)
   on conflict (user_id,data,treino_id,exercicio_id,indice) do update set
     carga=excluded.carga, reps=excluded.reps, feita=excluded.feita, alterado_em=excluded.alterado_em`,
  [ALUNO, data, tA.id, ex, i, carga, reps, quando]);
await upA('2026-11-02', 'agachamento', 0, 60, 10, '2026-11-02T10:00:00Z');
await upA('2026-11-09', 'agachamento', 0, 62.5, 8, '2026-11-09T10:00:00Z');
await upA('2026-11-09', 'agachamento', 1, 62.5, 7, '2026-11-09T10:03:00Z');
await upA('2026-11-09', 'agachamento', 1, 50, 5, '2026-11-09T09:00:00Z');
let s = await um(`select carga::float, reps from public.series where user_id = $1 and data='2026-11-09' and indice=1`, [ALUNO]);
ok(s.carga === 62.5 && s.reps === 7, 'alteração mais antiga que chega depois é ignorada');
const uv = await rows(`select exercicio_id, data::text from public.ultima_vez('2026-11-12')`);
ok(uv.length === 2 && uv.every((x) => x.data === '2026-11-09'), 'ultima_vez: só a última sessão');
ok((await rows(`select * from public.exercicios_feitos()`)).map((x) => x.exercicios_feitos).join() === 'agachamento', 'exercicios_feitos: o que já tem registro');
ok(!(await erro(`insert into public.medicoes (data, peso) values ('2026-11-12', 80)`)), 'medição: grava');
ok(!!(await erro(`insert into public.series (user_id,data,treino_id,exercicio_id,indice,reps) values ('${SOLO}','2026-11-11',$1,'agachamento',0,8)`, [tA.id])), 'não grava em nome de outro usuário');

console.log('\n# Quem vê os dados de quem');
await como(PERSONAL);
ok((await rows(`select * from public.series where user_id = $1`, [ALUNO])).length === 3, 'personal vê as séries do aluno dele');
ok((await rows(`select * from public.medicoes where user_id = $1`, [ALUNO])).length === 1, 'personal vê as medições do aluno dele');
ok((await rows(`select * from public.series where user_id = $1`, [ADMIN])).length === 0, 'personal não vê séries de quem não é aluno dele');
ok((await rows(`select * from public.resumo_sessoes where user_id = $1`, [ALUNO])).length === 2, 'personal vê o resumo das sessões do aluno');
ok(!!(await erro(`insert into public.medicoes (user_id, data, peso) values ($1, '2026-11-13', 81)`, [ALUNO])), 'personal não grava dados do aluno');
const painelP = await um(`select ultima_sessao::text, sessoes_4_semanas from public.painel_usuarios where email = 'aluno@gmail.com'`);
ok(painelP.ultima_sessao === '2026-11-09', 'painel: última sessão do aluno');

await como(SOLO);
ok((await rows(`select * from public.series`)).length === 0, 'aluno não vê séries dos outros');
ok((await rows(`select * from public.perfis`)).length === 0, 'aluno não vê perfis dos outros');

await como(ADMIN);
ok((await rows(`select distinct user_id from public.series`)).length === 2, 'admin vê as séries de todos');

console.log('\n# Desativar e mudar papel');
await como(ADMIN);
ok(!(await erro(`update public.usuarios set papel = 'aluno' where email = 'personal@gmail.com'`)), 'admin tira o papel de personal');
ok((await um(`select personal_email from public.usuarios where email = 'aluno@gmail.com'`)).personal_email === null, 'alunos dele ficam sem personal');
await como(ALUNO);
ok((await ficha()).podeEditar === true, 'sem personal, o aluno volta a editar a própria ficha');
await como(ADMIN);
ok(!(await erro(`update public.usuarios set ativo = false where email = 'aluno@gmail.com'`)), 'admin desativa um aluno');
await como(ALUNO);
const aInativo = (await um('select public.meu_acesso() a')).a;
ok(aInativo.convidado && aInativo.ativo === false, 'meu_acesso: inativo');
ok((await rows('select * from public.series')).length === 0, 'inativo não lê os próprios dados');
ok(!!(await erro('select public.ficha_de()')), 'inativo não abre a ficha');
await raiz();
ok((await um(`select count(*)::int n from public.series where user_id = $1`, [ALUNO])).n === 3, 'dados do inativo continuam guardados');

console.log('\n# Restaurar um backup');
await raiz();
let falhaRestauro = null;
try {
  // O backup carrega cada tabela num comando só (COPY), com as linhas em qualquer ordem.
  await db.exec(`insert into public.usuarios (email, papel, personal_email) values
    ('aluno2@gmail.com', 'aluno', 'personal2@gmail.com'),
    ('personal2@gmail.com', 'personal', null);`);
} catch (e) {
  falhaRestauro = e.message;
}
ok(!falhaRestauro, `aluno antes do personal no mesmo comando: a checagem espera o fim ${falhaRestauro ?? ''}`);

await raiz();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
