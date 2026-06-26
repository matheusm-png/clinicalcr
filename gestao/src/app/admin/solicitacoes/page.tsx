"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "@/lib/db";
import { SolicitacaoAgendamento, Profissional } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

const PERIODO_LABEL: Record<string, string> = { manha: "Manhã", tarde: "Tarde", qualquer: "Qualquer" };
const fmtData = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const fmtDataHora = (s?: string) => (s ? new Date(s).toLocaleString("pt-BR") : "—");
const fmtHora = (h?: number, m?: number) =>
  h == null ? "" : `${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;

export default function SolicitacoesPage() {
  const { showToast, confirm } = useToast();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAgendamento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [filtro, setFiltro] = useState<"pendente" | "aceita" | "recusada" | "todas">("pendente");

  // Modal aceitar
  const [aceitando, setAceitando] = useState<SolicitacaoAgendamento | null>(null);
  const [aData, setAData] = useState("");
  const [aHora, setAHora] = useState("09:00");
  const [aDur, setADur] = useState(30);
  const [aProc, setAProc] = useState("");
  const [aProf, setAProf] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [sols, profs] = await Promise.all([DB.solicitacoes.list(), DB.profissionais.list(true)]);
    setSolicitacoes(sols);
    setProfissionais(profs);
  };

  const pendentes = useMemo(() => solicitacoes.filter((s) => s.status === "pendente").length, [solicitacoes]);
  const visiveis = solicitacoes.filter((s) => filtro === "todas" || s.status === filtro);

  const abrirAceitar = (s: SolicitacaoAgendamento) => {
    setAData(s.dataPreferida || new Date().toISOString().split("T")[0]);
    setAHora(s.horaPreferida != null ? fmtHora(s.horaPreferida, s.minPreferida) : s.periodo === "tarde" ? "14:00" : "09:00");
    setADur(30);
    setAProc(s.procedimento || "Consulta");
    setAProf(profissionais.length === 1 ? String(profissionais[0].id) : "");
    setAceitando(s);
  };

  const confirmarAceitar = async () => {
    if (!aceitando) return;
    if (!aData) return showToast("Informe a data da consulta.", "error");
    const [h, m] = aHora.split(":").map(Number);
    setSalvando(true);
    try {
      await DB.solicitacoes.aceitar(aceitando, {
        data: aData, hora: h || 0, min: m || 0, dur: aDur,
        proc: aProc, profissionalId: aProf ? Number(aProf) : undefined,
      });
      setAceitando(null);
      await load();
      showToast("Consulta criada na agenda e solicitação aceita.", "success");
    } catch {
      showToast("Não foi possível aceitar a solicitação.", "error");
    } finally {
      setSalvando(false);
    }
  };

  const recusar = async (s: SolicitacaoAgendamento) => {
    if (s.id == null) return;
    if (!(await confirm("Recusar esta solicitação?", { danger: true, okLabel: "Recusar" }))) return;
    try {
      await DB.solicitacoes.recusar(s.id);
      await load();
      showToast("Solicitação recusada.", "success");
    } catch {
      showToast("Não foi possível recusar.", "error");
    }
  };

  const zap = (s: SolicitacaoAgendamento) => {
    const tel = (s.telefone || "").replace(/\D/g, "");
    const fone = tel.length >= 11 ? `55${tel}` : tel;
    const msg = encodeURIComponent(`Olá ${s.nome.split(" ")[0]}! Aqui é da Clínica LCR sobre seu pedido de agendamento.`);
    window.open(`https://wa.me/${fone}?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const badgeStatus = (st: string) =>
    st === "pendente" ? "badge-warning" : st === "aceita" ? "badge-success" : "badge-danger";

  return (
    <>
      <Topbar title="Solicitações online" />
      <main className="page-content">
        <div className="card mb-6" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {([["pendente", `Pendentes${pendentes ? ` (${pendentes})` : ""}`], ["aceita", "Aceitas"], ["recusada", "Recusadas"], ["todas", "Todas"]] as [typeof filtro, string][]).map(([k, label]) => (
            <button key={k} className={`filter-pill ${filtro === k ? "active" : ""}`} onClick={() => setFiltro(k)}>{label}</button>
          ))}
        </div>

        {visiveis.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Nenhuma solicitação"
              hint="Os pedidos de horário feitos na página pública de agendamento aparecem aqui."
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visiveis.map((s) => (
              <div key={s.id} className="card" style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 15 }}>{s.nome}</strong>
                      <span className={`badge ${badgeStatus(s.status)}`}>{s.status === "pendente" ? "Pendente" : s.status === "aceita" ? "Aceita" : "Recusada"}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                      {s.telefone}{s.email ? ` · ${s.email}` : ""}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      {s.procedimento || "Consulta"} · preferência: <strong>{fmtData(s.dataPreferida)}</strong>{s.horaPreferida != null ? <> às <strong>{fmtHora(s.horaPreferida, s.minPreferida)}</strong></> : ` (${PERIODO_LABEL[s.periodo]})`}
                    </div>
                    {s.obs && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>“{s.obs}”</div>}
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Recebido em {fmtDataHora(s.criadoEm)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn btn-sm" style={{ background: "#25D366", color: "#fff" }} onClick={() => zap(s)}>WhatsApp</button>
                    {s.status === "pendente" && (
                      <>
                        <button className="btn btn-outline btn-sm" onClick={() => recusar(s)}>Recusar</button>
                        <button className="btn btn-primary btn-sm" onClick={() => abrirAceitar(s)}>Aceitar e agendar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal aceitar */}
        {aceitando && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setAceitando(null)}>
            <div className="modal" style={{ maxWidth: 460 }}>
              <div className="modal-header">
                <span className="modal-title">Agendar — {aceitando.nome}</span>
                <button className="modal-close" onClick={() => setAceitando(null)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
                  Preferência do paciente: {fmtData(aceitando.dataPreferida)}{aceitando.horaPreferida != null ? ` às ${fmtHora(aceitando.horaPreferida, aceitando.minPreferida)}` : ` (${PERIODO_LABEL[aceitando.periodo]})`}. A consulta entra na agenda como <strong>pendente</strong>.
                </p>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Data *</label>
                    <input type="date" className="form-control" value={aData} onChange={(e) => setAData(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Horário</label>
                    <input type="time" className="form-control" value={aHora} onChange={(e) => setAHora(e.target.value)} />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Duração (min)</label>
                    <input type="number" min={10} step={5} className="form-control" value={aDur} onChange={(e) => setADur(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Profissional</label>
                    <select className="form-control" value={aProf} onChange={(e) => setAProf(e.target.value)}>
                      <option value="">Sem profissional</option>
                      {profissionais.map((p) => <option key={p.id} value={String(p.id)}>{p.nome}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Procedimento</label>
                  <input className="form-control" value={aProc} onChange={(e) => setAProc(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setAceitando(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={confirmarAceitar} disabled={salvando}>{salvando ? "Agendando…" : "Confirmar e agendar"}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
