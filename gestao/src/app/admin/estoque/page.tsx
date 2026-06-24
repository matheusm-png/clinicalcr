"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { ItemEstoque } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

export default function EstoquePage() {
  const { showToast, confirm } = useToast();
  const [items, setItems] = useState<ItemEstoque[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState(""); // "" | "odontologico" | "limpeza" | "baixo"
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isMovModalOpen, setIsMovModalOpen] = useState(false);

  // Item Form State
  const [itemId, setItemId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("odontologico");
  const [quantidade, setQuantidade] = useState("");
  const [minimo, setMinimo] = useState("");
  const [unidade, setUnidade] = useState("unid");
  const [fornecedor, setFornecedor] = useState("");
  const [obs, setObs] = useState("");

  // Movimentação Form State
  const [selectedItem, setSelectedItem] = useState<ItemEstoque | null>(null);
  const [movTipo, setMovTipo] = useState<"entrada" | "saida">("entrada");
  const [movQtd, setMovQtd] = useState("");
  const [movData, setMovData] = useState("");
  const [movMotivo, setMovMotivo] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setItems(await DB.estoque.list());
  };

  const handleOpenItemModal = (item?: ItemEstoque) => {
    if (item) {
      setItemId(item.id ?? null);
      setNome(item.nome);
      setCategoria(item.categoria === "Dentística" || item.categoria === "odontologico" ? "odontologico" : "limpeza");
      setQuantidade(String(item.quantidade));
      setMinimo(String(item.minimo));
      setUnidade(item.unidade || "unid");
      setFornecedor(item.fornecedor || "");
      setObs(item.obs || "");
    } else {
      setItemId(null);
      setNome("");
      setCategoria("odontologico");
      setQuantidade("0");
      setMinimo("5");
      setUnidade("unid");
      setFornecedor("");
      setObs("");
    }
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!nome || !quantidade || !minimo) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    const payload: ItemEstoque = {
      ...(itemId ? { id: itemId } : {}),
      nome,
      quantidade: parseInt(quantidade),
      minimo: parseInt(minimo),
      categoria: categoria === "odontologico" ? "odontologico" : "limpeza",
      fornecedor,
      unidade,
      obs,
    };

    try {
      await DB.estoque.save(payload);
      setIsItemModalOpen(false);
      await loadData();
      showToast("Item salvo.", "success");
    } catch {
      showToast("Não foi possível salvar o item. Tente novamente.", "error");
    }
  };

  const handleOpenMovModal = (item: ItemEstoque) => {
    setSelectedItem(item);
    setMovTipo("entrada");
    setMovQtd("");
    setMovData(new Date().toISOString().split("T")[0]);
    setMovMotivo("");
    setIsMovModalOpen(true);
  };

  const handleSaveMov = () => {
    if (!selectedItem || !movQtd) return;
    const qtdNum = parseInt(movQtd);
    if (isNaN(qtdNum) || qtdNum <= 0) {
      showToast("Informe uma quantidade válida.", "error");
      return;
    }

    let novaQtd = selectedItem.quantidade;
    if (movTipo === "entrada") {
      novaQtd += qtdNum;
    } else {
      if (qtdNum > selectedItem.quantidade) {
        showToast("Quantidade de saída maior do que o estoque atual.", "error");
        return;
      }
      novaQtd -= qtdNum;
    }

    const updatedItem = {
      ...selectedItem,
      quantidade: novaQtd,
    };

    (async () => {
      try {
        await DB.estoque.save(updatedItem);
        setIsMovModalOpen(false);
        await loadData();
        showToast("Movimentação registrada.", "success");
      } catch {
        showToast("Não foi possível registrar a movimentação.", "error");
      }
    })();
  };

  const handleDelete = async (id?: number) => {
    if (id == null) return;
    if (await confirm("Deseja realmente remover este item do estoque?", { danger: true, okLabel: "Remover" })) {
      try {
        await DB.estoque.remove(id);
        await loadData();
        showToast("Item removido.", "success");
      } catch {
        showToast("Não foi possível remover o item.", "error");
      }
    }
  };

  // Status de Estoque
  const getStatus = (item: ItemEstoque) => {
    if (item.quantidade === 0) {
      return { label: "Sem estoque", cls: "badge-danger", dot: "dot-empty" };
    }
    if (item.quantidade <= item.minimo) {
      return { label: "Estoque baixo", cls: "badge-warning", dot: "dot-low" };
    }
    return { label: "Normal", cls: "badge-success", dot: "dot-ok" };
  };

  // Cálculos de Estatísticas
  const totalItens = items.length;
  const normalCount = items.filter((i) => i.quantidade > i.minimo).length;
  const baixoCount = items.filter((i) => i.quantidade > 0 && i.quantidade <= i.minimo).length;
  const zeradoCount = items.filter((i) => i.quantidade === 0).length;

  // Filtragem
  const filteredItems = items.filter((i) => {
    const matchesSearch = !search || i.nome.toLowerCase().includes(search.toLowerCase());
    let matchesCat = true;

    // Normalizar categorias antigas
    const normCat = i.categoria === "Dentística" || i.categoria === "odontologico" ? "odontologico" : "limpeza";

    if (catFilter === "baixo") {
      matchesCat = i.quantidade <= i.minimo;
    } else if (catFilter) {
      matchesCat = normCat === catFilter;
    }

    return matchesSearch && matchesCat;
  });

  return (
    <>
      <Topbar title="Controle de Estoque">
        <button className="btn btn-primary" onClick={() => handleOpenItemModal()}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo Item
        </button>
      </Topbar>

      <main className="page-content">
        {/* Stats */}
        <div className="estoque-stats">
          <div className="est-stat">
            <div className="est-stat-icon" style={{ background: "var(--primary-light)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: "var(--primary-darker)" }}>
                <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div>
              <div className="est-stat-val">{totalItens}</div>
              <div className="est-stat-lbl">Total de itens</div>
            </div>
          </div>
          <div className="est-stat">
            <div className="est-stat-icon" style={{ background: "#DCFCE7" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: "#16A34A" }}>
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="est-stat-val" style={{ color: "#16A34A" }}>{normalCount}</div>
              <div className="est-stat-lbl">Estoque Normal</div>
            </div>
          </div>
          <div className="est-stat">
            <div className="est-stat-icon" style={{ background: "#FEF3C7" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: "#D97706" }}>
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <div>
              <div className="est-stat-val" style={{ color: "#D97706" }}>{baixoCount}</div>
              <div className="est-stat-lbl">Estoque Baixo</div>
            </div>
          </div>
          <div className="est-stat">
            <div className="est-stat-icon" style={{ background: "#FEE2E2" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: "#DC2626" }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <div>
              <div className="est-stat-val" style={{ color: "#DC2626" }}>{zeradoCount}</div>
              <div className="est-stat-lbl">Sem Estoque</div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card mb-6">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar item…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="cat-tabs">
              <button
                className={`cat-tab ${catFilter === "" ? "active" : ""}`}
                onClick={() => setCatFilter("")}
              >
                Todos
              </button>
              <button
                className={`cat-tab tab-odonto ${catFilter === "odontologico" ? "active" : ""}`}
                onClick={() => setCatFilter("odontologico")}
              >
                Odontológico
              </button>
              <button
                className={`cat-tab tab-limpeza ${catFilter === "limpeza" ? "active" : ""}`}
                onClick={() => setCatFilter("limpeza")}
              >
                Limpeza
              </button>
              <button
                className={`cat-tab tab-baixo ${catFilter === "baixo" ? "active" : ""}`}
                onClick={() => setCatFilter("baixo")}
                style={{ background: catFilter === "baixo" ? "var(--warning)" : "", color: catFilter === "baixo" ? "white" : "" }}
              >
                ⚠ Estoque baixo
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Itens */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}>
                  <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              }
              title={search || catFilter ? "Nenhum item encontrado" : "Estoque vazio"}
              hint={search || catFilter ? "Tente ajustar a busca ou os filtros." : "Cadastre insumos e materiais para controlar o estoque."}
              action={
                !search && !catFilter ? (
                  <button className="btn btn-primary btn-sm" onClick={() => handleOpenItemModal()}>
                    + Novo item
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Categoria</th>
                    <th>Quantidade</th>
                    <th>Mínimo</th>
                    <th>Fornecedor</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const st = getStatus(item);
                    const isLow = item.quantidade <= item.minimo;
                    const isZero = item.quantidade === 0;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderLeft: isZero
                            ? "3px solid var(--danger)"
                            : isLow
                            ? "3px solid var(--warning)"
                            : "",
                        }}
                      >
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.nome}</div>
                          {(item as any).obs && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              {(item as any).obs}
                            </div>
                          )}
                        </td>
                        <td>
                          {item.categoria === "odontologico" || item.categoria === "Dentística" ? (
                            <span className="cat-pill cat-odonto">🦷 Odontológico</span>
                          ) : (
                            <span className="cat-pill cat-limpeza">🧹 Limpeza</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className={`stock-dot ${st.dot}`}></span>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{item.quantidade}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(item as any).unidade || "unid"}</span>
                          </div>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                          {item.minimo} {(item as any).unidade || "unid"}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.fornecedor || "—"}</td>
                        <td>
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-btn"
                              title="Movimentação"
                              onClick={() => handleOpenMovModal(item)}
                            >
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </button>
                            <button
                              className="icon-btn"
                              title="Editar"
                              onClick={() => handleOpenItemModal(item)}
                            >
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              className="icon-btn danger"
                              title="Excluir"
                              onClick={() => handleDelete(item.id)}
                            >
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
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

        {/* Modal Novo/Editar Item */}
        {isItemModalOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsItemModalOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">{itemId ? "Editar Item" : "Novo Item"}</span>
                <button className="modal-close" onClick={() => setIsItemModalOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome do Item *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: Resina Z350"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <select
                      className="form-control"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                    >
                      <option value="odontologico">Odontológico</option>
                      <option value="limpeza">Limpeza</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fornecedor</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Dental Cremer"
                      value={fornecedor}
                      onChange={(e) => setFornecedor(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label className="form-label">Estoque Atual *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mínimo Alerta *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={minimo}
                      onChange={(e) => setMinimo(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidade</label>
                    <select className="form-control" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                      <option value="unid">Unidade</option>
                      <option value="pct">Pacote</option>
                      <option value="cx">Caixa</option>
                      <option value="fr">Frasco</option>
                      <option value="tub">Tubo</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Outras anotações sobre o item..."
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setIsItemModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSaveItem}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Movimentação */}
        {isMovModalOpen && selectedItem && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsMovModalOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">Movimentar: {selectedItem.nome}</span>
                <button className="modal-close" onClick={() => setIsMovModalOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                {/* Abas Tipo */}
                <div className="mov-type-tabs">
                  <button
                    type="button"
                    className={`mov-tab ${movTipo === "entrada" ? "active-entrada" : ""}`}
                    onClick={() => setMovTipo("entrada")}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    className={`mov-tab ${movTipo === "saida" ? "active-saida" : ""}`}
                    onClick={() => setMovTipo("saida")}
                  >
                    Saída
                  </button>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Quantidade *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Quantidade"
                      value={movQtd}
                      onChange={(e) => setMovQtd(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={movData}
                      onChange={(e) => setMovData(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Motivo / Justificativa</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: Compra com fornecedor / Consumo clínico"
                    value={movMotivo}
                    onChange={(e) => setMovMotivo(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setIsMovModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSaveMov}>
                  Registrar Movimentação
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
