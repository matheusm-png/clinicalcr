"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { Clinica, Usuario } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

const PAPEL_LABEL: Record<string, string> = { admin: "Administrador", dentista: "Dentista", secretaria: "Secretária" };

export default function ConfigPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"clinica" | "usuarios">("clinica");

  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Modal novo usuário
  const [novoOpen, setNovoOpen] = useState(false);
  const [uNome, setUNome] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uSenha, setUSenha] = useState("");
  const [uPapel, setUPapel] = useState("secretaria");
  const [salvandoU, setSalvandoU] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [c, us] = await Promise.all([DB.clinica.get(), DB.usuarios.list()]);
    setClinica(c);
    setUsuarios(us);
  };

  const setCampo = (k: keyof Clinica, v: string) => setClinica((c) => (c ? { ...c, [k]: v } : c));

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
