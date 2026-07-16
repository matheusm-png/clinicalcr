-- 0023 — Consentimento LGPD do paciente
-- Registra o consentimento do titular para tratamento de dados (LGPD, Lei 13.709/2018)
-- e um opt-in separado para contato por WhatsApp (gancho do S7).
-- Colunas em `pacientes`; RLS já isola por clinica_id (herdada da 0004).

alter table public.pacientes
  add column if not exists consentimento_lgpd boolean not null default false,
  add column if not exists consentimento_lgpd_em timestamptz,
  add column if not exists consentimento_lgpd_versao text,
  add column if not exists consentimento_whatsapp boolean not null default false;

comment on column public.pacientes.consentimento_lgpd is 'Titular consentiu com o tratamento de dados (LGPD)';
comment on column public.pacientes.consentimento_lgpd_em is 'Momento do consentimento (ISO)';
comment on column public.pacientes.consentimento_lgpd_versao is 'Versão do termo aceita (TERMO_LGPD_VERSAO)';
comment on column public.pacientes.consentimento_whatsapp is 'Opt-in para contato por WhatsApp';
