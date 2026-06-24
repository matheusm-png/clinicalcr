"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DB } from "@/lib/db";
import { Paciente, Agendamento, TransacaoFinanceira, ContaReceber } from "@/lib/types";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";

const brl = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 });
const hoje = () => new Date().toISOString().split("T")[0];

export default function DashboardPage() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [financeiro, setFinanceiro] = useState<TransacaoFinanceira[]>([]);
  const [contas, setContas] = useState<ContaReceber[]>([]);

  useEffect(() => {
    (async () => {
      const [pac, ag, fin, cts] = await Promise.all([
        DB.pacientes.list(),
        DB.agendamentos.list(),
        DB.financeiro.list(),
        DB.contas.list(),
      ]);
      setPacientes(pac);
      setAgendamentos(ag);
      setFinanceiro(fin);
      setContas(cts);
    })();
  }, []);

  const faturamentoMensal = financeiro
    .filter((f) => f.tipo === "receita" && f.status === "pago")
    .reduce((sum, item) => sum + item.valor, 0);

  const pacientesAtivos = pacientes.filter((p) => p.status === "Ativo").length;
  const agendamentosHoje = agendamentos.filter((a) => a.status === "confirmado").length;

  // A Receber agora vem das contas/parcelas (mais fiel que os lançamentos pendentes)
  const parcelas = contas.filter((c) => c.status !== "cancelada").flatMap((c) => c.parcelas ?? []);
  const aReceber = parcelas.filter((p) => !p.pago).reduce((s, p) => s + p.valor, 0);
  const emAtraso = parcelas.filter((p) => !p.pago && p.vencimento && p.vencimento < hoje()).reduce((s, p) => s + p.valor, 0);

  const proximosAgendamentos = agendamentos.filter((a) => a.status === "confirmado").slice(0, 5);

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

  return (
    <>
      <Topbar title="Início" />

      <main className="page-content">
        {/* Destaque Assistente IA */}
        <Link
          href="/admin/assistente"
          style={{
            display: "flex", alignItems: "center", gap: 16, textDecoration: "none",
            background: "linear-gradient(120deg, var(--primary-darker), var(--primary))",
            color: "#fff", borderRadius: "var(--radius-lg)", padding: "16px 20px", marginBottom: 24,
            boxShadow: "var(--shadow-md)",
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
        </Link>

        {/* Cards de Métricas */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            </div>
            <div>
              <div className="stat-value">{brl(faturamentoMensal)}</div>
              <div className="stat-label">Faturamento (recebido)</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="stat-value">{pacientesAtivos}</div>
              <div className="stat-label">Pacientes Ativos</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="stat-value">{agendamentosHoje}</div>
              <div className="stat-label">Agendamentos hoje</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="stat-value">{brl(aReceber)}</div>
              <div className="stat-label">
                A Receber{emAtraso > 0 && <span style={{ color: "var(--danger)", fontWeight: 600 }}> · {brl(emAtraso)} em atraso</span>}
              </div>
            </div>
          </div>
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
                    <tr><th>Horário</th><th>Paciente</th><th>Procedimento</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {proximosAgendamentos.map((a) => (
                      <tr key={a.id} onClick={() => abrirProntuario(a.pacienteId)} style={{ cursor: "pointer" }}>
                        <td><span className="badge badge-info">{String(a.hora).padStart(2, "0")}:{String(a.min).padStart(2, "0")}</span></td>
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
              <Link href="/admin/assistente" className="quick-btn">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <span>Assistente IA</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
