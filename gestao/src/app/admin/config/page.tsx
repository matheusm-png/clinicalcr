"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DB } from "@/lib/db";
import { Clinica, Usuario, Profissional, Marcador, ModeloDoc, Medicamento } from "@/lib/types";
import { MODULOS } from "@/lib/permissoes";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

const CORES = ["#0f766e", "#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#CA8A04", "#16A34A", "#0891B2"];

export default function ConfigPage() {
  const { showToast, confirm } = useToast();
  const [tab, setTab] = useState<"clinica" | "agenda" | "documentos" | "anamnese" | "profissionais" | "usuarios">("clinica");

  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [marcadores, setMarcadores] = useState<Marcador[]>([]);
  const [modelosDoc, setModelosDoc] = useState<ModeloDoc[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);

  // Novo medicamento (inline)
  const [medNome, setMedNome] = useState("");
  const [medPosologia, setMedPosologia] = useState("");
  const [salvandoMed, setSalvandoMed] = useState(false);

  // Novo marcador (inline)
  const [mNome, setMNome] = useState("");
  const [mCor, setMCor] = useState(CORES[4]);
  const [salvandoM, setSalvandoM] = useState(false);

  // Modal modelo de documento
  const [docOpen, setDocOpen] = useState(false);
  const [dId, setDId] = useState<number | null>(null);
  const [dNome, setDNome] = useState("");
  const [dTipo, setDTipo] = useState("termo");
  const [dTitulo, setDTitulo] = useState("");
  const [dConteudo, setDConteudo] = useState("");
  const [salvandoD, setSalvandoD] = useState(false);

  // Modal profissional
  const [profOpen, setProfOpen] = useState(false);
  const [pId, setPId] = useState<number | null>(null);
  const [pNome, setPNome] = useState("");
  const [pEsp, setPEsp] = useState("");
  const [pCro, setPCro] = useState("");
  const [pCor, setPCor] = useState(CORES[0]);
  const [pAtivo, setPAtivo] = useState(true);
  const [pComissao, setPComissao] = useState("");
  const [salvandoP, setSalvandoP] = useState(false);

  // Modal novo usuário
  const [novoOpen, setNovoOpen] = useState(false);
  const [uNome, setUNome] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uSenha, setUSenha] = useState("");
  const [uPapel, setUPapel] = useState("secretaria");
  const [salvandoU, setSalvandoU] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [c, us, profs, marcs, mods, meds] = await Promise.all([DB.clinica.get(), DB.usuarios.list(), DB.profissionais.list(), DB.marcadores.list(), DB.modelosDocumento.list(), DB.medicamentos.list()]);
    setClinica(c);
    setUsuarios(us);
    setProfissionais(profs);
    setMarcadores(marcs);
    setModelosDoc(mods);
    setMedicamentos(meds);
  };

  const adicionarMedicamento = async () => {
    if (!medNome.trim()) return showToast("Informe o nome do medicamento.", "error");
    setSalvandoMed(true);
    try {
      await DB.medicamentos.save({ nome: medNome.trim(), posologia: medPosologia.trim(), ativo: true });
      setMedNome(""); setMedPosologia("");
      await load();
      showToast("Medicamento adicionado.", "success");
    } catch {
      showToast("Não foi possível adicionar.", "error");
    } finally {
      setSalvandoMed(false);
    }
  };
  const removerMedicamento = async (m: Medicamento) => {
    if (m.id == null) return;
    if (!(await confirm(`Remover "${m.nome}" dos medicamentos?`, { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.medicamentos.remove(m.id);
      await load();
      showToast("Medicamento removido.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  const abrirNovoModelo = () => {
    setDId(null); setDNome(""); setDTipo("termo"); setDTitulo(""); setDConteudo(""); setDocOpen(true);
  };
  const abrirEditarModelo = (m: ModeloDoc) => {
    setDId(m.id!); setDNome(m.nome); setDTipo(m.tipo || "termo"); setDTitulo(m.titulo || ""); setDConteudo(m.conteudo || ""); setDocOpen(true);
  };
  const salvarModelo = async () => {
    if (!dNome.trim()) return showToast("Informe o nome do modelo.", "error");
    if (!dConteudo.trim()) return showToast("Informe o conteúdo do modelo.", "error");
    setSalvandoD(true);
    try {
      await DB.modelosDocumento.save({
        ...(dId ? { id: dId } : {}),
        nome: dNome.trim(), tipo: dTipo, titulo: dTitulo.trim(), conteudo: dConteudo, ativo: true,
      });
      setDocOpen(false);
      await load();
      showToast("Modelo salvo.", "success");
    } catch {
      showToast("Não foi possível salvar o modelo.", "error");
    } finally {
      setSalvandoD(false);
    }
  };
  const removerModelo = async (m: ModeloDoc) => {
    if (m.id == null) return;
    if (!(await confirm(`Remover o modelo "${m.nome}"?`, { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.modelosDocumento.remove(m.id);
      await load();
      showToast("Modelo removido.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  const adicionarMarcador = async () => {
    if (!mNome.trim()) return showToast("Informe o nome do marcador.", "error");
    setSalvandoM(true);
    try {
      await DB.marcadores.save({ nome: mNome.trim(), cor: mCor, ativo: true });
      setMNome(""); setMCor(CORES[4]);
      await load();
      showToast("Marcador adicionado.", "success");
    } catch {
      showToast("Não foi possível adicionar o marcador.", "error");
    } finally {
      setSalvandoM(false);
    }
  };

  const removerMarcador = async (m: Marcador) => {
    if (m.id == null) return;
    if (!(await confirm(`Remover o marcador "${m.nome}"? Os agendamentos com ele ficam sem marcador.`, { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.marcadores.remove(m.id);
      await load();
      showToast("Marcador removido.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  const abrirNovoProf = () => {
    setPId(null); setPNome(""); setPEsp(""); setPCro(""); setPCor(CORES[0]); setPAtivo(true); setPComissao("");
    setProfOpen(true);
  };
  const abrirEditarProf = (p: Profissional) => {
    setPId(p.id!); setPNome(p.nome); setPEsp(p.especialidade || ""); setPCro(p.cro || "");
    setPCor(p.cor); setPAtivo(p.ativo); setPComissao(p.comissaoPercentual ? String(p.comissaoPercentual) : ""); setProfOpen(true);
  };
  const salvarProfissional = async () => {
    if (!pNome.trim()) return showToast("Informe o nome do profissional.", "error");
    const comissao = pComissao ? parseFloat(pComissao.replace(",", ".")) : 0;
    if (isNaN(comissao) || comissao < 0 || comissao > 100) return showToast("Comissão deve ser entre 0 e 100%.", "error");
    setSalvandoP(true);
    try {
      await DB.profissionais.save({
        ...(pId ? { id: pId } : {}),
        nome: pNome.trim(), especialidade: pEsp, cro: pCro, cor: pCor, ativo: pAtivo, comissaoPercentual: comissao,
      });
      setProfOpen(false);
      await load();
      showToast("Profissional salvo.", "success");
    } catch {
      showToast("Não foi possível salvar o profissional.", "error");
    } finally {
      setSalvandoP(false);
    }
  };
  const removerProfissional = async (p: Profissional) => {
    if (p.id == null) return;
    if (!(await confirm(`Remover "${p.nome}"? As consultas dele(a) ficarão sem profissional.`, { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.profissionais.remove(p.id);
      await load();
      showToast("Profissional removido.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  const setCampo = (k: keyof Clinica, v: string) => setClinica((c) => (c ? { ...c, [k]: v } : c));
  const setCampoNum = (k: keyof Clinica, v: number) => setClinica((c) => (c ? { ...c, [k]: v } : c));

  const salvarClinica = async () => {
    if (!clinica) return;
    if (!clinica.nome) return showToast("Informe o nome da clínica.", "error");
    try {
      await DB.clinica.update(clinica);
      showToast("Dados da clínica salvos.", "success");
    } catch {
      showToast("Não foi possível salvar (apenas admin pode editar).", "error");
    }
  };

  const criarUsuario = async () => {
    if (!uEmail || !uSenha) return showToast("Informe e-mail e senha.", "error");
    setSalvandoU(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: uNome, email: uEmail, senha: uSenha, papel: uPapel }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setNovoOpen(false);
      setUNome(""); setUEmail(""); setUSenha(""); setUPapel("secretaria");
      await load();
      showToast("Usuário criado.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao criar usuário.", "error");
    } finally {
      setSalvandoU(false);
    }
  };

  const mudarPapel = async (id: string, papel: string) => {
    try {
      const r = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, papel }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      showToast("Papel atualizado.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao atualizar.", "error");
    }
  };

  // Permissões granulares por usuário
  const [permUser, setPermUser] = useState<Usuario | null>(null);
  const [permMap, setPermMap] = useState<Record<string, boolean>>({});
  const [salvandoPerm, setSalvandoPerm] = useState(false);

  const abrirPermissoes = (u: Usuario) => {
    const base: Record<string, boolean> = {};
    MODULOS.forEach((m) => { base[m.key] = u.permissoes ? u.permissoes[m.key] !== false : true; });
    setPermMap(base);
    setPermUser(u);
  };

  const salvarPermissoes = async () => {
    if (!permUser) return;
    setSalvandoPerm(true);
    try {
      // Se tudo liberado, grava null (sem restrição); senão grava o mapa.
      const todosTrue = MODULOS.every((m) => permMap[m.key] !== false);
      const r = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: permUser.id, permissoes: todosTrue ? null : permMap }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setPermUser(null);
      await load();
      showToast("Permissões atualizadas.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao salvar permissões.", "error");
    } finally {
      setSalvandoPerm(false);
    }
  };

  return (
    <>
      <Topbar title="Configurações" />

      <main className="page-content">
        <div className="tabs">
          <button className={`tab-btn ${tab === "clinica" ? "active" : ""}`} onClick={() => setTab("clinica")}>Minha Clínica</button>
          <button className={`tab-btn ${tab === "agenda" ? "active" : ""}`} onClick={() => setTab("agenda")}>Agenda</button>
          <button className={`tab-btn ${tab === "documentos" ? "active" : ""}`} onClick={() => setTab("documentos")}>Documentos</button>
          <button className={`tab-btn ${tab === "anamnese" ? "active" : ""}`} onClick={() => setTab("anamnese")}>Anamnese</button>
          <button className={`tab-btn ${tab === "profissionais" ? "active" : ""}`} onClick={() => setTab("profissionais")}>Profissionais</button>
          <button className={`tab-btn ${tab === "usuarios" ? "active" : ""}`} onClick={() => setTab("usuarios")}>Usuários</button>
        </div>

        {tab === "clinica" && clinica && (
          <div className="card" style={{ padding: 24, maxWidth: 720 }}>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Nome da clínica *</label>
                <input className="form-control" value={clinica.nome} onChange={(e) => setCampo("nome", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">CNPJ / CPF</label>
                <input className="form-control" value={clinica.cnpj ?? ""} onChange={(e) => setCampo("cnpj", e.target.value)} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-control" value={clinica.telefone ?? ""} onChange={(e) => setCampo("telefone", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-control" value={clinica.email ?? ""} onChange={(e) => setCampo("email", e.target.value)} />
              </div>
            </div>
            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">CEP</label>
                <input className="form-control" value={clinica.cep ?? ""} onChange={(e) => setCampo("cep", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input className="form-control" value={clinica.endereco ?? ""} onChange={(e) => setCampo("endereco", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Número</label>
                <input className="form-control" value={clinica.numero ?? ""} onChange={(e) => setCampo("numero", e.target.value)} />
              </div>
            </div>
            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">Bairro</label>
                <input className="form-control" value={clinica.bairro ?? ""} onChange={(e) => setCampo("bairro", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input className="form-control" value={clinica.cidade ?? ""} onChange={(e) => setCampo("cidade", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">UF</label>
                <input className="form-control" value={clinica.uf ?? ""} onChange={(e) => setCampo("uf", e.target.value)} maxLength={2} />
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 4px", fontSize: 14 }}>Pagamentos online (InfinitePay)</h4>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
                Informe sua InfiniteTag para gerar links de pagamento (Pix/cartão) nas cobranças, em "A Receber". Sem isso, os links são apenas demonstração.
              </p>
              <div className="form-group" style={{ maxWidth: 320 }}>
                <label className="form-label">InfiniteTag</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 18, color: "var(--text-muted)" }}>$</span>
                  <input
                    className="form-control"
                    placeholder="suaclinica"
                    value={clinica.infinitepayHandle ?? ""}
                    onChange={(e) => setCampo("infinitepayHandle", e.target.value)}
                  />
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>É o seu @ na InfinitePay (sem o "$"), encontrado no app InfinitePay.</span>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 4px", fontSize: 14 }}>Agendamento online</h4>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
                Página pública onde o paciente pede um horário (sem login). Os pedidos chegam em “Solicitações”.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
                <input type="checkbox" checked={clinica.agendamentoOnline ?? true} onChange={(e) => setClinica((c) => (c ? { ...c, agendamentoOnline: e.target.checked } : c))} />
                Aceitar solicitações de agendamento online
              </label>
              <div className="form-group" style={{ maxWidth: 420 }}>
                <label className="form-label">Link para compartilhar</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="form-control" readOnly value={typeof window !== "undefined" ? `${window.location.origin}/agendar` : "/agendar"} onFocus={(e) => e.target.select()} />
                  <button className="btn btn-outline" type="button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/agendar`); showToast("Link copiado.", "success"); }}>Copiar</button>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Coloque no Instagram, WhatsApp, Google Meu Negócio etc.</span>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <button className="btn btn-primary" onClick={salvarClinica}>Salvar dados da clínica</button>
            </div>
          </div>
        )}

        {tab === "agenda" && clinica && (
          <>
            <div className="card" style={{ padding: 24, maxWidth: 720, marginBottom: 16 }}>
              <span className="card-title" style={{ display: "block", marginBottom: 4 }}>Horário de funcionamento</span>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 14px" }}>
                Define a faixa de horas exibida na grade da agenda.
              </p>
              <div className="form-row form-row-2" style={{ maxWidth: 360 }}>
                <div className="form-group">
                  <label className="form-label">Abre às</label>
                  <select className="form-control" value={clinica.agendaHoraInicio ?? 7} onChange={(e) => setCampoNum("agendaHoraInicio", Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha às</label>
                  <select className="form-control" value={clinica.agendaHoraFim ?? 19} onChange={(e) => setCampoNum("agendaHoraFim", Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                  </select>
                </div>
              </div>
              {clinica.agendaHoraFim != null && clinica.agendaHoraInicio != null && clinica.agendaHoraFim <= clinica.agendaHoraInicio && (
                <p style={{ fontSize: 12, color: "var(--danger)", margin: "0 0 10px" }}>O horário de fechamento deve ser maior que o de abertura.</p>
              )}
              <button className="btn btn-primary" onClick={salvarClinica}>Salvar horário</button>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Marcadores</span>
              </div>
              <p style={{ padding: "0 16px", fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
                Rótulos coloridos para identificar consultas na agenda (ex.: cadeiras/salas, tipo de atendimento).
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", padding: "0 16px 16px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nome</label>
                  <input className="form-control" style={{ width: 200 }} value={mNome} placeholder="Ex.: Cadeira 1" onChange={(e) => setMNome(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cor</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {CORES.map((c) => (
                      <button key={c} type="button" aria-label={c} onClick={() => setMCor(c)}
                        style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: mCor === c ? "3px solid var(--text)" : "2px solid var(--border)", cursor: "pointer" }} />
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={adicionarMarcador} disabled={salvandoM}>+ Adicionar</button>
              </div>
              {marcadores.length === 0 ? (
                <p style={{ padding: "0 16px 20px", color: "var(--text-muted)", fontSize: 13 }}>Nenhum marcador cadastrado.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Marcador</th><th>Cor</th><th>Ações</th></tr></thead>
                    <tbody>
                      {marcadores.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 12, height: 12, borderRadius: "50%", background: m.cor, display: "inline-block", flexShrink: 0 }} />
                              <strong>{m.nome}</strong>
                            </span>
                          </td>
                          <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{m.cor}</td>
                          <td>
                            <button className="btn btn-outline btn-sm" style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => removerMarcador(m)}>Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "documentos" && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Modelos de documentos</span>
              <button className="btn btn-primary btn-sm" onClick={abrirNovoModelo}>+ Novo modelo</button>
            </div>
            <p style={{ padding: "0 16px", fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
              Crie modelos próprios (termos, contratos, orientações…) que aparecem no editor de Documentos do prontuário, além dos modelos padrão. Use os campos {"{{paciente}}"}, {"{{cpf}}"}, {"{{cidade}}"}, {"{{data}}"} e {"{{clinica}}"} para preencher automaticamente.
            </p>
            {modelosDoc.length === 0 ? (
              <p style={{ padding: "0 16px 20px", color: "var(--text-muted)", fontSize: 13 }}>Nenhum modelo personalizado ainda.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Modelo</th><th>Categoria</th><th>Ações</th></tr></thead>
                  <tbody>
                    {modelosDoc.map((m) => (
                      <tr key={m.id}>
                        <td><strong>{m.nome}</strong></td>
                        <td style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{m.tipo}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => abrirEditarModelo(m)}>Editar</button>
                            <button className="btn btn-outline btn-sm" style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => removerModelo(m)}>Remover</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "documentos" && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <span className="card-title">Medicamentos do receituário</span>
            </div>
            <p style={{ padding: "0 16px", fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
              Seus medicamentos favoritos aparecem no editor de Receituário (além da base padrão) para inserir com um clique.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", padding: "0 16px 16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome</label>
                <input className="form-control" style={{ width: 220 }} value={medNome} placeholder="Ex.: Amoxicilina 500mg" onChange={(e) => setMedNome(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 240 }}>
                <label className="form-label">Posologia</label>
                <input className="form-control" value={medPosologia} placeholder="Ex.: 1 cápsula de 8/8h por 7 dias" onChange={(e) => setMedPosologia(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={adicionarMedicamento} disabled={salvandoMed}>+ Adicionar</button>
            </div>
            {medicamentos.length === 0 ? (
              <p style={{ padding: "0 16px 20px", color: "var(--text-muted)", fontSize: 13 }}>Nenhum medicamento próprio cadastrado (a base padrão já está disponível no receituário).</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Medicamento</th><th>Posologia</th><th>Ações</th></tr></thead>
                  <tbody>
                    {medicamentos.map((m) => (
                      <tr key={m.id}>
                        <td><strong>{m.nome}</strong></td>
                        <td style={{ color: "var(--text-muted)", fontSize: 13 }}>{m.posologia || "—"}</td>
                        <td>
                          <button className="btn btn-outline btn-sm" style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => removerMedicamento(m)}>Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "anamnese" && (
          <div className="card" style={{ padding: 24, maxWidth: 720 }}>
            <span className="card-title" style={{ display: "block", marginBottom: 4 }}>Modelos de anamnese</span>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
              Crie fichas de anamnese próprias (seções e perguntas) para usar no prontuário, além da ficha padrão. A ficha padrão e o preenchimento por foto (OCR) continuam funcionando.
            </p>
            <Link href="/admin/modelos-anamnese" className="btn btn-primary">Gerenciar modelos de anamnese</Link>
          </div>
        )}

        {tab === "profissionais" && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Profissionais da clínica</span>
              <button className="btn btn-primary btn-sm" onClick={abrirNovoProf}>+ Novo profissional</button>
            </div>
            {profissionais.length === 0 ? (
              <p style={{ padding: "20px 16px", color: "var(--text-muted)", fontSize: 13 }}>
                Nenhum profissional cadastrado. Cadastre dentistas para usar a agenda por profissional.
              </p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Profissional</th><th>Especialidade</th><th>CRO</th><th>Comissão</th><th>Status</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {profissionais.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.cor, display: "inline-block", flexShrink: 0 }} />
                            <strong>{p.nome}</strong>
                          </span>
                        </td>
                        <td>{p.especialidade || "—"}</td>
                        <td>{p.cro || "—"}</td>
                        <td>{p.comissaoPercentual ? `${p.comissaoPercentual.toLocaleString("pt-BR")}%` : "—"}</td>
                        <td>
                          <span className={`badge ${p.ativo ? "badge-success" : "badge-danger"}`}>{p.ativo ? "Ativo" : "Inativo"}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => abrirEditarProf(p)}>Editar</button>
                            <button className="btn btn-outline btn-sm" style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => removerProfissional(p)}>Remover</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "usuarios" && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Usuários da clínica</span>
              <button className="btn btn-primary btn-sm" onClick={() => setNovoOpen(true)}>+ Novo usuário</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Nome</th><th>Papel</th><th>Acesso</th></tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.nome || "—"}</strong></td>
                      <td>
                        <select className="form-control" style={{ width: 180 }} value={u.papel} onChange={(e) => mudarPapel(u.id, e.target.value)}>
                          <option value="admin">Administrador</option>
                          <option value="dentista">Dentista</option>
                          <option value="secretaria">Secretária</option>
                        </select>
                      </td>
                      <td>
                        {u.papel === "admin" ? (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Acesso total</span>
                        ) : (
                          <button className="btn btn-outline btn-sm" onClick={() => abrirPermissoes(u)}>
                            {u.permissoes ? "Personalizado" : "Todos os módulos"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "12px 16px 0" }}>
              Papéis: <strong>Administrador</strong> (tudo), <strong>Dentista</strong> (clínico + financeiro), <strong>Secretária</strong> (atendimento, sem financeiro).
              Use <strong>Acesso</strong> para liberar/bloquear módulos específicos por usuário.
            </p>
          </div>
        )}

        {/* Modal de permissões granulares */}
        {permUser && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setPermUser(null)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">Acesso de {permUser.nome || "usuário"}</span>
                <button className="modal-close" onClick={() => setPermUser(null)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
                  Marque os módulos que este usuário pode ver no menu. Desmarcar oculta o módulo para ele.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {MODULOS.map((m) => (
                    <label key={m.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--border)" }}>
                      <input
                        type="checkbox"
                        checked={permMap[m.key] !== false}
                        onChange={(e) => setPermMap((prev) => ({ ...prev, [m.key]: e.target.checked }))}
                      />
                      <span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{m.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setPermUser(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarPermissoes} disabled={salvandoPerm}>
                  {salvandoPerm ? "Salvando…" : "Salvar acesso"}
                </button>
              </div>
            </div>
          </div>
        )}

        {docOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setDocOpen(false)}>
            <div className="modal" style={{ maxWidth: 640 }}>
              <div className="modal-header">
                <span className="modal-title">{dId ? "Editar modelo" : "Novo modelo de documento"}</span>
                <button className="modal-close" onClick={() => setDocOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Nome do modelo *</label>
                    <input className="form-control" value={dNome} onChange={(e) => setDNome(e.target.value)} placeholder="Ex.: Termo de consentimento — Implante" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <select className="form-control" value={dTipo} onChange={(e) => setDTipo(e.target.value)}>
                      <option value="termo">Termo</option>
                      <option value="receituario">Receituário</option>
                      <option value="atestado">Atestado</option>
                      <option value="declaracao">Declaração</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Título do documento</label>
                  <input className="form-control" value={dTitulo} onChange={(e) => setDTitulo(e.target.value)} placeholder="Ex.: Termo de Consentimento (se vazio, usa o nome do modelo)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Conteúdo *</label>
                  <textarea className="form-control" rows={10} value={dConteudo} onChange={(e) => setDConteudo(e.target.value)}
                    placeholder={"Use os campos automáticos:\n{{paciente}}, {{cpf}}, {{cidade}}, {{data}}, {{clinica}}"}
                    style={{ fontFamily: "inherit", lineHeight: 1.6 }} />
                  <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    Campos automáticos: <code>{"{{paciente}}"}</code> <code>{"{{cpf}}"}</code> <code>{"{{cidade}}"}</code> <code>{"{{data}}"}</code> <code>{"{{clinica}}"}</code>
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setDocOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarModelo} disabled={salvandoD}>{salvandoD ? "Salvando…" : "Salvar modelo"}</button>
              </div>
            </div>
          </div>
        )}

        {profOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setProfOpen(false)}>
            <div className="modal" style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <span className="modal-title">{pId ? "Editar profissional" : "Novo profissional"}</span>
                <button className="modal-close" onClick={() => setProfOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input className="form-control" value={pNome} onChange={(e) => setPNome(e.target.value)} placeholder="Ex: Dra. Lara Camila" />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Especialidade</label>
                    <input className="form-control" value={pEsp} onChange={(e) => setPEsp(e.target.value)} placeholder="Ex: Ortodontia" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CRO</label>
                    <input className="form-control" value={pCro} onChange={(e) => setPCro(e.target.value)} placeholder="Ex: CRO-BA 12345" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Comissão (%)</label>
                  <input
                    className="form-control"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={pComissao}
                    onChange={(e) => setPComissao(e.target.value)}
                    placeholder="Ex: 40"
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>% sobre a produção realizada (procedimentos concluídos atribuídos ao profissional). Use o relatório de Comissões para apurar.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Cor na agenda</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {CORES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPCor(c)}
                        aria-label={c}
                        style={{
                          width: 30, height: 30, borderRadius: "50%", background: c, cursor: "pointer",
                          border: pCor === c ? "3px solid var(--text)" : "2px solid var(--border)",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={pAtivo} onChange={(e) => setPAtivo(e.target.checked)} />
                    Ativo (aparece na agenda)
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setProfOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarProfissional} disabled={salvandoP}>
                  {salvandoP ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {novoOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setNovoOpen(false)}>
            <div className="modal" style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <span className="modal-title">Novo Usuário</span>
                <button className="modal-close" onClick={() => setNovoOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome</label>
                  <input className="form-control" value={uNome} onChange={(e) => setUNome(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail *</label>
                  <input type="email" className="form-control" value={uEmail} onChange={(e) => setUEmail(e.target.value)} autoComplete="off" />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Senha *</label>
                    <input type="text" className="form-control" value={uSenha} onChange={(e) => setUSenha(e.target.value)} placeholder="mín. 6 caracteres" autoComplete="off" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Papel</label>
                    <select className="form-control" value={uPapel} onChange={(e) => setUPapel(e.target.value)}>
                      <option value="secretaria">Secretária</option>
                      <option value="dentista">Dentista</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setNovoOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={criarUsuario} disabled={salvandoU}>
                  {salvandoU ? "Criando…" : "Criar usuário"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
