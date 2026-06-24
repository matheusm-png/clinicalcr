"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { Agendamento, Paciente, Profissional } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function AgendaPage() {
  const { showToast, confirm } = useToast();
  const [appointments, setAppointments] = useState<Agendamento[]>([]);
  const [patients, setPatients] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [filtroProf, setFiltroProf] = useState<number | "todos">("todos");
  const [currentMonday, setCurrentMonday] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [modalId, setModalId] = useState<string>("");
  const [modalPaciente, setModalPaciente] = useState<string>("");
  const [modalProcedimento, setModalProcedimento] = useState<string>("");
  const [modalProfissional, setModalProfissional] = useState<number | "">("");
  const [modalData, setModalData] = useState<string>("");
  const [modalHorario, setModalHorario] = useState<string>("08:00");
  const [modalDuracao, setModalDuracao] = useState<number>(30);
  const [modalStatus, setModalStatus] = useState<"confirmado" | "pendente" | "bloqueado">("confirmado");
  const [modalPresenca, setModalPresenca] = useState<"agendado" | "compareceu" | "faltou">("agendado");
  const [modalObs, setModalObs] = useState<string>("");

  useEffect(() => {
    // Obter segunda-feira atual
    setCurrentMonday(getMonday(new Date()));
    loadData();
  }, []);

  const loadData = async () => {
    const [ags, pacs, profs] = await Promise.all([
      DB.agendamentos.list(),
      DB.pacientes.list(),
      DB.profissionais.list(true),
    ]);
    setAppointments(ags);
    setPatients(pacs);
    setProfissionais(profs);
  };

  // Mapa id→cor para pintar os blocos por profissional.
  const corProf = (id?: number) => profissionais.find((p) => p.id === id)?.cor;
  const nomeProf = (id?: number) => profissionais.find((p) => p.id === id)?.nome;

  // Agendamentos visíveis conforme o filtro de profissional.
  const visiveis = filtroProf === "todos"
    ? appointments
    : appointments.filter((a) => a.profissionalId === filtroProf);

  function getMonday(d: Date) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    dt.setDate(diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  const formatRange = (monday: Date) => {
    const fri = new Date(monday);
    fri.setDate(fri.getDate() + 6);
    const m = monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const f = fri.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    return `${m} – ${f}`;
  };

  const getWeekDays = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(prev.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(next.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleToday = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  const openNewModal = (dia?: number, hora?: number, min?: number) => {
    setModalId("");
    setModalPaciente("");
    setModalProcedimento("");
    setModalObs("");
    setModalStatus("confirmado");
    setModalPresenca("agendado");
    setModalDuracao(30);
    // Pré-seleciona o profissional do filtro (ou o primeiro ativo).
    setModalProfissional(filtroProf !== "todos" ? filtroProf : (profissionais[0]?.id ?? ""));

    const d = new Date(currentMonday);
    if (dia !== undefined && hora !== undefined && min !== undefined) {
      d.setDate(d.getDate() + dia);
      setModalHorario(`${String(hora).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    } else {
      setModalHorario("08:00");
    }
    setModalData(d.toISOString().split("T")[0]);
    setIsModalOpen(true);
  };

  const openEditModal = (appt: Agendamento) => {
    setModalId(String(appt.id));
    setModalPaciente(appt.paciente);
    setModalProcedimento(appt.proc);
    setModalStatus(appt.status);
    setModalDuracao(appt.dur || 30);
    setModalProfissional(appt.profissionalId ?? "");
    setModalPresenca(appt.presenca ?? "agendado");
    setModalObs(appt.obs || "");

    const d = new Date(currentMonday);
    d.setDate(d.getDate() + appt.dia);
    setModalData(d.toISOString().split("T")[0]);
    setModalHorario(`${String(appt.hora).padStart(2, "0")}:${String(appt.min).padStart(2, "0")}`);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!modalId) return;
    if (await confirm("Tem certeza que deseja excluir esta consulta?", { danger: true, okLabel: "Excluir" })) {
      try {
        await DB.agendamentos.remove(Number(modalId));
        setIsModalOpen(false);
        await loadData();
        showToast("Consulta excluída.", "success");
      } catch {
        showToast("Não foi possível excluir a consulta.", "error");
      }
    }
  };

  const handleSave = async () => {
    if (!modalPaciente || !modalProcedimento || !modalData || !modalHorario) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    const selDate = new Date(modalData + "T00:00:00");
    const MondayTime = new Date(currentMonday).setHours(0, 0, 0, 0);
    const SelTime = selDate.getTime();
    const diffDays = Math.round((SelTime - MondayTime) / (1000 * 60 * 60 * 24));

    const [h, m] = modalHorario.split(":").map(Number);

    // Buscar ID do paciente se já existir cadastrado
    const patientObj = patients.find((p) => p.nome === modalPaciente);

    const appt: Agendamento = {
      ...(modalId ? { id: Number(modalId) } : {}),
      paciente: modalPaciente,
      pacienteId: patientObj ? patientObj.id : undefined,
      proc: modalProcedimento,
      dia: diffDays,
      hora: h,
      min: m,
      dur: modalDuracao,
      status: modalStatus,
      profissionalId: modalProfissional === "" ? undefined : Number(modalProfissional),
      presenca: modalPresenca,
      obs: modalObs,
    };

    try {
      await DB.agendamentos.save(appt);
      setIsModalOpen(false);
      await loadData();
      showToast(modalId ? "Consulta atualizada." : "Consulta agendada.", "success");
    } catch {
      showToast("Não foi possível salvar a consulta.", "error");
    }
  };

  const days = getWeekDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <>
      <Topbar title="Agenda">
        <button className="btn btn-primary" onClick={() => openNewModal()}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova Consulta
        </button>
      </Topbar>

      <main className="page-content">
        {/* Toolbar */}
        <div className="card mb-6">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={handlePrevWeek}>
                &#8249;
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, minWidth: 160, textAlign: "center" }}>
                {formatRange(currentMonday)}
              </span>
              <button className="btn btn-outline btn-sm" onClick={handleNextWeek}>
                &#8250;
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleToday}>
                Hoje
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <select
                className="form-control"
                style={{ width: "auto", padding: "7px 12px", fontSize: 13 }}
                value={filtroProf}
                onChange={(e) => setFiltroProf(e.target.value === "todos" ? "todos" : Number(e.target.value))}
              >
                <option value="todos">Todos os profissionais</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grade Semanal */}
        <div className="card agenda-grid">
          <table className="agenda-table">
            <thead>
              <tr>
                <th className="time-col">Horário</th>
                {days.map((d, i) => {
                  const isToday = d.getTime() === today.getTime();
                  return (
                    <th key={i} style={isToday ? { background: "var(--primary)", color: "white" } : {}}>
                      {isToday ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#fff",
                            color: "var(--primary)",
                            fontWeight: 700,
                            marginRight: 4,
                          }}
                        >
                          {d.getDate()}
                        </span>
                      ) : (
                        `${d.getDate()} `
                      )}
                      {DAYS_SHORT[d.getDay()]}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((h) => {
                return (
                  <React.Fragment key={h}>
                    {/* Slot de :00 */}
                    <tr>
                      <td className="time-cell" rowSpan={2}>
                        {String(h).padStart(2, "0")}:00
                      </td>
                      {days.map((d, di) => {
                        const appt = visiveis.find((a) => a.dia === di && a.hora === h && a.min < 30);
                        if (appt) {
                          return (
                            <td key={di} style={{ padding: 3 }} className="clickable" onClick={() => openEditModal(appt)}>
                              <div
                                className={`appt-block ${appt.status}`}
                                title={`${appt.paciente} — ${appt.proc}${nomeProf(appt.profissionalId) ? " · " + nomeProf(appt.profissionalId) : ""}${appt.presenca === "compareceu" ? " (compareceu)" : appt.presenca === "faltou" ? " (faltou)" : ""}`}
                                style={{
                                  ...(appt.status !== "bloqueado" && corProf(appt.profissionalId) ? { borderLeft: `4px solid ${corProf(appt.profissionalId)}` } : {}),
                                  ...(appt.presenca === "faltou" ? { opacity: 0.5 } : {}),
                                }}
                              >
                                <span style={{ fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                                  {appt.presenca === "compareceu" && <span aria-hidden>✓</span>}
                                  {appt.presenca === "faltou" && <span aria-hidden>✕</span>}
                                  {appt.proc}
                                </span>
                                <span style={{ fontSize: 9, opacity: 0.85 }}>{appt.paciente}</span>
                              </div>
                            </td>
                          );
                        } else {
                          return (
                            <td key={di} className="clickable" onClick={() => openNewModal(di, h, 0)}></td>
                          );
                        }
                      })}
                    </tr>
                    {/* Slot de :30 */}
                    <tr>
                      {days.map((d, di) => {
                        const appt = visiveis.find((a) => a.dia === di && a.hora === h && a.min >= 30);
                        if (appt) {
                          return (
                            <td key={di} style={{ padding: 3 }} className="clickable" onClick={() => openEditModal(appt)}>
                              <div
                                className={`appt-block ${appt.status}`}
                                title={`${appt.paciente} — ${appt.proc}${nomeProf(appt.profissionalId) ? " · " + nomeProf(appt.profissionalId) : ""}${appt.presenca === "compareceu" ? " (compareceu)" : appt.presenca === "faltou" ? " (faltou)" : ""}`}
                                style={{
                                  ...(appt.status !== "bloqueado" && corProf(appt.profissionalId) ? { borderLeft: `4px solid ${corProf(appt.profissionalId)}` } : {}),
                                  ...(appt.presenca === "faltou" ? { opacity: 0.5 } : {}),
                                }}
                              >
                                <span style={{ fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                                  {appt.presenca === "compareceu" && <span aria-hidden>✓</span>}
                                  {appt.presenca === "faltou" && <span aria-hidden>✕</span>}
                                  {appt.proc}
                                </span>
                                <span style={{ fontSize: 9, opacity: 0.85 }}>{appt.paciente}</span>
                              </div>
                            </td>
                          );
                        } else {
                          return (
                            <td key={di} className="clickable" onClick={() => openNewModal(di, h, 30)}></td>
                          );
                        }
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--primary-dark)", display: "inline-block" }}></span>{" "}
            Confirmado
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--warning)", display: "inline-block" }}></span> Pentente
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#CBD5E1", display: "inline-block" }}></span> Bloqueado
          </div>
        </div>

        {/* Modal Novo/Editar Agendamento */}
        {isModalOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">{modalId ? "Editar Consulta" : "Nova Consulta"}</span>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Paciente *</label>
                    <select
                      className="form-control"
                      value={modalPaciente}
                      onChange={(e) => setModalPaciente(e.target.value)}
                    >
                      <option value="">Selecionar paciente...</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.nome}>
                          {p.nome}
                        </option>
                      ))}
                      {/* Caso o paciente não esteja listado, permitir digitar ou apenas listar os criados */}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Profissional</label>
                    <select
                      className="form-control"
                      value={modalProfissional}
                      onChange={(e) => setModalProfissional(e.target.value === "" ? "" : Number(e.target.value))}
                    >
                      <option value="">Sem profissional</option>
                      {profissionais.map((p) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Procedimento *</label>
                  <select
                    className="form-control"
                    value={modalProcedimento}
                    onChange={(e) => setModalProcedimento(e.target.value)}
                  >
                    <option value="">Selecionar procedimento...</option>
                    <option value="Consulta de Avaliação">Consulta de Avaliação</option>
                    <option value="Consulta de Retorno">Consulta de Retorno</option>
                    <option value="Extração">Extração</option>
                    <option value="Clareamento">Clareamento</option>
                    <option value="Ortodontia">Ortodontia</option>
                    <option value="Implante">Implante</option>
                    <option value="Limpeza / Profilaxia">Limpeza / Profilaxia</option>
                    <option value="Canal (Endodontia)">Canal (Endodontia)</option>
                    <option value="Restauração">Restauração</option>
                    <option value="Prótese">Prótese</option>
                  </select>
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label className="form-label">Data *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={modalData}
                      onChange={(e) => setModalData(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Horário *</label>
                    <select
                      className="form-control"
                      value={modalHorario}
                      onChange={(e) => setModalHorario(e.target.value)}
                    >
                      <option value="08:00">08:00</option>
                      <option value="08:30">08:30</option>
                      <option value="09:00">09:00</option>
                      <option value="09:30">09:30</option>
                      <option value="10:00">10:00</option>
                      <option value="10:30">10:30</option>
                      <option value="11:00">11:00</option>
                      <option value="11:30">11:30</option>
                      <option value="12:00">12:00</option>
                      <option value="12:30">12:30</option>
                      <option value="13:00">13:00</option>
                      <option value="13:30">13:30</option>
                      <option value="14:00">14:00</option>
                      <option value="14:30">14:30</option>
                      <option value="15:00">15:00</option>
                      <option value="15:30">15:30</option>
                      <option value="16:00">16:00</option>
                      <option value="16:30">16:30</option>
                      <option value="17:00">17:00</option>
                      <option value="17:30">17:30</option>
                      <option value="18:00">18:00</option>
                      <option value="18:30">18:30</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duração</label>
                    <select
                      className="form-control"
                      value={modalDuracao}
                      onChange={(e) => setModalDuracao(Number(e.target.value))}
                    >
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                      <option value="90">90 min</option>
                      <option value="120">120 min</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as any)}
                  >
                    <option value="confirmado">Confirmado</option>
                    <option value="pendente">Pendente de confirmação</option>
                    <option value="bloqueado">Bloqueio de horário</option>
                  </select>
                </div>
                {modalId && modalStatus !== "bloqueado" && (
                  <div className="form-group">
                    <label className="form-label">Comparecimento</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {([
                        { v: "agendado", label: "Agendado" },
                        { v: "compareceu", label: "Compareceu" },
                        { v: "faltou", label: "Faltou" },
                      ] as const).map((opt) => {
                        const ativo = modalPresenca === opt.v;
                        const cor = opt.v === "compareceu" ? "#16A34A" : opt.v === "faltou" ? "#EF4444" : "var(--primary)";
                        return (
                          <button
                            key={opt.v}
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setModalPresenca(opt.v)}
                            style={{
                              background: ativo ? cor : "var(--bg2)",
                              color: ativo ? "#fff" : "var(--text-muted)",
                              border: `1px solid ${ativo ? cor : "var(--border)"}`,
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Anotações sobre a consulta..."
                    value={modalObs}
                    onChange={(e) => setModalObs(e.target.value)}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: "space-between" }}>
                <div>
                  {modalId && (
                    <button className="btn btn-danger" onClick={handleDelete}>
                      Excluir
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={handleSave}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

// React.Fragment helper inside Next.js needs import or custom React reference
import React from "react";
