"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "@/lib/db";
import {
  Paciente,
  Procedimento,
  TransacaoFinanceira,
  ContaReceber,
  Agendamento,
  Profissional,
  Clinica,
} from "@/lib/types";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

// ── Helpers ───────────────────────────────────────────────
const brl = (v: number) =>
  "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const pct = (v: number) => `${(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const isoDia = (d: Date) => d.toISOString().split("T")[0];
const primeiroDiaMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const ultimoDiaMes = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

// Converte qualquer string de data (yyyy-mm-dd ou ISO timestamp) p/ Date local "no início do dia".
function paraData(s?: string): Date | null {
  if (!s) return null;
  const base = s.length <= 10 ? s + "T00:00:00" : s;
  const d = new Date(base);
  return isNaN(d.getTime()) ? null : d;
}

// A data (string) está dentro de [de, ate] (inclusive)?
function noPeriodo(s: string | undefined, de: string, ate: string): boolean {
  const d = paraData(s);
  if (!d) return false;
  const dia = isoDia(d);
  return dia >= de && dia <= ate;
}

// Lista de meses "yyyy-mm" entre de e ate (inclusive), no máx. 24 buckets.
function mesesEntre(de: string, ate: string): string[] {
  const ini = paraData(de)!;
  const fim = paraData(ate)!;
  const out: string[] = [];
  const cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
  while (cur <= fim && out.length < 24) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

const rotuloMes = (ym: string) => {
  const [a, m] = ym.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[parseInt(m, 10) - 1]}/${a.slice(2)}`;
};

type Preset = "mes" | "mes-passado" | "3meses" | "ano" | "custom";

function rangeDoPreset(p: Preset): { de: string; ate: string } {
  const hoje = new Date();
  if (p === "mes") return { de: isoDia(primeiroDiaMes(hoje)), ate: isoDia(ultimoDiaMes(hoje)) };
  if (p === "mes-passado") {
    const m = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return { de: isoDia(primeiroDiaMes(m)), ate: isoDia(ultimoDiaMes(m)) };
  }
  if (p === "3meses") {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    return { de: isoDia(ini), ate: isoDia(ultimoDiaMes(hoje)) };
  }
  // ano
  return { de: `${hoje.getFullYear()}-01-01`, ate: `${hoje.getFullYear()}-12-31` };
}

function baixarCSV(nomeArquivo: string, linhas: (string | number)[][]) {
  const csv = linhas
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";"),
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Componentes visuais simples (sem lib de chart) ────────
function BarrasMensais({
  meses,
  series,
}: {
  meses: string[];
  series: { receita: number; despesa: number }[];
}) {
  const max = Math.max(1, ...series.flatMap((s) => [s.receita, s.despesa]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, padding: "8px 4px", overflowX: "auto" }}>
      {meses.map((m, i) => {
        const s = series[i];
        return (
          <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 48, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 150 }}>
              <div
                title={`Receita: ${brl(s.receita)}`}
                style={{ width: 14, height: `${(s.receita / max) * 100}%`, minHeight: s.receita > 0 ? 3 : 0, background: "var(--success)", borderRadius: "3px 3px 0 0" }}
              />
              <div
                title={`Despesa: ${brl(s.despesa)}`}
                style={{ width: 14, height: `${(s.despesa / max) * 100}%`, minHeight: s.despesa > 0 ? 3 : 0, background: "var(--danger)", borderRadius: "3px 3px 0 0" }}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{rotuloMes(m)}</span>
          </div>
        );
      })}
    </div>
  );
}

function BarrasHorizontais({ itens }: { itens: { rotulo: string; valor: number; sub?: string }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {itens.map((it) => (
        <div key={it.rotulo} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 160, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{it.rotulo}</span>
          <div style={{ flex: 1, background: "var(--bg2)", borderRadius: 6, height: 22, position: "relative", minWidth: 60 }}>
            <div style={{ width: `${(it.valor / max) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--primary), var(--primary-darker))", borderRadius: 6, minWidth: 2 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, width: 110, textAlign: "right", flexShrink: 0 }}>{it.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────
