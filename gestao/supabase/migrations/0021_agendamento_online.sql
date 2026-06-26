-- ============================================================
-- S8 — Agendamento online público
-- Migration 0021: solicitações de horário feitas pelo paciente (sem login),
-- que caem numa caixa de entrada do admin.
-- ============================================================

-- Liga/desliga o agendamento online por clínica.
alter table public.clinicas
  add column if not exists agendamento_online boolean not null default true;

create table if not exists public.solicitacoes_agendamento (
  id             bigint generated always as identity primary key,
  clinica_id     bigint references public.clinicas(id),
  nome           text not null,
  telefone       text not null,
  email          text,
  procedimento   text not null default '',
  data_preferida date,
  periodo        text not null default 'qualquer',   -- manha|tarde|qualquer
  obs            text not null default '',
  status         text not null default 'pendente',    -- pendente|aceita|recusada
  agendamento_id bigint references public.agendamentos(id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table public.solicitacoes_agendamento enable row level security;

-- Leitura/edição apenas para a equipe da clínica (RLS por tenant). A INSERÇÃO
-- pública NÃO usa RLS: é feita no servidor pelo admin client (service key),
-- que carimba o clinica_id explicitamente — por isso não há policy de insert.
drop policy if exists "solicitacoes_select" on public.solicitacoes_agendamento;
drop policy if exists "solicitacoes_update" on public.solicitacoes_agendamento;
drop policy if exists "solicitacoes_delete" on public.solicitacoes_agendamento;

create policy "solicitacoes_select" on public.solicitacoes_agendamento
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "solicitacoes_update" on public.solicitacoes_agendamento
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "solicitacoes_delete" on public.solicitacoes_agendamento
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_solicitacoes_clinica_status
  on public.solicitacoes_agendamento (clinica_id, status);
