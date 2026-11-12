-- Caderno de Treino v2: fichas por usuário, catálogo de exercícios e papéis (Admin, Personal, Aluno).
-- Termos seguem o CONTEXT.md: Ficha de treino, Ficha padrão, Treino, Exercício, Grupo, Usuário, Papel.
--
-- O que muda:
--   convites            -> usuarios (papel, ativo, personal, nome, último acesso)
--   rotinas             -> fichas (uma por usuário; a de id 'padrao' é a Ficha padrão)
--   exercicios          -> catálogo (nome, grupo, incremento, dica)
--   treino_exercicios   -> novo: o exercício como prescrito num treino (séries, faixa, descanso, ordem)
-- Dados de quem já usa o app passam para a própria ficha (cópia da padrão).

------------------------------------------------------------------------------
-- Funções de apoio fora da API
------------------------------------------------------------------------------
-- O schema privado não é exposto pela API do Supabase. As funções daqui são
-- usadas pelas regras de acesso; as que leem public.usuarios rodam como dono
-- (security definer) para a regra de acesso não consultar a si mesma.
create schema privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

create function privado.meu_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

------------------------------------------------------------------------------
-- Usuários (antes: convites)
------------------------------------------------------------------------------
alter table public.convites rename to usuarios;
drop policy "ver o proprio convite" on public.usuarios;
alter table public.usuarios rename column criado_em to convidado_em;
update public.usuarios set email = lower(trim(email));

alter table public.usuarios
  add column user_id uuid unique references auth.users (id) on delete set null,
  add column nome text,
  add column papel text not null default 'aluno',
  add column ativo boolean not null default true,
  add column personal_email text references public.usuarios (email) on update cascade on delete set null,
  add column ultimo_acesso timestamptz;

-- O Admin é só um, fixo pelo e-mail (ADR 0003).
insert into public.usuarios (email, papel) values ('brenovambaster5@gmail.com', 'admin')
  on conflict (email) do update set papel = 'admin';

alter table public.usuarios
  add constraint usuarios_email_minusculo check (email = lower(trim(email))),
  add constraint usuarios_papel check (papel in ('aluno', 'personal', 'admin')),
  add constraint usuarios_admin_fixo check ((papel = 'admin') = (email = 'brenovambaster5@gmail.com')),
  add constraint usuarios_admin_ativo check (papel <> 'admin' or ativo),
  add constraint usuarios_personal_de_aluno check (personal_email is null or (papel = 'aluno' and personal_email <> email));

-- Quem já entrou no app ganha o vínculo com a conta de login.
update public.usuarios u
set user_id = a.id,
    nome = coalesce(a.raw_user_meta_data ->> 'full_name', a.raw_user_meta_data ->> 'name')
from auth.users a
where lower(a.email) = u.email;

-- Papel e situação de quem está logado. Lê usuarios sem passar pelas regras de acesso.
create function privado.meu_papel()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.papel from public.usuarios u where u.email = privado.meu_email() and u.ativo;
$$;

create function privado.eh_ativo()
returns boolean
language sql
stable
set search_path = ''
as $$
  select privado.meu_papel() is not null;
$$;

create function privado.eh_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(privado.meu_papel() = 'admin', false);
$$;

create function privado.eh_personal()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(privado.meu_papel() = 'personal', false);
$$;

