-- ============================================================
-- Sprint 3 — Prontuário rico
-- Migration 0008: anexos (fotos / raio-x / documentos) — multi-tenant
-- Metadados na tabela public.anexos; arquivos no bucket privado "anexos".
-- ============================================================

-- ─── Tabela de metadados ──────────────────────────────────
create table if not exists public.anexos (
  id          bigint generated always as identity primary key,
  clinica_id  bigint references public.clinicas(id) default public.clinica_atual(),
  paciente_id bigint not null references public.pacientes(id) on delete cascade,
  nome        text not null,                 -- nome original do arquivo
  path        text not null,                 -- caminho no Storage (clinica_id/paciente_id/arquivo)
  tipo        text,                          -- mime type
  tamanho     bigint,                        -- bytes
  categoria   text not null default 'outro', -- foto | raio-x | documento | outro
  autor       text,
  created_at  timestamptz not null default now()
);

alter table public.anexos enable row level security;

drop policy if exists "anexos_select" on public.anexos;
drop policy if exists "anexos_insert" on public.anexos;
drop policy if exists "anexos_update" on public.anexos;
drop policy if exists "anexos_delete" on public.anexos;

create policy "anexos_select" on public.anexos
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "anexos_insert" on public.anexos
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "anexos_update" on public.anexos
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "anexos_delete" on public.anexos
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_anexos_paciente on public.anexos(paciente_id);

-- ─── Bucket privado de Storage ────────────────────────────
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

-- ─── Policies de Storage (isolamento por clínica) ─────────
-- Convenção de path: "{clinica_id}/{paciente_id}/{arquivo}".
-- A 1ª pasta do path tem de ser a clínica do usuário logado.
drop policy if exists "anexos_obj_select" on storage.objects;
drop policy if exists "anexos_obj_insert" on storage.objects;
drop policy if exists "anexos_obj_delete" on storage.objects;

create policy "anexos_obj_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = public.clinica_atual()::text
  );
create policy "anexos_obj_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = public.clinica_atual()::text
  );
create policy "anexos_obj_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = public.clinica_atual()::text
  );
