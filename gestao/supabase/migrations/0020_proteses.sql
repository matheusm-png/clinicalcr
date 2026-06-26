-- ============================================================
-- C5 — Controle protético
-- Migration 0020: acompanhamento de próteses (kanban solicitada→laboratório→
-- retornou→instalada), por clínica.
-- ============================================================

create table if not exists public.proteses (
  id              bigint generated always as identity primary key,
  clinica_id      bigint references public.clinicas(id) default public.clinica_atual(),
  paciente_id     bigint references public.pacientes(id) on delete cascade,
  tipo            text not null,                         -- coroa, PPR, prótese total, faceta…
  dente           text not null default '',              -- elemento(s) dentário(s)
  laboratorio     text not null default '',              -- nome do laboratório
  cor             text not null default '',              -- cor/escala (ex.: A2)
  material        text not null default '',              -- zircônia, metalocerâmica…
  valor           numeric(10,2) not null default 0,      -- custo do laboratório
  status          text not null default 'solicitada',    -- solicitada|laboratorio|retornou|instalada
  enviado_em      date,                                  -- data de envio ao laboratório
  previsao_retorno date,                                 -- previsão de retorno
  instalado_em    date,                                  -- data de instalação
  obs             text not null default '',
  created_at      timestamptz not null default now()
);

alter table public.proteses enable row level security;

drop policy if exists "proteses_select" on public.proteses;
drop policy if exists "proteses_insert" on public.proteses;
drop policy if exists "proteses_update" on public.proteses;
drop policy if exists "proteses_delete" on public.proteses;

create policy "proteses_select" on public.proteses
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "proteses_insert" on public.proteses
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "proteses_update" on public.proteses
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "proteses_delete" on public.proteses
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_proteses_clinica on public.proteses(clinica_id);
create index if not exists idx_proteses_status on public.proteses(status);