-- Quem está logado é o personal de p_user?
create function privado.eh_personal_de(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.eh_personal() and exists (
    select 1 from public.usuarios u
    where u.user_id = p_user and u.personal_email = privado.meu_email()
  );
$$;

-- Pode ver os dados (perfil, séries, medições, ficha) de p_user?
create function privado.pode_ver(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select privado.eh_ativo()
     and (p_user = auth.uid() or privado.eh_admin() or privado.eh_personal_de(p_user));
$$;

create function privado.tem_personal(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.usuarios u where u.user_id = p_user and u.personal_email is not null);
$$;

-- Personal só para aluno; quem deixa de ser aluno perde o personal.
create function privado.normalizar_usuario()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.papel <> 'aluno' then
    new.personal_email := null;
  end if;
  return new;
end;
$$;

create trigger usuarios_normalizar before insert or update of papel, personal_email on public.usuarios
  for each row execute function privado.normalizar_usuario();

-- O personal escolhido tem que ter o papel Personal. Conferido no fim do comando
-- (adiado), para um backup restaurar alunos e personais em qualquer ordem.
create function privado.conferir_personal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.personal_email is not null and not exists (
    select 1 from public.usuarios p where p.email = new.personal_email and p.papel = 'personal'
  ) then
    raise exception 'O e-mail escolhido como personal não tem o papel Personal.' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger usuarios_conferir_personal after insert or update of papel, personal_email on public.usuarios
  deferrable initially deferred
  for each row execute function privado.conferir_personal();

-- Quem deixa de ser personal deixa os alunos sem personal.
create function privado.soltar_alunos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.papel = 'personal' and new.papel <> 'personal' then
    update public.usuarios set personal_email = null where personal_email = new.email;
  end if;
  return null;
end;
$$;

create trigger usuarios_soltar_alunos after update of papel on public.usuarios
  for each row execute function privado.soltar_alunos();

-- Regras de acesso a usuarios: cada um vê a própria linha; o personal vê os alunos
-- dele; o admin vê e altera todos. Excluir de vez é só pelo painel do Supabase;
-- pelo app, o admin só cancela convite de quem ainda não entrou.
create policy "ver usuarios" on public.usuarios for select to authenticated
  using (
    email = (select privado.meu_email())
    or (select privado.eh_admin())
    or ((select privado.eh_personal()) and personal_email = (select privado.meu_email()))
  );
create policy "admin convida" on public.usuarios for insert to authenticated
  with check ((select privado.eh_admin()));
create policy "admin altera" on public.usuarios for update to authenticated
  using ((select privado.eh_admin()))
  with check ((select privado.eh_admin()));
create policy "admin cancela convite" on public.usuarios for delete to authenticated
  using ((select privado.eh_admin()) and user_id is null and papel <> 'admin');
grant select, insert, update, delete on public.usuarios to authenticated;

-- As regras antigas usam tem_convite(); agora ela quer dizer "usuário ativo".
create or replace function public.tem_convite()
returns boolean
language sql
stable
set search_path = ''
as $$
  select privado.eh_ativo();
$$;

-- Chamada ao abrir o app: registra o acesso e devolve papel e situação.
create function privado.registrar_acesso()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.usuarios;
begin
  select * into v from public.usuarios where email = privado.meu_email();
  if not found or auth.uid() is null then
    return jsonb_build_object('convidado', false, 'ativo', false);
  end if;
  if v.ativo then
    update public.usuarios
    set user_id = auth.uid(),
        nome = coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''), nome),
        ultimo_acesso = now()
    where email = v.email;
  end if;
  return jsonb_build_object('convidado', true, 'ativo', v.ativo, 'papel', v.papel, 'personal', v.personal_email);
end;
$$;

create function public.meu_acesso()
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select privado.registrar_acesso();
$$;

------------------------------------------------------------------------------
-- Grupos
------------------------------------------------------------------------------
-- Lista fixa: muda só por migração.
create table public.grupos (
  id     text primary key,
  nome   text not null,
  ordem  int  not null unique
);
insert into public.grupos (id, nome, ordem) values
  ('peito', 'Peito', 1),
  ('costas', 'Costas', 2),
  ('ombros', 'Ombros', 3),
  ('biceps', 'Bíceps', 4),
  ('triceps', 'Tríceps', 5),
  ('quadriceps', 'Quadríceps', 6),
  ('posterior', 'Posterior de coxa', 7),
  ('gluteo', 'Glúteo', 8),
  ('panturrilha', 'Panturrilha', 9),
  ('abdomen', 'Abdômen', 10);

