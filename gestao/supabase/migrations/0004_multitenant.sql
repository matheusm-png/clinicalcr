-- ============================================================
-- Multi-tenant (SaaS multi-clínica)
-- Migration 0004: clinica_id em todas as tabelas + isolamento por RLS
-- Estratégia: clinica_id DEFAULT public.clinica_atual() → inserts do app
-- não precisam enviar clinica_id; o banco preenche e a RLS isola.
-- ============================================================

-- 1. Tabela de clínicas (tenants)
create table if not exists public.clinicas (
  id         bigint generated always as identity primary key,
  nome       text not null,
  created_at timestamptz not null default now()
);
alter table public.clinicas enable row level security;

-- 2. profiles aponta para a clínica do usuário
alter table public.profiles add column if not exists clinica_id bigint references public.clinicas(id);

-- 3. Helper: clínica do usuário logado (usado nas policies e como default)
create or replace function public.clinica_atual()
returns bigint
language sql stable security definer set search_path = public
as $$ select clinica_id from public.profiles where id = auth.uid(); $$;

-- 4. clinica_id em todas as tabelas de domínio, com default = clinica_atual()
do $$
declare t text;
begin
  foreach t in array array[
    'pacientes','procedimentos','anamneses','transacoes_financeiras',
    'agendamentos','itens_estoque','procedimentos_catalogo','orcamentos','orcamento_itens'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists clinica_id bigint references public.clinicas(id) default public.clinica_atual()',
      t);
  end loop;
end $$;

-- 5. Cria a Clínica LCR e vincula todos os dados/perfis existentes (do seed)
do $$
declare cid bigint; t text;
begin
  select id into cid from public.clinicas where nome = 'Clínica LCR' limit 1;
  if cid is null then
    insert into public.clinicas (nome) values ('Clínica LCR') returning id into cid;
  end if;

  update public.profiles set clinica_id = cid where clinica_id is null;

  foreach t in array array[
    'pacientes','procedimentos','anamneses','transacoes_financeiras',
    'agendamentos','itens_estoque','procedimentos_catalogo','orcamentos','orcamento_itens'
  ]
  loop
    execute format('update public.%I set clinica_id = %L where clinica_id is null', t, cid);
  end loop;
end $$;

-- 6. RLS: isolar por clínica.
-- Tabelas operacionais: qualquer usuário autenticado DA CLÍNICA lê/cria/edita;
-- DELETE só admin/dentista (da clínica).
do $$
declare t text;
begin
  foreach t in array array[
    'pacientes','procedimentos','anamneses',
    'agendamentos','itens_estoque','procedimentos_catalogo','orcamentos','orcamento_itens'
  ]
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_select" on public.%1$s
        for select to authenticated using (clinica_id = public.clinica_atual());
      create policy "%1$s_insert" on public.%1$s
        for insert to authenticated with check (clinica_id = public.clinica_atual());
      create policy "%1$s_update" on public.%1$s
        for update to authenticated
        using (clinica_id = public.clinica_atual())
        with check (clinica_id = public.clinica_atual());
      create policy "%1$s_delete" on public.%1$s
        for delete to authenticated
        using (clinica_id = public.clinica_atual() and public.papel_atual() in ('admin','dentista'));
    $f$, t);
  end loop;
end $$;

-- Financeiro: só admin/dentista E da mesma clínica.
drop policy if exists "financeiro_all" on public.transacoes_financeiras;
create policy "financeiro_all" on public.transacoes_financeiras
  for all to authenticated
  using (clinica_id = public.clinica_atual() and public.papel_atual() in ('admin','dentista'))
  with check (clinica_id = public.clinica_atual() and public.papel_atual() in ('admin','dentista'));

-- profiles: vê o próprio; admin vê os da própria clínica.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (
    id = auth.uid()
    or (public.papel_atual() = 'admin' and clinica_id = public.clinica_atual())
  );

-- clinicas: o usuário vê a própria clínica.
drop policy if exists "clinicas_select" on public.clinicas;
create policy "clinicas_select" on public.clinicas
  for select to authenticated using (id = public.clinica_atual());
