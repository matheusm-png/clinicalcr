"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "@/lib/db";
import { Procedimento, Profissional, Paciente, Clinica } from "@/lib/types";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

// ── Helpers ───────────────────────────────────────────────
const brl = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const isoDia = (d: Date) => d.toISOString().split("T")[0];
const primeiroDiaMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const ultimoDiaMes = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

function paraData(s?: string): Date | null {
  if (!s) return null;
  const base = s.length <= 10 ? s + "T00:00:00" : s;
  const d = new Date(base);
  return isNaN(d.getTime()) ? null : d;
}
function noPeriodo(s: string | undefined, de: string, ate: string): boolean {
  const d = paraData(s);
  if (!d) return false;
  const dia = isoDia(d);
  return dia >= de && dia <= ate;
}

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
  return { de: `${hoje.getFullYear()}-01-01`, ate: `${hoje.getFullYear()}-12-31` };
}

function baixarCSV(nomeArquivo: string, linhas: (string | number)[][]) {
  const csv = linhas
    .map((r) =>
      r.map((c) => {
        const s = String(c ?? "");
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(";"),
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

// ── Página ────────────────────────────────────────────────
export default function ComissoesPage() {
  const { showToast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [clinica, setClinica] = useState<Clinica | null>(null);

  const [preset, setPreset] = useState<Preset>("mes");
  const inicial = rangeDoPreset("mes");
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [profFiltro, setProfFiltro] = useState<string>(""); // "" = todos

  useEffect(() => {
    (async () => {
      const [proc, prof, pac, cli] = await Promise.all([
        DB.procedimentos.list(),
        DB.profissionais.list(),
        DB.pacientes.list(),
        DB.clinica.get(),
      ]);
      setProcedimentos(proc);
      setProfissionais(prof);
      setPacientes(pac);
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

  const nomePaciente = (id: number) => pacientes.find((p) => p.id === id)?.nome ?? `Paciente #${id}`;

  const dados = useMemo(() => {
    const profById = new Map(profissionais.map((p) => [p.id!, p]));
    // Produção realizada no período = procedimentos concluídos.
    const realizados = procedimentos.filter((p) => p.status === "Concluído" && noPeriodo(p.criadoEm, de, ate));

    // Agrupa por profissional.
    type Linha = { prof: Profissional; qtd: number; producao: number; comissao: number; itens: Procedimento[] };
    const porProf = new Map<number, Linha>();
    let semProfQtd = 0;
    let semProfProducao = 0;

    realizados.forEach((p) => {
      if (!p.profissionalId || !profById.has(p.profissionalId)) {
        semProfQtd += 1;
        semProfProducao += p.custo || 0;
        return;
      }
      const prof = profById.get(p.profissionalId)!;
      const l = porProf.get(prof.id!) ?? { prof, qtd: 0, producao: 0, comissao: 0, itens: [] };
      l.qtd += 1;
      l.producao += p.custo || 0;
      l.comissao += (p.custo || 0) * ((prof.comissaoPercentual ?? 0) / 100);
      l.itens.push(p);
      porProf.set(prof.id!, l);
    });

    let linhas = [...porProf.values()].sort((a, b) => b.comissao - a.comissao);
    if (profFiltro) linhas = linhas.filter((l) => String(l.prof.id) === profFiltro);

    const totalProducao = linhas.reduce((s, l) => s + l.producao, 0);
    const totalComissao = linhas.reduce((s, l) => s + l.comissao, 0);
    const totalProc = linhas.reduce((s, l) => s + l.qtd, 0);

    return { linhas, totalProducao, totalComissao, totalProc, semProfQtd, semProfProducao };
  }, [procedimentos, profissionais, pacientes, de, ate, profFiltro]);

  const exportarCSV = () => {
    const linhas: (string | number)[][] = [];
    linhas.push([`Comissões ${clinica?.nome ?? ""} — período ${de} a ${ate}`]);
    linhas.push([]);
    linhas.push(["Profissional", "Comissão (%)", "Procedimentos", "Produção", "Comissão"]);
    dados.linhas.forEach((l) =>
      linhas.push([l.prof.nome, l.prof.comissaoPercentual ?? 0, l.qtd, l.producao.toFixed(2), l.comissao.toFixed(2)]),
    );
    linhas.push(["TOTAL", "", dados.totalProc, dados.totalProducao.toFixed(2), dados.totalComissao.toFixed(2)]);
    linhas.push([]);
    linhas.push(["Detalhamento dos procedimentos"]);
    linhas.push(["Profissional", "Paciente", "Procedimento", "Dente", "Produção", "Comissão"]);
    dados.linhas.forEach((l) =>
      l.itens.forEach((p) =>
        linhas.push([
          l.prof.nome,
          nomePaciente(p.pacienteId),
          p.procedimento,
          String(p.dente ?? ""),
          (p.custo || 0).toFixed(2),
          ((p.custo || 0) * ((l.prof.comissaoPercentual ?? 0) / 100)).toFixed(2),
        ]),
      ),
    );
    baixarCSV(`comissoes-${de}-a-${ate}.csv`, linhas);
    showToast("CSV exportado.", "success");
  };

  const imprimir = () => {
    const resumo = dados.linhas
      .map((l) => `<tr><td>${l.prof.nome}</td><td style="text-align:center">${(l.prof.comissaoPercentual ?? 0).toLocaleString("pt-BR")}%</td><td style="text-align:center">${l.qtd}</td><td style="text-align:right">${brl(l.producao)}</td><td style="text-align:right;font-weight:700">${brl(l.comissao)}</td></tr>`)
      .join("");
    const detalhe = dados.linhas
      .map((l) =>
        l.itens
          .map((p) => `<tr><td>${l.prof.nome}</td><td>${nomePaciente(p.pacienteId)}</td><td>${p.procedimento}</td><td style="text-align:center">${p.dente ?? ""}</td><td style="text-align:right">${brl(p.custo || 0)}</td><td style="text-align:right">${brl((p.custo || 0) * ((l.prof.comissaoPercentual ?? 0) / 100))}</td></tr>`)
          .join(""),
      )
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Comissões — ${clinica?.nome ?? "Clínica"}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;margin:0;padding:32px}
  h1{font-size:20px;margin:0 0 2px} .sub{color:#64748b;font-size:13px;margin-bottom:20px}
  h2{font-size:14px;margin:24px 0 8px;border-bottom:2px solid #0f766e;padding-bottom:4px;color:#0f766e}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left} th{background:#f1f5f9}
  .tot{font-weight:800}
  .foot{margin-top:28px;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{padding:0}}
</style></head><body>
<h1>${clinica?.nome ?? "Clínica"} — Relatório de comissões</h1>
<div class="sub">Período: ${paraData(de)!.toLocaleDateString("pt-BR")} a ${paraData(ate)!.toLocaleDateString("pt-BR")} · Base: produção realizada · Emitido em ${new Date().toLocaleString("pt-BR")}</div>
<h2>Resumo por profissional</h2>
<table><thead><tr><th>Profissional</th><th style="text-align:center">%</th><th style="text-align:center">Proc.</th><th style="text-align:right">Produção</th><th style="text-align:right">Comissão</th></tr></thead>
<tbody>${resumo || '<tr><td colspan="5">Sem dados no período</td></tr>'}
<tr class="tot"><td>TOTAL</td><td></td><td style="text-align:center">${dados.totalProc}</td><td style="text-align:right">${brl(dados.totalProducao)}</td><td style="text-align:right">${brl(dados.totalComissao)}</td></tr></tbody></table>
${detalhe ? `<h2>Detalhamento</h2><table><thead><tr><th>Profissional</th><th>Paciente</th><th>Procedimento</th><th style="text-align:center">Dente</th><th style="text-align:right">Produção</th><th style="text-align:right">Comissão</th></tr></thead><tbody>${detalhe}</tbody></table>` : ""}
<div class="foot">Comissão calculada sobre a produção realizada (procedimentos concluídos atribuídos ao profissional) no período.</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      showToast("Libere os pop-ups para imprimir.", "error");
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
      <Topbar title="Comissões">
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
        {/* Filtros */}
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
              <select className="form-control" style={{ width: "auto", fontSize: 13 }} value={profFiltro} onChange={(e) => setProfFiltro(e.target.value)}>
                <option value="">Todos os profissionais</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.nome}</option>
                ))}
              </select>
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
              {card("Produção realizada", brl(dados.totalProducao), "var(--primary)")}
              {card("Total de comissões", brl(dados.totalComissao), "var(--success)")}
              {card("Procedimentos", String(dados.totalProc))}
              {card("Sem profissional", String(dados.semProfQtd), dados.semProfQtd > 0 ? "var(--warning)" : undefined, dados.semProfQtd > 0 ? <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{brl(dados.semProfProducao)} não atribuídos</div> : null)}
            </div>

            {/* Resumo por profissional */}
            <div className="card mb-6" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Comissão por profissional</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>base: produção realizada no período</span>
              </div>
              {dados.linhas.length === 0 ? (
                <EmptyState
                  icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
                  title="Nenhuma comissão no período"
                  hint="Conclua procedimentos atribuídos a um profissional (com % de comissão configurado) para apurar aqui."
                />
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Profissional</th><th>Comissão</th><th>Procedimentos</th><th>Produção</th><th>Comissão (R$)</th></tr>
                    </thead>
                    <tbody>
                      {dados.linhas.map((l) => (
                        <tr key={l.prof.id}>
                          <td><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: l.prof.cor, marginRight: 8 }} /><strong>{l.prof.nome}</strong></td>
                          <td>{l.prof.comissaoPercentual ? `${l.prof.comissaoPercentual.toLocaleString("pt-BR")}%` : <span className="badge badge-warning">0%</span>}</td>
                          <td>{l.qtd}</td>
                          <td>{brl(l.producao)}</td>
                          <td style={{ fontWeight: 700, color: "var(--success)" }}>{brl(l.comissao)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "var(--bg2)" }}>
                        <td style={{ fontWeight: 800 }}>TOTAL</td>
                        <td></td>
                        <td style={{ fontWeight: 800 }}>{dados.totalProc}</td>
                        <td style={{ fontWeight: 800 }}>{brl(dados.totalProducao)}</td>
                        <td style={{ fontWeight: 800, color: "var(--success)" }}>{brl(dados.totalComissao)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Detalhamento dos procedimentos */}
            {dados.linhas.length > 0 && (
              <div className="card mb-6" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Detalhamento dos procedimentos</span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Profissional</th><th>Paciente</th><th>Procedimento</th><th>Dente</th><th>Produção</th><th>Comissão</th></tr>
                    </thead>
                    <tbody>
                      {dados.linhas.flatMap((l) =>
                        l.itens.map((p) => (
                          <tr key={p.id}>
                            <td>{l.prof.nome}</td>
                            <td>{nomePaciente(p.pacienteId)}</td>
                            <td>{p.procedimento}</td>
                            <td>{p.dente || "—"}</td>
                            <td>{brl(p.custo || 0)}</td>
                            <td style={{ color: "var(--success)" }}>{brl((p.custo || 0) * ((l.prof.comissaoPercentual ?? 0) / 100))}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8 }}>
              A comissão é calculada sobre a <strong>produção realizada</strong> (procedimentos concluídos no período atribuídos ao profissional), usando o % configurado em Configurações › Profissionais. Procedimentos sem profissional não geram comissão.
            </p>
          </>
        )}
      </main>
    </>
  );
}
