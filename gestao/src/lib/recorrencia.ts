// ─── Recorrência ──────────────────────────────────────────
// Gera as datas mensais a partir da primeira. Vence sempre no mesmo dia do mês;
// em mês mais curto (ex.: dia 31 em fevereiro) cai no último dia.
// Tudo em texto 'yyyy-mm-dd' pra não ter surpresa de fuso.
export const MAX_PARCELAS = 60;

export function datasMensais(inicio: string, opts: { meses?: number; ate?: string }): string[] {
  const [y0, m0, d0] = inicio.split("-").map(Number);
  if (!y0 || !m0 || !d0) return [];
  const out: string[] = [];
  for (let i = 0; i < MAX_PARCELAS; i++) {
    const idx = m0 - 1 + i;
    const y = y0 + Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const ultimo = new Date(y, m, 0).getDate();
    const d = Math.min(d0, ultimo);
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (opts.meses != null && i >= opts.meses) break;
    if (opts.ate && iso.slice(0, 7) > opts.ate) break;
    out.push(iso);
  }
  return out;
}

// Série sem data de fim: quantos meses à frente ficam sempre gerados.
export const MESES_A_FRENTE_SEM_FIM = 12;

// Último mês (YYYY-MM) que uma série sem fim deve ter, contando a partir de hoje.
export function horizonteSemFim(hoje = new Date()): string {
  const idx = hoje.getFullYear() * 12 + hoje.getMonth() + (MESES_A_FRENTE_SEM_FIM - 1);
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
