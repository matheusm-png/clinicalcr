// Controle sanitário (Vigilância Sanitária): situação de validade dos produtos,
// faixa de temperatura do frigobar e relatórios PDF (via window.print).
import { ItemEstoque, FrigobarRegistro } from "@/lib/types";

export const FRIGOBAR_MIN = 2; // °C
export const FRIGOBAR_MAX = 8; // °C
export const DIAS_ALERTA_VALIDADE = 30; // "vence em breve" quando faltam <= 30 dias

export type SituacaoValidade = {
  key: "sem" | "ok" | "vence-breve" | "vencido";
  label: string;
  cls: string; // classe de badge (quando aplicável)
  color: string; // cor para o PDF
  dias?: number;
};

// Classifica a validade de um produto em relação a hoje.
export function situacaoValidade(dataValidade?: string, diasAlerta = DIAS_ALERTA_VALIDADE): SituacaoValidade {
  if (!dataValidade) return { key: "sem", label: "—", cls: "", color: "#94a3b8" };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const val = new Date(dataValidade + "T00:00:00");
  const dias = Math.round((val.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return { key: "vencido", label: "Vencido", cls: "badge-danger", color: "#dc2626", dias };
  if (dias <= diasAlerta) return { key: "vence-breve", label: `Vence em ${dias}d`, cls: "badge-warning", color: "#d97706", dias };
  return { key: "ok", label: "Na validade", cls: "badge-success", color: "#059669", dias };
}

// Uma temperatura está fora da faixa aceitável (2–8 °C)?
export function tempForaDaFaixa(temp?: number): boolean {
  if (temp == null || Number.isNaN(temp)) return false;
  return temp < FRIGOBAR_MIN || temp > FRIGOBAR_MAX;
}

// Registro do frigobar teve alguma aferição fora da faixa?
export function registroForaDaFaixa(r: FrigobarRegistro): boolean {
  return tempForaDaFaixa(r.entradaTemp) || tempForaDaFaixa(r.saidaTemp);
}

const dataBR = (iso?: string) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const esc = (s?: string) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CSS = `
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;margin:0;padding:32px}
  h1{font-size:19px;margin:0 0 2px} .sub{color:#64748b;font-size:12px;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}
  th,td{border:1px solid #e2e8f0;padding:5px 7px;text-align:left} th{background:#f1f5f9}
  .legend{font-size:10px;color:#64748b;margin:6px 0 14px}
  .foot{margin-top:26px;font-size:10px;color:#94a3b8;text-align:center}
  .sign{margin-top:40px;display:flex;gap:60px}
  .sign div{flex:1;border-top:1px solid #475569;padding-top:4px;font-size:11px;text-align:center;color:#475569}
  @media print{body{padding:0}}
`;

function abrirImpressao(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
  return true;
}

// Relatório de estoque (com validades e situação) para a Vigilância Sanitária.
export function imprimirRelatorioEstoque(itens: ItemEstoque[], clinicaNome = "Clínica"): boolean {
  const linhas = itens
    .slice()
    .sort((a, b) => (a.dataValidade || "9999").localeCompare(b.dataValidade || "9999"))
    .map((i) => {
      const s = situacaoValidade(i.dataValidade);
      return `<tr>
        <td>${esc(i.nome)}</td>
        <td>${esc(i.fabricante) || "—"}</td>
        <td>${esc(i.lote) || "—"}</td>
        <td>${dataBR(i.dataFabricacao)}</td>
        <td>${dataBR(i.dataValidade)}</td>
        <td style="color:${s.color};font-weight:600">${s.label}</td>
        <td style="text-align:center">${i.quantidade} ${esc(i.unidade) || ""}</td>
        <td style="text-align:center">${i.minimo}</td>
        <td>${esc(i.fornecedor) || "—"}</td>
      </tr>`;
    })
    .join("");
  const vencidos = itens.filter((i) => situacaoValidade(i.dataValidade).key === "vencido").length;
  const venceBreve = itens.filter((i) => situacaoValidade(i.dataValidade).key === "vence-breve").length;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Controle de Estoque — ${esc(clinicaNome)}</title><style>${CSS}</style></head><body>
<h1>${esc(clinicaNome)} — Controle de Estoque</h1>
<div class="sub">Relatório para Vigilância Sanitária · Emitido em ${new Date().toLocaleString("pt-BR")}</div>
<div class="legend">Total de itens: <b>${itens.length}</b> · Vencidos: <b style="color:#dc2626">${vencidos}</b> · A vencer (≤${DIAS_ALERTA_VALIDADE} dias): <b style="color:#d97706">${venceBreve}</b></div>
<table><thead><tr>
  <th>Produto</th><th>Fabricante</th><th>Lote</th><th>Fabricação</th><th>Validade</th><th>Situação</th><th style="text-align:center">Qtd</th><th style="text-align:center">Mín.</th><th>Fornecedor</th>
</tr></thead><tbody>${linhas || '<tr><td colspan="9" style="text-align:center;color:#94a3b8">Sem itens cadastrados</td></tr>'}</tbody></table>
<div class="sign"><div>Responsável técnico</div><div>Data</div></div>
<div class="foot">Documento gerado pelo sistema de gestão da ${esc(clinicaNome)}.</div>
</body></html>`;
  return abrirImpressao(html);
}

// Relatório de controle de temperatura do frigobar para a Vigilância Sanitária.
export function imprimirRelatorioFrigobar(registros: FrigobarRegistro[], clinicaNome = "Clínica"): boolean {
  const linhas = registros
    .slice()
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
    .map((r) => {
      const foraE = tempForaDaFaixa(r.entradaTemp);
      const foraS = tempForaDaFaixa(r.saidaTemp);
      const cor = (fora: boolean) => (fora ? "color:#dc2626;font-weight:700" : "");
      return `<tr>
        <td>${dataBR(r.data)}</td>
        <td style="text-align:center">${r.entradaHora || "—"}</td>
        <td style="text-align:center;${cor(foraE)}">${r.entradaTemp != null ? r.entradaTemp + " °C" : "—"}</td>
        <td style="text-align:center">${r.saidaHora || "—"}</td>
        <td style="text-align:center;${cor(foraS)}">${r.saidaTemp != null ? r.saidaTemp + " °C" : "—"}</td>
        <td style="text-align:center">${foraE || foraS ? '<b style="color:#dc2626">Fora</b>' : "OK"}</td>
        <td>${esc(r.acaoCorretiva) || (foraE || foraS ? "<b style='color:#dc2626'>Registrar ação</b>" : "—")}</td>
        <td>${esc(r.responsavel) || "—"}</td>
      </tr>`;
    })
    .join("");
  const forams = registros.filter(registroForaDaFaixa).length;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Controle de Temperatura do Frigobar — ${esc(clinicaNome)}</title><style>${CSS}</style></head><body>
<h1>${esc(clinicaNome)} — Controle de Temperatura do Frigobar</h1>
<div class="sub">Relatório para Vigilância Sanitária · Faixa aceitável: ${FRIGOBAR_MIN} °C a ${FRIGOBAR_MAX} °C · Emitido em ${new Date().toLocaleString("pt-BR")}</div>
<div class="legend">Registros: <b>${registros.length}</b> · Ocorrências fora da faixa: <b style="color:#dc2626">${forams}</b></div>
<table><thead><tr>
  <th>Data</th><th style="text-align:center">Entrada</th><th style="text-align:center">Temp.</th><th style="text-align:center">Saída</th><th style="text-align:center">Temp.</th><th style="text-align:center">Faixa</th><th>Ação corretiva</th><th>Responsável</th>
</tr></thead><tbody>${linhas || '<tr><td colspan="8" style="text-align:center;color:#94a3b8">Sem registros</td></tr>'}</tbody></table>
<div class="sign"><div>Responsável técnico</div><div>Data</div></div>
<div class="foot">Documento gerado pelo sistema de gestão da ${esc(clinicaNome)}.</div>
</body></html>`;
  return abrirImpressao(html);
}
