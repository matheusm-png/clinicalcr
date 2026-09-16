-- 0033 — Procedimento: faces do dente
--
-- A ficha de papel tem, para cada dente, o quadradinho de 5 faces
-- (mesial, distal, oclusal/incisal, vestibular, lingual/palatina), e a
-- dentista anota a face junto do dente: "Rest. uni. 1.6(MC); 1.5(DM)".
-- O sistema só guardava o número do dente, então a face ia parar em `obs`.
--
-- Formato: { "16": ["M","C"], "15": ["M","D"] }
--   M mesial · D distal · O oclusal/incisal · V vestibular
--   L lingual/palatina · C cervical
-- NULL = procedimento sem face informada (todos os registros antigos).

alter table public.procedimentos
  add column if not exists faces jsonb;

comment on column public.procedimentos.faces is
  'Faces por dente: {"16":["M","C"]}. M/D/O(I)/V/L(P)/C. NULL = não informado.';
