-- ============================================================
-- C8 — Permissões granulares por usuário
-- Migration 0026: coluna `permissoes` (jsonb) em profiles.
--   • NULL  → sem restrição extra (usa o comportamento padrão do papel).
--   • {mod: false} → oculta/bloqueia aquele módulo para o usuário.
-- Admins nunca são restringidos (regra aplicada na aplicação).
-- ============================================================

alter table public.profiles add column if not exists permissoes jsonb;
