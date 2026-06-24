-- ============================================================
-- Sprint 4 — Multiprofissional + Agenda avançada
-- Migration 0010: profissionais + vínculo na agenda (multi-tenant)
-- ============================================================

create table if not exists public.profissionais (
  id            bigint generated always as identity primary key,
  clinica_id    bigint references public.clinicas(id) default public.clinica_atual(),
  nome          text not null,
  especialidade text,
  cro           text,                      -- registro no Conselho (CRO)
  cor           text not null default '#0f766e',  -- cor no calendário
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.profissionais enable row level security;

drop policy if exists "profissionais_select" on public.profissionais;
drop policy if exists "profissionais_insert" on public.profissionais;
drop policy if exists "profissionais_update" on public.profissionais;
drop policy if exists "profissionais_delete" on public.profissionais;

create policy "profissionais_select" on public.profissionais
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "profissionais_insert" on public.profissionais
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "profissionais_update" on public.profissionais
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "profissionais_delete" on public.profissionais
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_profissionais_clinica on public.profissionais(clinica_id);

-- Vínculo opcional do agendamento ao profissional.
alter table public.agendamentos
  add column if not exists profissional_id bigint references public.profissionais(id) on delete set null;

-- Seed: 1 profissional para a clínica demo (id 1) + backfill dos agendamentos existentes.
insert into public.profissionais (clinica_id, nome, especialidade, cor)
select 1, 'Dra. Lara Camila', 'Clínico Geral', '#0f766e'
where exists (select 1 from public.clinicas where id = 1)
  and not exists (select 1 from public.profissionais where clinica_id = 1);

update public.agendamentos a
set profissional_id = (select id from public.profissionais where clinica_id = 1 limit 1)
where a.clinica_id = 1 and a.profissional_id is null;
