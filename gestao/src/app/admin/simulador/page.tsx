"use client";

import { useMemo, useState } from "react";
import Topbar from "@/components/Topbar";

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Parcela { n: number; valor: number; juros: number; amortizacao: number; saldo: number; }

export default function SimuladorPage() {
  const [valor, setValor] = useState("1000");
  const [entrada, setEntrada] = useState("0");
  const [entradaTipo, setEntradaTipo] = useState<"reais" | "percent">("reais");
  const [parcelas, setParcelas] = useState(3);
  const [taxa, setTaxa] = useState("0"); // % ao mês

  const r = useMemo(() => {
    const total = Math.max(0, parseFloat(valor.replace(",", ".")) || 0);
    const entradaNum = Math.max(0, parseFloat(entrada.replace(",", ".")) || 0);
    const entradaReais = Math.min(total, entradaTipo === "percent" ? (total * entradaNum) / 100 : entradaNum);
    const pv = Math.max(0, total - entradaReais);
    const n = Math.max(1, Math.floor(parcelas));
    const i = Math.max(0, parseFloat(taxa.replace(",", ".")) || 0) / 100;

    const parcelaValor = i === 0 ? pv / n : (pv * i) / (1 - Math.pow(1 + i, -n));

    const tabela: Parcela[] = [];
    let saldo = pv;
    for (let k = 1; k <= n; k++) {
      const juros = saldo * i;
      const amortizacao = parcelaValor - juros;
      saldo = Math.max(0, saldo - amortizacao);
      tabela.push({ n: k, valor: parcelaValor, juros, amortizacao, saldo });
    }
    const totalParcelado = parcelaValor * n;
    const totalPago = entradaReais + totalParcelado;
    const totalJuros = totalParcelado - pv;
    return { total, entradaReais, pv, n, i, parcelaValor, tabela, totalParcelado, totalPago, totalJuros };
  }, [valor, entrada, entradaTipo, parcelas, taxa]);

  const num = (v: number, label: string, cor?: string) => (
    <div style={{ background: "var(--bg2, #f8fafc)", borderRadius: 10, padding: 14, flex: "1 1 150px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: cor || "var(--text)" }}>{brl(v)}</div>
    </div>
  );

  return (
    <>
      <Topbar title="Simulador de parcelamento" />
      <main className="page-content">
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Entradas */}
          <div className="card" style={{ flex: "0 0 320px", maxWidth: "100%", padding: 20 }}>
            <div className="form-group">
              <label className="form-label">Valor total (R$)</label>
              <input type="number" min="0" step="0.01" className="form-control" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Entrada</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" min="0" step="0.01" className="form-control" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
                <select className="form-control" style={{ width: 90 }} value={entradaTipo} onChange={(e) => setEntradaTipo(e.target.value as "reais" | "percent")}>
                  <option value="reais">R$</option>
                  <option value="percent">%</option>
                </select>
              </div>
              {entradaTipo === "percent" && <small style={{ color: "var(--text-muted)", fontSize: 11 }}>= {brl(r.entradaReais)}</small>}
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Nº de parcelas</label>
                <input type="number" min="1" max="60" className="form-control" value={parcelas} onChange={(e) => setParcelas(Math.max(1, Number(e.target.value)))} />
              </div>
              <div className="form-group">
                <label className="form-label">Juros (% ao mês)</label>
                <input type="number" min="0" step="0.1" className="form-control" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
              </div>
            </div>
            <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
              Juros 0% = parcelamento sem acréscimo. Com juros, usa a Tabela Price (parcelas fixas).
            </small>
          </div>

          {/* Resultado */}
          <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                {r.n}x de <strong style={{ color: "var(--primary)", fontSize: 18 }}>{brl(r.parcelaValor)}</strong>
                {r.entradaReais > 0 && <> · entrada de {brl(r.entradaReais)}</>}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {num(r.pv, "Valor parcelado")}
                {num(r.totalJuros, "Juros total", r.totalJuros > 0 ? "var(--danger)" : undefined)}
                {num(r.totalPago, "Total a pagar", "var(--primary)")}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Parcelas</span></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>#</th><th>Parcela</th><th>Juros</th><th>Amortização</th><th>Saldo devedor</th></tr>
                  </thead>
                  <tbody>
                    {r.tabela.map((p) => (
                      <tr key={p.n}>
                        <td>{p.n}</td>
                        <td><strong>{brl(p.valor)}</strong></td>
                        <td style={{ color: "var(--text-muted)" }}>{brl(p.juros)}</td>
                        <td style={{ color: "var(--text-muted)" }}>{brl(p.amortizacao)}</td>
                        <td style={{ color: "var(--text-muted)" }}>{brl(p.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
