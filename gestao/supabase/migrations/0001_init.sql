-- ============================================================
-- Clínica LCR — Gestão Odontológica
-- Migration 0001: schema inicial + auth por papéis + RLS
-- Rode no SQL Editor do Supabase (ou via Supabase CLI).
-- ============================================================

-- ─── Extensões ────────────────────────────────────────────
-- (uuid/pgcrypto já vêm habilitadas em projetos Supabase)

-- ─── Papéis de usuário ────────────────────────────────────
do $$ begin
  create type public.papel as enum ('admin', 'dentista', 'secretaria');
exception when duplicate_object then null; end $$;

-- Perfil ligado a auth.users (1:1)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  papel      public.papel not null default 'secretaria',
  created_at timestamptz not null default now()
);

-- Cria automaticamente um profile quando um usuário é criado no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: papel do usuário logado (usado nas policies).
-- security definer p/ ler profiles sem recursão de RLS.
create or replace function public.papel_atual()
returns public.papel
language sql
stable
security definer set search_path = public
as $$
  select papel from public.profiles where id = auth.uid();
$$;

-- ─── Tabelas de domínio ───────────────────────────────────
create table if not exists public.pacientes (
  id                 bigint generated always as identity primary key,
  nome               text not null,
  nascimento         date,
  cpf                text,
  tel                text,
  plano              text default 'Particular',
  status             text not null default 'Ativo',
  sexo               text,
  estado_civil       text,
  rg                 text,
  orgao_emissor      text,
  email              text,
  contato_emergencia text,
  tel_emergencia     text,
  cep                text,
  endereco           text,
  numero             text,
  complemento        text,
  bairro             text,
  cidade             text,
  uf                 text,
  created_at         timestamptz not null default now()
);

create table if not exists public.procedimentos (
  id           bigint generated always as identity primary key,
  paciente_id  bigint references public.pacientes(id) on delete cascade,
  dente        text,
  procedimento text not null,
  custo        numeric(12,2) not null default 0,
  status       text not null default 'Pendente',
  obs          text,
  created_at   timestamptz not null default now()
);

create table if not exists public.anamneses (
  id            bigint generated always as identity primary key,
  paciente_id   bigint references public.pacientes(id) on delete cascade,
  paciente_nome text,
  respostas     jsonb not null default '{}'::jsonb,
  assinatura    text,            -- data-URL PNG (mover p/ Storage no futuro)
  data          date,
  status        text default 'Assinado',
  created_at    timestamptz not null default now()
);

create table if not exists public.transacoes_financeiras (
  id              bigint generated always as identity primary key,
  tipo            text not null,      -- 'receita' | 'despesa'
  descricao       text not null,
  valor           numeric(12,2) not null default 0,
  categoria       text,
  data            date not null default current_date,
  status          text not null default 'pago',  -- 'pago' | 'pendente'
  forma_pagamento text,
  created_at      timestamptz not null default now()
);

create table if not exists public.agendamentos (
  id          bigint generated always as identity primary key,
  paciente    text not null,
  paciente_id bigint references public.pacientes(id) on delete set null,
  proc        text,
  dia         int not null,      -- 0..6 (Seg..Dom)
  hora        int not null,
  min         int not null default 0,
  dur         int not null default 30,
  status      text not null default 'confirmado',
  obs         text,
  created_at  timestamptz not null default now()
);

create table if not exists public.itens_estoque (
  id         bigint generated always as identity primary key,
  nome       text not null,
  quantidade int not null default 0,
  minimo     int not null default 0,
  categoria  text,
  fornecedor text,
  unidade    text,
  obs        text,
  created_at timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────
alter table public.profiles               enable row level security;
alter table public.pacientes              enable row level security;
alter table public.procedimentos          enable row level security;
alter table public.anamneses              enable row level security;
alter table public.transacoes_financeiras enable row level security;
alter table public.agendamentos           enable row level security;
alter table public.itens_estoque          enable row level security;

-- profiles: cada um vê/edita o próprio; admin vê todos.
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (id = auth.uid() or public.papel_atual() = 'admin');
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- Tabelas operacionais/clínicas: qualquer autenticado lê/cria/edita;
-- DELETE só admin/dentista.
do $$
declare t text;
begin
  foreach t in array array['pacientes','procedimentos','anamneses','agendamentos','itens_estoque']
  loop
    execute format($f$
      create policy "%1$s_select" on public.%1$s
        for select to authenticated using (true);
      create policy "%1$s_insert" on public.%1$s
        for insert to authenticated with check (true);
      create policy "%1$s_update" on public.%1$s
        for update to authenticated using (true) with check (true);
      create policy "%1$s_delete" on public.%1$s
        for delete to authenticated
        using (public.papel_atual() in ('admin','dentista'));
    $f$, t);
  end loop;
end $$;

-- Financeiro: somente admin/dentista (secretária não acessa).
create policy "financeiro_all" on public.transacoes_financeiras
  for all to authenticated
  using (public.papel_atual() in ('admin','dentista'))
  with check (public.papel_atual() in ('admin','dentista'));
