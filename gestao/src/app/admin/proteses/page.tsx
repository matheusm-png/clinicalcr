"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "@/lib/db";
import { Protese, Paciente, StatusProtese } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().split("T")[0];
const fmtData = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");

const STAGES: { key: StatusProtese; label: string; cor: string }[] = [
  { key: "solicitada", label: "Solicitada", cor: "var(--text-muted)" },
  { key: "laboratorio", label: "No laboratório", cor: "var(--warning)" },
  { key: "retornou", label: "Retornou", cor: "#0ea5e9" },
  { key: "instalada", label: "Instalada", cor: "var(--success)" },
];
const stageIndex = (s: StatusProtese) => Math.max(0, STAGES.findIndex((x) => x.key === s));

const TIPOS = ["Coroa", "Coroa sobre implante", "Faceta", "Prótese Parcial Removível (PPR)", "Prótese Total", "Protocolo", "Provisório", "Onlay/Inlay", "Núcleo", "Placa de bruxismo"];

export default function ProtesesPage() {
  const { showToast, confirm } = useToast();
  const [proteses, setProteses] = useState<Protese[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  // Modal de criação/edição
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [fPaciente, setFPaciente] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fDente, setFDente] = useState("");
  const [fLab, setFLab] = useState("");
  const [fCor, setFCor] = useState("");
  const [fMaterial, setFMaterial] = useState("");
  const [fValor, setFValor] = useState("");
  const [fPrev, setFPrev] = useState("");
  const [fObs, setFObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [ps, pacs] = await Promise.all([DB.proteses.list(), DB.pacientes.list()]);
    setProteses(ps);
    setPacientes(pacs);
  };

  const nomePaciente = (id: number) => pacientes.find((p) => p.id === id)?.nome ?? "—";
  // Atrasada = ainda no laboratório/solicitada e passou da previsão de retorno.
  const atrasada = (p: Protese) =>
    (p.status === "solicitada" || p.status === "laboratorio") && !!p.previsaoRetorno && p.previsaoRetorno < hoje();

  const totais = useMemo(() => ({
    emLab: proteses.filter((p) => p.status === "laboratorio").length,
    atrasadas: proteses.filter(atrasada).length,
    aInstalar: proteses.filter((p) => p.status === "retornou").length,
  }), [proteses]);

  const abrirNova = () => {
    setEditId(null);
    setFPaciente(""); setFTipo(""); setFDente(""); setFLab(""); setFCor(""); setFMaterial(""); setFValor(""); setFPrev(""); setFObs("");
    setOpen(true);
  };

  const abrirEdicao = (p: Protese) => {
    setEditId(p.id ?? null);
    setFPaciente(String(p.pacienteId));
    setFTipo(p.tipo);
    setFDente(p.dente ?? "");
    setFLab(p.laboratorio ?? "");
    setFCor(p.cor ?? "");
    setFMaterial(p.material ?? "");
    setFValor(p.valor ? String(p.valor) : "");
    setFPrev(p.previsaoRetorno ?? "");
    setFObs(p.obs ?? "");
    setOpen(true);
  };

  const salvar = async () => {
    if (!fPaciente || !fTipo) return showToast("Informe o paciente e o tipo de prótese.", "error");
    setSalvando(true);
    const base = proteses.find((p) => p.id === editId);
    try {
      await DB.proteses.save({
        ...(editId ? { id: editId } : {}),
        pacienteId: Number(fPaciente),
        tipo: fTipo,
        dente: fDente,
        laboratorio: fLab,
        cor: fCor,
        material: fMaterial,
        valor: fValor ? Number(fValor) : 0,
        status: base?.status ?? "solicitada",
        enviadoEm: base?.enviadoEm,
        previsaoRetorno: fPrev || undefined,
        instaladoEm: base?.instaladoEm,
        obs: fObs,
      });
      setOpen(false);
      await load();
      showToast(editId ? "Prótese atualizada." : "Prótese cadastrada.", "success");
    } catch {
      showToast("Não foi possível salvar.", "error");
    } finally {
      setSalvando(false);
    }
  };

  // Move a prótese de etapa, carimbando datas automáticas.
  const mover = async (p: Protese, delta: number) => {
    const novo = Math.min(STAGES.length - 1, Math.max(0, stageIndex(p.status) + delta));
    const status = STAGES[novo].key;
    if (status === p.status) return;
    setSalvandoId(p.id ?? null);
    try {
      await DB.proteses.save({
        ...p,
        status,
        enviadoEm: status === "laboratorio" && !p.enviadoEm ? hoje() : p.enviadoEm,
        instaladoEm: status === "instalada" && !p.instaladoEm ? hoje() : p.instaladoEm,
      });
      await load();
    } catch {
      showToast("Não foi possível mover.", "error");
    } finally {
      setSalvandoId(null);
    }
  };

  const remover = async (p: Protese) => {
    if (p.id == null) return;
    if (!(await confirm("Remover esta prótese do controle?", { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.proteses.remove(p.id);
      await load();
      showToast("Prótese removida.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  return (
    <>
      <Topbar title="Controle protético">
        <button className="btn btn-primary" onClick={abrirNova}>+ Nova prótese</button>
      </Topbar>

      <main className="page-content">
        {/* KPIs */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="card" style={{ padding: "14px 18px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>No laboratório</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--warning)" }}>{totais.emLab}</div>
          </div>
          <div className="card" style={{ padding: "14px 18px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Prontas p/ instalar</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0ea5e9" }}>{totais.aInstalar}</div>
          </div>
          <div className="card" style={{ padding: "14px 18px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Atrasadas</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: totais.atrasadas > 0 ? "var(--danger)" : "var(--text)" }}>{totais.atrasadas}</div>
          </div>
        </div>

        {proteses.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Nenhuma prótese em acompanhamento"
              hint="Cadastre uma prótese para acompanhá-la do laboratório até a instalação."
              action={<button className="btn btn-primary btn-sm" onClick={abrirNova}>+ Nova prótese</button>}
            />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {STAGES.map((stage, ci) => {
              const itens = proteses.filter((p) => p.status === stage.key);
              return (
                <div key={stage.key} style={{ flex: "1 0 250px", minWidth: 250, background: "var(--bg2, #f8fafc)", borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: stage.cor, display: "inline-block" }} />
                      {stage.label}
                    </strong>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg, #fff)", borderRadius: 10, padding: "1px 8px" }}>{itens.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {itens.map((p) => {
                      const idx = stageIndex(p.status);
                      const late = atrasada(p);
                      return (
                        <div key={p.id} style={{ background: "var(--bg, #fff)", border: `1px solid ${late ? "var(--danger)" : "var(--border)"}`, borderRadius: 8, padding: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{nomePaciente(p.pacienteId)}</div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="icon-btn" title="Editar" onClick={() => abrirEdicao(p)} style={{ padding: 2 }}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
                              </button>
                              <button className="icon-btn danger" title="Remover" onClick={() => remover(p)} style={{ padding: 2 }}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, marginTop: 2 }}>{p.tipo}{p.dente ? ` · dente ${p.dente}` : ""}</div>
                          {p.laboratorio && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Lab: {p.laboratorio}</div>}
                          {(p.cor || p.material) && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{[p.material, p.cor && `cor ${p.cor}`].filter(Boolean).join(" · ")}</div>}
                          {p.status !== "instalada" && p.previsaoRetorno && (
                            <div style={{ fontSize: 11, color: late ? "var(--danger)" : "var(--text-muted)", fontWeight: late ? 700 : 400 }}>
                              {late ? "Atrasada — prev. " : "Prev. retorno: "}{fmtData(p.previsaoRetorno)}
                            </div>
                          )}
                          {p.status === "instalada" && p.instaladoEm && (
                            <div style={{ fontSize: 11, color: "var(--success)" }}>Instalada em {fmtData(p.instaladoEm)}</div>
                          )}
                          {!!p.valor && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Lab: {brl(p.valor)}</div>}
                          <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "flex-end" }}>
                            <button className="btn btn-outline btn-sm" style={{ padding: "4px 8px" }} disabled={idx === 0 || salvandoId === p.id} onClick={() => mover(p, -1)} title="Voltar etapa">←</button>
                            <button className="btn btn-outline btn-sm" style={{ padding: "4px 8px" }} disabled={idx === STAGES.length - 1 || salvandoId === p.id} onClick={() => mover(p, +1)} title="Avançar etapa">→</button>
                          </div>
                        </div>
                      );
                    })}
                    {itens.length === 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "10px 0" }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal nova/editar prótese */}
        {open && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="modal" style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <span className="modal-title">{editId ? "Editar prótese" : "Nova prótese"}</span>
                <button className="modal-close" onClick={() => setOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Paciente *</label>
                  <select className="form-control" value={fPaciente} onChange={(e) => setFPaciente(e.target.value)}>
                    <option value="">Selecionar…</option>
                    {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Tipo *</label>
                    <input className="form-control" list="tipos-protese" value={fTipo} onChange={(e) => setFTipo(e.target.value)} placeholder="Ex.: Coroa" />
                    <datalist id="tipos-protese">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dente(s)</label>
                    <input className="form-control" value={fDente} onChange={(e) => setFDente(e.target.value)} placeholder="Ex.: 16, 21" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Laboratório</label>
                  <input className="form-control" value={fLab} onChange={(e) => setFLab(e.target.value)} placeholder="Nome do laboratório" />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Material</label>
                    <input className="form-control" value={fMaterial} onChange={(e) => setFMaterial(e.target.value)} placeholder="Zircônia, metalocerâmica…" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cor</label>
                    <input className="form-control" value={fCor} onChange={(e) => setFCor(e.target.value)} placeholder="Ex.: A2" />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Valor do laboratório (R$)</label>
                    <input type="number" min="0" step="0.01" className="form-control" value={fValor} onChange={(e) => setFValor(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Previsão de retorno</label>
                    <input type="date" className="form-control" value={fPrev} onChange={(e) => setFPrev(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea className="form-control" rows={2} value={fObs} onChange={(e) => setFObs(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