------------------------------------------------------------------------------
-- Exercício do treino: a prescrição sai do catálogo
------------------------------------------------------------------------------
create table public.treino_exercicios (
  treino_id     text not null references public.treinos (id) on delete cascade,
  exercicio_id  text not null references public.exercicios (id),
  ordem         int  not null,
  series        int  not null check (series between 1 and 10),
  reps_min      int  not null check (reps_min between 1 and 100),
  reps_max      int  not null check (reps_max >= reps_min and reps_max <= 100),
  descanso_seg  int  not null check (descanso_seg between 15 and 600),
  primary key (treino_id, exercicio_id)
);
create index treino_exercicios_por_exercicio on public.treino_exercicios (exercicio_id);

insert into public.treino_exercicios (treino_id, exercicio_id, ordem, series, reps_min, reps_max, descanso_seg)
select treino_id, id, ordem, series, reps_min, reps_max, descanso_seg from public.exercicios;

------------------------------------------------------------------------------
-- Catálogo de exercícios
------------------------------------------------------------------------------
drop policy "convidados leem" on public.exercicios;
alter table public.exercicios
  drop column treino_id,
  drop column ordem,
  drop column series,
  drop column reps_min,
  drop column reps_max,
  drop column descanso,
  drop column descanso_seg,
  add column grupo text references public.grupos (id),
  add column criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  add column criado_em timestamptz not null default now();
alter table public.exercicios
  alter column id set default gen_random_uuid()::text,
  alter column dica set default '';

update public.exercicios e set grupo = g.grupo
from (values
  ('agachamento', 'quadriceps'), ('legpress', 'quadriceps'), ('bulgaro', 'quadriceps'), ('extensora', 'quadriceps'),
  ('flexora-sentada', 'posterior'), ('flexora-deitada', 'posterior'), ('stiff', 'posterior'),
  ('hip-thrust', 'gluteo'), ('legpress-alto', 'gluteo'), ('abdutora', 'gluteo'),
  ('panturrilha-pe', 'panturrilha'), ('panturrilha-sentado', 'panturrilha'),
  ('abd-polia', 'abdomen'), ('elev-pernas', 'abdomen'),
  ('supino-reto', 'peito'), ('supino-incl-halter', 'peito'), ('peck-deck', 'peito'),
  ('supino-incl-barra', 'peito'), ('supino-reto-halter', 'peito'), ('crossover', 'peito'),
  ('puxada', 'costas'), ('remada-curvada', 'costas'), ('remada-baixa', 'costas'),
  ('barra-fixa', 'costas'), ('serrote', 'costas'), ('remada-maquina', 'costas'),
  ('desenv-halter', 'ombros'), ('elev-lateral', 'ombros'), ('face-pull', 'ombros'),
  ('desenv-maquina', 'ombros'), ('elev-lateral-polia', 'ombros'), ('crucifixo-inverso', 'ombros'),
  ('rosca-direta', 'biceps'), ('rosca-martelo', 'biceps'), ('rosca-inclinada', 'biceps'), ('rosca-scott', 'biceps'),
  ('triceps-testa', 'triceps'), ('triceps-corda', 'triceps'), ('mergulho', 'triceps'), ('triceps-frances', 'triceps')
) as g (id, grupo)
where e.id = g.id;
update public.exercicios set grupo = 'peito' where grupo is null; -- não deve acontecer; evita travar a migração

alter table public.exercicios
  alter column grupo set not null,
  add constraint exercicios_nome check (length(trim(nome)) between 2 and 80),
  add constraint exercicios_incremento_max check (incremento <= 50);
create unique index exercicios_nome_unico on public.exercicios (lower(trim(nome)));

