-- ============================================================
-- C4 — Clínico customizável (etapa 2)
-- Migration 0017: medicamentos favoritos da clínica (receituário).
-- ============================================================

-- Além da base padrão (no código), a clínica cadastra seus medicamentos/posologias.
create table if not exists public.medicamentos (
  id         bigint generated always as identity primary key,
  clinica_id bigint references public.clinicas(id) default public.clinica_atual(),
  nome       text not null,
  posologia  text not null default '',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.medicamentos enable row level security;

drop policy if exists "medicamentos_select" on public.medicamentos;
drop policy if exists "medicamentos_insert" on public.medicamentos;
drop policy if exists "medicamentos_update" on public.medicamentos;
drop policy if exists "medicamentos_delete" on public.medicamentos;

create policy "medicamentos_select" on public.medicamentos
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "medicamentos_insert" on public.medicamentos
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "medicamentos_update" on public.medicamentos
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "medicamentos_delete" on public.medicamentos
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_medicamentos_clinica on public.medicamentos(clinica_id);
