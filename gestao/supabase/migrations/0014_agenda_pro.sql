-- ============================================================
-- C1 — Agenda PRO
-- Migration 0014: horário de funcionamento configurável + marcadores
-- (tags coloridas / cadeiras / salas) + vínculo na agenda. Multi-tenant.
-- ============================================================

-- 1) Horário de funcionamento da agenda, por clínica (substitui a grade fixa 7–18h).
alter table public.clinicas
  add column if not exists agenda_hora_inicio int not null default 7,
  add column if not exists agenda_hora_fim    int not null default 19;

-- 2) Marcadores: rótulos coloridos para os eventos da agenda (ex.: "Cadeira 1", "Cirurgia").
create table if not exists public.marcadores (
  id         bigint generated always as identity primary key,
  clinica_id bigint references public.clinicas(id) default public.clinica_atual(),
  nome       text not null,
  cor        text not null default '#6366f1',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.marcadores enable row level security;

drop policy if exists "marcadores_select" on public.marcadores;
drop policy if exists "marcadores_insert" on public.marcadores;
drop policy if exists "marcadores_update" on public.marcadores;
drop policy if exists "marcadores_delete" on public.marcadores;

create policy "marcadores_select" on public.marcadores
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "marcadores_insert" on public.marcadores
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "marcadores_update" on public.marcadores
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "marcadores_delete" on public.marcadores
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_marcadores_clinica on public.marcadores(clinica_id);

-- 3) Vínculo opcional do agendamento ao marcador.
alter table public.agendamentos
  add column if not exists marcador_id bigint references public.marcadores(id) on delete set null;

-- Seed de exemplo para a clínica demo (id 1).
insert into public.marcadores (clinica_id, nome, cor)
select 1, v.nome, v.cor
from (values ('Cadeira 1', '#ea580c'), ('Cirurgia', '#7c3aed')) as v(nome, cor)
where exists (select 1 from public.clinicas where id = 1)
  and not exists (select 1 from public.marcadores where clinica_id = 1);
