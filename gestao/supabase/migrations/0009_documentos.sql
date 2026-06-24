-- ============================================================
-- Sprint 3 — Prontuário rico
-- Migration 0009: documentos (receituário / atestado / declaração) — multi-tenant
-- Conteúdo editável + assinatura (data-url PNG). Impressão/PDF é client-side.
-- ============================================================

create table if not exists public.documentos (
  id          bigint generated always as identity primary key,
  clinica_id  bigint references public.clinicas(id) default public.clinica_atual(),
  paciente_id bigint not null references public.pacientes(id) on delete cascade,
  tipo        text not null default 'outro',  -- receituario | atestado | declaracao | termo | outro
  titulo      text not null,
  conteudo    text not null,
  assinatura  text,                            -- data-url PNG da assinatura
  autor       text,
  created_at  timestamptz not null default now()
);

alter table public.documentos enable row level security;

drop policy if exists "documentos_select" on public.documentos;
drop policy if exists "documentos_insert" on public.documentos;
drop policy if exists "documentos_update" on public.documentos;
drop policy if exists "documentos_delete" on public.documentos;

create policy "documentos_select" on public.documentos
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "documentos_insert" on public.documentos
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "documentos_update" on public.documentos
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "documentos_delete" on public.documentos
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_documentos_paciente on public.documentos(paciente_id);
