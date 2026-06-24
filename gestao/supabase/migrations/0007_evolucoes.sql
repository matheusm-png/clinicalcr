-- ============================================================
-- Sprint 3 — Prontuário rico
-- Migration 0007: evoluções clínicas (multi-tenant)
-- ============================================================

create table if not exists public.evolucoes (
  id          bigint generated always as identity primary key,
  clinica_id  bigint references public.clinicas(id) default public.clinica_atual(),
  paciente_id bigint not null references public.pacientes(id) on delete cascade,
  texto       text not null,
  autor       text,
  created_at  timestamptz not null default now()
);

alter table public.evolucoes enable row level security;

drop policy if exists "evolucoes_select" on public.evolucoes;
drop policy if exists "evolucoes_insert" on public.evolucoes;
drop policy if exists "evolucoes_update" on public.evolucoes;
drop policy if exists "evolucoes_delete" on public.evolucoes;

create policy "evolucoes_select" on public.evolucoes
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "evolucoes_insert" on public.evolucoes
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "evolucoes_update" on public.evolucoes
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "evolucoes_delete" on public.evolucoes
  for delete to authenticated
  using (clinica_id = public.clinica_atual() and public.papel_atual() in ('admin','dentista'));

create index if not exists idx_evolucoes_paciente on public.evolucoes(paciente_id);