------------------------------------------------------------------------------
-- Fichas (antes: rotinas) e treinos
------------------------------------------------------------------------------
drop policy "convidados leem" on public.rotinas;
drop policy "convidados leem" on public.treinos;
alter table public.rotinas rename to fichas;
alter table public.fichas
  add column user_id uuid unique references auth.users (id) on delete cascade,
  add column atualizado_em timestamptz not null default now();
alter table public.fichas alter column id set default gen_random_uuid()::text;
update public.fichas set nome = 'Ficha padrão' where id = 'padrao';
alter table public.fichas add constraint fichas_dono check ((id = 'padrao') = (user_id is null));

alter table public.treinos rename column rotina_id to ficha_id;
alter table public.treinos drop constraint treinos_rotina_id_ordem_key;
alter table public.treinos drop constraint treinos_rotina_id_fkey;
alter table public.treinos
  add constraint treinos_ficha_id_fkey foreign key (ficha_id) references public.fichas (id) on delete cascade,
  add column arquivado_em timestamptz, -- saiu da ficha mas tem histórico
  alter column id set default gen_random_uuid()::text,
  alter column foco set default '',
  alter column cardio set default '',
  add constraint treinos_nome check (length(trim(nome)) between 1 and 40),
  add constraint treinos_apelido check (length(trim(apelido)) between 1 and 14);
create index treinos_por_ficha on public.treinos (ficha_id, ordem);

