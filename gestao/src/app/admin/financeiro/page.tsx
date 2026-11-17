"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { TransacaoFinanceira } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { MAX_PARCELAS, MESES_A_FRENTE_SEM_FIM, datasMensais } from "@/lib/recorrencia";

const fmtData = (iso: string) => iso.split("-").reverse().join("/");

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
  const [recorrente, setRecorrente] = useState(false);
  const [recModo, setRecModo] = useState<"meses" | "ate" | "sempre">("meses");
  const [recMeses, setRecMeses] = useState("12");
  const [recAte, setRecAte] = useState(""); // YYYY-MM

  useEffect(() => {
    // Definir mês atual como default do filtro
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonthFilter(currentMonth);

    loadData();
  }, []);

  const loadData = async () => {
    const lista = await DB.financeiro.list();
    // Série sem fim: completa até 12 meses à frente antes de mostrar.
    const criadas = await DB.financeiro.renovarSemFim(lista);
    setTransactions(criadas > 0 ? await DB.financeiro.list() : lista);
  };

  const handleOpenModal = () => {
    setTipo("receita");
    setDescricao("");
    setValor("");
    setCategoria("Estética");
    setData(new Date().toISOString().split("T")[0]);
    setStatus("pago");
    setFormaPagto("PIX");
    setRecorrente(false);
    setRecModo("meses");
    setRecMeses("12");
    setRecAte("");
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

    if (recorrente) {
      if (datasSerie.length < 2) {
        showToast(
          recModo === "meses" ? "Informe 2 meses ou mais para repetir." : "Escolha um mês final depois do primeiro.",
          "error",
        );
        return;
      }
      const serieId = crypto.randomUUID();
      const total = datasSerie.length;
      const semFim = recModo === "sempre";
      // Só a primeira parcela leva o status escolhido; as futuras nascem pendentes
      // (ninguém pagou o salário de março ainda).
      const lista = datasSerie.map((d, i) => ({
        ...novaTransacao,
        data: d,
        status: i === 0 ? status : ("pendente" as const),
        serieId,
        serieParcela: i + 1,
        serieTotal: semFim ? undefined : total,
        serieSemFim: semFim,
      }));
      try {
        await DB.financeiro.addSerie(lista);
        setIsModalOpen(false);
        await loadData();
        showToast(
          semFim
            ? `Recorrência sem fim criada: ${total} meses gerados, renova sozinha.`
            : `${total} lançamentos mensais registrados.`,
          "success",
        );
      } catch {
        showToast("Não foi possível salvar a recorrência. Tente novamente.", "error");
      }
      return;
    }

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
    const doPaciente = transactions.find((x) => x.id === id)?.parcelaId != null;
    const msg = doPaciente
      ? "Este lançamento veio do pagamento de um paciente. Excluir aqui tira só do caixa: na ficha do paciente a parcela continua como paga. Excluir mesmo assim?"
      : "Tem certeza que deseja excluir este lançamento?";
    if (await confirm(msg, { danger: true, okLabel: "Excluir" })) {
      try {
        await DB.financeiro.remove(id);
        await loadData();
        showToast("Lançamento excluído.", "success");
      } catch {
        showToast("Não foi possível excluir o lançamento.", "error");
      }
    }
  };

  const handleCancelarSerie = async (t: TransacaoFinanceira) => {
    if (!t.serieId) return;
    const restantes = transactions.filter(
      (x) => x.serieId === t.serieId && x.data >= t.data && x.status === "pendente",
    ).length;
    if (restantes === 0) {
      showToast("Não há parcelas pendentes desta série a partir desta data.", "error");
      return;
    }
    const ok = await confirm(
      `Cancelar a recorrência "${t.descricao}" a partir de ${fmtData(t.data)}? ` +
        `${restantes} parcela(s) pendente(s) serão excluídas. As já pagas continuam.`,
      { danger: true, okLabel: "Cancelar série" },
    );
    if (!ok) return;
    try {
      const n = await DB.financeiro.cancelarSerie(t.serieId, t.data);
      await loadData();
      showToast(`${n} parcela(s) excluída(s).`, "success");
    } catch {
      showToast("Não foi possível cancelar a série.", "error");
    }
  };

  const datasSerie =
    recorrente && data
      ? datasMensais(
          data,
          recModo === "sempre"
            ? { meses: MESES_A_FRENTE_SEM_FIM }
            : recModo === "meses"
              ? { meses: Math.max(0, parseInt(recMeses) || 0) }
              : { ate: recAte || data.slice(0, 7) },
        )
      : [];

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
                        {t.parcelaId && (
                          <span
                            className="badge"
                            title="Lançado automaticamente ao marcar o pagamento do paciente"
                            style={{ marginLeft: 8, fontSize: 11 }}
                          >
                            Paciente
                          </span>
                        )}
                        {t.serieId && (
                          <span
                            className="badge"
                            title={t.serieSemFim ? "Lançamento recorrente mensal, sem data de fim" : "Lançamento recorrente (mensal)"}
                            style={{ marginLeft: 8, fontSize: 11 }}
                          >
                            {t.serieSemFim ? `Mensal ${t.serieParcela ?? ""} · sem fim` : t.serieTotal ? `Mensal ${t.serieParcela}/${t.serieTotal}` : `Mensal ${t.serieParcela ?? ""}`}
                          </span>
                        )}
                      </td>
                      <td>{t.categoria}</td>
                      {/* Sem forma registrada era exibido como "PIX" — a tela afirmava
                          uma forma de pagamento que ninguém informou. */}
                      <td>
                        {(t as any).formaPagto || (
                          <span style={{ color: "var(--text-muted)" }}>Não informada</span>
                        )}
                      </td>
                      <td style={{ color: t.tipo === "receita" ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                        {t.tipo === "receita" ? "+" : "-"} R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`badge badge-${t.status === "pago" ? "success" : "warning"}`}>
                          {t.status === "pago" ? "Pago" : "Pendente"}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(t.id)}>
                          Remover
                        </button>
                        {t.serieId && (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ marginLeft: 6 }}
                            title="Exclui esta e as próximas parcelas pendentes"
                            onClick={() => handleCancelarSerie(t)}
                          >
                            Cancelar série
                          </button>
                        )}
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
                    <label className="form-label">{recorrente ? "1º vencimento *" : "Data *"}</label>
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
                        <option value="Atendimentos">Atendimentos (geral)</option>
                        <option value="Sublocação">Sublocação de sala</option>
                        <option value="Repasse de profissionais">Repasse de profissionais (%)</option>
                      </select>
                    ) : (
                      <select className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                        <option value="Insumos">Insumos e Materiais</option>
                        <option value="Aluguel">Aluguel / Condomínio</option>
                        <option value="Salários">Salários / Comissões</option>
                        <option value="Marketing">Marketing / Divulgação</option>
                        <option value="Impostos e Taxas">Impostos e Taxas</option>
                        <option value="Contas (luz, telefone, internet)">Contas (luz, telefone, internet)</option>
                        <option value="Contabilidade">Contabilidade</option>
                        <option value="Serviços e Manutenção">Serviços e Manutenção</option>
                        <option value="Segurança">Segurança</option>
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
                      <option value="InfinitePay">InfinitePay</option>
                      <option value="Descontado">Descontado</option>
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

                {/* Recorrência */}
                <div className="form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                    <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
                    <strong>Repetir todo mês</strong>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>(salário, aluguel, mensalidades…)</span>
                  </label>
                </div>
                {recorrente && (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      marginTop: -6,
                      marginBottom: 12,
                    }}
                  >
                    <div className="form-row form-row-2">
                      <div className="form-group">
                        <label className="form-label">Até quando</label>
                        <select
                          className="form-control"
                          value={recModo}
                          onChange={(e) => setRecModo(e.target.value as "meses" | "ate" | "sempre")}
                        >
                          <option value="meses">Por um número de meses</option>
                          <option value="ate">Até um mês específico</option>
                          <option value="sempre">Sem data de fim</option>
                        </select>
                      </div>
                      <div className="form-group">
                        {recModo === "sempre" ? null : recModo === "meses" ? (
                          <>
                            <label className="form-label">Quantos meses</label>
                            <input
                              type="number"
                              min={2}
                              max={MAX_PARCELAS}
                              className="form-control"
                              value={recMeses}
                              onChange={(e) => setRecMeses(e.target.value)}
                            />
                          </>
                        ) : (
                          <>
                            <label className="form-label">Último mês</label>
                            <input
                              type="month"
                              className="form-control"
                              value={recAte}
                              min={data ? data.slice(0, 7) : undefined}
                              onChange={(e) => setRecAte(e.target.value)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {!data ? (
                        "Escolha a data do primeiro vencimento acima."
                      ) : recModo === "sempre" ? (
                        <>
                          Vence todo <strong>dia {Number(data.slice(8, 10))}</strong>
                          {Number(data.slice(8, 10)) > 28 && " (ou no último dia, em mês mais curto)"}. Gera agora os{" "}
                          <strong>próximos {MESES_A_FRENTE_SEM_FIM} meses</strong> e vai renovando sozinho: sempre que o
                          Financeiro abre, completa até {MESES_A_FRENTE_SEM_FIM} meses à frente. Para parar, use
                          &quot;Cancelar série&quot; na lista.
                        </>
                      ) : datasSerie.length < 2 ? (
                        "A recorrência precisa de pelo menos 2 meses."
                      ) : (
                        <>
                          Vence todo <strong>dia {Number(data.slice(8, 10))}</strong>
                          {Number(data.slice(8, 10)) > 28 && " (ou no último dia, em mês mais curto)"}. Vai gerar{" "}
                          <strong>{datasSerie.length} lançamentos</strong>, de {fmtData(datasSerie[0])} a{" "}
                          {fmtData(datasSerie[datasSerie.length - 1])}
                          {datasSerie.length === MAX_PARCELAS && ` (máximo de ${MAX_PARCELAS})`}. Só o primeiro fica
                          como &quot;{status === "pago" ? (tipo === "receita" ? "Recebido" : "Pago") : "Pendente"}&quot;;
                          os próximos entram como pendentes. Dá pra cancelar a série depois, pela lista.
                        </>
                      )}
                    </div>
                  </div>
                )}
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
