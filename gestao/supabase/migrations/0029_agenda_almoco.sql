-- 0029 — Intervalo de almoço na agenda
-- Faixa de horas (bloco) em que a clínica não atende (ex.: 12–14 na LCR).
-- Nulo = sem intervalo. A grade da agenda e o agendamento online pulam essa faixa.

alter table clinicas
  add column if not exists agenda_almoco_inicio int,
  add column if not exists agenda_almoco_fim    int;

-- Clínica LCR: almoço 12h–14h (Seg–Sex).
update clinicas set agenda_almoco_inicio = 12, agenda_almoco_fim = 14 where id = 1;