create function privado.ficha_do_treino(p_treino text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.ficha_id from public.treinos t where t.id = p_treino;
$$;

-- A Ficha padrão todo usuário ativo vê; a de um usuário, quem pode ver os dados dele.
create function privado.pode_ver_ficha(p_ficha text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.eh_ativo() and exists (
    select 1 from public.fichas f
    where f.id = p_ficha and (f.user_id is null or privado.pode_ver(f.user_id))
  );
$$;

-- Admin altera qualquer ficha (inclusive a padrão); personal, a dos alunos dele;
-- o próprio usuário, a sua, se não tiver personal.
create function privado.pode_editar_ficha(p_ficha text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.eh_ativo() and exists (
    select 1 from public.fichas f
    where f.id = p_ficha and (
      privado.eh_admin()
      or (f.user_id = auth.uid() and (privado.eh_personal() or not privado.tem_personal(auth.uid())))
      or (f.user_id is not null and privado.eh_personal_de(f.user_id))
    )
  );
$$;

create policy "ver ficha" on public.fichas for select to authenticated
  using (privado.pode_ver_ficha(id));
create policy "alterar ficha" on public.fichas for update to authenticated
  using (privado.pode_editar_ficha(id)) with check (privado.pode_editar_ficha(id));

create policy "ver treinos" on public.treinos for select to authenticated
  using (privado.pode_ver_ficha(ficha_id));
create policy "incluir treinos" on public.treinos for insert to authenticated
  with check (privado.pode_editar_ficha(ficha_id));
create policy "alterar treinos" on public.treinos for update to authenticated
  using (privado.pode_editar_ficha(ficha_id)) with check (privado.pode_editar_ficha(ficha_id));
create policy "apagar treinos" on public.treinos for delete to authenticated
  using (privado.pode_editar_ficha(ficha_id));

alter table public.treino_exercicios enable row level security;
create policy "ver exercicios do treino" on public.treino_exercicios for select to authenticated
  using (privado.pode_ver_ficha(privado.ficha_do_treino(treino_id)));
create policy "incluir exercicios do treino" on public.treino_exercicios for insert to authenticated
  with check (privado.pode_editar_ficha(privado.ficha_do_treino(treino_id)));
create policy "alterar exercicios do treino" on public.treino_exercicios for update to authenticated
  using (privado.pode_editar_ficha(privado.ficha_do_treino(treino_id)))
  with check (privado.pode_editar_ficha(privado.ficha_do_treino(treino_id)));
create policy "apagar exercicios do treino" on public.treino_exercicios for delete to authenticated
  using (privado.pode_editar_ficha(privado.ficha_do_treino(treino_id)));

alter table public.grupos enable row level security;
create policy "ativos leem" on public.grupos for select to authenticated using ((select privado.eh_ativo()));

-- Catálogo: todos os ativos leem; admin e personal cadastram; só o admin corrige ou apaga.
create policy "ativos leem" on public.exercicios for select to authenticated
  using ((select privado.eh_ativo()));
create policy "admin e personal cadastram" on public.exercicios for insert to authenticated
  with check ((select privado.eh_admin()) or (select privado.eh_personal()));
create policy "admin altera" on public.exercicios for update to authenticated
  using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "admin apaga" on public.exercicios for delete to authenticated
  using ((select privado.eh_admin()));

grant select on public.grupos to authenticated;
grant select, insert, update, delete on public.exercicios, public.treinos, public.treino_exercicios to authenticated;
grant select, update on public.fichas to authenticated;

------------------------------------------------------------------------------
-- Ficha de cada usuário: cópia da padrão no primeiro acesso
------------------------------------------------------------------------------
create function privado.copiar_padrao(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ficha text;
  v_treino public.treinos;
  v_novo text;
begin
  select id into v_ficha from public.fichas where user_id = p_user;
  if v_ficha is not null then
    return v_ficha;
  end if;
  insert into public.fichas (nome, user_id) values ('Ficha de treino', p_user) returning id into v_ficha;
  for v_treino in
    select * from public.treinos where ficha_id = 'padrao' and arquivado_em is null order by ordem
  loop
    insert into public.treinos (ficha_id, ordem, nome, apelido, foco, cardio)
    values (v_ficha, v_treino.ordem, v_treino.nome, v_treino.apelido, v_treino.foco, v_treino.cardio)
    returning id into v_novo;
    insert into public.treino_exercicios (treino_id, exercicio_id, ordem, series, reps_min, reps_max, descanso_seg)
    select v_novo, exercicio_id, ordem, series, reps_min, reps_max, descanso_seg
    from public.treino_exercicios where treino_id = v_treino.id;
  end loop;
  return v_ficha;
end;
$$;

create function privado.garantir_ficha(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or not privado.pode_ver(p_user) then
    raise exception 'Sem permissão para ver esta ficha.' using errcode = '42501';
  end if;
  return privado.copiar_padrao(p_user);
end;
$$;

-- A ficha em JSON, do jeito que o app usa. Roda com as regras de acesso de quem chama.
create function privado.ficha_json(p_ficha text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', f.id,
    'userId', f.user_id,
    'podeEditar', privado.pode_editar_ficha(f.id),
    'treinos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'ordem', t.ordem, 'nome', t.nome, 'apelido', t.apelido, 'foco', t.foco, 'cardio', t.cardio,
        'exercicios', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'nome', e.nome, 'grupo', e.grupo, 'incremento', e.incremento, 'dica', e.dica,
            'ordem', te.ordem, 'series', te.series, 'repsMin', te.reps_min, 'repsMax', te.reps_max,
            'descansoSeg', te.descanso_seg
          ) order by te.ordem)
          from public.treino_exercicios te
          join public.exercicios e on e.id = te.exercicio_id
          where te.treino_id = t.id
        ), '[]'::jsonb)
      ) order by t.ordem)
      from public.treinos t
      where t.ficha_id = f.id and t.arquivado_em is null
    ), '[]'::jsonb),
    'arquivados', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'apelido', t.apelido) order by t.arquivado_em desc)
      from public.treinos t
      where t.ficha_id = f.id and t.arquivado_em is not null
    ), '[]'::jsonb)
  )
  from public.fichas f
  where f.id = p_ficha;
$$;

-- Ficha de um usuário (a própria, se p_user for nulo). Cria a cópia da padrão se ainda não existe.
create function public.ficha_de(p_user uuid default null)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_ficha text;
begin
  -- Em dois comandos: a leitura (stable) só enxerga a cópia recém-criada no comando seguinte.
  v_ficha := privado.garantir_ficha(coalesce(p_user, auth.uid()));
  return privado.ficha_json(v_ficha);