export default function RelatoriosPage() {
  const { showToast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [financeiro, setFinanceiro] = useState<TransacaoFinanceira[]>([]);
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [clinica, setClinica] = useState<Clinica | null>(null);

  const [preset, setPreset] = useState<Preset>("mes");
  const inicial = rangeDoPreset("mes");
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);

  useEffect(() => {
    (async () => {
      const [pac, proc, fin, cts, ag, prof, cli] = await Promise.all([
        DB.pacientes.list(),
        DB.procedimentos.list(),
        DB.financeiro.list(),
        DB.contas.list(),
        DB.agendamentos.list(),
        DB.profissionais.list(),
        DB.clinica.get(),
      ]);
      setPacientes(pac);
      setProcedimentos(proc);
      setFinanceiro(fin);
      setContas(cts);
      setAgendamentos(ag);
      setProfissionais(prof);
      setClinica(cli);
      setCarregando(false);
    })();
  }, []);

  const aplicarPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = rangeDoPreset(p);
      setDe(r.de);
      setAte(r.ate);
    }
  };

  // ── Cálculos derivados ──────────────────────────────────
  const m = useMemo(() => {
    // Financeiro (datas reais)
    const finPeriodo = financeiro.filter((f) => noPeriodo(f.data, de, ate));
    const receitaPaga = finPeriodo.filter((f) => f.tipo === "receita" && f.status === "pago").reduce((s, f) => s + f.valor, 0);
    const despesaPaga = finPeriodo.filter((f) => f.tipo === "despesa" && f.status === "pago").reduce((s, f) => s + f.valor, 0);
    const saldo = receitaPaga - despesaPaga;

    // Parcelas: recebido (pagoEm no período) e em aberto/atraso (snapshot atual)
    const parcelas = contas.filter((c) => c.status !== "cancelada").flatMap((c) => c.parcelas ?? []);
    const recebidoParcelas = parcelas.filter((p) => p.pago && noPeriodo(p.pagoEm, de, ate)).reduce((s, p) => s + p.valor, 0);
    const hojeIso = isoDia(new Date());
    const aReceber = parcelas.filter((p) => !p.pago).reduce((s, p) => s + p.valor, 0);
    const emAtraso = parcelas.filter((p) => !p.pago && p.vencimento && p.vencimento < hojeIso).reduce((s, p) => s + p.valor, 0);

    // Novos pacientes (criadoEm no período)
    const novosPacientes = pacientes.filter((p) => noPeriodo(p.criadoEm, de, ate)).length;

    // Faturamento por mês
    const meses = mesesEntre(de, ate);
    const serieMensal = meses.map((ym) => {
      const doMes = financeiro.filter((f) => {
        const d = paraData(f.data);
        return d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === ym && f.status === "pago";
      });
      return {
        receita: doMes.filter((f) => f.tipo === "receita").reduce((s, f) => s + f.valor, 0),
        despesa: doMes.filter((f) => f.tipo === "despesa").reduce((s, f) => s + f.valor, 0),
      };
    });

    // Novos pacientes por mês
    const novosPorMes = meses.map((ym) =>
      pacientes.filter((p) => {
        const d = paraData(p.criadoEm);
        return d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === ym;
      }).length,
    );

    // Produção: procedimentos concluídos no período, agrupados por nome
    const procPeriodo = procedimentos.filter((p) => p.status === "Concluído" && noPeriodo(p.criadoEm, de, ate));
    const porProc: Record<string, { qtd: number; valor: number }> = {};
    procPeriodo.forEach((p) => {
      const k = p.procedimento || "(sem nome)";
      (porProc[k] ??= { qtd: 0, valor: 0 });
      porProc[k].qtd += 1;
      porProc[k].valor += p.custo || 0;
    });
    const producao = Object.entries(porProc)
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.valor - a.valor);
    const producaoTotal = producao.reduce((s, p) => s + p.valor, 0);
    const procPendentes = procedimentos.filter((p) => p.status === "Pendente").length;

    // Comparecimento (snapshot geral — agendamentos não têm data absoluta)
    const agValidos = agendamentos.filter((a) => a.status !== "bloqueado");
    const compareceu = agValidos.filter((a) => a.presenca === "compareceu").length;
    const faltou = agValidos.filter((a) => a.presenca === "faltou").length;
    const agendado = agValidos.filter((a) => (a.presenca ?? "agendado") === "agendado").length;
    const baseComp = compareceu + faltou;
    const taxaComparecimento = baseComp > 0 ? (compareceu / baseComp) * 100 : 0;

    // Desempenho por profissional
    const porProf = profissionais.map((prof) => {
      const meus = agValidos.filter((a) => a.profissionalId === prof.id);
      const c = meus.filter((a) => a.presenca === "compareceu").length;
      const f = meus.filter((a) => a.presenca === "faltou").length;
      const base = c + f;
      return { nome: prof.nome, cor: prof.cor, total: meus.length, compareceu: c, faltou: f, taxa: base > 0 ? (c / base) * 100 : 0 };
    });
    const semProf = agValidos.filter((a) => !a.profissionalId).length;

    return {
      receitaPaga, despesaPaga, saldo, recebidoParcelas, aReceber, emAtraso,
      novosPacientes, meses, serieMensal, novosPorMes,
      producao, producaoTotal, procPendentes,
      compareceu, faltou, agendado, taxaComparecimento, baseComp,
      porProf, semProf,
    };
  }, [financeiro, contas, pacientes, procedimentos, agendamentos, profissionais, de, ate]);

  // ── Exportações ─────────────────────────────────────────
  const exportarCSV = () => {
    const linhas: (string | number)[][] = [];
    linhas.push([`Relatório ${clinica?.nome ?? "Clínica"} — período ${de} a ${ate}`]);
    linhas.push([]);
    linhas.push(["Indicador", "Valor"]);
    linhas.push(["Receitas (pago)", m.receitaPaga.toFixed(2)]);
    linhas.push(["Despesas (pago)", m.despesaPaga.toFixed(2)]);
    linhas.push(["Saldo", m.saldo.toFixed(2)]);
    linhas.push(["Recebido em parcelas", m.recebidoParcelas.toFixed(2)]);
    linhas.push(["A receber (em aberto)", m.aReceber.toFixed(2)]);
    linhas.push(["Em atraso", m.emAtraso.toFixed(2)]);
    linhas.push(["Novos pacientes", m.novosPacientes]);
    linhas.push(["Taxa de comparecimento (%)", m.taxaComparecimento.toFixed(1)]);
    linhas.push([]);
    linhas.push(["Produção (procedimentos concluídos)", "Quantidade", "Valor"]);
    m.producao.forEach((p) => linhas.push([p.nome, p.qtd, p.valor.toFixed(2)]));
    linhas.push(["TOTAL", m.producao.reduce((s, p) => s + p.qtd, 0), m.producaoTotal.toFixed(2)]);
    linhas.push([]);
    linhas.push(["Faturamento por mês", "Receita", "Despesa"]);
    m.meses.forEach((ym, i) => linhas.push([rotuloMes(ym), m.serieMensal[i].receita.toFixed(2), m.serieMensal[i].despesa.toFixed(2)]));
    linhas.push([]);
    linhas.push(["Profissional", "Agendamentos", "Compareceu", "Faltou", "Taxa (%)"]);
    m.porProf.forEach((p) => linhas.push([p.nome, p.total, p.compareceu, p.faltou, p.taxa.toFixed(1)]));
    baixarCSV(`relatorio-${de}-a-${ate}.csv`, linhas);
    showToast("CSV exportado.", "success");
  };

  const imprimir = () => {
    const linhasProd = m.producao
      .map((p) => `<tr><td>${p.nome}</td><td style="text-align:center">${p.qtd}</td><td style="text-align:right">${brl(p.valor)}</td></tr>`)
      .join("");
    const linhasProf = m.porProf
      .map((p) => `<tr><td>${p.nome}</td><td style="text-align:center">${p.total}</td><td style="text-align:center">${p.compareceu}</td><td style="text-align:center">${p.faltou}</td><td style="text-align:right">${pct(p.taxa)}</td></tr>`)
      .join("");
    const linhasMes = m.meses
      .map((ym, i) => `<tr><td>${rotuloMes(ym)}</td><td style="text-align:right;color:#059669">${brl(m.serieMensal[i].receita)}</td><td style="text-align:right;color:#dc2626">${brl(m.serieMensal[i].despesa)}</td></tr>`)
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório — ${clinica?.nome ?? "Clínica"}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;margin:0;padding:32px}
  h1{font-size:20px;margin:0 0 2px} .sub{color:#64748b;font-size:13px;margin-bottom:20px}
  h2{font-size:14px;margin:24px 0 8px;border-bottom:2px solid #0f766e;padding-bottom:4px;color:#0f766e}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left} th{background:#f1f5f9}
  .kpis{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px}
  .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;min-width:150px}
  .kpi .l{font-size:10px;text-transform:uppercase;color:#64748b} .kpi .v{font-size:18px;font-weight:800}
  .foot{margin-top:28px;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{padding:0}}
</style></head><body>
<h1>${clinica?.nome ?? "Clínica"} — Relatório gerencial</h1>
<div class="sub">Período: ${paraData(de)!.toLocaleDateString("pt-BR")} a ${paraData(ate)!.toLocaleDateString("pt-BR")} · Emitido em ${new Date().toLocaleString("pt-BR")}</div>
<div class="kpis">
  <div class="kpi"><div class="l">Receitas (pago)</div><div class="v" style="color:#059669">${brl(m.receitaPaga)}</div></div>
  <div class="kpi"><div class="l">Despesas (pago)</div><div class="v" style="color:#dc2626">${brl(m.despesaPaga)}</div></div>
  <div class="kpi"><div class="l">Saldo</div><div class="v">${brl(m.saldo)}</div></div>
  <div class="kpi"><div class="l">A receber</div><div class="v" style="color:#d97706">${brl(m.aReceber)}</div></div>
  <div class="kpi"><div class="l">Novos pacientes</div><div class="v">${m.novosPacientes}</div></div>
  <div class="kpi"><div class="l">Comparecimento</div><div class="v">${pct(m.taxaComparecimento)}</div></div>
</div>
<h2>Faturamento por mês</h2>
<table><thead><tr><th>Mês</th><th style="text-align:right">Receita</th><th style="text-align:right">Despesa</th></tr></thead><tbody>${linhasMes || '<tr><td colspan="3">Sem dados</td></tr>'}</tbody></table>
<h2>Produção (procedimentos concluídos)</h2>
<table><thead><tr><th>Procedimento</th><th style="text-align:center">Qtd</th><th style="text-align:right">Valor</th></tr></thead><tbody>${linhasProd || '<tr><td colspan="3">Sem dados</td></tr>'}<tr><th>TOTAL</th><th style="text-align:center">${m.producao.reduce((s, p) => s + p.qtd, 0)}</th><th style="text-align:right">${brl(m.producaoTotal)}</th></tr></tbody></table>
<h2>Desempenho por profissional <span style="font-weight:400;color:#94a3b8;font-size:11px">(comparecimento — total acumulado)</span></h2>
<table><thead><tr><th>Profissional</th><th style="text-align:center">Agend.</th><th style="text-align:center">Compareceu</th><th style="text-align:center">Faltou</th><th style="text-align:right">Taxa</th></tr></thead><tbody>${linhasProf || '<tr><td colspan="5">Sem dados</td></tr>'}</tbody></table>
<div class="foot">Gerado pelo sistema de gestão ${clinica?.nome ?? ""}. Comparecimento e desempenho por profissional refletem o total acumulado dos agendamentos.</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      showToast("Libere os pop-ups para imprimir o relatório.", "error");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  const card = (label: string, valor: string, cor?: string, extra?: React.ReactNode) => (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor || "var(--text)" }}>{valor}</div>
      {extra}
    </div>
  );

  return (
    <>
      <Topbar title="Relatórios">
        <button className="btn btn-outline" onClick={exportarCSV} disabled={carregando}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          CSV
        </button>
        <button className="btn btn-primary" onClick={imprimir} disabled={carregando}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
          </svg>
          Imprimir / PDF
        </button>
      </Topbar>

      <main className="page-content">
        {/* Filtro de período */}
        <div className="card mb-6">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {([["mes", "Este mês"], ["mes-passado", "Mês passado"], ["3meses", "Últimos 3 meses"], ["ano", "Este ano"], ["custom", "Personalizado"]] as [Preset, string][]).map(([p, label]) => (
                <button key={p} className={`filter-pill ${preset === p ? "active" : ""}`} onClick={() => aplicarPreset(p)}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
              <input type="date" className="form-control" style={{ width: "auto" }} value={de} onChange={(e) => { setDe(e.target.value); setPreset("custom"); }} />
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>até</span>
              <input type="date" className="form-control" style={{ width: "auto" }} value={ate} onChange={(e) => { setAte(e.target.value); setPreset("custom"); }} />
            </div>
          </div>
        </div>

        {carregando ? (
          <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Carregando dados…</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              {card("Receitas (pago)", brl(m.receitaPaga), "var(--success)")}
              {card("Despesas (pago)", brl(m.despesaPaga), "var(--danger)")}
              {card("Saldo do período", brl(m.saldo), m.saldo >= 0 ? "var(--primary)" : "var(--danger)")}
              {card("Novos pacientes", String(m.novosPacientes))}
            </div>
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              {card("Recebido em parcelas", brl(m.recebidoParcelas), "var(--success)")}
              {card("A receber (em aberto)", brl(m.aReceber), "var(--warning)", m.emAtraso > 0 ? <div style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600, marginTop: 2 }}>{brl(m.emAtraso)} em atraso</div> : null)}
              {card("Comparecimento", m.baseComp > 0 ? pct(m.taxaComparecimento) : "—", "var(--primary)", <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{m.compareceu} compareceram · {m.faltou} faltaram</div>)}
              {card("Procedimentos pendentes", String(m.procPendentes), "var(--warning)")}
            </div>

            {/* Faturamento por mês */}
            <div className="card mb-6">
              <div className="card-header">
                <h3 className="card-title">Faturamento por mês</h3>
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: "var(--success)", borderRadius: 2, display: "inline-block" }} /> Receita</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: "var(--danger)", borderRadius: 2, display: "inline-block" }} /> Despesa</span>
                </div>
              </div>
              {m.serieMensal.some((s) => s.receita > 0 || s.despesa > 0) ? (
                <BarrasMensais meses={m.meses} series={m.serieMensal} />
              ) : (
                <EmptyState compact icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}><path d="M3 3v18h18M7 16l4-4 4 4 5-6" /></svg>} title="Sem lançamentos no período" hint="Registre recebimentos e despesas no Financeiro." />
              )}
            </div>

            <div className="dashboard-cols">
              {/* Produção */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Produção realizada</h3>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{brl(m.producaoTotal)}</span>
                </div>
                {m.producao.length === 0 ? (
                  <EmptyState compact icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>} title="Nenhum procedimento concluído no período" hint="Conclua procedimentos no prontuário para vê-los aqui." />
                ) : (
                  <BarrasHorizontais itens={m.producao.slice(0, 8).map((p) => ({ rotulo: p.nome, valor: p.valor, sub: `${p.qtd}× · ${brl(p.valor)}` }))} />
                )}
              </div>

              {/* Comparecimento */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Comparecimento</h3>
                </div>
                {m.baseComp + m.agendado === 0 ? (
                  <EmptyState compact icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>} title="Sem dados de comparecimento" hint="Marque presença/falta na agenda." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: "var(--primary)" }}>{pct(m.taxaComparecimento)}</span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>de comparecimento</span>
                    </div>
                    <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", background: "var(--bg2)" }}>
                      <div style={{ width: `${(m.compareceu / Math.max(1, m.compareceu + m.faltou)) * 100}%`, background: "var(--success)" }} title={`${m.compareceu} compareceram`} />
                      <div style={{ width: `${(m.faltou / Math.max(1, m.compareceu + m.faltou)) * 100}%`, background: "var(--danger)" }} title={`${m.faltou} faltaram`} />
                    </div>
                    <div style={{ display: "flex", gap: 18, fontSize: 13 }}>
                      <span><strong style={{ color: "var(--success)" }}>{m.compareceu}</strong> compareceram</span>
                      <span><strong style={{ color: "var(--danger)" }}>{m.faltou}</strong> faltaram</span>
                      <span><strong>{m.agendado}</strong> agendados</span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Total acumulado de todos os agendamentos (a agenda não guarda data absoluta).</p>
                  </div>
                )}
              </div>
            </div>

            {/* Desempenho por profissional */}
            <div className="card mb-6">
              <div className="card-header">
                <h3 className="card-title">Desempenho por profissional</h3>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>comparecimento acumulado</span>
              </div>
              {m.porProf.length === 0 ? (
                <EmptyState compact icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} title="Nenhum profissional cadastrado" hint="Cadastre profissionais em Configurações." />
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Profissional</th><th>Agendamentos</th><th>Compareceu</th><th>Faltou</th><th>Taxa</th></tr>
                    </thead>
                    <tbody>
                      {m.porProf.map((p) => (
                        <tr key={p.nome}>
                          <td><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: p.cor, marginRight: 8 }} /><strong>{p.nome}</strong></td>
                          <td>{p.total}</td>
                          <td style={{ color: "var(--success)", fontWeight: 600 }}>{p.compareceu}</td>
                          <td style={{ color: "var(--danger)", fontWeight: 600 }}>{p.faltou}</td>
                          <td>{(p.compareceu + p.faltou) > 0 ? <span className={`badge ${p.taxa >= 80 ? "badge-success" : p.taxa >= 60 ? "badge-warning" : "badge-danger"}`}>{pct(p.taxa)}</span> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                        </tr>
                      ))}
                      {m.semProf > 0 && (
                        <tr>
                          <td style={{ color: "var(--text-muted)" }}>Sem profissional</td>
                          <td>{m.semProf}</td>
                          <td colSpan={3} style={{ color: "var(--text-muted)" }}>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Novos pacientes por mês */}
            <div className="card mb-6">
              <div className="card-header">
                <h3 className="card-title">Novos pacientes por mês</h3>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{m.novosPacientes} no período</span>
              </div>
              {m.novosPorMes.some((n) => n > 0) ? (
                <BarrasHorizontais itens={m.meses.map((ym, i) => ({ rotulo: rotuloMes(ym), valor: m.novosPorMes[i], sub: `${m.novosPorMes[i]} paciente${m.novosPorMes[i] === 1 ? "" : "s"}` }))} />
              ) : (
                <EmptyState compact icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19 8v6M22 11h-6" /></svg>} title="Nenhum paciente novo no período" hint="Os cadastros de pacientes feitos no período aparecem aqui." />
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
