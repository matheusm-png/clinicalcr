-- ============================================================
-- LGPD Parte 2 — Log de auditoria (rastreabilidade)
-- Migration 0024: registra quem criou/alterou/excluiu/acessou dado de paciente.
--   • Escritas em `pacientes` → trigger no banco (robusto, não dá pra escapar).
--   • Acessos (leitura de prontuário) e exportações → registrados pelo app.
-- Leitura do log restrita a admin da clínica.
-- ============================================================

create table if not exists public.auditoria (
  id            bigint generated always as identity primary key,
  clinica_id    bigint references public.clinicas(id) default public.clinica_atual(),
  usuario_id    uuid default auth.uid(),                -- quem fez (null = sistema/serviço)
  usuario_nome  text,                                   -- nome no momento do evento
  acao          text not null,                          -- criacao|edicao|exclusao|acesso|exportacao
  entidade      text not null default 'paciente',       -- tipo do registro afetado
  entidade_id   bigint,                                 -- id do registro
  detalhe       text,                                   -- ex.: nome do paciente
  created_at    timestamptz not null default now()
);

create index if not exists idx_auditoria_clinica on public.auditoria(clinica_id, created_at desc);
create index if not exists idx_auditoria_entidade on public.auditoria(entidade, entidade_id);

alter table public.auditoria enable row level security;

drop policy if exists "auditoria_select_admin" on public.auditoria;
drop policy if exists "auditoria_insert" on public.auditoria;

-- Leitura: só admin da clínica
create policy "auditoria_select_admin" on public.auditoria
  for select to authenticated using (
    clinica_id = public.clinica_atual()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.papel = 'admin'
    )
  );

-- Inserção: qualquer usuário autenticado da própria clínica (o app registra acesso/exportação)
create policy "auditoria_insert" on public.auditoria
  for insert to authenticated with check (clinica_id = public.clinica_atual());

-- Log automático das escritas em pacientes (INSERT/UPDATE/DELETE).
create or replace function public.audit_pacientes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome  text;
  v_acao  text;
  v_pid   bigint;
  v_det   text;
begin
  select nome into v_nome from public.profiles where id = auth.uid();
  if (tg_op = 'INSERT') then
    v_acao := 'criacao';  v_pid := new.id;  v_det := new.nome;
  elsif (tg_op = 'UPDATE') then
    v_acao := 'edicao';   v_pid := new.id;  v_det := new.nome;
  else
    v_acao := 'exclusao'; v_pid := old.id;  v_det := old.nome;
  end if;
  insert into public.auditoria (clinica_id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe)
  values (coalesce(new.clinica_id, old.clinica_id), auth.uid(), v_nome, v_acao, 'paciente', v_pid, v_det);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_audit_pacientes on public.pacientes;
create trigger trg_audit_pacientes
  after insert or update or delete on public.pacientes
  for each row execute function public.audit_pacientes();
