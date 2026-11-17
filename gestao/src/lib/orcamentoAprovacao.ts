import { Orcamento } from "./types";
import { dentesDoTexto } from "./faces";

// Linhas de `procedimentos` (status Pendente = "a realizar" no odontograma) que um
// orçamento aprovado gera. Usado pela aprovação no app (DB.orcamentos.aprovar) e
// pelo aceite do paciente no link (/api/p/[token]) — as duas têm que dar o mesmo.
//
// Item marcado em N dentes com quantidade N (o que o odontograma do orçamento
// gera) vira 1 procedimento por dente — cada um é dado como realizado na sua vez.
// Fora isso (ex.: profilaxia por sextante), fica 1 procedimento com os dentes juntos.
export function procedimentosDoOrcamento(orc: Orcamento, profissionalId?: number | null) {
  return (orc.itens ?? []).flatMap((it) => {
    const base = {
      paciente_id: orc.pacienteId,
      procedimento: it.descricao,
      status: "Pendente",
      profissional_id: profissionalId ?? null,
    };
    const dentes = dentesDoTexto(it.dente);
    const qtd = it.quantidade || 1;
    if (dentes.length > 1 && dentes.length === qtd) {
      return dentes.map((d) => ({ ...base, dente: d, custo: it.valorUnitario }));
    }
    return [{ ...base, dente: dentes.join(", "), custo: it.valorUnitario * qtd }];
  });
}
