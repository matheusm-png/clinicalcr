"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { TransacaoFinanceira } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

export default function FinanceiroPage() {
  const { showToast, confirm } = useToast();
  const [transactions, setTransactions] = useState<TransacaoFinanceira[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(""); // "" | "receita" | "despesa"
  const [statusFilter, setStatusFilter] = useState(""); // "" | "pago" | "pendente"
  const [monthFilter, setMonthFilter] = useState(""); // YYYY-MM
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [tipo, setTipo] = useState<"receita" | "despesa">("receita");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("Estética");
  const [data, setData] = useState("");
  const [status, setStatus] = useState<"pago" | "pendente">("pago");
  const [formaPagto, setFormaPagto] = useState("PIX");

  useEffect(() => {
    // Definir mês atual como default do filtro
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonthFilter(currentMonth);

    loadData();
  }, []);

  const loadData = async () => {
    setTransactions(await DB.financeiro.list());
  };

  const handleOpenModal = () => {
    setTipo("receita");
    setDescricao("");
    setValor("");
    setCategoria("Estética");
    setData(new Date().toISOString().split("T")[0]);
    setStatus("pago");
    setFormaPagto("PIX");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!descricao || !valor || !data) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    const novaTransacao: TransacaoFinanceira = {
      tipo,
      descricao,
      valor: parseFloat(valor),
      categoria,
      data,
      status,
      formaPagto,
    };

    try {
      await DB.financeiro.add(novaTransacao);
      setIsModalOpen(false);
      await loadData();
      showToast("Lançamento registrado.", "success");
    } catch {
      showToast("Não foi possível salvar o lançamento. Tente novamente.", "error");
    }
  };

  const handleDelete = async (id?: number) => {
    if (id == null) return;
    if (await confirm("Tem certeza que deseja excluir este lançamento?", { danger: true, okLabel: "Excluir" })) {
      try {
        await DB.financeiro.remove(id);
        await loadData();
        showToast("Lançamento excluído.", "success");
      } catch {
        showToast("Não foi possível excluir o lançamento.", "error");
      }
    }
  };

  // Filtragem dos lançamentos
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      !search || t.descricao.toLowerCase().includes(search.toLowerCase()) || t.categoria.toLowerCase().includes(search.toLowerCase());
    const matchesTipo = !typeFilter || t.tipo === typeFilter;
    const matchesStatus = !statusFilter || t.status === statusFilter;

    let matchesMonth = true;
    if (monthFilter) {
      const [year, month] = monthFilter.split("-");
      const tDate = new Date(t.data);
      matchesMonth =
        tDate.getFullYear() === parseInt(year) && String(tDate.getMonth() + 1).padStart(2, "0") === month;
    }

    return matchesSearch && matchesTipo && matchesStatus && matchesMonth;
  });

  // Cálculos do resumo baseados no filtro de período (monthFilter)
  const transactionsOfPeriod = transactions.filter((t) => {
    if (!monthFilter) return true;
    const [year, month] = monthFilter.split("-");
    const tDate = new Date(t.data);
    return tDate.getFullYear() === parseInt(year) && String(tDate.getMonth() + 1).padStart(2, "0") === month;
  });

  const totalReceita = transactionsOfPeriod
    .filter((t) => t.tipo === "receita" && t.status === "pago")
    .reduce((sum, item) => sum + item.valor, 0);

  const totalDespesa = transactionsOfPeriod
    .filter((t) => t.tipo === "despesa" && t.status === "pago")
    .reduce((sum, item) => sum + item.valor, 0);

  const saldo = totalReceita - totalDespesa;

  return (
    <>
      <Topbar title="Financeiro">
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo Lançamento
        </button>
      </Topbar>

      <main className="page-content">
        {/* Resumo */}
        <div className="fin-summary">
          <div className="fin-card" style={{ borderColor: "var(--success)", borderLeftWidth: 4, background: "white", padding: "16px 20px", borderRadius: "var(--radius-lg)" }}>
            <div className="fin-card-label" style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Total Recebimentos</div>
            <div className="fin-card-val" style={{ color: "var(--success)", fontSize: 24, fontWeight: 800 }}>
              R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="fin-card" style={{ borderColor: "var(--danger)", borderLeftWidth: 4, background: "white", padding: "16px 20px", borderRadius: "var(--radius-lg)" }}>
            <div className="fin-card-label" style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Total Despesas</div>
            <div className="fin-card-val" style={{ color: "var(--danger)", fontSize: 24, fontWeight: 800 }}>
              R$ {totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="fin-card" style={{ borderColor: "var(--primary)", borderLeftWidth: 4, background: "white", padding: "16px 20px", borderRadius: "var(--radius-lg)" }}>
            <div className="fin-card-label" style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Saldo do período</div>
            <div className="fin-card-val" style={{ color: "var(--primary)", fontSize: 24, fontWeight: 800 }}>
              R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card mb-6">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 180 }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className={`filter-pill ${typeFilter === "" ? "active" : ""}`}
                onClick={() => setTypeFilter("")}
              >
                Todos
              </button>
              <button
                className={`filter-pill ${typeFilter === "receita" ? "active" : ""}`}
                onClick={() => setTypeFilter("receita")}
              >
                Recebimentos
              </button>
              <button
                className={`filter-pill ${typeFilter === "despesa" ? "active" : ""}`}
                onClick={() => setTypeFilter("despesa")}
              >
                Despesas
              </button>
            </div>
            <input
              type="month"
              className="form-control"
              style={{ width: "auto" }}
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
            <select
              className="form-control"
              style={{ width: "auto", fontSize: 13 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos status</option>
              <option value="pago">Pago</option>
              <option value="pendente">A receber / pendente</option>
            </select>
          </div>
        </div>

        {/* Tabela de Lançamentos */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Lançamentos</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filteredTransactions.length} lançamentos encontrados</span>
          </div>
          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}>
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
              title="Nenhum lançamento neste período"
              hint="Registre recebimentos e despesas para acompanhar o fluxo de caixa."
              action={
                <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
                  + Novo lançamento
                </button>
              }
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Forma Pagto.</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t) => (
                    <tr key={t.id}>
                      <td>{new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td>
                        <strong>{t.descricao}</strong>
                      </td>
                      <td>{t.categoria}</td>
                      <td>{(t as any).formaPagto || "PIX"}</td>
                      <td style={{ color: t.tipo === "receita" ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                        {t.tipo === "receita" ? "+" : "-"} R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`badge badge-${t.status === "pago" ? "success" : "warning"}`}>
                          {t.status === "pago" ? "Pago" : "Pendente"}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(t.id)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Novo Lançamento */}
        {isModalOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">Novo Lançamento</span>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                {/* Seleção do Tipo de Lançamento */}
                <div className="type-toggle" style={{ display: "flex", border: "1.5px solid var(--border-solid)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                  <button
                    type="button"
                    className={`type-btn ${tipo === "receita" ? "active-rec" : ""}`}
                    onClick={() => {
                      setTipo("receita");
                      setCategoria("Estética");
                    }}
                    style={{ flex: 1, padding: "10px 0", cursor: "pointer", border: "none" }}
                  >
                    Recebimento
                  </button>
                  <button
                    type="button"
                    className={`type-btn ${tipo === "despesa" ? "active-desp" : ""}`}
                    onClick={() => {
                      setTipo("despesa");
                      setCategoria("Insumos");
                    }}
                    style={{ flex: 1, padding: "10px 0", cursor: "pointer", border: "none" }}
                  >
                    Despesa
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: Lentes de porcelana - Maria"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Valor (R$) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0,00"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    {tipo === "receita" ? (
                      <select className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                        <option value="Estética">Estética</option>
                        <option value="Clínica Geral">Clínica Geral</option>
                        <option value="Ortodontia">Ortodontia</option>
                        <option value="Implantes">Implantes</option>
                        <option value="Endodontia">Endodontia</option>
                      </select>
                    ) : (
                      <select className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                        <option value="Insumos">Insumos e Materiais</option>
                        <option value="Aluguel">Aluguel / Condomínio</option>
                        <option value="Salários">Salários / Comissões</option>
                        <option value="Marketing">Marketing / Divulgação</option>
                        <option value="Outros">Outras Despesas</option>
                      </select>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Forma de Pagamento</label>
                    <select className="form-control" value={formaPagto} onChange={(e) => setFormaPagto(e.target.value)}>
                      <option value="PIX">PIX</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Boleto">Boleto Bancário</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="pago">{tipo === "receita" ? "Recebido" : "Pago"}</option>
                    <option value="pendente">{tipo === "receita" ? "A receber" : "Pendente"}</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
