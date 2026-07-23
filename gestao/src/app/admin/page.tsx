"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DB } from "@/lib/db";
import { Paciente, Agendamento, TransacaoFinanceira, ContaReceber, Protese, ItemEstoque, Procedimento, Orcamento } from "@/lib/types";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { ABRIR_ASSISTENTE_EVENT } from "@/components/AssistenteFlutuante";

const abrirAssistente = () => window.dispatchEvent(new Event(ABRIR_ASSISTENTE_EVENT));

const brl = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 });

// 'yyyy-mm-dd' em horário local (consistente com a coluna `data` da agenda).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoje = () => ymd(new Date());
const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
// Aceita 'yyyy-mm-dd' ou timestamp ISO; retorna Date local ou null.
const paraData = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
  return isNaN(d.getTime()) ? null : d;
};
const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMesYm = (ym: string) => { const [, m] = ym.split("-"); return MESES_CURTO[Number(m) - 1]; };

// Rótulo amigável: "Hoje", "Amanhã" ou "dd/mm".
const rotuloDia = (data: string) => {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  if (data === hoje()) return "Hoje";
  if (data === ymd(amanha)) return "Amanhã";
  const [y, m, d] = data.split("-");
  return `${d}/${m}`;
};

// Badge de variação percentual (▲ verde / ▼ vermelho). `bom` inverte a cor quando cair é bom.
function Trend({ atual, anterior, bomSubir = true }: { atual: number; anterior: number; bomSubir?: boolean }) {
  if (anterior === 0 && atual === 0) return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— sem base</span>;
  const delta = anterior === 0 ? 100 : ((atual - anterior) / Math.abs(anterior)) * 100;
  const subiu = atual >= anterior;
  const positivo = bomSubir ? subiu : !subiu;
  const cor = atual === anterior ? "var(--text-muted)" : positivo ? "var(--success)" : "var(--danger)";
  const seta = atual === anterior ? "→" : subiu ? "▲" : "▼";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: cor, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {seta} {Math.abs(delta).toFixed(0)}%
      <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>vs mês ant.</span>
    </span>
  );
}

// Anel/donut SVG simples com percentual central.
function Ring({ pct, cor, label, sub }: { pct: number; cor: string; label: string; sub?: string }) {
  const r = 34, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg viewBox="0 0 84 84" style={{ width: 92, height: 92, transform: "rotate(-90deg)" }}>
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--bg2)" strokeWidth="9" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .5s ease" }} />
        <text x="42" y="42" textAnchor="middle" dominantBaseline="central" transform="rotate(90 42 42)"
          style={{ fontSize: 18, fontWeight: 800, fill: "var(--text)" }}>{Math.round(pct)}%</text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>}
      </div>
    </div>
  );
}

