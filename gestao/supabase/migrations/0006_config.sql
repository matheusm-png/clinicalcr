-- ============================================================
-- Configurações: dados da clínica + gestão de usuários
-- Migration 0006
-- ============================================================

-- Campos cadastrais da clínica
alter table public.clinicas add column if not exists cnpj      text;
alter table public.clinicas add column if not exists telefone  text;
alter table public.clinicas add column if not exists email     text;
alter table public.clinicas add column if not exists cep       text;
alter table public.clinicas add column if not exists endereco  text;
alter table public.clinicas add column if not exists numero    text;
alter table public.clinicas add column if not exists bairro    text;
alter table public.clinicas add column if not exists cidade    text;
alter table public.clinicas add column if not exists uf        text;
alter table public.clinicas add column if not exists logo_url  text;

-- Admin pode editar os dados da própria clínica
drop policy if exists "clinicas_update" on public.clinicas;
create policy "clinicas_update" on public.clinicas
  for update to authenticated
  using (id = public.clinica_atual() and public.papel_atual() = 'admin')
  with check (id = public.clinica_atual() and public.papel_atual() = 'admin');

-- Admin pode editar perfis (papel/nome) da própria clínica
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or (public.papel_atual() = 'admin' and clinica_id = public.clinica_atual()))
  with check (id = auth.uid() or (public.papel_atual() = 'admin' and clinica_id = public.clinica_atual()));
