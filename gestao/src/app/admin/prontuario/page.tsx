"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DB } from "@/lib/db";
import { Paciente, Procedimento, Anamnese, Profissional, ModeloAnamnese } from "@/lib/types";
import Topbar from "@/components/Topbar";
import Odontograma from "@/components/Odontograma";
import { useToast } from "@/components/Toast";
import AnaliseRiscoIA from "@/components/AnaliseRiscoIA";
import EvolucoesTab from "@/components/EvolucoesTab";
import AnexosTab from "@/components/AnexosTab";
import DocumentosTab from "@/components/DocumentosTab";

function ProntuarioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, confirm } = useToast();

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [anamneses, setAnamneses] = useState<Anamnese[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [modelosAnamnese, setModelosAnamnese] = useState<ModeloAnamnese[]>([]);
  const [selectedTeeth, setSelectedTeeth] = useState<Set<string>>(new Set());

  // Active Tab state
  const [activeTab, setActiveTab] = useState<"ficha" | "anamnese" | "evolucoes" | "anexos" | "documentos">("ficha");

  // Modals state
  const [isProcModalOpen, setIsProcModalOpen] = useState(false);
  const [isFichaDenteOpen, setIsFichaDenteOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Ficha Dente state
  const [selectedDenteNum, setSelectedDenteNum] = useState<string>("");

  // Proc Form State
  const [editProcId, setEditProcId] = useState<number | null>(null);
  const [procNome, setProcNome] = useState("");
  const [procDente, setProcDente] = useState("");
  const [procEstado, setProcEstado] = useState<"a-realizar" | "realizado" | "pre-existente">("a-realizar");
  const [procProfId, setProcProfId] = useState<string>("");
  const [procObs, setProcObs] = useState("");

  // Profile Edit Form State
  const [editNome, setEditNome] = useState("");
  const [editTel, setEditTel] = useState("");
  const [editPlano, setEditPlano] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editNascimento, setEditNascimento] = useState("");

  useEffect(() => {
    loadPaciente();
  }, [searchParams]);

  useEffect(() => {
    (async () => setProfissionais(await DB.profissionais.list(true)))();
  }, []);

  const loadPaciente = async () => {
    const idParam = searchParams.get("id");
    let currentPaciente: Paciente | null = null;

    if (idParam) {
      currentPaciente = await DB.pacientes.get(Number(idParam));
    } else {
      // Tentar carregar do localStorage
      const cached = localStorage.getItem("lcr-selected-paciente");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          currentPaciente = await DB.pacientes.get(parsed.id);
        } catch {}
      }
    }

    // Fallback para o primeiro paciente da lista
    if (!currentPaciente) {
      const list = await DB.pacientes.list();
      if (list.length > 0) {
        currentPaciente = list[0];
      }
    }

    if (currentPaciente) {
      setPaciente(currentPaciente);
      const [procs, anms, mods] = await Promise.all([
        DB.procedimentos.list(currentPaciente.id),
        DB.anamneses.list(currentPaciente.id),
        DB.modelosAnamnese.list(),
      ]);
      setProcedimentos(procs);
      setAnamneses(anms);
      setModelosAnamnese(mods.filter((m) => m.ativo !== false));
      localStorage.setItem("lcr-selected-paciente", JSON.stringify(currentPaciente));

      // Prefill Profile Edit
      setEditNome(currentPaciente.nome);
      setEditTel(currentPaciente.tel);
      setEditPlano(currentPaciente.plano);
      setEditCpf(currentPaciente.cpf);
      setEditNascimento(currentPaciente.nascimento || "");
    }
  };

  if (!paciente) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: "40px" }}>
        <h3>Nenhum paciente selecionado</h3>
        <Link href="/admin/pacientes" className="btn btn-primary" style={{ marginTop: "16px" }}>
          Ir para Pacientes
        </Link>
      </div>
    );
  }

  const iniciais = (nomeCompleto: string) => {
    const partes = nomeCompleto.trim().split(" ");
    return partes.length >= 2
      ? partes[0][0].toUpperCase() + partes[partes.length - 1][0].toUpperCase()
      : partes[0][0].toUpperCase();
  };

  const handleOpenProcModal = (denteNum?: string) => {
    setEditProcId(null);
    setProcNome("");
    setProcObs("");
    setProcEstado("a-realizar");
    setProcProfId(profissionais.length === 1 ? String(profissionais[0].id) : "");

    if (denteNum) {
      setProcDente(denteNum);
    } else if (selectedTeeth.size > 0) {
      setProcDente(Array.from(selectedTeeth).sort().join(", "));
    } else {
      setProcDente("");
    }

    setIsProcModalOpen(true);
  };

  const handleSaveProcedimento = async () => {
    if (!procNome) {
      showToast("Selecione um procedimento.", "error");
      return;
    }

    const data: Procedimento = {
      ...(editProcId ? { id: editProcId } : {}),
      pacienteId: paciente.id!,
      procedimento: procNome,
      dente: procDente,
      status: procEstado === "realizado" ? "Concluído" : procEstado === "a-realizar" ? "Pendente" : "Cancelado",
      custo: 150, // valor default
      profissionalId: procProfId ? Number(procProfId) : undefined,
      obs: procObs,
    };

    try {
      await DB.procedimentos.save(data);
      setIsProcModalOpen(false);
      setSelectedTeeth(new Set());
      await loadPaciente();
      showToast("Procedimento salvo.", "success");
    } catch {
      showToast("Não foi possível salvar o procedimento.", "error");
    }
  };

  const handleEditProc = (p: any) => {
    setEditProcId(p.id);
    setProcNome(p.nome || p.procedimento);
    setProcDente(p.dente);
    setProcEstado(p.estado || (p.status === "Concluído" ? "realizado" : "a-realizar"));
    setProcProfId(p.profissionalId ? String(p.profissionalId) : "");
    setProcObs(p.obs || "");
    setIsFichaDenteOpen(false);
    setIsProcModalOpen(true);
  };

  const handleRemoveProcedimento = async (id?: number) => {
    if (id == null) return;
    if (await confirm("Deseja remover este procedimento?", { danger: true, okLabel: "Remover" })) {
      try {
        await DB.procedimentos.remove(id);
        setIsFichaDenteOpen(false);
        await loadPaciente();
        showToast("Procedimento removido.", "success");
      } catch {
        showToast("Não foi possível remover o procedimento.", "error");
      }
    }
  };

  const handleDenteClick = (num: string, hasProcs: boolean) => {
    setSelectedDenteNum(num);
    const procsDente = procedimentos.filter((p: any) => {
      const dentes = p.dente?.toString().split(",").map((d: any) => d.trim()) || [];
      return dentes.includes(num);
    });

    if (hasProcs) {
      setIsFichaDenteOpen(true);
    } else {
      setSelectedTeeth(new Set([num]));
      handleOpenProcModal(num);
    }
  };

  const handleSaveProfile = async () => {
    if (!editNome || !editTel) {
      showToast("Preencha os campos obrigatórios (Nome e Telefone).", "error");
      return;
    }

    const updatedPaciente: Paciente = {
      ...paciente,
      nome: editNome,
      tel: editTel,
      plano: editPlano,
      cpf: editCpf,
      nascimento: editNascimento,
    };

    try {
      await DB.pacientes.save(updatedPaciente);
      setIsEditProfileOpen(false);
      await loadPaciente();
      showToast("Dados do paciente atualizados.", "success");
    } catch {
      showToast("Não foi possível salvar os dados do paciente.", "error");
    }
  };

  // Filtrar procedimentos do dente selecionado para exibir no modal de ficha do dente
  const procsDenteSelecionado = procedimentos.filter((p: any) => {
    const dentes = p.dente?.toString().split(",").map((d: any) => d.trim()) || [];
    return dentes.includes(selectedDenteNum);
  });

  return (
    <>
      <Topbar title="Prontuário">
        <button className="btn btn-outline btn-sm" onClick={() => setIsEditProfileOpen(true)}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Editar Perfil
        </button>
      </Topbar>

      <main className="page-content">
        {/* Header do Paciente */}
        <div
          className="card"
          style={{
            background: "#fff",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow)",
            padding: "20px 24px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--primary-darker)",
                flexShrink: 0,
              }}
            >
              {iniciais(paciente.nome)}
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{paciente.nome}</span>
                <span className={`badge ${paciente.status === "Ativo" ? "badge-success" : "badge-danger"}`}>
                  {paciente.status}
                </span>
              </div>
              <div className="patient-meta" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {paciente.nascimento ? new Date(paciente.nascimento).toLocaleDateString("pt-BR") : "Nascimento não cadastrado"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.36a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z" />
                  </svg>
                  {paciente.tel}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  CPF: {paciente.cpf}
                </span>
                <span>{paciente.plano} · Prontuário #{String(paciente.id).substring(0, 4)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <Link href="/admin/agenda" className="btn btn-primary btn-sm">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Agendar
              </Link>
            </div>
          </div>

          <div
            className="patient-fin-cards"
            style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 16 }}
          >
            <div className="fin-mini" style={{ borderColor: "#EF4444", background: "#FEF2F2" }}>
              <div className="fin-mini-label" style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Total Atrasado</div>
              <div className="fin-mini-val" style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: "#EF4444" }}>R$ 0,00</div>
            </div>
            <div className="fin-mini" style={{ borderColor: "#F59E0B", background: "#FFFBEB" }}>
              <div className="fin-mini-label" style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>A Receber</div>
              <div className="fin-mini-val" style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: "#F59E0B" }}>R$ 1.200,00</div>
            </div>
            <div className="fin-mini" style={{ borderColor: "#22C55E", background: "#F0FDF4" }}>
              <div className="fin-mini-label" style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Total Recebido</div>
              <div className="fin-mini-val" style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: "#22C55E" }}>R$ 550,00</div>
            </div>
          </div>
        </div>

        {/* Alerta anamnese */}
        {anamneses.length === 0 && (
          <div className="alert-banner">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Nenhuma anamnese realizada para este paciente.
            <Link
              href={`/admin/anamnese?id=${paciente.id}`}
              className="btn btn-sm"
              style={{ background: "#F59E0B", color: "#fff", marginLeft: "auto" }}
            >
              + Nova Anamnese
            </Link>
          </div>
        )}

        {/* Abas principais */}
        <div className="card">
          <div className="tabs" style={{ marginBottom: 24 }}>
            <button
              className={`tab-btn ${activeTab === "ficha" ? "active" : ""}`}
              onClick={() => setActiveTab("ficha")}
            >
              Ficha Clínica
            </button>
            <button
              className={`tab-btn ${activeTab === "anamnese" ? "active" : ""}`}
              onClick={() => setActiveTab("anamnese")}
            >
              Anamnese
            </button>
            <button
              className={`tab-btn ${activeTab === "evolucoes" ? "active" : ""}`}
              onClick={() => setActiveTab("evolucoes")}
            >
              Evoluções
            </button>
            <button
              className={`tab-btn ${activeTab === "anexos" ? "active" : ""}`}
              onClick={() => setActiveTab("anexos")}
            >
              Anexos
            </button>
            <button
              className={`tab-btn ${activeTab === "documentos" ? "active" : ""}`}
              onClick={() => setActiveTab("documentos")}
            >
              Documentos
            </button>
          </div>

          {activeTab === "evolucoes" && (
            <div className="tab-panel active">
              <EvolucoesTab pacienteId={paciente.id!} autor="Dra. Lara Camila" />
            </div>
          )}

          {activeTab === "anexos" && (
            <div className="tab-panel active">
              <AnexosTab pacienteId={paciente.id!} autor="Dra. Lara Camila" />
            </div>
          )}

          {activeTab === "documentos" && (
            <div className="tab-panel active">
              <DocumentosTab paciente={paciente} autor="Dra. Lara Camila" />
            </div>
          )}

          {/* Ficha Clínica */}
          {activeTab === "ficha" && (
            <div className="tab-panel active">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Odontograma</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleOpenProcModal()}>
                    + Novo Procedimento
                  </button>
                </div>
              </div>

              {/* Odontograma Component */}
              <Odontograma
                procedimentos={procedimentos}
                selectedTeeth={selectedTeeth}
                onSelectTeeth={setSelectedTeeth}
                onDenteClick={handleDenteClick}
              />

              {/* Legendas Odontograma */}
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 11, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#3B82F6" }} /> A Realizar
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#22C55E" }} /> Realizado
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#F59E0B" }} /> Pré-existente
                </div>
              </div>

              {/* Tabela de Procedimentos */}
              <div className="proc-table-wrap table-wrapper" style={{ marginTop: 24 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Procedimento</th>
                      <th>Dente</th>
                      <th>Estado</th>
                      <th>Data</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procedimentos.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                          Nenhum procedimento registrado.
                        </td>
                      </tr>
                    ) : (
                      procedimentos.map((p: any) => (
                        <tr key={p.id}>
                          <td>{p.nome || p.procedimento}</td>
                          <td>{p.dente || "—"}</td>
                          <td>
                            <span
                              className={`badge badge-${
                                p.estado === "realizado" ? "success" : p.estado === "a-realizar" ? "info" : "warning"
                              }`}
                            >
                              {p.estado || p.status}
                            </span>
                          </td>
                          <td>{p.data || "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-outline btn-sm" onClick={() => handleEditProc(p)}>
                                Editar
                              </button>
                              <button className="btn btn-outline btn-sm" onClick={() => handleRemoveProcedimento(p.id)}>
                                Remover
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ficha Anamnese */}
          {activeTab === "anamnese" && (
            <div className="tab-panel active">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Histórico de Anamneses</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {modelosAnamnese.length > 0 && (
                    <select
                      className="form-control"
                      style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) router.push(`/admin/anamnese/modelo?modelo=${e.target.value}&id=${paciente.id}`); }}
                    >
                      <option value="">Usar modelo…</option>
                      {modelosAnamnese.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  )}
                  <Link href={`/admin/anamnese?id=${paciente.id}`} className="btn btn-primary btn-sm">
                    + Nova Anamnese
                  </Link>
                </div>
              </div>

              {anamneses.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" style={{ width: 48, height: 48, margin: "0 auto 12px", display: "block", color: "var(--border)" }}>
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <path d="M9 14l2 2 4-4" />
                  </svg>
                  Nenhuma anamnese realizada para este paciente.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Modelo</th>
                        <th>Dentista</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anamneses.map((a: any) => (
                        <tr key={a.id}>
                          <td>{a.criadoEm ? new Date(a.criadoEm).toLocaleDateString("pt-BR") : "—"}</td>
                          <td>Anamnese Odontológica Padrão</td>
                          <td>Dra. Lara Camila</td>
                          <td>
                            <AnaliseRiscoIA respostas={a.respostas} pacienteNome={paciente.nome} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Procedimento (Novo / Editar) */}
        {isProcModalOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsProcModalOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">{editProcId ? "Editar Procedimento" : "Novo Procedimento"}</span>
                <button className="modal-close" onClick={() => setIsProcModalOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Procedimento *</label>
                  <select className="form-control" value={procNome} onChange={(e) => setProcNome(e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="Restauração">Restauração</option>
                    <option value="Extração">Extração</option>
                    <option value="Canal">Canal (Endodontia)</option>
                    <option value="Implante">Implante</option>
                    <option value="Ortodontia">Ortodontia</option>
                    <option value="Prótese">Prótese</option>
                    <option value="Clareamento">Clareamento</option>
                  </select>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Dentes (Ex: 16, 21, 45...)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: 16, 21, 45…"
                      value={procDente}
                      onChange={(e) => setProcDente(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select
                      className="form-control"
                      value={procEstado}
                      onChange={(e) => setProcEstado(e.target.value as any)}
                    >
                      <option value="a-realizar">A realizar</option>
                      <option value="realizado">Realizado</option>
                      <option value="pre-existente">Pré-existente</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Profissional responsável</label>
                  <select className="form-control" value={procProfId} onChange={(e) => setProcProfId(e.target.value)}>
                    <option value="">Não atribuído</option>
                    {profissionais.map((pr) => (
                      <option key={pr.id} value={String(pr.id)}>{pr.nome}</option>
                    ))}
                  </select>
                  {procEstado === "realizado" && !procProfId && (
                    <span style={{ fontSize: 11, color: "var(--warning)" }}>Atribua um profissional para que a produção entre no relatório de comissões.</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Anotações do procedimento..."
                    value={procObs}
                    onChange={(e) => setProcObs(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setIsProcModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSaveProcedimento}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Ficha Dente */}
        {isFichaDenteOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsFichaDenteOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">Ficha do Dente {selectedDenteNum}</span>
                <button className="modal-close" onClick={() => setIsFichaDenteOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {procsDenteSelecionado.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Nenhum procedimento neste dente.</p>
                ) : (
                  procsDenteSelecionado.map((p: any) => (
                    <div
                      key={p.id}
                      className="card"
                      style={{ padding: 12, border: "1px solid var(--border)", background: "var(--bg2)" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-dark)" }}>{p.nome || p.procedimento}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.data || "Sem data"}</div>
                        </div>
                        <span className={`badge badge-${p.estado === "realizado" ? "success" : p.estado === "a-realizar" ? "info" : "warning"}`}>
                          {p.estado || p.status}
                        </span>
                      </div>
                      {p.obs && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Obs: {p.obs}</p>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => handleEditProc(p)}>
                          Editar
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ flex: 1, color: "var(--danger)", borderColor: "rgba(239,68,68,0.2)" }}
                          onClick={() => handleRemoveProcedimento(p.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%", marginTop: 12 }}
                  onClick={() => {
                    setIsFichaDenteOpen(false);
                    handleOpenProcModal(selectedDenteNum);
                  }}
                >
                  + Novo Procedimento no Dente {selectedDenteNum}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Perfil */}
        {isEditProfileOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsEditProfileOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">Editar Perfil do Paciente</span>
                <button className="modal-close" onClick={() => setIsEditProfileOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome Completo *</label>
                  <input type="text" className="form-control" value={editNome} onChange={(e) => setEditNome(e.target.value)} />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">CPF</label>
                    <input type="text" className="form-control" value={editCpf} onChange={(e) => setEditCpf(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefone *</label>
                    <input type="text" className="form-control" value={editTel} onChange={(e) => setEditTel(e.target.value)} />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Data de Nascimento</label>
                    <input type="date" className="form-control" value={editNascimento} onChange={(e) => setEditNascimento(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plano</label>
                    <select className="form-control" value={editPlano} onChange={(e) => setEditPlano(e.target.value)}>
                      <option value="Particular">Particular</option>
                      <option value="Unimed">Unimed</option>
                      <option value="Bradesco Saúde">Bradesco Saúde</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setIsEditProfileOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSaveProfile}>
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function ProntuarioPage() {
  return (
    <Suspense fallback={<div>Carregando prontuário...</div>}>
      <ProntuarioContent />
    </Suspense>
  );
}
