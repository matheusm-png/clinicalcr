-- 0036 — Agendamento: telefone de contato
--
-- Paciente novo é agendado antes de existir cadastro (liga, marca, a ficha
-- vem na primeira consulta). Sem cadastro não havia onde guardar o telefone,
-- que ia parar em `obs`. Agora a consulta tem o próprio campo.
-- NULL = não informado (registros antigos / paciente já cadastrado).

alter table public.agendamentos
  add column if not exists telefone text;

comment on column public.agendamentos.telefone is
  'Telefone de contato informado no agendamento (útil p/ paciente sem cadastro).';
