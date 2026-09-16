-- 0031 — Número do prontuário próprio (desacoplado do id do banco)
--
-- Motivo: a tela mostrava "Prontuário #<id do banco>". Como o id é uma sequência
-- que nunca volta atrás, todo paciente de teste apagado queimava um número —
-- a clínica tinha 2 pacientes reais e já estava no #16.
--
-- Agora o número é um campo próprio, preenchido só quando a clínica decidir.
-- Enquanto for NULL, a tela mostra "nº a definir" em vez de inventar um número.
-- A numeração definitiva será atribuída por ORDEM DA DATA DA ANAMNESE
-- (primeiro paciente atendido = #1), quando o cadastro retroativo terminar.

alter table public.pacientes
  add column if not exists prontuario integer;

-- Dois pacientes da mesma clínica não podem ter o mesmo número.
-- Parcial: vários NULL convivem (ainda não numerados).
create unique index if not exists pacientes_prontuario_unico
  on public.pacientes (clinica_id, prontuario)
  where prontuario is not null;

comment on column public.pacientes.prontuario is
  'Número do prontuário da clínica. NULL = ainda não numerado. Atribuído em lote por data da anamnese.';
