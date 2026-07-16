"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DB } from "@/lib/db";
import { FrigobarRegistro } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import {
  FRIGOBAR_MIN,
  FRIGOBAR_MAX,
  tempForaDaFaixa,
  registroForaDaFaixa,
  imprimirRelatorioFrigobar,
} from "@/lib/estoque/visa";

export default function FrigobarPage() {
  const { showToast, confirm } = useToast();
  const [registros, setRegistros] = useState<FrigobarRegistro[]>([]);
  const [clinicaNome, setClinicaNome] = useState("Clínica");
  const [isOpen, setIsOpen] = useState(false);

  // Form state
  const [editId, setEditId] = useState<number | null>(null);
  const [data, setData] = useState("");
  const [entradaHora, setEntradaHora] = useState("");
  const [entradaTemp, setEntradaTemp] = useState("");
  const [saidaHora, setSaidaHora] = useState("");
  const [saidaTemp, setSaidaTemp] = useState("");
  const [acaoCorretiva, setAcaoCorretiva] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setRegistros(await DB.frigobar.list());
    const c = await DB.clinica.get();
    if (c?.nome) setClinicaNome(c.nome);
  };

  const abrirNovo = () => {
    setEditId(null);
    setData(new Date().toISOString().split("T")[0]);
    setEntradaHora("");
    setEntradaTemp("");
    setSaidaHora("");
    setSaidaTemp("");
    setAcaoCorretiva("");
    setResponsavel("");
    setObs("");
    setIsOpen(true);
  };

  const abrirEdit = (r: FrigobarRegistro) => {
    setEditId(r.id ?? null);
    setData(r.data);
    setEntradaHora(r.entradaHora || "");
    setEntradaTemp(r.entradaTemp != null ? String(r.entradaTemp) : "");
    setSaidaHora(r.saidaHora || "");
    setSaidaTemp(r.saidaTemp != null ? String(r.saidaTemp) : "");
    setAcaoCorretiva(r.acaoCorretiva || "");
    setResponsavel(r.responsavel || "");
    setObs(r.obs || "");
    setIsOpen(true);
  };

  // Alerta em tempo real no formulário
  const entradaNum = entradaTemp === "" ? undefined : Number(entradaTemp);
  const saidaNum = saidaTemp === "" ? undefined : Number(saidaTemp);
  const foraFaixaForm = tempForaDaFaixa(entradaNum) || tempForaDaFaixa(saidaNum);

  const salvar = async () => {
    if (!data) {
      showToast("Informe a data.", "error");
      return;
    }
    if (entradaTemp === "" && saidaTemp === "") {
      showToast("Registre ao menos uma temperatura.", "error");
      return;
    }
    // Ação corretiva obrigatória quando fora da faixa
    if (foraFaixaForm && !acaoCorretiva.trim()) {
      showToast("Temperatura fora da faixa (2–8 °C): registre a ação corretiva tomada.", "error");
      return;
    }

    const payload: FrigobarRegistro = {
      ...(editId ? { id: editId } : {}),
      data,
      entradaHora: entradaHora || undefined,
      entradaTemp: entradaNum,
      saidaHora: saidaHora || undefined,
      saidaTemp: saidaNum,
      acaoCorretiva,
      responsavel,
      obs,
    };

    try {
      await DB.frigobar.save(payload);
      setIsOpen(false);
      await load();
      showToast("Registro salvo.", "success");
    } catch {
      showToast("Não foi possível salvar o registro.", "error");
    }
  };

  const remover = async (id?: number) => {
    if (id == null) return;
    if (!(await confirm("Remover este registro de temperatura?", { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.frigobar.remove(id);
      await load();
      showToast("Registro removido.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  const ocorrencias = registros.filter(registroForaDaFaixa).length;

  const tempCell = (t?: number) =>
    t == null ? (
      <span style={{ color: "var(--text-muted)" }}>—</span>
    ) : (
      <span style={{ fontWeight: 700, color: tempForaDaFaixa(t) ? "var(--danger)" : "var(--text)" }}>
        {t} °C
      </span>
    );

  return (
    <>
      <Topbar title="Controle do Frigobar">
        <Link href="/admin/estoque" className="btn btn-outline btn-sm">
          ← Estoque
        </Link>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => { if (!imprimirRelatorioFrigobar(registros, clinicaNome)) showToast("Libere os pop-ups para gerar o relatório.", "error"); }}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
          </svg>
          Relatório VISA (PDF)
        </button>
        <button className="btn btn-primary" onClick={abrirNovo}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo registro
        </button>
      </Topbar>

      <main className="page-content">
        {/* Faixa aceitável + ocorrências */}
        <div className="card mb-6" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 0.3 }}>Faixa aceitável</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0369a1" }}>{FRIGOBAR_MIN} °C a {FRIGOBAR_MAX} °C</div>
          </div>
          <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 0.3 }}>Registros</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{registros.length}</div>
          </div>
          <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 0.3 }}>Fora da faixa</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ocorrencias > 0 ? "var(--danger)" : "#16A34A" }}>{ocorrencias}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {registros.length === 0 ? (
            <EmptyState
              title="Nenhum registro de temperatura"
              hint="Registre a temperatura do frigobar na entrada e na saída do expediente."
              action={<button className="btn btn-primary btn-sm" onClick={abrirNovo}>+ Novo registro</button>}
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Entrada</th>
                    <th>Temp.</th>
                    <th>Saída</th>
                    <th>Temp.</th>
                    <th>Faixa</th>
                    <th>Ação corretiva</th>
                    <th>Responsável</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {[...registros]
                    .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
                    .map((r) => {
                      const fora = registroForaDaFaixa(r);
                      return (
                        <tr key={r.id} style={{ borderLeft: fora ? "3px solid var(--danger)" : "" }}>
                          <td>{r.data ? new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                          <td style={{ color: "var(--text-muted)" }}>{r.entradaHora || "—"}</td>
                          <td>{tempCell(r.entradaTemp)}</td>
                          <td style={{ color: "var(--text-muted)" }}>{r.saidaHora || "—"}</td>
                          <td>{tempCell(r.saidaTemp)}</td>
                          <td>
                            <span className={`badge ${fora ? "badge-danger" : "badge-success"}`}>{fora ? "Fora" : "OK"}</span>
                          </td>
                          <td style={{ fontSize: 12, color: fora && !r.acaoCorretiva ? "var(--danger)" : "var(--text-muted)" }}>
                            {r.acaoCorretiva || (fora ? "Registrar ação!" : "—")}
                          </td>
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.responsavel || "—"}</td>
                          <td>
                            <div className="row-actions">
                              <button className="icon-btn" title="Editar" onClick={() => abrirEdit(r)}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button className="icon-btn danger" title="Excluir" onClick={() => remover(r.id)}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal registro */}
        {isOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">{editId ? "Editar registro" : "Novo registro de temperatura"}</span>
                <button className="modal-close" onClick={() => setIsOpen(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Data *</label>
                  <input type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Hora entrada</label>
                    <input type="time" className="form-control" value={entradaHora} onChange={(e) => setEntradaHora(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temp. entrada (°C)</label>
                    <input type="number" step="0.1" className="form-control" placeholder="Ex: 4,5" value={entradaTemp} onChange={(e) => setEntradaTemp(e.target.value)}
                      style={tempForaDaFaixa(entradaNum) ? { borderColor: "var(--danger)", color: "var(--danger)" } : undefined} />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Hora saída</label>
                    <input type="time" className="form-control" value={saidaHora} onChange={(e) => setSaidaHora(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temp. saída (°C)</label>
                    <input type="number" step="0.1" className="form-control" placeholder="Ex: 6,0" value={saidaTemp} onChange={(e) => setSaidaTemp(e.target.value)}
                      style={tempForaDaFaixa(saidaNum) ? { borderColor: "var(--danger)", color: "var(--danger)" } : undefined} />
                  </div>
                </div>

                {foraFaixaForm && (
                  <div className="alert-banner" style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", marginBottom: 14 }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, flexShrink: 0 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Temperatura fora da faixa de {FRIGOBAR_MIN}–{FRIGOBAR_MAX} °C. Descreva a ação corretiva tomada.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Ação corretiva {foraFaixaForm && <span style={{ color: "var(--danger)" }}>*</span>}</label>
                  <textarea className="form-control" rows={2} placeholder="Ex: Ajustado termostato; produtos transferidos temporariamente…"
                    value={acaoCorretiva} onChange={(e) => setAcaoCorretiva(e.target.value)} />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Responsável</label>
                    <input type="text" className="form-control" placeholder="Quem aferiu" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Observações</label>
                    <input type="text" className="form-control" value={obs} onChange={(e) => setObs(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setIsOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar}>Salvar</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
