"use client";

import { useEffect, useState } from "react";
import { DB, nomeNormalizado } from "@/lib/db";
import { Agendamento, Paciente, Profissional, Marcador, ProcedimentoCatalogo } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MINI_DOW = ["S", "T", "Q", "Q", "S", "S", "D"]; // Seg..Dom (mini-calendário)

// 'yyyy-mm-dd' em horário LOCAL (evita o shift de fuso do toISOString).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Sublocação: modalidade escolhida na tela. No banco, manhã/tarde viram 'turno'.
type ModalidadeUI = "hora" | "manha" | "tarde" | "diaria";
const MODALIDADE_LABEL: Record<ModalidadeUI, string> = {
  hora: "Por hora",
  manha: "Turno manhã",
  tarde: "Turno tarde",
  diaria: "Diária",
};
const hhmm = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const dataBR = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const somaDias = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return ymd(new Date(y, m - 1, dd + n));
};
// Faixa ocupada do agendamento, em minutos desde 00:00.
const faixa = (a: Agendamento): [number, number] => {
  const ini = a.hora * 60 + a.min;
  return [ini, ini + (a.dur || 30)];
};

export default function AgendaPage() {
  const { showToast, confirm } = useToast();
  const [appointments, setAppointments] = useState<Agendamento[]>([]);
  const [patients, setPatients] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [marcadores, setMarcadores] = useState<Marcador[]>([]);
  const [catalogo, setCatalogo] = useState<ProcedimentoCatalogo[]>([]);
  const [horaInicio, setHoraInicio] = useState(7);
  const [horaFim, setHoraFim] = useState(19);
  const [almocoInicio, setAlmocoInicio] = useState<number | null>(null);
  const [almocoFim, setAlmocoFim] = useState<number | null>(null);
  const [filtroProf, setFiltroProf] = useState<number | "todos">("todos");
  const [currentMonday, setCurrentMonday] = useState<Date>(new Date());
  // Mês exibido no mini-calendário lateral (1º dia do mês).
  const [miniRef, setMiniRef] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [modalId, setModalId] = useState<string>("");
  const [modalPaciente, setModalPaciente] = useState<string>("");
  const [modalTelefone, setModalTelefone] = useState<string>("");
  const [modalProcedimento, setModalProcedimento] = useState<string>("");
  const [modalProfissional, setModalProfissional] = useState<number | "">("");
  const [modalMarcador, setModalMarcador] = useState<number | "">("");
  // "consulta" = agendamento normal; "bloqueio" = horário indisponível (sem paciente).
  // "sublocacao" = sala alugada a dentista de fora (hora/turno/diária).
  const [modalTipo, setModalTipo] = useState<"consulta" | "bloqueio" | "sublocacao">("consulta");
  const [modalModalidade, setModalModalidade] = useState<ModalidadeUI>("hora");
  const [modalHoras, setModalHoras] = useState<number>(1);
  const [modalRepetir, setModalRepetir] = useState(false);
  const [modalRepetirAte, setModalRepetirAte] = useState<string>("");
  const [modalSerieId, setModalSerieId] = useState<string | undefined>(undefined);
  const [modalData, setModalData] = useState<string>("");
  const [modalHorario, setModalHorario] = useState<string>("08:00");
  const [modalDuracao, setModalDuracao] = useState<number>(30);
  const [modalStatus, setModalStatus] = useState<Agendamento["status"]>("confirmado");
  const [modalPresenca, setModalPresenca] = useState<"agendado" | "compareceu" | "faltou">("agendado");
  const [modalObs, setModalObs] = useState<string>("");

  useEffect(() => {
    // Obter segunda-feira atual
    setCurrentMonday(getMonday(new Date()));
    loadData();
  }, []);

  const loadData = async () => {
    const [ags, pacs, profs, marcs, clinica, cat] = await Promise.all([
      DB.agendamentos.list(),
      DB.pacientes.list(),
      DB.profissionais.list(true),
      DB.marcadores.list(),
      DB.clinica.get(),
      DB.catalogo.list(true),
    ]);
    setAppointments(ags);
    setPatients(pacs);
    setProfissionais(profs);
    setMarcadores(marcs);
    setCatalogo(cat);
    if (clinica?.agendaHoraInicio != null) setHoraInicio(clinica.agendaHoraInicio);
    if (clinica?.agendaHoraFim != null) setHoraFim(clinica.agendaHoraFim);
    setAlmocoInicio(clinica?.agendaAlmocoInicio ?? null);
    setAlmocoFim(clinica?.agendaAlmocoFim ?? null);
  };

  // Faixa de horas da grade, conforme o horário de funcionamento da clínica.
  const HOURS = Array.from({ length: Math.max(1, horaFim - horaInicio) }, (_, i) => horaInicio + i);
  // Uma hora cai no intervalo de almoço da clínica (bloco não atendido)?
  const emAlmoco = (h: number) =>
    almocoInicio != null && almocoFim != null && h >= almocoInicio && h < almocoFim;
  // Opções de horário (a cada 30 min) dentro do funcionamento.
  const timeSlots = HOURS.flatMap((hh) => [`${String(hh).padStart(2, "0")}:00`, `${String(hh).padStart(2, "0")}:30`]);

  // Mapa id→cor para pintar os blocos por profissional.
  const corProf = (id?: number) => profissionais.find((p) => p.id === id)?.cor;
  const nomeProf = (id?: number) => profissionais.find((p) => p.id === id)?.nome;
  // Marcador (rótulo colorido) do agendamento.
  const marcadorDe = (id?: number) => marcadores.find((m) => m.id === id);
  // Equipe da clínica x dentistas de fora que alugam sala.
  const equipe = profissionais.filter((p) => p.tipo !== "sublocatario");
  const sublocatarios = profissionais.filter((p) => p.tipo === "sublocatario");

  // Turnos seguem o horário da clínica: manhã até o almoço, tarde depois dele.
  const meioDia = almocoInicio ?? 12;
  const voltaAlmoco = almocoFim ?? meioDia;
  const faixaModalidade = (mod: ModalidadeUI): [number, number] => {
    if (mod === "manha") return [horaInicio * 60, meioDia * 60];
    if (mod === "tarde") return [voltaAlmoco * 60, horaFim * 60];
    if (mod === "diaria") return [horaInicio * 60, horaFim * 60];
    const [h, m] = modalHorario.split(":").map(Number);
    const ini = h * 60 + m;
    return [ini, ini + modalHoras * 60];
  };

  // Reservas/consultas que batem com [ini, fim) nas datas dadas: mesma sala,
  // mesmo sublocatário, bloqueio da clínica, ou outra sublocação sem sala definida.
  const conflitos = (
    datas: Set<string>,
    ini: number,
    fim: number,
    salaId: number | undefined,
    profId: number | undefined,
    ignorar: Set<number>,
    soSublocacao = false,
  ) =>
    appointments.filter((a) => {
      if (a.cancelado || (a.id != null && ignorar.has(a.id)) || !datas.has(a.data)) return false;
      const [aIni, aFim] = faixa(a);
      if (!(aIni < fim && aFim > ini)) return false;
      if (soSublocacao && a.status !== "sublocacao") return false;
      if (salaId != null && a.marcadorId === salaId) return true;
      if (a.status === "sublocacao" && (salaId == null || a.marcadorId == null)) return true;
      if (profId != null && a.profissionalId === profId) return true;
      return a.status === "bloqueado";
    });

  const descreveConflito = (a: Agendamento) => {
    const [i, f] = faixa(a);
    const quem =
      a.status === "sublocacao"
        ? `Sublocação ${nomeProf(a.profissionalId) ?? ""}`.trim()
        : a.status === "bloqueado"
        ? `Bloqueio${a.proc ? ` (${a.proc})` : ""}`
        : `${a.paciente} — ${a.proc}`;
    const sala = marcadorDe(a.marcadorId)?.nome;
    return `${dataBR(a.data)} ${hhmm(i)}–${hhmm(f)} · ${quem}${sala ? ` · ${sala}` : ""}`;
  };

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

  const openNewModal = (dia?: number, hora?: number, min?: number, tipo: "consulta" | "bloqueio" | "sublocacao" = "consulta") => {
    setModalId("");
    setModalPaciente("");
    setModalTelefone("");
    setModalProcedimento("");
    setModalObs("");
    setModalTipo(tipo);
    setModalStatus(tipo === "bloqueio" ? "bloqueado" : "confirmado");
    setModalPresenca("agendado");
    setModalDuracao(tipo === "bloqueio" ? 60 : 30);
    setModalMarcador(tipo === "sublocacao" && marcadores.length === 1 ? (marcadores[0].id ?? "") : "");
    setModalModalidade("hora");
    setModalHoras(1);
    setModalRepetir(false);
    setModalSerieId(undefined);
    if (tipo === "sublocacao") {
      setModalStatus("sublocacao");
      const filtroEhSub = sublocatarios.some((p) => p.id === filtroProf);
      setModalProfissional(filtroEhSub ? (filtroProf as number) : (sublocatarios[0]?.id ?? ""));
    } else {
      // Pré-seleciona o profissional do filtro (ou o primeiro da equipe).
      const filtroEhEquipe = equipe.some((p) => p.id === filtroProf);
      setModalProfissional(filtroEhEquipe ? (filtroProf as number) : (equipe[0]?.id ?? ""));
    }

    const d = new Date(currentMonday);
    if (dia !== undefined && hora !== undefined && min !== undefined) {
      d.setDate(d.getDate() + dia);
      setModalHorario(`${String(hora).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    } else {
      setModalHorario("08:00");
    }
    setModalData(ymd(d));
    setModalRepetirAte(somaDias(ymd(d), 7 * 12));
    setIsModalOpen(true);
  };

  const openEditModal = (appt: Agendamento) => {
    setModalId(String(appt.id));
    setModalPaciente(appt.paciente);
    setModalTelefone(appt.telefone || "");
    setModalProcedimento(appt.proc);
    setModalTipo(appt.status === "bloqueado" ? "bloqueio" : appt.status === "sublocacao" ? "sublocacao" : "consulta");
    setModalRepetir(false);
    setModalSerieId(appt.serieId);
    if (appt.status === "sublocacao") {
      const mod = appt.sublocacaoModalidade ?? "hora";
      setModalModalidade(mod === "turno" ? (appt.hora < meioDia ? "manha" : "tarde") : mod);
      setModalHoras(Math.max(1, Math.round((appt.dur || 60) / 60)));
    }
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

  // Cancela a reserva fixa deste dia em diante (os dias anteriores ficam no histórico).
  const handleCancelarSerie = async () => {
    if (!modalSerieId) return;
    const futuras = appointments.filter((a) => a.serieId === modalSerieId && a.data >= modalData).length;
    if (!(await confirm(`Cancelar a reserva fixa a partir de ${dataBR(modalData)}? ${futuras > 1 ? `Saem ${futuras} reservas` : "Sai 1 reserva"} da agenda. As anteriores ficam.`, { danger: true, okLabel: "Cancelar série" }))) return;
    try {
      const n = await DB.agendamentos.removerSerieAPartir(modalSerieId, modalData);
      setIsModalOpen(false);
      await loadData();
      showToast(`Reserva fixa cancelada (${n} ${n === 1 ? "dia" : "dias"}).`, "success");
    } catch {
      showToast("Não foi possível cancelar a série.", "error");
    }
  };

  const handleDelete = async () => {
    if (!modalId) return;
    const oque = modalTipo === "sublocacao" ? "esta reserva de sala" : modalTipo === "bloqueio" ? "este bloqueio" : "esta consulta";
    if (await confirm(`Tem certeza que deseja excluir ${oque}?`, { danger: true, okLabel: "Excluir" })) {
      try {
        await DB.agendamentos.remove(Number(modalId));
        setIsModalOpen(false);
        await loadData();
        showToast(modalTipo === "sublocacao" ? "Reserva excluída." : modalTipo === "bloqueio" ? "Bloqueio excluído." : "Consulta excluída.", "success");
      } catch {
        showToast("Não foi possível excluir.", "error");
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

  const handleSaveSublocacao = async () => {
    if (!modalData) return showToast("Informe a data.", "error");
    if (modalProfissional === "") return showToast("Escolha o sublocatário.", "error");
    if (marcadores.length > 0 && modalMarcador === "") return showToast("Escolha a sala.", "error");
    const [ini, fim] = faixaModalidade(modalModalidade);
    if (fim <= ini) return showToast("Horário inválido para essa modalidade.", "error");

    // Datas: o dia escolhido ou, se fixo, toda semana até a data final (máx. 1 ano).
    const datas: string[] = [modalData];
    if (!modalId && modalRepetir) {
      if (!modalRepetirAte || modalRepetirAte < modalData) return showToast("Informe até quando repete.", "error");
      for (let d = somaDias(modalData, 7); d <= modalRepetirAte && datas.length < 53; d = somaDias(d, 7)) datas.push(d);
    }

    const salaId = modalMarcador === "" ? undefined : Number(modalMarcador);
    const profId = Number(modalProfissional);
    const batem = conflitos(new Set(datas), ini, fim, salaId, profId, new Set(modalId ? [Number(modalId)] : []));
    if (batem.length > 0) {
      const lista = batem.slice(0, 6).map(descreveConflito).join("\n");
      const mais = batem.length > 6 ? `\n…e mais ${batem.length - 6}.` : "";
      if (!(await confirm(`Esse horário já está ocupado:\n${lista}${mais}\n\nSalvar mesmo assim?`, { okLabel: "Salvar assim" }))) return;
    }

    const base: Agendamento = {
      paciente: "",
      proc: MODALIDADE_LABEL[modalModalidade],
      data: modalData,
      hora: Math.floor(ini / 60),
      min: ini % 60,
      dur: fim - ini,
      status: "sublocacao",
      sublocacaoModalidade: modalModalidade === "manha" || modalModalidade === "tarde" ? "turno" : modalModalidade,
      serieId: modalSerieId,
      profissionalId: profId,
      marcadorId: salaId,
      presenca: "agendado",
      obs: modalObs,
    };

    try {
      if (modalId) {
        const atual = appointments.find((a) => a.id === Number(modalId));
        await DB.agendamentos.save({ ...atual, ...base, id: Number(modalId) });
      } else if (datas.length === 1) {
        await DB.agendamentos.save(base);
      } else {
        const serieId = crypto.randomUUID();
        await DB.agendamentos.inserirVarios(datas.map((data) => ({ ...base, data, serieId })));
      }
      setIsModalOpen(false);
      await loadData();
      showToast(
        modalId ? "Reserva atualizada." : datas.length > 1 ? `Reserva fixa criada: ${datas.length} semanas.` : "Sala reservada.",
        "success",
      );
    } catch {
      showToast("Não foi possível salvar a reserva.", "error");
    }
  };

  const handleSave = async () => {
    if (modalTipo === "sublocacao") return handleSaveSublocacao();
    const ehBloqueio = modalTipo === "bloqueio";
    if (!modalData || !modalHorario || (!ehBloqueio && (!modalPaciente.trim() || !modalProcedimento))) {
      showToast(ehBloqueio ? "Informe data e horário do bloqueio." : "Preencha todos os campos obrigatórios.", "error");
      return;
    }

    const [h, m] = modalHorario.split(":").map(Number);

    // Buscar ID do paciente se já existir cadastrado. Compara sem acento e sem
    // espaço duplo — igualdade exata perdia o vínculo por qualquer diferença de
    // digitação, e a consulta sumia do histórico do paciente.
    const alvo = nomeNormalizado(modalPaciente);
    const patientObj = patients.find((p) => nomeNormalizado(p.nome) === alvo);

    const appt: Agendamento = {
      ...(modalId ? { id: Number(modalId) } : {}),
      paciente: ehBloqueio ? "" : (patientObj ? patientObj.nome : modalPaciente.trim().replace(/\s+/g, " ")),
      pacienteId: ehBloqueio ? undefined : (patientObj ? patientObj.id : undefined),
      telefone: ehBloqueio ? undefined : modalTelefone.trim(),
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

    // Consulta numa sala que está sublocada nesse horário: avisa antes de salvar.
    if (!ehBloqueio && appt.marcadorId != null) {
      const [ini, fim] = faixa(appt);
      const batem = conflitos(new Set([appt.data]), ini, fim, appt.marcadorId, undefined, new Set(appt.id ? [appt.id] : []), true);
      if (batem.length > 0) {
        if (!(await confirm(`Essa sala está sublocada nesse horário:\n${batem.map(descreveConflito).join("\n")}\n\nSalvar mesmo assim?`, { okLabel: "Salvar assim" }))) return;
      }
    }

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

  // Célula de meia hora da grade. Mostra o que começa nela; se nada começa,
  // mas uma sala sublocada cobre esse horário, mostra a continuação da reserva.
  const renderCelula = (d: Date, di: number, h: number, meia: 0 | 30) => {
    const dKey = ymd(d);
    const appt = visiveis.find((a) => a.data === dKey && a.hora === h && (meia === 0 ? a.min < 30 : a.min >= 30));
    if (!appt) {
      const slot = h * 60 + meia;
      const cobre = visiveis.find((a) => {
        if (a.status !== "sublocacao" || a.data !== dKey) return false;
        const [i, f] = faixa(a);
        return i < slot && f > slot;
      });
      if (cobre) {
        return (
          <td key={di} style={{ padding: "0 3px" }} className="clickable" onClick={() => openEditModal(cobre)}>
            <div
              className="appt-block sublocacao cont"
              title={`Sala sublocada — ${nomeProf(cobre.profissionalId) ?? ""}`}
              style={{ "--sub": corProf(cobre.profissionalId) ?? "#0f766e" } as React.CSSProperties}
            />
          </td>
        );
      }
      return <td key={di} className="clickable" onClick={() => openNewModal(di, h, meia)}></td>;
    }
    if (appt.status === "sublocacao") {
      const [i, f] = faixa(appt);
      const sala = marcadorDe(appt.marcadorId)?.nome;
      return (
        <td key={di} style={{ padding: "3px 3px 0" }} className="clickable" onClick={() => openEditModal(appt)}>
          <div
            className="appt-block sublocacao"
            title={`Sala sublocada — ${nomeProf(appt.profissionalId) ?? ""} · ${appt.proc} · ${hhmm(i)}–${hhmm(f)}${sala ? " · " + sala : ""}`}
            style={{ "--sub": corProf(appt.profissionalId) ?? "#0f766e", borderRadius: "6px 6px 0 0" } as React.CSSProperties}
          >
            <span style={{ fontSize: 10, fontWeight: 700 }}>
              {appt.serieId ? "↻ " : ""}{nomeProf(appt.profissionalId) ?? "Sublocação"}
            </span>
            <span style={{ fontSize: 9, opacity: 0.85 }}>
              {sala ? `${sala} · ` : ""}{hhmm(i)}–{hhmm(f)}
            </span>
          </div>
        </td>
      );
    }
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
  };

  // Formulário da reserva de sala (sublocação).
  const renderFormSublocacao = () => {
    const [ini, fim] = faixaModalidade(modalModalidade);
    const horasTotais = (fim - ini) / 60;
    const semanas = (() => {
      if (!modalRepetir || !modalRepetirAte || modalRepetirAte < modalData) return 1;
      let n = 1;
      for (let d = somaDias(modalData, 7); d <= modalRepetirAte && n < 53; d = somaDias(d, 7)) n++;
      return n;
    })();
    const diaSemana = modalData ? DAYS_SHORT[new Date(`${modalData}T12:00:00`).getDay()] : "";
    return (
      <>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Sala alugada a dentista de fora, com pacientes próprios. Aqui é só o controle de horário.
        </p>
        {sublocatarios.length === 0 && (
          <div className="alert" style={{ fontSize: 13, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            Nenhum sublocatário cadastrado. Cadastre em <a href="/admin/config" style={{ color: "var(--primary)", fontWeight: 600 }}>Configurações → Profissionais</a> com vínculo <strong>Sublocatário</strong>.
          </div>
        )}
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Sublocatário *</label>
            <select
              className="form-control"
              value={modalProfissional}
              onChange={(e) => setModalProfissional(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Selecionar…</option>
              {profissionais
                .filter((p) => p.tipo === "sublocatario" || p.id === modalProfissional)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sala{marcadores.length > 0 ? " *" : ""}</label>
            <select
              className="form-control"
              value={modalMarcador}
              onChange={(e) => setModalMarcador(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={marcadores.length === 0}
            >
              <option value="">{marcadores.length === 0 ? "Sem salas cadastradas" : "Selecionar…"}</option>
              {marcadores.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Modalidade</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(Object.keys(MODALIDADE_LABEL) as ModalidadeUI[]).map((m) => {
              const ativo = modalModalidade === m;
              const [a, b] = m === "hora" ? [null, null] : faixaModalidade(m);
              return (
                <button
                  key={m}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setModalModalidade(m)}
                  style={{
                    background: ativo ? "var(--primary)" : "var(--bg2)",
                    color: ativo ? "#fff" : "var(--text-muted)",
                    border: `1px solid ${ativo ? "var(--primary)" : "var(--border)"}`,
                  }}
                >
                  {MODALIDADE_LABEL[m]}
                  {a != null && b != null && <span style={{ opacity: 0.8, fontWeight: 400 }}>&nbsp;{hhmm(a)}–{hhmm(b)}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className={`form-row ${modalModalidade === "hora" ? "form-row-3" : "form-row-2"}`}>
          <div className="form-group">
            <label className="form-label">Data *</label>
            <input type="date" className="form-control" value={modalData} onChange={(e) => setModalData(e.target.value)} />
          </div>
          {modalModalidade === "hora" ? (
            <>
              <div className="form-group">
                <label className="form-label">Início *</label>
                <select className="form-control" value={modalHorario} onChange={(e) => setModalHorario(e.target.value)}>
                  {timeSlots.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Horas</label>
                <select className="form-control" value={modalHoras} onChange={(e) => setModalHoras(Number(e.target.value))}>
                  {Array.from({ length: Math.max(1, horaFim - horaInicio) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}h</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">Horário</label>
              <input className="form-control" value={`${hhmm(ini)} – ${hhmm(fim)}`} disabled />
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "-4px 0 12px" }}>
          {hhmm(ini)}–{hhmm(fim)} · {horasTotais.toLocaleString("pt-BR")}h
          {modalModalidade === "hora" && <> · R$ {(horasTotais * 50).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (R$ 50/h)</>}
          {modalModalidade === "diaria" && almocoInicio != null && almocoFim != null && <> · inclui o intervalo de almoço</>}
        </div>
        {!modalId && (
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={modalRepetir} onChange={(e) => setModalRepetir(e.target.checked)} />
              <strong>Fixo: repetir toda {diaSemana ? diaSemana.toLowerCase() : "semana"}</strong>
            </label>
            {modalRepetir && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <label className="form-label" style={{ margin: 0 }}>Até</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: "auto" }}
                  value={modalRepetirAte}
                  min={modalData}
                  onChange={(e) => setModalRepetirAte(e.target.value)}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{semanas} {semanas === 1 ? "semana" : "semanas"}{semanas >= 53 ? " (máx. 1 ano)" : ""}</span>
              </div>
            )}
          </div>
        )}
        {modalId && modalSerieId && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
            ↻ Faz parte de uma reserva fixa semanal. Alterar aqui muda só este dia.
          </p>
        )}
        <div className="form-group">
          <label className="form-label">Observações</label>
          <textarea className="form-control" rows={2} value={modalObs} onChange={(e) => setModalObs(e.target.value)} placeholder="Ex.: traz o próprio material" />
        </div>
      </>
    );
  };

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
        <button className="btn btn-outline" onClick={() => openNewModal(undefined, undefined, undefined, "sublocacao")}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M3 21V8l9-5 9 5v13" />
            <path d="M9 21v-7h6v7" />
          </svg>
          Sublocar sala
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
                // Intervalo de almoço: linha única não agendável.
                if (emAlmoco(h)) {
                  return (
                    <tr key={h} className="lunch-row">
                      <td className="time-cell">{String(h).padStart(2, "0")}:00</td>
                      <td
                        colSpan={days.length}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: 0.3,
                          background:
                            "repeating-linear-gradient(45deg, var(--bg2), var(--bg2) 8px, transparent 8px, transparent 16px)",
                        }}
                      >
                        {h === almocoInicio
                          ? `Intervalo de almoço · ${String(almocoInicio).padStart(2, "0")}h–${String(almocoFim).padStart(2, "0")}h`
                          : ""}
                      </td>
                    </tr>
                  );
                }
                return (
                  <React.Fragment key={h}>
                    {/* Slot de :00 */}
                    <tr>
                      <td className="time-cell" rowSpan={2}>
                        {String(h).padStart(2, "0")}:00
                      </td>
                      {days.map((d, di) => renderCelula(d, di, h, 0))}
                    </tr>
                    {/* Slot de :30 */}
                    <tr>
                      {days.map((d, di) => renderCelula(d, di, h, 30))}
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span className="appt-block sublocacao" style={{ width: 12, height: 12, padding: 0, borderRadius: 3, borderLeftWidth: 3, display: "inline-block" }}></span> Sala sublocada (↻ = fixa)
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
                    : modalTipo === "sublocacao"
                    ? (modalId ? "Editar reserva de sala" : "Sublocar sala")
                    : (modalId ? "Editar Consulta" : "Nova Consulta")}
                </span>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                {modalTipo === "sublocacao" && renderFormSublocacao()}
                {modalTipo !== "sublocacao" && (<>
                {modalTipo === "bloqueio" && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
                    Reserva um horário como indisponível (almoço, reunião, férias…). Não precisa de paciente.
                  </p>
                )}
                {modalTipo === "consulta" && (
                  <div className="form-group">
                    <label className="form-label">Paciente *</label>
                    {/* Campo livre com sugestões: paciente cadastrado é vinculado
                        pelo nome; paciente novo entra só com o nome (o cadastro
                        completo vem depois, na anamnese). */}
                    <input
                      className="form-control"
                      list="agenda-pacientes"
                      placeholder="Digite o nome (cadastrado ou paciente novo)"
                      value={modalPaciente}
                      onChange={(e) => {
                        const nome = e.target.value;
                        setModalPaciente(nome);
                        // Paciente cadastrado: puxa o telefone da ficha se o campo estiver vazio.
                        const cad = patients.find((p) => nomeNormalizado(p.nome) === nomeNormalizado(nome));
                        if (cad?.tel && !modalTelefone.trim()) setModalTelefone(cad.tel);
                      }}
                      autoComplete="off"
                    />
                    <datalist id="agenda-pacientes">
                      {patients.map((p) => (
                        <option key={p.id} value={p.nome} />
                      ))}
                    </datalist>
                    {modalPaciente.trim() !== "" &&
                      !patients.some((p) => nomeNormalizado(p.nome) === nomeNormalizado(modalPaciente)) && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                          Paciente novo — ainda sem cadastro. Ao cadastrar com o mesmo nome, a consulta é ligada à ficha.
                        </div>
                      )}
                  </div>
                )}
                {modalTipo === "consulta" && (
                  <div className="form-group">
                    <label className="form-label">Telefone</label>
                    <input
                      className="form-control"
                      type="tel"
                      inputMode="tel"
                      placeholder="(00) 00000-0000"
                      value={modalTelefone}
                      onChange={(e) => setModalTelefone(e.target.value)}
                    />
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
                      {profissionais
                        .filter((p) => p.tipo !== "sublocatario" || p.id === modalProfissional)
                        .map((p) => (
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
                      {/* preserva valor legado fora do catálogo (ao editar) */}
                      {modalProcedimento &&
                        modalProcedimento !== "Consulta de Avaliação" &&
                        modalProcedimento !== "Consulta de Retorno" &&
                        !catalogo.some((c) => c.nome === modalProcedimento) && (
                          <option value={modalProcedimento}>{modalProcedimento}</option>
                        )}
                      <optgroup label="Consultas">
                        <option value="Consulta de Avaliação">Consulta de Avaliação</option>
                        <option value="Consulta de Retorno">Consulta de Retorno</option>
                      </optgroup>
                      {catalogo.length > 0 && (
                        <optgroup label="Catálogo de procedimentos">
                          {catalogo.map((c) => (
                            <option key={c.id} value={c.nome}>{c.nome}</option>
                          ))}
                        </optgroup>
                      )}
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
                </>)}
              </div>
              <div className="modal-footer" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {modalId && (
                    <button className="btn btn-danger" onClick={handleDelete}>
                      {modalSerieId && modalTipo === "sublocacao" ? "Excluir só este dia" : "Excluir"}
                    </button>
                  )}
                  {modalId && modalTipo === "sublocacao" && modalSerieId && (
                    <button className="btn btn-outline" onClick={handleCancelarSerie} title="Apaga esta e as próximas reservas da série">
                      Cancelar série daqui pra frente
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
