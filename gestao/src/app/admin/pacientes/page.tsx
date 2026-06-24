"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DB } from "@/lib/db";
import { Paciente } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// Converte dd/mm/aaaa -> aaaa-mm-dd; mantém aaaa-mm-dd; senão "".
const parseData = (v: string): string => {
  const t = (v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
};

// Parser de CSV simples (detecta , ou ; e remove aspas).
function parseCSV(texto: string): Paciente[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return [];
  const delim = (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const corta = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const cabec = corta(linhas[0]).map(norm);
  const idx = (...nomes: string[]) => cabec.findIndex((c) => nomes.includes(c));
  const iNome = idx("nome", "paciente", "nome completo");
  const iCpf = idx("cpf");
  const iTel = idx("telefone", "tel", "celular", "fone", "whatsapp", "contato");
  const iNasc = idx("nascimento", "data de nascimento", "data nascimento", "dn", "nasc");
  const iEmail = idx("email", "e-mail");
  const iPlano = idx("plano", "convenio", "convênio");

  const out: Paciente[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const col = corta(linhas[i]);
    const nome = iNome >= 0 ? col[iNome] : col[0];
    if (!nome) continue;
    out.push({
      nome,
      cpf: iCpf >= 0 ? col[iCpf] ?? "" : "",
      tel: iTel >= 0 ? col[iTel] ?? "" : "",
      nascimento: iNasc >= 0 ? parseData(col[iNasc] ?? "") : "",
      email: iEmail >= 0 ? col[iEmail] ?? "" : "",
      plano: iPlano >= 0 ? col[iPlano] || "Particular" : "Particular",
      status: "Ativo",
    });
  }
  return out;
}

export default function PacientesPage() {
  const router = useRouter();
  const { showToast, confirm } = useToast();
  const [patients, setPatients] = useState<Paciente[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"dados" | "contato" | "endereco">("dados");

  // Form State
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [cpf, setCpf] = useState("");
  const [tel, setTel] = useState("");
  const [plano, setPlano] = useState("Particular");
  const [sexo, setSexo] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [rg, setRg] = useState("");
  const [orgaoEmissor, setOrgaoEmissor] = useState("");
  const [email, setEmail] = useState("");
  const [contatoEmergencia, setContatoEmergencia] = useState("");
  const [telEmergencia, setTelEmergencia] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("BA");

  // Importação em lote (CSV)
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importando, setImportando] = useState(false);
  const importPreview = csvText.trim() ? parseCSV(csvText) : [];

  useEffect(() => {
    loadData();
  }, []);

  const onArquivoCsv = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const importar = async () => {
    if (importPreview.length === 0) {
      showToast("Nenhum paciente válido encontrado no CSV.", "error");
      return;
    }
    setImportando(true);
    try {
      const n = await DB.pacientes.importar(importPreview);
      setImportOpen(false);
      setCsvText("");
      await loadData();
      showToast(`${n} paciente(s) importado(s).`, "success");
    } catch {
      showToast("Falha ao importar. Verifique o arquivo.", "error");
    } finally {
      setImportando(false);
    }
  };

  const loadData = async () => {
    setPatients(await DB.pacientes.list());
  };

  const iniciais = (nomeCompleto: string) => {
    const partes = nomeCompleto.trim().split(" ");
    return partes.length >= 2
      ? partes[0][0].toUpperCase() + partes[partes.length - 1][0].toUpperCase()
      : partes[0][0].toUpperCase();
  };

  // Preenche/limpa os campos do formulário a partir de um paciente (ou em branco).
  const preencherForm = (p?: Paciente) => {
    setNome(p?.nome ?? "");
    setNascimento(p?.nascimento ?? "");
    setCpf(p?.cpf ?? "");
    setTel(p?.tel ?? "");
    setPlano(p?.plano ?? "Particular");
    setSexo(p?.sexo ?? "");
    setEstadoCivil(p?.estadoCivil ?? "");
    setRg(p?.rg ?? "");
    setOrgaoEmissor(p?.orgaoEmissor ?? "");
    setEmail(p?.email ?? "");
    setContatoEmergencia(p?.contatoEmergencia ?? "");
    setTelEmergencia(p?.telEmergencia ?? "");
    setCep(p?.cep ?? "");
    setEndereco(p?.endereco ?? "");
    setNumero(p?.numero ?? "");
    setComplemento(p?.complemento ?? "");
    setBairro(p?.bairro ?? "");
    setCidade(p?.cidade ?? "");
    setUf(p?.uf || "BA");
  };

  const handleOpenNewModal = () => {
    setEditingId(null);
    preencherForm();
    setActiveTab("dados");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Paciente) => {
    setEditingId(p.id ?? null);
    preencherForm(p);
    setActiveTab("dados");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!nome || !tel) {
      showToast("Preencha os campos obrigatórios (Nome e Telefone).", "error");
      return;
    }

    const paciente: Paciente = {
      ...(editingId ? { id: editingId } : {}),
      nome, nascimento, cpf, tel, plano,
      status: editingId
        ? (patients.find((x) => x.id === editingId)?.status ?? "Ativo")
        : "Ativo",
      sexo, estadoCivil, rg, orgaoEmissor, email,
      contatoEmergencia, telEmergencia,
      cep, endereco, numero, complemento, bairro, cidade, uf,
    };

    try {
      await DB.pacientes.save(paciente);
      setIsModalOpen(false);
      await loadData();
      showToast(editingId ? "Paciente atualizado." : "Paciente cadastrado.", "success");
    } catch {
      showToast("Não foi possível salvar o paciente. Tente novamente.", "error");
    }
  };

  const handleDelete = async (p: Paciente) => {
    if (p.id == null) return;
    const ok = await confirm(
      `Excluir o paciente "${p.nome}"? Isso remove também procedimentos e anamneses vinculados.`,
      { danger: true, okLabel: "Excluir" },
    );
    if (!ok) return;
    try {
      await DB.pacientes.remove(p.id);
      await loadData();
      showToast("Paciente excluído.", "success");
    } catch {
      showToast("Não foi possível excluir o paciente.", "error");
    }
  };

  const abrirProntuario = (p: Paciente) => {
    localStorage.setItem("lcr-selected-paciente", JSON.stringify(p));
    router.push("/admin/prontuario");
  };

  const filteredPatients = patients.filter((p) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !search ||
      p.nome.toLowerCase().includes(query) ||
      p.cpf.includes(query) ||
      p.tel.includes(query);
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <Topbar title="Pacientes">
        <button className="btn btn-outline" onClick={() => { setCsvText(""); setImportOpen(true); }}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Importar
        </button>
        <button className="btn btn-primary" onClick={handleOpenNewModal}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo Paciente
        </button>
      </Topbar>

      <main className="page-content">
        {/* Filtros */}
        <div className="card mb-6">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nome, CPF ou telefone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-control"
              style={{ width: "auto", fontSize: 13 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="Ativo">Ativos</option>
              <option value="Inativo">Inativos</option>
            </select>
            <select className="form-control" style={{ width: "auto", fontSize: 13 }}>
              <option>Todos os planos</option>
              <option>Particular</option>
              <option>Unimed</option>
              <option>Bradesco Saúde</option>
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Lista de Pacientes</span>
            <span className="text-muted">{filteredPatients.length} pacientes</span>
          </div>
          {filteredPatients.length === 0 ? (
            <EmptyState
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              title={search || statusFilter ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
              hint={search || statusFilter ? "Tente ajustar a busca ou os filtros." : "Cadastre o primeiro paciente para começar."}
              action={
                !search && !statusFilter ? (
                  <button className="btn btn-primary btn-sm" onClick={handleOpenNewModal}>
                    + Cadastrar paciente
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>CPF</th>
                    <th>Telefone</th>
                    <th>Plano</th>
                    <th>Última Consulta</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="patient-avatar">{iniciais(p.nome)}</div>
                          <button
                            onClick={() => abrirProntuario(p)}
                            style={{
                              fontWeight: 600,
                              color: "var(--primary-darker)",
                              textDecoration: "none",
                              fontSize: 13,
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            {p.nome}
                          </button>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: "var(--text-muted)" }}>{p.cpf}</td>
                      <td style={{ fontSize: 13 }}>{p.tel}</td>
                      <td style={{ fontSize: 13 }}>{p.plano}</td>
                      <td style={{ fontSize: 13, color: "var(--text-muted)" }}>—</td>
                      <td>
                        <span className={`badge ${p.status === "Ativo" ? "badge-success" : "badge-danger"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button onClick={() => abrirProntuario(p)} className="btn btn-outline btn-sm">
                            Prontuário
                          </button>
                          <button onClick={() => handleOpenEditModal(p)} className="icon-btn" title="Editar paciente">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(p)} className="icon-btn danger" title="Excluir paciente">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Novo Paciente */}
        {isModalOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <span className="modal-title">{editingId ? "Editar Paciente" : "Cadastro de Paciente"}</span>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                {/* Abas */}
                <div className="tabs">
                  <button
                    className={`tab-btn ${activeTab === "dados" ? "active" : ""}`}
                    onClick={() => setActiveTab("dados")}
                  >
                    Dados Pessoais
                  </button>
                  <button
                    className={`tab-btn ${activeTab === "contato" ? "active" : ""}`}
                    onClick={() => setActiveTab("contato")}
                  >
                    Contato
                  </button>
                  <button
                    className={`tab-btn ${activeTab === "endereco" ? "active" : ""}`}
                    onClick={() => setActiveTab("endereco")}
                  >
                    Endereço
                  </button>
                </div>

                {/* Aba Dados Pessoais */}
                {activeTab === "dados" && (
                  <div className="tab-panel active">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 88,
                            height: 88,
                            borderRadius: "50%",
                            border: "2px dashed var(--primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            background: "var(--primary-light)",
                          }}
                        >
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 32, height: 32, color: "var(--primary)" }}>
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Foto do paciente</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div className="form-row form-row-2">
                          <div className="form-group">
                            <label className="form-label">Nome Completo *</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Nome completo"
                              value={nome}
                              onChange={(e) => setNome(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Data de Nascimento</label>
                            <input
                              type="date"
                              className="form-control"
                              value={nascimento}
                              onChange={(e) => setNascimento(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-row form-row-3">
                          <div className="form-group">
                            <label className="form-label">CPF</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="000.000.000-00"
                              value={cpf}
                              onChange={(e) => setCpf(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">RG</label>
                            <input type="text" className="form-control" placeholder="0000000" value={rg} onChange={(e) => setRg(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Órgão Emissor</label>
                            <input type="text" className="form-control" placeholder="SSP/BA" value={orgaoEmissor} onChange={(e) => setOrgaoEmissor(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="form-row form-row-3">
                      <div className="form-group">
                        <label className="form-label">Sexo</label>
                        <select className="form-control" value={sexo} onChange={(e) => setSexo(e.target.value)}>
                          <option value="">Selecionar</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Feminino">Feminino</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Estado Civil</label>
                        <select className="form-control" value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)}>
                          <option value="">Selecionar</option>
                          <option value="Solteiro(a)">Solteiro(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viúvo(a)">Viúvo(a)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Plano de Saúde</label>
                        <select
                          className="form-control"
                          value={plano}
                          onChange={(e) => setPlano(e.target.value)}
                        >
                          <option value="Particular">Particular</option>
                          <option value="Unimed">Unimed</option>
                          <option value="Bradesco Saúde">Bradesco Saúde</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba Contato */}
                {activeTab === "contato" && (
                  <div className="tab-panel active">
                    <div className="form-row form-row-2">
                      <div className="form-group">
                        <label className="form-label">Telefone *</label>
                        <input
                          type="tel"
                          className="form-control"
                          placeholder="(00) 00000-0000"
                          value={tel}
                          onChange={(e) => setTel(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">E-mail</label>
                        <input type="email" className="form-control" placeholder="exemplo@lcr.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row form-row-2">
                      <div className="form-group">
                        <label className="form-label">Contato de Emergência</label>
                        <input type="text" className="form-control" placeholder="Nome do contato" value={contatoEmergencia} onChange={(e) => setContatoEmergencia(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Telefone de Emergência</label>
                        <input type="tel" className="form-control" placeholder="(00) 00000-0000" value={telEmergencia} onChange={(e) => setTelEmergencia(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba Endereço */}
                {activeTab === "endereco" && (
                  <div className="tab-panel active">
                    <div className="form-row form-row-3">
                      <div className="form-group">
                        <label className="form-label">CEP</label>
                        <input type="text" className="form-control" placeholder="44900-000" value={cep} onChange={(e) => setCep(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Endereço</label>
                        <input type="text" className="form-control" placeholder="Rua, Avenida..." value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Número</label>
                        <input type="text" className="form-control" placeholder="123" value={numero} onChange={(e) => setNumero(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row form-row-2">
                      <div className="form-group">
                        <label className="form-label">Complemento</label>
                        <input type="text" className="form-control" placeholder="Apto, Bloco..." value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Bairro</label>
                        <input type="text" className="form-control" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row form-row-3">
                      <div className="form-group">
                        <label className="form-label">Cidade</label>
                        <input type="text" className="form-control" placeholder="Irecê" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Estado</label>
                        <select className="form-control" value={uf} onChange={(e) => setUf(e.target.value)}>
                          <option value="BA">BA</option>
                          <option value="SP">SP</option>
                          <option value="RJ">RJ</option>
                          <option value="MG">MG</option>
                          <option value="PE">PE</option>
                          <option value="CE">CE</option>
                          <option value="AM">AM</option>
                          <option value="RS">RS</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">País</label>
                        <input type="text" className="form-control" value="Brasil" readOnly />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Salvar Paciente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Importar pacientes (CSV) */}
        {importOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setImportOpen(false)}>
            <div className="modal" style={{ maxWidth: 560 }}>
              <div className="modal-header">
                <span className="modal-title">Importar pacientes (CSV)</span>
                <button className="modal-close" onClick={() => setImportOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                  Envie um arquivo <strong>.csv</strong> ou cole abaixo. Primeira linha = cabeçalho.
                  Colunas reconhecidas: <strong>nome, cpf, telefone, nascimento, email, plano</strong> (só <strong>nome</strong> é obrigatório).
                </p>
                <div className="form-group">
                  <input type="file" accept=".csv,text/csv" className="form-control" onChange={(e) => onArquivoCsv(e.target.files?.[0])} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ou cole o CSV</label>
                  <textarea
                    className="form-control"
                    rows={6}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder={"nome,cpf,telefone,nascimento\nMaria Souza,123.456.789-00,(74) 99999-0000,15/03/1990"}
                  />
                </div>
                {csvText.trim() && (
                  <div style={{ fontSize: 13, color: importPreview.length ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                    {importPreview.length
                      ? `${importPreview.length} paciente(s) prontos para importar`
                      : "Nenhum paciente válido detectado (confira o cabeçalho)."}
                  </div>
                )}
                {importPreview.length > 0 && (
                  <div className="table-wrapper" style={{ marginTop: 10, maxHeight: 180, overflowY: "auto" }}>
                    <table>
                      <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th></tr></thead>
                      <tbody>
                        {importPreview.slice(0, 8).map((p, i) => (
                          <tr key={i}><td>{p.nome}</td><td>{p.cpf || "—"}</td><td>{p.tel || "—"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setImportOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={importar} disabled={importando || importPreview.length === 0}>
                  {importando ? "Importando…" : `Importar ${importPreview.length || ""}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