end;
$$;

create function public.ficha_padrao()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select privado.ficha_json('padrao');
$$;

-- Grava a ficha inteira de uma vez. p_treinos: lista em ordem, cada um com
-- id (nulo para treino novo), nome, apelido, foco, cardio e exercicios
-- (lista em ordem de {id, series, repsMin, repsMax, descansoSeg}).
-- Treino que sai da ficha é apagado se nunca foi feito; se tem histórico, é arquivado.
create function public.salvar_ficha(p_ficha text, p_treinos jsonb)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_t jsonb;
  v_e jsonb;
  v_i int := 0;
  v_j int;
  v_id text;
  v_ids text[] := '{}';
begin
  if not privado.pode_editar_ficha(p_ficha) then
    raise exception 'Sem permissão para alterar esta ficha.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_treinos) is distinct from 'array' or jsonb_array_length(p_treinos) not between 1 and 7 then
    raise exception 'A ficha precisa ter de 1 a 7 treinos.' using errcode = '22023';
  end if;

  for v_t in select value from jsonb_array_elements(p_treinos) loop
    v_i := v_i + 1;
    if jsonb_typeof(v_t -> 'exercicios') is distinct from 'array' or jsonb_array_length(v_t -> 'exercicios') = 0 then
      raise exception 'O treino "%" ficou sem exercícios.', v_t ->> 'nome' using errcode = '22023';
    end if;

    v_id := nullif(v_t ->> 'id', '');
    if v_id is not null and not exists (select 1 from public.treinos where id = v_id and ficha_id = p_ficha) then
      v_id := null; -- id de outra ficha (cópia): vira treino novo
    end if;
    if v_id is null then
      insert into public.treinos (ficha_id, ordem, nome, apelido, foco, cardio)
      values (p_ficha, v_i, trim(v_t ->> 'nome'), trim(v_t ->> 'apelido'),
              coalesce(trim(v_t ->> 'foco'), ''), coalesce(trim(v_t ->> 'cardio'), ''))
      returning id into v_id;
    else
      update public.treinos
      set ordem = v_i, nome = trim(v_t ->> 'nome'), apelido = trim(v_t ->> 'apelido'),
          foco = coalesce(trim(v_t ->> 'foco'), ''), cardio = coalesce(trim(v_t ->> 'cardio'), ''),
          arquivado_em = null
      where id = v_id;
    end if;
    v_ids := v_ids || v_id;

    delete from public.treino_exercicios where treino_id = v_id;
    v_j := 0;
    for v_e in select value from jsonb_array_elements(v_t -> 'exercicios') loop
      v_j := v_j + 1;
      insert into public.treino_exercicios (treino_id, exercicio_id, ordem, series, reps_min, reps_max, descanso_seg)
      values (v_id, v_e ->> 'id', v_j, (v_e ->> 'series')::int, (v_e ->> 'repsMin')::int,
              (v_e ->> 'repsMax')::int, (v_e ->> 'descansoSeg')::int);
    end loop;
  end loop;

  delete from public.treinos t
  where t.ficha_id = p_ficha and not (t.id = any (v_ids))
    and not exists (select 1 from public.series s where s.treino_id = t.id)
    and not exists (select 1 from public.sessoes c where c.treino_id = t.id);
  update public.treinos set arquivado_em = now()
  where ficha_id = p_ficha and not (id = any (v_ids)) and arquivado_em is null;
  update public.fichas set atualizado_em = now() where id = p_ficha;
end;
$$;

------------------------------------------------------------------------------
-- Admin e personal leem os dados de quem acompanham (escrever continua só o dono)
------------------------------------------------------------------------------
create policy "admin e personal leem" on public.perfis for select to authenticated
  using ((select privado.eh_ativo()) and (user_id = (select auth.uid()) or (select privado.eh_admin()) or privado.eh_personal_de(user_id)));
