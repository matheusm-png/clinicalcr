-- ============================================================
-- C4 — Clínico customizável (etapa 1)
-- Migration 0016: modelos de documentos customizáveis por clínica.
-- ============================================================

-- A clínica cria seus próprios modelos (termos, contratos, orientações…),
-- que aparecem no editor de Documentos do prontuário além dos modelos fixos.
-- Suporta placeholders no conteúdo/título: {{paciente}}, {{cpf}}, {{cidade}}, {{data}}, {{clinica}}.
create table if not exists public.modelos_documento (
  id         bigint generated always as identity primary key,
  clinica_id bigint references public.clinicas(id) default public.clinica_atual(),
  nome       text not null,                         -- rótulo no seletor
  tipo       text not null default 'outro',         -- categoria (receituario|atestado|declaracao|termo|outro)
  titulo     text not null default '',
  conteudo   text not null default '',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.modelos_documento enable row level security;

drop policy if exists "modelos_documento_select" on public.modelos_documento;
drop policy if exists "modelos_documento_insert" on public.modelos_documento;
drop policy if exists "modelos_documento_update" on public.modelos_documento;
drop policy if exists "modelos_documento_delete" on public.modelos_documento;

create policy "modelos_documento_select" on public.modelos_documento
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "modelos_documento_insert" on public.modelos_documento
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "modelos_documento_update" on public.modelos_documento
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "modelos_documento_delete" on public.modelos_documento
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_modelos_documento_clinica on public.modelos_documento(clinica_id);
