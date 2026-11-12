-- Ajustes apontados pelo verificador de segurança do Supabase.

-- 1. Cada usuário pode ler só o próprio convite; assim tem_convite() não precisa
--    rodar com privilégios elevados.
create policy "ver o proprio convite" on public.convites
  for select to authenticated
  using (lower(trim(email)) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

create or replace function public.tem_convite()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.convites c
    where lower(trim(c.email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 2. search_path fixo no gatilho "mais recente vence".
alter function public.manter_mais_recente() set search_path = '';
