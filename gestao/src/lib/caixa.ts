// Caixa = fonte única do dinheiro que entrou (decisão de 17/11/2026).
//
// Desde 01/01/2026 tudo o que entrou está em transacoes_financeiras: até
// 10/11 pela planilha "MOVIMENTO DE CAIXA" (importada) e, a partir de 11/11,
// automaticamente — parcela de paciente marcada como paga gera a linha no
// caixa (gatilho da migration 0038).
//
// Por isso entradas = receitas do caixa + parcelas pagas ANTES de 2026 (o
// histórico das fichas de papel, que não tem caixa). Somar as parcelas de
// 2026 contaria o mesmo pagamento duas vezes.
export const INICIO_CAIXA = "2026-01-01";

export function parcelaForaDoCaixa(p: { pago?: boolean; pagoEm?: string }): boolean {
  return !!p.pago && !!p.pagoEm && p.pagoEm.slice(0, 10) < INICIO_CAIXA;
}
