"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { ProcedimentoCatalogo } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { catalogoPadraoFlat } from "@/lib/catalogo/padrao";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => s.trim().toLowerCase();

export default function CatalogoPage() {
  const { showToast, confirm } = useToast();
  const [itens, setItens] = useState<ProcedimentoCatalogo[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => setItens(await DB.catalogo.list());

  const abrirNovo = () => {
    setEditId(null);
    setNome(""); setCategoria(""); setPreco(""); setDuracao(""); setAtivo(true);
    setIsOpen(true);
  };

  const abrirEdit = (p: ProcedimentoCatalogo) => {
    setEditId(p.id ?? null);
    setNome(p.nome);
    setCategoria(p.categoria ?? "");
    setPreco(String(p.preco));
    setDuracao(p.duracaoMin ? String(p.duracaoMin) : "");
    setAtivo(p.ativo ?? true);
    setIsOpen(true);
  };

  const salvar = async () => {
    if (!nome || !preco) {
      showToast("Informe ao menos nome e preço.", "error");
      return;
    }
    const payload: ProcedimentoCatalogo = {
      ...(editId ? { id: editId } : {}),
      nome,
      categoria,
      preco: parseFloat(preco),
      duracaoMin: duracao ? parseInt(duracao) : undefined,
      ativo,
    };
    try {
      await DB.catalogo.save(payload);
      setIsOpen(false);
      await load();
      showToast(editId ? "Procedimento atualizado." : "Procedimento adicionado.", "success");
    } catch {
      showToast("Não foi possível salvar.", "error");
    }
  };

  // Importa o catálogo padrão (C2), pulando os que já existem pelo nome.
  const importarPadrao = async () => {
    const padrao = catalogoPadraoFlat();
    const existentes = new Set(itens.map((p) => norm(p.nome)));
    const novos = padrao.filter((p) => !existentes.has(norm(p.nome)));
    if (novos.length === 0) {
      showToast("Seu catálogo já contém todos os procedimentos padrão.", "info");
      return;
    }
    const ok = await confirm(
      `Adicionar ${novos.length} procedimento(s) do catálogo padrão? Os preços vêm como sugestão e você pode editar depois.`,
      { okLabel: "Importar" },
    );
    if (!ok) return;
    setImportando(true);
    try {
      const qtd = await DB.catalogo.importarMuitos(
        novos.map((p) => ({ nome: p.nome, categoria: p.categoria, preco: p.preco, duracaoMin: p.duracaoMin, ativo: true })),
      );
      await load();
      showToast(`${qtd} procedimento(s) importado(s). Revise os preços conforme sua tabela.`, "success");
    } catch {
      showToast("Não foi possível importar o catálogo padrão.", "error");
    } finally {
      setImportando(false);
    }
  };

  const remover = async (p: ProcedimentoCatalogo) => {
    if (p.id == null) return;
    if (!(await confirm(`Remover "${p.nome}" do catálogo?`, { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.catalogo.remove(p.id);
      await load();
      showToast("Procedimento removido.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  const filtrados = itens.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || (p.categoria ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <Topbar title="Catálogo de Procedimentos">
        <button className="btn btn-outline" onClick={importarPadrao} disabled={importando}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          {importando ? "Importando…" : "Importar catálogo padrão"}
        </button>
        <button className="btn btn-primary" onClick={abrirNovo}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo Procedimento
        </button>
      </Topbar>

      <main className="page-content">
        <div className="card mb-6">
          <div className="search-bar" style={{ minWidth: 220 }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" placeholder="Buscar procedimento ou categoria…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Procedimentos</span>
            <span className="text-muted">{filtrados.length} itens</span>
          </div>

          {filtrados.length === 0 ? (
            <EmptyState
              title={search ? "Nenhum procedimento encontrado" : "Catálogo vazio"}
              hint={search ? "Tente outra busca." : "Importe o catálogo padrão para começar rápido ou cadastre manualmente."}
              action={!search ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button className="btn btn-primary btn-sm" onClick={importarPadrao} disabled={importando}>
                    {importando ? "Importando…" : "Importar catálogo padrão"}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={abrirNovo}>+ Novo procedimento</button>
                </div>
              ) : undefined}
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Procedimento</th>
                    <th>Categoria</th>
                    <th>Preço</th>
                    <th>Duração</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.nome}</strong></td>
                      <td style={{ color: "var(--text-muted)" }}>{p.categoria || "—"}</td>
                      <td><strong>{brl(p.preco)}</strong></td>
                      <td style={{ color: "var(--text-muted)" }}>{p.duracaoMin ? `${p.duracaoMin} min` : "—"}</td>
                      <td>
                        <span className={`badge ${p.ativo ? "badge-success" : "badge-danger"}`}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="icon-btn" title="Editar" onClick={() => abrirEdit(p)}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button className="icon-btn danger" title="Remover" onClick={() => remover(p)}>
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

        {isOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}>
            <div className="modal" style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <span className="modal-title">{editId ? "Editar Procedimento" : "Novo Procedimento"}</span>
                <button className="modal-close" onClick={() => setIsOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Restauração em resina" />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <input className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Dentística" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duração (min)</label>
                    <input type="number" className="form-control" value={duracao} onChange={(e) => setDuracao(e.target.value)} placeholder="Ex.: 50" />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Preço (R$) *</label>
                    <input type="number" step="0.01" className="form-control" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={ativo ? "1" : "0"} onChange={(e) => setAtivo(e.target.value === "1")}>
                      <option value="1">Ativo</option>
                      <option value="0">Inativo</option>
                    </select>
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
