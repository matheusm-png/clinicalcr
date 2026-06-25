"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { Clinica, Usuario, Profissional, Marcador } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

const CORES = ["#0f766e", "#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#CA8A04", "#16A34A", "#0891B2"];

export default function ConfigPage() {
  const { showToast, confirm } = useToast();
  const [tab, setTab] = useState<"clinica" | "agenda" | "profissionais" | "usuarios">("clinica");

  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [marcadores, setMarcadores] = useState<Marcador[]>([]);

  // Novo marcador (inline)
  const [mNome, setMNome] = useState("");
  const [mCor, setMCor] = useState(CORES[4]);
  const [salvandoM, setSalvandoM] = useState(false);

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
    const [c, us, profs, marcs] = await Promise.all([DB.clinica.get(), DB.usuarios.list(), DB.profissionais.list(), DB.marcadores.list()]);
    setClinica(c);
    setUsuarios(us);
    setProfissionais(profs);
    setMarcadores(marcs);
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

  return (
    <>
      <Topbar title="Configurações" />

      <main className="page-content">
        <div className="tabs">
          <button className={`tab-btn ${tab === "clinica" ? "active" : ""}`} onClick={() => setTab("clinica")}>Minha Clínica</button>
          <button className={`tab-btn ${tab === "agenda" ? "active" : ""}`} onClick={() => setTab("agenda")}>Agenda</button>
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
                  <tr><th>Nome</th><th>Papel</th></tr>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "12px 16px 0" }}>
              Papéis: <strong>Administrador</strong> (tudo), <strong>Dentista</strong> (clínico + financeiro), <strong>Secretária</strong> (atendimento, sem financeiro).
            </p>
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