// Linha de barra horizontal (label · valor + trilho proporcional).
function BarLinha({ label, cor, valor, max, texto }: { label: string; cor: string; valor: number; max: number; texto: string }) {
  const w = max > 0 ? Math.max(2, (valor / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{texto}</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: "var(--bg2)", overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: cor, borderRadius: 6, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [financeiro, setFinanceiro] = useState<TransacaoFinanceira[]>([]);
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [proteses, setProteses] = useState<Protese[]>([]);
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);

  useEffect(() => {
    (async () => {
      const [pac, ag, fin, cts, prot, est, proc, orc] = await Promise.all([
        DB.pacientes.list(),
        DB.agendamentos.list(),
        DB.financeiro.list(),
        DB.contas.list(),
        DB.proteses.list(),
        DB.estoque.list(),
        DB.procedimentos.list(),
        DB.orcamentos.list(),
      ]);
      setPacientes(pac);
      setAgendamentos(ag);
      setFinanceiro(fin);
      setContas(cts);
      setProteses(prot);
      setEstoque(est);
      setProcedimentos(proc);
      setOrcamentos(orc);
    })();
  }, []);

  const m = useMemo(() => {
    const hojeIso = hoje();
    const agora = new Date();
    const ymAtual = ymKey(agora);
    const ymAnterior = ymKey(new Date(agora.getFullYear(), agora.getMonth() - 1, 1));
    const noMes = (s: string | undefined, ym: string) => { const d = paraData(s); return !!d && ymKey(d) === ym; };

    // Últimos 6 meses (mais antigo → atual)
    const meses: string[] = [];
    for (let i = 5; i >= 0; i--) meses.push(ymKey(new Date(agora.getFullYear(), agora.getMonth() - i, 1)));

    // ── Entradas (receitas pagas + parcelas pagas) por mês
    const parcelas = contas.filter((c) => c.status !== "cancelada").flatMap((c) => c.parcelas ?? []);
    const entradasMes = (ym: string) => {
      const rec = financeiro.filter((f) => f.tipo === "receita" && f.status === "pago" && noMes(f.data, ym)).reduce((s, f) => s + f.valor, 0);
      const par = parcelas.filter((p) => p.pago && noMes(p.pagoEm, ym)).reduce((s, p) => s + p.valor, 0);
      return rec + par;
    };
    const saidasMes = (ym: string) => financeiro.filter((f) => f.tipo === "despesa" && f.status === "pago" && noMes(f.data, ym)).reduce((s, f) => s + f.valor, 0);

    const fluxo = meses.map((ym) => ({ ym, entradas: entradasMes(ym), saidas: saidasMes(ym) }));
    const entradasAtual = entradasMes(ymAtual);
    const entradasAnt = entradasMes(ymAnterior);
    const saidasAtual = saidasMes(ymAtual);
    const saldoAtual = entradasAtual - saidasAtual;

    // ── Pacientes
    const pacientesAtivos = pacientes.filter((p) => p.status === "Ativo").length;
    const novosMes = pacientes.filter((p) => noMes(p.criadoEm, ymAtual)).length;
    const novosAnt = pacientes.filter((p) => noMes(p.criadoEm, ymAnterior)).length;

    // ── A Receber / aging
    const aReceber = parcelas.filter((p) => !p.pago).reduce((s, p) => s + p.valor, 0);
    const parcelasAtrasadas = parcelas.filter((p) => !p.pago && p.vencimento && p.vencimento < hojeIso);
    const emAtraso = parcelasAtrasadas.reduce((s, p) => s + p.valor, 0);
    const aging = { aVencer: 0, d1_30: 0, d31_60: 0, d60: 0 };
    parcelas.filter((p) => !p.pago && p.vencimento).forEach((p) => {
      const venc = paraData(p.vencimento)!;
      const dd = Math.floor((agora.getTime() - venc.getTime()) / 86400000);
      if (dd <= 0) aging.aVencer += p.valor;
      else if (dd <= 30) aging.d1_30 += p.valor;
      else if (dd <= 60) aging.d31_60 += p.valor;
      else aging.d60 += p.valor;
    });

    // ── Comparecimento (mês atual)
    const agMes = agendamentos.filter((a) => a.status !== "bloqueado" && noMes(a.data, ymAtual));
    const compareceu = agMes.filter((a) => a.presenca === "compareceu").length;
    const faltou = agMes.filter((a) => a.presenca === "faltou").length;
    const baseComp = compareceu + faltou;
    const taxaComp = baseComp > 0 ? (compareceu / baseComp) * 100 : 0;
    const compAnt = (() => {
      const prev = agendamentos.filter((a) => a.status !== "bloqueado" && noMes(a.data, ymAnterior));
      const c = prev.filter((a) => a.presenca === "compareceu").length;
      const f = prev.filter((a) => a.presenca === "faltou").length;
      return c + f > 0 ? (c / (c + f)) * 100 : 0;
    })();

    // ── Agenda da semana (segunda→domingo da semana atual)
    const diaSemana = (agora.getDay() + 6) % 7; // 0 = segunda
    const segunda = new Date(agora); segunda.setDate(agora.getDate() - diaSemana);
    const semana = Array.from({ length: 7 }, (_, i) => { const d = new Date(segunda); d.setDate(segunda.getDate() + i); return ymd(d); });
    const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const porDia = semana.map((data, i) => ({
      dow: DOW[i], data,
      total: agendamentos.filter((a) => a.status !== "bloqueado" && a.data === data).length,
      hoje: data === hojeIso,
    }));
    const agSemana = porDia.reduce((s, d) => s + d.total, 0);

    // ── Produção (procedimentos concluídos no mês)
    const procMes = procedimentos.filter((p) => p.status === "Concluído" && noMes(p.criadoEm, ymAtual));
    const producaoTotal = procMes.reduce((s, p) => s + (p.custo || 0), 0);
    const ticketMedio = procMes.length > 0 ? producaoTotal / procMes.length : 0;
    const procPendentes = procedimentos.filter((p) => p.status === "Pendente").length;
    const topProcMap: Record<string, { qtd: number; valor: number }> = {};
    procMes.forEach((p) => {
      const k = p.procedimento || "—";
      topProcMap[k] = topProcMap[k] || { qtd: 0, valor: 0 };
      topProcMap[k].qtd++; topProcMap[k].valor += p.custo || 0;
    });
    const topProc = Object.entries(topProcMap).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.valor - a.valor).slice(0, 5);

    // ── Funil de orçamentos
    const funil = {
      rascunho: orcamentos.filter((o) => o.status === "rascunho").length,
      enviado: orcamentos.filter((o) => o.status === "enviado").length,
      aprovado: orcamentos.filter((o) => o.status === "aprovado").length,
      recusado: orcamentos.filter((o) => o.status === "recusado").length,
    };
    const baseConv = funil.enviado + funil.aprovado + funil.recusado;
    const taxaConversao = baseConv > 0 ? (funil.aprovado / baseConv) * 100 : 0;
    const aprovadoMesValor = orcamentos.filter((o) => o.status === "aprovado" && noMes(o.aprovadoEm, ymAtual)).reduce((s, o) => s + (o.total || 0), 0);

    // ── Pendências acionáveis (painel "Precisa de atenção")
    const protesesAtrasadas = proteses.filter((p) => (p.status === "solicitada" || p.status === "laboratorio") && !!p.previsaoRetorno && p.previsaoRetorno < hojeIso).length;
    const retornosVencidos = pacientes.filter((p) => !!p.proximaRevisao && p.proximaRevisao < hojeIso).length;
    const recuperacaoPendentes = agendamentos.filter((a) => ((a.presenca === "faltou" && !a.cancelado) || a.cancelado) && a.recuperacao !== "recuperado").length;
    const estoqueBaixo = estoque.filter((i) => i.quantidade <= i.minimo).length;

    return {
      fluxo, entradasAtual, entradasAnt, saidasAtual, saldoAtual,
      pacientesAtivos, novosMes, novosAnt,
      aReceber, emAtraso, parcelasAtrasadas, aging,
      compareceu, faltou, baseComp, taxaComp, compAnt,
      porDia, agSemana,
      producaoTotal, ticketMedio, procConcluidos: procMes.length, procPendentes, topProc,
      funil, taxaConversao, aprovadoMesValor,
      protesesAtrasadas, retornosVencidos, recuperacaoPendentes, estoqueBaixo,
    };
  }, [pacientes, agendamentos, financeiro, contas, proteses, estoque, procedimentos, orcamentos]);

  // Próximos: confirmados de hoje em diante, ordenados por data e horário.
  const proximosAgendamentos = agendamentos
    .filter((a) => a.status === "confirmado" && a.data >= hoje())
    .sort((a, b) => a.data.localeCompare(b.data) || a.hora - b.hora || a.min - b.min)
    .slice(0, 5);

  // Aniversariantes de hoje (mesmo dia/mês do nascimento).
  const _h = new Date();
  const aniversariantes = pacientes
    .filter((p) => {
      if (!p.nascimento) return false;
      const n = new Date(p.nascimento + "T00:00:00");
      return !isNaN(n.getTime()) && n.getMonth() === _h.getMonth() && n.getDate() === _h.getDate();
    })
    .map((p) => ({ p, idade: _h.getFullYear() - new Date(p.nascimento + "T00:00:00").getFullYear() }));

  const zap = (p: Paciente) => {
    const tel = (p.tel || "").replace(/\D/g, "");
    const fone = tel.length >= 11 ? `55${tel}` : tel;
    const msg = encodeURIComponent(`Feliz aniversário, ${p.nome.split(" ")[0]}! 🎉 Toda a equipe da clínica deseja um dia especial.`);
    window.open(`https://wa.me/${fone}?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const abrirProntuario = async (pacienteId?: number) => {
    if (!pacienteId) return;
    const paciente = await DB.pacientes.get(pacienteId);
    if (paciente) {
      localStorage.setItem("lcr-selected-paciente", JSON.stringify(paciente));
      router.push("/admin/prontuario");
    }
  };

  const alertas = [
    m.parcelasAtrasadas.length > 0 && {
      href: "/admin/receber", cor: "var(--danger)",
      titulo: `${brl(m.emAtraso)} em atraso`, sub: `${m.parcelasAtrasadas.length} parcela${m.parcelasAtrasadas.length === 1 ? "" : "s"} vencida${m.parcelasAtrasadas.length === 1 ? "" : "s"}`,
      d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    m.protesesAtrasadas > 0 && {
      href: "/admin/proteses", cor: "#ea580c",
      titulo: `${m.protesesAtrasadas} prótese${m.protesesAtrasadas === 1 ? "" : "s"} atrasada${m.protesesAtrasadas === 1 ? "" : "s"}`, sub: "Passou da previsão de retorno do laboratório",
      d: "M12 2c-2.5 0-4 1.5-4 4 0 1.2.4 2.3.4 4 0 4 .6 8 1.6 12 .3 1 1.7 1 2 0 1-4 1.6-8 1.6-12 0-1.7.4-2.8.4-4 0-2.5-1.5-4-4-4z",
    },
    m.recuperacaoPendentes > 0 && {
      href: "/admin/relacionamento", cor: "var(--warning)",
      titulo: `${m.recuperacaoPendentes} paciente${m.recuperacaoPendentes === 1 ? "" : "s"} a recuperar`, sub: "Faltas/desmarcações aguardando contato",
      d: "M22 11l-3 3-2-2M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    },
    m.retornosVencidos > 0 && {
      href: "/admin/retornos", cor: "#0ea5e9",
      titulo: `${m.retornosVencidos} retorno${m.retornosVencidos === 1 ? "" : "s"} vencido${m.retornosVencidos === 1 ? "" : "s"}`, sub: "Pacientes com revisão atrasada",
      d: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
    },
    m.estoqueBaixo > 0 && {
      href: "/admin/estoque", cor: "var(--danger)",
      titulo: `${m.estoqueBaixo} item${m.estoqueBaixo === 1 ? "" : "ns"} em falta`, sub: "Estoque no mínimo ou abaixo",
      d: "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
    },
  ].filter(Boolean) as { href: string; cor: string; titulo: string; sub: string; d: string }[];

  const maxFluxo = Math.max(1, ...m.fluxo.flatMap((f) => [f.entradas, f.saidas]));
  const maxDia = Math.max(1, ...m.porDia.map((d) => d.total));
  const maxAging = Math.max(1, m.aging.aVencer, m.aging.d1_30, m.aging.d31_60, m.aging.d60);
  const maxProc = Math.max(1, ...m.topProc.map((p) => p.valor));

  return (
    <>
      <Topbar title="Início" />

      <main className="page-content">
        {/* Destaque Assistente IA */}
        <button
          onClick={abrirAssistente}
          style={{
            display: "flex", alignItems: "center", gap: 16, textDecoration: "none",
            background: "linear-gradient(120deg, var(--primary-darker), var(--primary))",
            color: "#fff", borderRadius: "var(--radius-lg)", padding: "16px 20px", marginBottom: 24,
            boxShadow: "var(--shadow-md)", border: "none", width: "100%", textAlign: "left", cursor: "pointer",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M9 10h.01M13 10h.01M17 10h.01" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Assistente IA</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>Pergunte sobre pacientes, agenda, financeiro… em linguagem natural.</div>
          </div>
          <span className="btn" style={{ background: "#fff", color: "var(--primary-darker)", fontWeight: 700, flexShrink: 0 }}>Abrir</span>
        </button>

        {/* Cards de Métricas (mês atual + tendência) */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="stat-value">{brl(m.entradasAtual)}</div>
              <div className="stat-label">Entradas do mês</div>
              <div style={{ marginTop: 4 }}><Trend atual={m.entradasAtual} anterior={m.entradasAnt} /></div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="stat-value">{m.pacientesAtivos}</div>
              <div className="stat-label">Pacientes ativos · +{m.novosMes} no mês</div>
              <div style={{ marginTop: 4 }}><Trend atual={m.novosMes} anterior={m.novosAnt} /></div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="stat-value">{m.taxaComp.toFixed(0)}%</div>
              <div className="stat-label">Comparecimento · {m.compareceu}/{m.baseComp} consultas</div>
              <div style={{ marginTop: 4 }}><Trend atual={m.taxaComp} anterior={m.compAnt} /></div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="stat-value">{brl(m.aReceber)}</div>
              <div className="stat-label">
                A receber{m.emAtraso > 0 && <span style={{ color: "var(--danger)", fontWeight: 600 }}> · {brl(m.emAtraso)} em atraso</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Precisa de atenção */}
        <div className="card" style={{ marginTop: 24, marginBottom: 24, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: alertas.length ? 12 : 0 }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="var(--primary)" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Precisa de atenção</span>
            {alertas.length > 0 && <span className="badge badge-warning">{alertas.length}</span>}
          </div>
          {alertas.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 14 }}>
              <span style={{ fontSize: 18 }} aria-hidden>✅</span> Tudo em dia — sem pendências no momento.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {alertas.map((a) => (
                <Link key={a.href} href={a.href} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", background: "var(--bg2)", borderRadius: 10, borderLeft: `4px solid ${a.cor}`, padding: "10px 14px" }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke={a.cor} strokeWidth="2" style={{ width: 20, height: 20, flexShrink: 0 }}><path d={a.d} /></svg>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.titulo}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {aniversariantes.length > 0 && (
          <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid #DB2777", padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }} aria-hidden>🎂</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Aniversariantes de hoje</span>
              <span className="badge badge-info">{aniversariantes.length}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {aniversariantes.map(({ p, idade }) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg2)", borderRadius: 10, padding: "8px 12px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.nome}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{idade} anos · {p.tel || "sem telefone"}</span>
                  </div>
                  <button className="btn btn-sm" style={{ background: "#25D366", color: "#fff" }} onClick={() => zap(p)} disabled={!(p.tel || "").replace(/\D/g, "")}>
                    Parabenizar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fluxo de caixa — últimos 6 meses */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title">Fluxo de caixa · últimos 6 meses</h3>
            <Link href="/admin/relatorios" className="btn btn-outline btn-sm">Ver relatórios</Link>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Resumo do mês */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Entradas (mês)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success)" }}>{brl(m.entradasAtual)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Saídas (mês)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--danger)" }}>{brl(m.saidasAtual)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Saldo (mês)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.saldoAtual >= 0 ? "var(--success)" : "var(--danger)" }}>{brl(m.saldoAtual)}</div>
              </div>
            </div>
            {/* Gráfico de barras */}
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, height: 130, paddingTop: 8 }}>
                {m.fluxo.map((f) => (
                  <div key={f.ym} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: "100%", width: "100%", justifyContent: "center" }}>
                      <div title={`Entradas: ${brl(f.entradas)}`} style={{ width: 12, height: `${(f.entradas / maxFluxo) * 100}%`, minHeight: f.entradas > 0 ? 3 : 0, background: "var(--success)", borderRadius: "3px 3px 0 0", transition: "height .4s ease" }} />
                      <div title={`Saídas: ${brl(f.saidas)}`} style={{ width: 12, height: `${(f.saidas / maxFluxo) * 100}%`, minHeight: f.saidas > 0 ? 3 : 0, background: "var(--danger)", borderRadius: "3px 3px 0 0", transition: "height .4s ease" }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{rotuloMesYm(f.ym)}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--success)" }} /> Entradas</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--danger)" }} /> Saídas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Produção + Funil de orçamentos */}
        <div className="dashboard-cols" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Produção do mês</h3>
              <Link href="/admin/relatorios" className="btn btn-outline btn-sm">Detalhes</Link>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{brl(m.producaoTotal)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.procConcluidos} procedimento{m.procConcluidos === 1 ? "" : "s"} concluído{m.procConcluidos === 1 ? "" : "s"}</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{brl(m.ticketMedio)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Ticket médio</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.procPendentes > 0 ? "var(--warning)" : "var(--text)" }}>{m.procPendentes}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Pendentes na fila</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Top procedimentos (mês)</div>
            {m.topProc.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum procedimento concluído neste mês ainda.</div>
            ) : (
              m.topProc.map((p) => (
                <BarLinha key={p.nome} label={p.nome} cor="var(--primary)" valor={p.valor} max={maxProc} texto={`${p.qtd}× · ${brl(p.valor)}`} />
              ))
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Funil de orçamentos</h3>
              <Link href="/admin/orcamentos" className="btn btn-outline btn-sm">Abrir</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <Ring pct={m.taxaConversao} cor="var(--primary)" label="Conversão" sub="aprovados / decididos" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aprovado no mês</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success)" }}>{brl(m.aprovadoMesValor)}</div>
              </div>
            </div>
            {(() => {
              const maxF = Math.max(1, m.funil.rascunho, m.funil.enviado, m.funil.aprovado, m.funil.recusado);
              return (<>
                <BarLinha label="Rascunho" cor="var(--text-muted)" valor={m.funil.rascunho} max={maxF} texto={String(m.funil.rascunho)} />
                <BarLinha label="Enviado" cor="var(--info)" valor={m.funil.enviado} max={maxF} texto={String(m.funil.enviado)} />
                <BarLinha label="Aprovado" cor="var(--success)" valor={m.funil.aprovado} max={maxF} texto={String(m.funil.aprovado)} />
                <BarLinha label="Recusado" cor="var(--danger)" valor={m.funil.recusado} max={maxF} texto={String(m.funil.recusado)} />
              </>);
            })()}
          </div>
        </div>

        {/* Agenda da semana + A Receber (aging) */}
        <div className="dashboard-cols" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Agenda da semana</h3>
              <Link href="/admin/agenda" className="btn btn-outline btn-sm">Abrir agenda</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <Ring pct={m.taxaComp} cor={m.taxaComp >= 80 ? "var(--success)" : m.taxaComp >= 60 ? "var(--warning)" : "var(--danger)"} label="Comparecimento" sub={`${m.compareceu} vieram · ${m.faltou} faltaram`} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{m.agSemana} consulta{m.agSemana === 1 ? "" : "s"} nesta semana</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
                  {m.porDia.map((d) => (
                    <div key={d.data} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{d.total || ""}</div>
                      <div title={`${d.total} agendamento(s)`} style={{ width: "100%", maxWidth: 22, height: `${(d.total / maxDia) * 100}%`, minHeight: d.total > 0 ? 4 : 2, background: d.hoje ? "var(--primary)" : "var(--primary-light)", borderRadius: "3px 3px 0 0", transition: "height .4s ease" }} />
                      <div style={{ fontSize: 10, color: d.hoje ? "var(--primary)" : "var(--text-muted)", fontWeight: d.hoje ? 700 : 500, marginTop: 4 }}>{d.dow}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">A receber · por vencimento</h3>
              <Link href="/admin/receber" className="btn btn-outline btn-sm">Cobranças</Link>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total em aberto</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{brl(m.aReceber)}</div>
            </div>
            <BarLinha label="A vencer" cor="var(--info)" valor={m.aging.aVencer} max={maxAging} texto={brl(m.aging.aVencer)} />
            <BarLinha label="Vencido 1–30 dias" cor="var(--warning)" valor={m.aging.d1_30} max={maxAging} texto={brl(m.aging.d1_30)} />
            <BarLinha label="Vencido 31–60 dias" cor="#ea580c" valor={m.aging.d31_60} max={maxAging} texto={brl(m.aging.d31_60)} />
            <BarLinha label="Vencido +60 dias" cor="var(--danger)" valor={m.aging.d60} max={maxAging} texto={brl(m.aging.d60)} />
          </div>
        </div>

        <div className="dashboard-cols">
          {/* Próximos Pacientes */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Próximos Pacientes</h3>
              <Link href="/admin/agenda" className="btn btn-primary btn-sm">Ver Agenda Completa</Link>
            </div>
            {proximosAgendamentos.length === 0 ? (
              <EmptyState
                compact
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                }
                title="Sem agendamentos confirmados"
                hint="As próximas consultas confirmadas aparecem aqui."
                action={<Link href="/admin/agenda" className="btn btn-primary btn-sm">Abrir agenda</Link>}
              />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Quando</th><th>Paciente</th><th>Procedimento</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {proximosAgendamentos.map((a) => (
                      <tr key={a.id} onClick={() => abrirProntuario(a.pacienteId)} style={{ cursor: "pointer" }}>
                        <td>
                          <span className="badge badge-info">{String(a.hora).padStart(2, "0")}:{String(a.min).padStart(2, "0")}</span>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{rotuloDia(a.data)}</div>
                        </td>
                        <td><strong>{a.paciente}</strong></td>
                        <td>{a.proc}</td>
                        <td><span className="badge badge-success">Confirmado</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ações Rápidas */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Ações Rápidas</h3>
            </div>
            <div className="quick-grid">
              <Link href="/admin/pacientes" className="quick-btn">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 4v16m8-8H4" /></svg>
                <span>Novo Paciente</span>
              </Link>
              <Link href="/admin/agenda" className="quick-btn">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Agendar</span>
              </Link>
              <Link href="/admin/orcamentos" className="quick-btn">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 14l2 2 4-4M5 3h14a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2z" /></svg>
                <span>Orçamento</span>
              </Link>
              <Link href="/admin/financeiro" className="quick-btn">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                <span>Lançar Pagto</span>
              </Link>
              <Link href="/admin/receber" className="quick-btn">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
                <span>Cobranças</span>
              </Link>
              <button type="button" onClick={abrirAssistente} className="quick-btn">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <span>Assistente IA</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