create policy "admin e personal leem" on public.sessoes for select to authenticated
  using ((select privado.eh_ativo()) and (user_id = (select auth.uid()) or (select privado.eh_admin()) or privado.eh_personal_de(user_id)));
create policy "admin e personal leem" on public.series for select to authenticated
  using ((select privado.eh_ativo()) and (user_id = (select auth.uid()) or (select privado.eh_admin()) or privado.eh_personal_de(user_id)));
create policy "admin e personal leem" on public.medicoes for select to authenticated
  using ((select privado.eh_ativo()) and (user_id = (select auth.uid()) or (select privado.eh_admin()) or privado.eh_personal_de(user_id)));

-- Exercícios com algum registro, para a Evolução listar também os que saíram da ficha.
create function public.exercicios_feitos(p_user uuid default null)
returns setof text
language sql
stable
set search_path = ''
as $$
  select distinct s.exercicio_id
  from public.series s
  where s.user_id = coalesce(p_user, auth.uid()) and s.reps is not null;
$$;

-- Lista de usuários para o admin (todos) e o personal (os alunos dele).
create view public.painel_usuarios
with (security_invoker = true)
as
select
  u.email,
  u.user_id,
  u.nome,
  u.papel,
  u.ativo,
  u.personal_email,
  u.convidado_em,
  u.ultimo_acesso,
  p.meta_semanal,
  r.ultima_sessao,
  coalesce(r.sessoes_4_semanas, 0)::int as sessoes_4_semanas
from public.usuarios u
left join public.perfis p on p.user_id = u.user_id
left join lateral (
  select
    max(s.data) as ultima_sessao,
    count(distinct s.data::text || '|' || s.treino_id) filter (where s.data > current_date - 28) as sessoes_4_semanas
  from public.series s
  where s.user_id = u.user_id and (s.feita or s.reps is not null)
) r on true;
grant select on public.painel_usuarios to authenticated;

------------------------------------------------------------------------------
-- Permissões das funções
------------------------------------------------------------------------------
revoke all on all functions in schema privado from public;
grant execute on all functions in schema privado to authenticated;

revoke execute on function public.meu_acesso() from public, anon;
revoke execute on function public.ficha_de(uuid) from public, anon;
revoke execute on function public.ficha_padrao() from public, anon;
revoke execute on function public.salvar_ficha(text, jsonb) from public, anon;
revoke execute on function public.exercicios_feitos(uuid) from public, anon;
revoke execute on function public.tem_convite() from public, anon;
grant execute on function public.meu_acesso() to authenticated;
grant execute on function public.ficha_de(uuid) to authenticated;
grant execute on function public.ficha_padrao() to authenticated;
grant execute on function public.salvar_ficha(text, jsonb) to authenticated;
grant execute on function public.exercicios_feitos(uuid) to authenticated;
grant execute on function public.tem_convite() to authenticated;

------------------------------------------------------------------------------
-- Quem já usa o app: ficha própria e histórico movido para ela
------------------------------------------------------------------------------
do $$
declare
  v_user uuid;
begin
  for v_user in
    select user_id from public.series
    union select user_id from public.sessoes
    union select user_id from public.usuarios where user_id is not null
  loop
    perform privado.copiar_padrao(v_user);
  end loop;
end;
$$;

-- Os treinos copiados mantêm a ordem dos da padrão: é por ela que o histórico é ligado.
update public.series s
set treino_id = t.id
from public.treinos p, public.fichas f, public.treinos t
where s.treino_id = p.id and p.ficha_id = 'padrao'
  and f.user_id = s.user_id and t.ficha_id = f.id and t.ordem = p.ordem;

update public.sessoes s
set treino_id = t.id
from public.treinos p, public.fichas f, public.treinos t
where s.treino_id = p.id and p.ficha_id = 'padrao'
  and f.user_id = s.user_id and t.ficha_id = f.id and t.ordem = p.ordem;
