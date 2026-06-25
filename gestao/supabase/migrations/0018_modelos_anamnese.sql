-- ============================================================
-- C4 — Clínico customizável (etapa 3, opção 1)
-- Migration 0018: modelos de anamnese customizáveis por clínica.
-- Convivem com o wizard fixo + OCR (que continuam intactos).
-- ============================================================

-- estrutura: jsonb com [{ nome, perguntas: [{ texto, tipo }] }]
-- tipo da pergunta: 'texto' | 'sim_nao' | 'numero'
create table if not exists public.modelos_anamnese (
  id         bigint generated always as identity primary key,
  clinica_id bigint references public.clinicas(id) default public.clinica_atual(),
  nome       text not null,
  estrutura  jsonb not null default '[]'::jsonb,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.modelos_anamnese enable row level security;

drop policy if exists "modelos_anamnese_select" on public.modelos_anamnese;
drop policy if exists "modelos_anamnese_insert" on public.modelos_anamnese;
drop policy if exists "modelos_anamnese_update" on public.modelos_anamnese;
drop policy if exists "modelos_anamnese_delete" on public.modelos_anamnese;

create policy "modelos_anamnese_select" on public.modelos_anamnese
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "modelos_anamnese_insert" on public.modelos_anamnese
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "modelos_anamnese_update" on public.modelos_anamnese
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "modelos_anamnese_delete" on public.modelos_anamnese
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_modelos_anamnese_clinica on public.modelos_anamnese(clinica_id);
