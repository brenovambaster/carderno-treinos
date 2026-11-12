-- Caderno de Treino: esquema inicial.
-- Termos seguem o CONTEXT.md (Rotina, Treino, Exercício, Sessão, Série, Medição, Perfil, Convite).

------------------------------------------------------------------------------
-- Convites
------------------------------------------------------------------------------
-- Só e-mails desta tabela acessam dados. Administração pelo painel do Supabase
-- (Table Editor ou SQL), sem políticas: a API não lê nem escreve aqui.
create table public.convites (
  email      text primary key,
  criado_em  timestamptz not null default now()
);
alter table public.convites enable row level security;

create or replace function public.tem_convite()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.convites c
    where lower(trim(c.email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function public.tem_convite() from public, anon;
grant execute on function public.tem_convite() to authenticated;

------------------------------------------------------------------------------
-- Rotina padrão (somente leitura pelo app)
------------------------------------------------------------------------------
create table public.rotinas (
  id    text primary key,
  nome  text not null
);

create table public.treinos (
  id         text primary key,
  rotina_id  text not null references public.rotinas (id),
  ordem      int  not null,
  nome       text not null,   -- "Pernas A"
  apelido    text not null,   -- rótulo curto para os botões do topo
  foco       text not null,
  cardio     text not null,
  unique (rotina_id, ordem)
);

create table public.exercicios (
  id            text primary key,
  treino_id     text not null references public.treinos (id),
  ordem         int  not null,
  nome          text not null,
  series        int  not null check (series between 1 and 10),
  reps_min      int  not null check (reps_min > 0),
  reps_max      int  not null check (reps_max >= reps_min),
  descanso      text not null,  -- texto exibido: "2–3 min"
  descanso_seg  int  not null check (descanso_seg > 0),
  incremento    numeric(5, 2) not null check (incremento >= 0), -- 0 = exercício com peso do corpo
  dica          text not null,
  unique (treino_id, ordem)
);

alter table public.rotinas    enable row level security;
alter table public.treinos    enable row level security;
alter table public.exercicios enable row level security;

create policy "convidados leem" on public.rotinas
  for select to authenticated using ((select public.tem_convite()));
create policy "convidados leem" on public.treinos
  for select to authenticated using ((select public.tem_convite()));
create policy "convidados leem" on public.exercicios
  for select to authenticated using ((select public.tem_convite()));

------------------------------------------------------------------------------
-- Perfil
------------------------------------------------------------------------------
create table public.perfis (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sexo           text not null check (sexo in ('M', 'F')),
  nascimento     date not null,
  altura_cm      numeric(4, 1) not null check (altura_cm between 100 and 250),
  tipo_trabalho  text not null check (tipo_trabalho in ('sentado', 'em_pe', 'bracal')),
  objetivo       text not null check (objetivo in ('perder', 'manter', 'ganhar')),
  meta_semanal   int  not null default 6 check (meta_semanal between 1 and 7),
  atualizado_em  timestamptz not null default now()
);

------------------------------------------------------------------------------
-- Execução: séries e dados da sessão
------------------------------------------------------------------------------
-- Uma Sessão existe a partir da primeira série registrada; esta tabela guarda
-- só o que é da sessão inteira (cardio).
create table public.sessoes (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data         date not null,
  treino_id    text not null references public.treinos (id),
  cardio_min   int check (cardio_min between 0 and 600),
  alterado_em  timestamptz not null default now(),
  primary key (user_id, data, treino_id)
);

create table public.series (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data          date not null,
  treino_id     text not null references public.treinos (id),
  exercicio_id  text not null references public.exercicios (id),
  indice        int  not null check (indice between 0 and 9),
  carga         numeric(6, 2) check (carga >= 0),
  reps          int check (reps between 0 and 999),
  feita         boolean not null default false,
  alterado_em   timestamptz not null default now(), -- hora em que foi digitada no aparelho
  primary key (user_id, data, treino_id, exercicio_id, indice)
);
create index series_por_exercicio on public.series (user_id, exercicio_id, data desc);
create index series_por_data on public.series (user_id, data desc);

-- "Vale o que foi digitado por último" (ADR 0002): uma atualização mais antiga
-- que a gravada é ignorada, mesmo que chegue depois ao servidor.
create or replace function public.manter_mais_recente()
returns trigger
language plpgsql
as $$
begin
  if new.alterado_em < old.alterado_em then
    return null;
  end if;
  return new;
end;
$$;

create trigger series_mais_recente before update on public.series
  for each row execute function public.manter_mais_recente();
create trigger sessoes_mais_recente before update on public.sessoes
  for each row execute function public.manter_mais_recente();

------------------------------------------------------------------------------
-- Medições
------------------------------------------------------------------------------
create table public.medicoes (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data           date not null,
  peso           numeric(5, 2) check (peso between 20 and 400),
  cintura        numeric(4, 1) check (cintura between 30 and 250),
  passos         int check (passos between 0 and 100000),
  atualizado_em  timestamptz not null default now(),
  primary key (user_id, data)
);

------------------------------------------------------------------------------
-- Acesso: cada usuário convidado vê e altera só os próprios dados
------------------------------------------------------------------------------
alter table public.perfis   enable row level security;
alter table public.sessoes  enable row level security;
alter table public.series   enable row level security;
alter table public.medicoes enable row level security;

create policy "dono convidado" on public.perfis for all to authenticated
  using      (user_id = (select auth.uid()) and (select public.tem_convite()))
  with check (user_id = (select auth.uid()) and (select public.tem_convite()));
create policy "dono convidado" on public.sessoes for all to authenticated
  using      (user_id = (select auth.uid()) and (select public.tem_convite()))
  with check (user_id = (select auth.uid()) and (select public.tem_convite()));
create policy "dono convidado" on public.series for all to authenticated
  using      (user_id = (select auth.uid()) and (select public.tem_convite()))
  with check (user_id = (select auth.uid()) and (select public.tem_convite()));
create policy "dono convidado" on public.medicoes for all to authenticated
  using      (user_id = (select auth.uid()) and (select public.tem_convite()))
  with check (user_id = (select auth.uid()) and (select public.tem_convite()));

------------------------------------------------------------------------------
-- Consultas usadas pelo app
------------------------------------------------------------------------------
-- Uma linha por sessão: quantas séries foram registradas e feitas.
create view public.resumo_sessoes
with (security_invoker = true)
as
select
  s.user_id,
  s.data,
  s.treino_id,
  count(*) filter (where s.feita)                       as feitas,
  count(*) filter (where s.feita or s.reps is not null) as registradas,
  max(s.alterado_em)                                    as alterado_em
from public.series s
group by s.user_id, s.data, s.treino_id;

-- Para cada exercício, as séries da última sessão anterior a p_data.
-- Base da Sugestão de carga.
create or replace function public.ultima_vez(p_data date)
returns table (exercicio_id text, data date, indice int, carga numeric, reps int)
language sql
stable
set search_path = ''
as $$
  with ultima as (
    select s.exercicio_id, max(s.data) as data
    from public.series s
    where s.user_id = (select auth.uid())
      and s.data < p_data
      and s.reps is not null
    group by s.exercicio_id
  )
  select s.exercicio_id, s.data, s.indice, s.carga, s.reps
  from public.series s
  join ultima u on u.exercicio_id = s.exercicio_id and u.data = s.data
  where s.user_id = (select auth.uid())
    and s.reps is not null
  order by s.exercicio_id, s.indice;
$$;
revoke execute on function public.ultima_vez(date) from public, anon;
grant execute on function public.ultima_vez(date) to authenticated;
