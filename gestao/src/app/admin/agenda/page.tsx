"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { Agendamento, Paciente, Profissional, Marcador } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MINI_DOW = ["S", "T", "Q", "Q", "S", "S", "D"]; // Seg..Dom (mini-calendário)

// 'yyyy-mm-dd' em horário LOCAL (evita o shift de fuso do toISOString).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AgendaPage() {
  const { showToast, confirm } = useToast();
  const [appointments, setAppointments] = useState<Agendamento[]>([]);
  const [patients, setPatients] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [marcadores, setMarcadores] = useState<Marcador[]>([]);
  const [horaInicio, setHoraInicio] = useState(7);
  const [horaFim, setHoraFim] = useState(19);
  const [filtroProf, setFiltroProf] = useState<number | "todos">("todos");
  const [currentMonday, setCurrentMonday] = useState<Date>(new Date());
  // Mês exibido no mini-calendário lateral (1º dia do mês).
  const [miniRef, setMiniRef] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [modalId, setModalId] = useState<string>("");
  const [modalPaciente, setModalPaciente] = useState<string>("");
  const [modalProcedimento, setModalProcedimento] = useState<string>("");
  const [modalProfissional, setModalProfissional] = useState<number | "">("");
  const [modalMarcador, setModalMarcador] = useState<number | "">("");
  // "consulta" = agendamento normal; "bloqueio" = horário indisponível (sem paciente).
  const [modalTipo, setModalTipo] = useState<"consulta" | "bloqueio">("consulta");
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
    const [ags, pacs, profs, marcs, clinica] = await Promise.all([
      DB.agendamentos.list(),
      DB.pacientes.list(),
      DB.profissionais.list(true),
      DB.marcadores.list(),
      DB.clinica.get(),
    ]);
    setAppointments(ags);
    setPatients(pacs);
    setProfissionais(profs);
    setMarcadores(marcs);
    if (clinica?.agendaHoraInicio != null) setHoraInicio(clinica.agendaHoraInicio);
    if (clinica?.agendaHoraFim != null) setHoraFim(clinica.agendaHoraFim);
  };

  // Faixa de horas da grade, conforme o horário de funcionamento da clínica.
  const HOURS = Array.from({ length: Math.max(1, horaFim - horaInicio) }, (_, i) => horaInicio + i);
  // Opções de horário (a cada 30 min) dentro do funcionamento.
  const timeSlots = HOURS.flatMap((hh) => [`${String(hh).padStart(2, "0")}:00`, `${String(hh).padStart(2, "0")}:30`]);

  // Mapa id→cor para pintar os blocos por profissional.
  const corProf = (id?: number) => profissionais.find((p) => p.id === id)?.cor;
  const nomeProf = (id?: number) => profissionais.find((p) => p.id === id)?.nome;
  // Marcador (rótulo colorido) do agendamento.
  const marcadorDe = (id?: number) => marcadores.find((m) => m.id === id);

  // Agendamentos visíveis na grade: exclui desmarcados (vão p/ a Recuperação)
  // e aplica o filtro de profissional.
  const visiveis = appointments
    .filter((a) => !a.cancelado)
    .filter((a) => filtroProf === "todos" || a.profissionalId === filtroProf);

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
    setMiniRef(new Date(prev));
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(next.getDate() + 7);
    setCurrentMonday(next);
    setMiniRef(new Date(next));
  };

  const handleToday = () => {
    setCurrentMonday(getMonday(new Date()));
    setMiniRef(new Date());
  };

  // Clica num dia do mini-calendário → salta a grade para a semana dele.
  const selectDay = (d: Date) => {
    setCurrentMonday(getMonday(d));
    setMiniRef(new Date(d));
  };

  // Navega o mês do mini-calendário (sem mexer na semana exibida).
  const miniPrevMonth = () => setMiniRef(new Date(miniRef.getFullYear(), miniRef.getMonth() - 1, 1));
  const miniNextMonth = () => setMiniRef(new Date(miniRef.getFullYear(), miniRef.getMonth() + 1, 1));

  // Grade do mês (6 semanas, começando na segunda) para o mini-calendário.
  const miniGrid = () => {
    const y = miniRef.getFullYear();
    const m = miniRef.getMonth();
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // 0 = segunda
    const start = new Date(y, m, 1 - firstDow);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const openNewModal = (dia?: number, hora?: number, min?: number, tipo: "consulta" | "bloqueio" = "consulta") => {
    setModalId("");
    setModalPaciente("");
    setModalProcedimento("");
    setModalObs("");
    setModalTipo(tipo);
    setModalStatus(tipo === "bloqueio" ? "bloqueado" : "confirmado");
    setModalPresenca("agendado");
    setModalDuracao(tipo === "bloqueio" ? 60 : 30);
    setModalMarcador("");
    // Pré-seleciona o profissional do filtro (ou o primeiro ativo).
    setModalProfissional(filtroProf !== "todos" ? filtroProf : (profissionais[0]?.id ?? ""));

    const d = new Date(currentMonday);
    if (dia !== undefined && hora !== undefined && min !== undefined) {
      d.setDate(d.getDate() + dia);
      setModalHorario(`${String(hora).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    } else {
      setModalHorario("08:00");
    }
    setModalData(ymd(d));
    setIsModalOpen(true);
  };

  const openEditModal = (appt: Agendamento) => {
    setModalId(String(appt.id));
    setModalPaciente(appt.paciente);
    setModalProcedimento(appt.proc);
    setModalTipo(appt.status === "bloqueado" ? "bloqueio" : "consulta");
    setModalStatus(appt.status);
    setModalDuracao(appt.dur || 30);
    setModalProfissional(appt.profissionalId ?? "");
    setModalMarcador(appt.marcadorId ?? "");
    setModalPresenca(appt.presenca ?? "agendado");
    setModalObs(appt.obs || "");

    setModalData(appt.data);
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

  // Desmarcar = paciente cancelou. Mantém o registro (vai p/ a Recuperação),
  // some da grade. Diferente de Excluir (apaga de vez).
  const handleDesmarcar = async () => {
    if (!modalId) return;
    if (!(await confirm("Marcar esta consulta como desmarcada pelo paciente? Ela sai da agenda e vai para a Recuperação.", { okLabel: "Desmarcar" }))) return;
    try {
      const atual = appointments.find((a) => a.id === Number(modalId));
      if (!atual) return;
      await DB.agendamentos.save({ ...atual, cancelado: true, recuperacao: undefined });
      setIsModalOpen(false);
      await loadData();
      showToast("Consulta desmarcada. Veja em Recuperação.", "success");
    } catch {
      showToast("Não foi possível desmarcar.", "error");
    }
  };

  const handleSave = async () => {
    const ehBloqueio = modalTipo === "bloqueio";
    if (!modalData || !modalHorario || (!ehBloqueio && (!modalPaciente || !modalProcedimento))) {
      showToast(ehBloqueio ? "Informe data e horário do bloqueio." : "Preencha todos os campos obrigatórios.", "error");
      return;
    }

    const [h, m] = modalHorario.split(":").map(Number);

    // Buscar ID do paciente se já existir cadastrado
    const patientObj = patients.find((p) => p.nome === modalPaciente);

    const appt: Agendamento = {
      ...(modalId ? { id: Number(modalId) } : {}),
      paciente: ehBloqueio ? "" : modalPaciente,
      pacienteId: ehBloqueio ? undefined : (patientObj ? patientObj.id : undefined),
      proc: ehBloqueio ? (modalObs || "Bloqueio") : modalProcedimento,
      data: modalData,
      hora: h,
      min: m,
      dur: modalDuracao,
      status: ehBloqueio ? "bloqueado" : modalStatus,
      profissionalId: modalProfissional === "" ? undefined : Number(modalProfissional),
      marcadorId: ehBloqueio || modalMarcador === "" ? undefined : Number(modalMarcador),
      presenca: ehBloqueio ? "agendado" : modalPresenca,
      obs: modalObs,
    };

    try {
      await DB.agendamentos.save(appt);
      setIsModalOpen(false);
      await loadData();
      const verbo = modalId ? "atualizado" : (ehBloqueio ? "criado" : "agendada");
      showToast(ehBloqueio ? `Bloqueio ${verbo}.` : `Consulta ${verbo === "criado" ? "agendada" : verbo}.`, "success");
    } catch {
      showToast("Não foi possível salvar.", "error");
    }
  };

  const days = getWeekDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <>
      <Topbar title="Agenda">
        <button className="btn btn-outline" onClick={() => openNewModal(undefined, undefined, undefined, "bloqueio")}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M5.6 5.6l12.8 12.8" />
          </svg>
          Bloquear horário
        </button>
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

        {/* Mini-calendário + Grade semanal lado a lado */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Mini-calendário do mês */}
          <div className="card" style={{ flex: "0 0 250px", maxWidth: "100%", padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button className="btn btn-outline btn-sm" style={{ padding: "2px 8px" }} onClick={miniPrevMonth} aria-label="Mês anterior">&#8249;</button>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {(() => { const s = miniRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); })()}
              </span>
              <button className="btn btn-outline btn-sm" style={{ padding: "2px 8px" }} onClick={miniNextMonth} aria-label="Próximo mês">&#8250;</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {MINI_DOW.map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", padding: "2px 0" }}>{d}</div>
              ))}
              {miniGrid().map((d, i) => {
                const inMonth = d.getMonth() === miniRef.getMonth();
                const isToday = d.getTime() === today.getTime();
                const weekEnd = new Date(currentMonday); weekEnd.setDate(weekEnd.getDate() + 6);
                const inWeek = d >= currentMonday && d <= weekEnd;
                return (
                  <button
                    key={i}
                    onClick={() => selectDay(d)}
                    title={d.toLocaleDateString("pt-BR")}
                    style={{
                      aspectRatio: "1 / 1",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      opacity: inMonth ? 1 : 0.32,
                      color: isToday ? "#fff" : "var(--text)",
                      background: isToday ? "var(--primary)" : inWeek ? "var(--primary-light, rgba(99,102,241,0.14))" : "transparent",
                    }}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <button className="btn btn-outline btn-sm" style={{ width: "100%", marginTop: 10 }} onClick={handleToday}>Hoje</button>
          </div>

          {/* Grade Semanal */}
          <div className="card agenda-grid" style={{ flex: "1 1 320px", minWidth: 0 }}>
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
                        const dKey = ymd(d);
                        const appt = visiveis.find((a) => a.data === dKey && a.hora === h && a.min < 30);
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
                                  {marcadorDe(appt.marcadorId) && (
                                    <span aria-hidden title={marcadorDe(appt.marcadorId)!.nome} style={{ width: 7, height: 7, borderRadius: "50%", background: marcadorDe(appt.marcadorId)!.cor, flexShrink: 0 }} />
                                  )}
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
                        const dKey = ymd(d);
                        const appt = visiveis.find((a) => a.data === dKey && a.hora === h && a.min >= 30);
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
                                  {marcadorDe(appt.marcadorId) && (
                                    <span aria-hidden title={marcadorDe(appt.marcadorId)!.nome} style={{ width: 7, height: 7, borderRadius: "50%", background: marcadorDe(appt.marcadorId)!.cor, flexShrink: 0 }} />
                                  )}
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
                <span className="modal-title">
                  {modalTipo === "bloqueio"
                    ? (modalId ? "Editar bloqueio" : "Bloquear horário")
                    : (modalId ? "Editar Consulta" : "Nova Consulta")}
                </span>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                {modalTipo === "bloqueio" && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
                    Reserva um horário como indisponível (almoço, reunião, férias…). Não precisa de paciente.
                  </p>
                )}
                {modalTipo === "consulta" && (
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
                    </select>
                  </div>
                )}
                <div className="form-row form-row-2">
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
                  {modalTipo === "consulta" && marcadores.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Marcador</label>
                      <select
                        className="form-control"
                        value={modalMarcador}
                        onChange={(e) => setModalMarcador(e.target.value === "" ? "" : Number(e.target.value))}
                      >
                        <option value="">Sem marcador</option>
                        {marcadores.map((m) => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {modalTipo === "consulta" && (
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
                )}
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
                      {timeSlots.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
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
                {modalTipo === "consulta" && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-control"
                      value={modalStatus}
                      onChange={(e) => setModalStatus(e.target.value as any)}
                    >
                      <option value="confirmado">Confirmado</option>
                      <option value="pendente">Pendente de confirmação</option>
                    </select>
                  </div>
                )}
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
                  <label className="form-label">{modalTipo === "bloqueio" ? "Motivo" : "Observações"}</label>
                  <textarea
                    className="form-control"
                    rows={modalTipo === "bloqueio" ? 2 : 3}
                    placeholder={modalTipo === "bloqueio" ? "Ex.: Almoço, Reunião, Férias…" : "Anotações sobre a consulta..."}
                    value={modalObs}
                    onChange={(e) => setModalObs(e.target.value)}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {modalId && (
                    <button className="btn btn-danger" onClick={handleDelete}>
                      Excluir
                    </button>
                  )}
                  {modalId && modalTipo === "consulta" && (
                    <button className="btn btn-outline" onClick={handleDesmarcar} title="Paciente cancelou — manda para a Recuperação">
                      Desmarcar
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
