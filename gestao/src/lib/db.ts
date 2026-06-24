import { createClient, isSupabaseConfigured } from "./supabase/client";
import {
  Paciente,
  Procedimento,
  Anamnese,
  TransacaoFinanceira,
  Agendamento,
  ItemEstoque,
  ProcedimentoCatalogo,
  Orcamento,
  OrcamentoItem,
  ContaReceber,
  Parcela,
  Clinica,
  Usuario,
  Evolucao,
  Anexo,
  Documento,
  Profissional,
} from "./types";

// ============================================================
// Fachada de dados — agora backada pelo Supabase (Postgres + RLS).
// Mantém a MESMA forma da API antiga (DB.pacientes.list/get/save/remove,
// DB.financeiro.add/update, etc.), porém TODOS os métodos são async.
// A segurança é garantida por RLS no banco, não por este cliente.
// ============================================================

const sb = () => createClient();

// "" não é uma data válida no Postgres — normaliza para null.
const orNull = (v: unknown) => (v === "" || v === undefined ? null : v);

// ─── Mappers (snake_case no banco ↔ camelCase no app) ─────
const fromPaciente = (r: any): Paciente => ({
  id: r.id,
  nome: r.nome,
  nascimento: r.nascimento ?? "",
  cpf: r.cpf ?? "",
  tel: r.tel ?? "",
  plano: r.plano ?? "Particular",
  status: r.status,
  sexo: r.sexo ?? "",
  estadoCivil: r.estado_civil ?? "",
  rg: r.rg ?? "",
  orgaoEmissor: r.orgao_emissor ?? "",
  email: r.email ?? "",
  contatoEmergencia: r.contato_emergencia ?? "",
  telEmergencia: r.tel_emergencia ?? "",
  cep: r.cep ?? "",
  endereco: r.endereco ?? "",
  numero: r.numero ?? "",
  complemento: r.complemento ?? "",
  bairro: r.bairro ?? "",
  cidade: r.cidade ?? "",
  uf: r.uf ?? "",
  proximaRevisao: r.proxima_revisao ?? "",
  criadoEm: r.created_at,
});
const toPaciente = (p: Paciente) => ({
  nome: p.nome,
  nascimento: orNull(p.nascimento),
  cpf: p.cpf,
  tel: p.tel,
  plano: p.plano,
  status: p.status,
  sexo: orNull(p.sexo),
  estado_civil: orNull(p.estadoCivil),
  rg: orNull(p.rg),
  orgao_emissor: orNull(p.orgaoEmissor),
  email: orNull(p.email),
  contato_emergencia: orNull(p.contatoEmergencia),
  tel_emergencia: orNull(p.telEmergencia),
  cep: orNull(p.cep),
  endereco: orNull(p.endereco),
  numero: orNull(p.numero),
  complemento: orNull(p.complemento),
  bairro: orNull(p.bairro),
  cidade: orNull(p.cidade),
  uf: orNull(p.uf),
  proxima_revisao: orNull(p.proximaRevisao),
});

const fromProcedimento = (r: any): Procedimento => ({
  id: r.id,
  pacienteId: r.paciente_id,
  dente: r.dente,
  procedimento: r.procedimento,
  custo: Number(r.custo),
  status: r.status,
  profissionalId: r.profissional_id ?? undefined,
  obs: r.obs ?? "",
  criadoEm: r.created_at,
});
const toProcedimento = (p: Procedimento) => ({
  paciente_id: p.pacienteId,
  dente: String(p.dente),
  procedimento: p.procedimento,
  custo: p.custo,
  status: p.status,
  profissional_id: p.profissionalId ?? null,
  obs: orNull(p.obs),
});

const fromAnamnese = (r: any): Anamnese => ({
  id: r.id,
  pacienteId: r.paciente_id,
  pacienteNome: r.paciente_nome ?? "",
  respostas: r.respostas ?? {},
  assinatura: r.assinatura ?? "",
  data: r.data ?? "",
  status: r.status ?? "Assinado",
  criadoEm: r.created_at,
});
const toAnamnese = (a: Anamnese) => ({
  paciente_id: orNull(a.pacienteId),
  paciente_nome: orNull(a.pacienteNome),
  respostas: a.respostas ?? {},
  assinatura: orNull(a.assinatura),
  data: orNull(a.data),
  status: a.status ?? "Assinado",
});

const fromFinanceiro = (r: any): TransacaoFinanceira => ({
  id: r.id,
  tipo: r.tipo,
  descricao: r.descricao,
  valor: Number(r.valor),
  categoria: r.categoria ?? "",
  data: r.data,
  status: r.status,
  formaPagto: r.forma_pagamento ?? "",
  criadoEm: r.created_at,
});
const toFinanceiro = (t: TransacaoFinanceira) => ({
  tipo: t.tipo,
  descricao: t.descricao,
  valor: t.valor,
  categoria: t.categoria,
  data: orNull(t.data),
  status: t.status,
  forma_pagamento: orNull(t.formaPagto),
});

const fromAgendamento = (r: any): Agendamento => ({
  id: r.id,
  paciente: r.paciente,
  pacienteId: r.paciente_id ?? undefined,
  proc: r.proc ?? "",
  dia: r.dia,
  hora: r.hora,
  min: r.min,
  dur: r.dur,
  status: r.status,
  profissionalId: r.profissional_id ?? undefined,
  presenca: r.presenca ?? "agendado",
  obs: r.obs ?? "",
  criadoEm: r.created_at,
});
const toAgendamento = (a: Agendamento) => ({
  paciente: a.paciente,
  paciente_id: a.pacienteId ?? null,
  proc: a.proc,
  dia: a.dia,
  hora: a.hora,
  min: a.min,
  dur: a.dur,
  status: a.status,
  profissional_id: a.profissionalId ?? null,
  presenca: a.presenca ?? "agendado",
  obs: orNull(a.obs),
});

const fromProfissional = (r: any): Profissional => ({
  id: r.id,
  nome: r.nome,
  especialidade: r.especialidade ?? "",
  cro: r.cro ?? "",
  cor: r.cor ?? "#0f766e",
  ativo: r.ativo,
  comissaoPercentual: r.comissao_percentual != null ? Number(r.comissao_percentual) : 0,
  criadoEm: r.created_at,
});
const toProfissional = (p: Profissional) => ({
  nome: p.nome,
  especialidade: orNull(p.especialidade),
  cro: orNull(p.cro),
  cor: p.cor,
  ativo: p.ativo ?? true,
  comissao_percentual: p.comissaoPercentual ?? 0,
});

const fromEstoque = (r: any): ItemEstoque => ({
  id: r.id,
  nome: r.nome,
  quantidade: r.quantidade,
  minimo: r.minimo,
  categoria: r.categoria ?? "",
  fornecedor: r.fornecedor ?? "",
  unidade: r.unidade ?? "",
  obs: r.obs ?? "",
  criadoEm: r.created_at,
});
const toEstoque = (i: ItemEstoque) => ({
  nome: i.nome,
  quantidade: i.quantidade,
  minimo: i.minimo,
  categoria: i.categoria,
  fornecedor: i.fornecedor,
  unidade: orNull(i.unidade),
  obs: orNull(i.obs),
});

const fromCatalogo = (r: any): ProcedimentoCatalogo => ({
  id: r.id,
  nome: r.nome,
  categoria: r.categoria ?? "",
  preco: Number(r.preco),
  duracaoMin: r.duracao_min ?? undefined,
  ativo: r.ativo,
  criadoEm: r.created_at,
});
const toCatalogo = (c: ProcedimentoCatalogo) => ({
  nome: c.nome,
  categoria: orNull(c.categoria),
  preco: c.preco,
  duracao_min: c.duracaoMin ?? null,
  ativo: c.ativo ?? true,
});

const fromOrcamento = (r: any): Orcamento => ({
  id: r.id,
  pacienteId: r.paciente_id,
  status: r.status,
  desconto: Number(r.desconto),
  total: Number(r.total),
  observacoes: r.observacoes ?? "",
  aprovadoEm: r.aprovado_em ?? undefined,
  criadoEm: r.created_at,
});
const toOrcamento = (o: Orcamento) => ({
  paciente_id: o.pacienteId,
  status: o.status,
  desconto: o.desconto,
  total: o.total,
  observacoes: orNull(o.observacoes),
});

const fromOrcItem = (r: any): OrcamentoItem => ({
  id: r.id,
  orcamentoId: r.orcamento_id,
  catalogoId: r.catalogo_id ?? undefined,
  descricao: r.descricao,
  dente: r.dente ?? "",
  quantidade: r.quantidade,
  valorUnitario: Number(r.valor_unitario),
});
const toOrcItem = (orcamentoId: number, it: OrcamentoItem) => ({
  orcamento_id: orcamentoId,
  catalogo_id: it.catalogoId ?? null,
  descricao: it.descricao,
  dente: orNull(it.dente),
  quantidade: it.quantidade,
  valor_unitario: it.valorUnitario,
});

const fromParcela = (r: any): Parcela => ({
  id: r.id,
  contaId: r.conta_id,
  numero: r.numero,
  valor: Number(r.valor),
  vencimento: r.vencimento ?? "",
  pago: r.pago,
  pagoEm: r.pago_em ?? undefined,
  formaPagamento: r.forma_pagamento ?? "",
});
const fromConta = (r: any): ContaReceber => ({
  id: r.id,
  pacienteId: r.paciente_id,
  orcamentoId: r.orcamento_id ?? undefined,
  descricao: r.descricao,
  valorTotal: Number(r.valor_total),
  status: r.status,
  criadoEm: r.created_at,
});

const fromDocumento = (r: any): Documento => ({
  id: r.id,
  pacienteId: r.paciente_id,
  tipo: r.tipo ?? "outro",
  titulo: r.titulo,
  conteudo: r.conteudo,
  assinatura: r.assinatura ?? "",
  autor: r.autor ?? "",
  criadoEm: r.created_at,
});
const toDocumento = (d: Documento) => ({
  paciente_id: d.pacienteId,
  tipo: d.tipo,
  titulo: d.titulo,
  conteudo: d.conteudo,
  assinatura: orNull(d.assinatura),
  autor: orNull(d.autor),
});

// ─── CRUD genérico ────────────────────────────────────────
// Aviso único quando o backend ainda não está configurado.
let _avisou = false;
function semBackend(): boolean {
  if (isSupabaseConfigured()) return false;
  if (!_avisou) {
    console.warn("[DB] Supabase não configurado — rodando sem backend. Veja supabase/SETUP.md.");
    _avisou = true;
  }
  return true;
}

async function listTable<T>(
  table: string,
  fromRow: (r: any) => T,
  filter?: { col: string; val: unknown },
): Promise<T[]> {
  if (semBackend()) return [];
  let query = sb().from(table).select("*");
  if (filter) query = query.eq(filter.col, filter.val);
  const { data, error } = await query.order("id", { ascending: true });
  if (error) {
    console.error(`[DB] listar ${table}:`, error.message);
    return [];
  }
  return (data ?? []).map(fromRow);
}

async function getTable<T>(
  table: string,
  fromRow: (r: any) => T,
  id: number | string,
): Promise<T | null> {
  if (semBackend()) return null;
  const { data, error } = await sb()
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error(`[DB] obter ${table}#${id}:`, error.message);
    return null;
  }
  return data ? fromRow(data) : null;
}

async function saveTable<T extends { id?: number }>(
  table: string,
  toRow: (x: T) => Record<string, unknown>,
  fromRow: (r: any) => T,
  item: T,
): Promise<T> {
  if (semBackend()) {
    throw new Error("Supabase não configurado — não é possível salvar. Veja supabase/SETUP.md.");
  }
  const row = toRow(item);
  // Tem id real → update; senão → insert (o Postgres gera o id).
  const builder = item.id
    ? sb().from(table).update(row).eq("id", item.id)
    : sb().from(table).insert(row);
  const { data, error } = await builder.select().single();
  if (error) {
    console.error(`[DB] salvar ${table}:`, error.message);
    throw error;
  }
  return fromRow(data);
}

async function removeTable(table: string, id: number | string): Promise<void> {
  if (semBackend()) return;
  const { error } = await sb().from(table).delete().eq("id", id);
  if (error) {
    console.error(`[DB] remover ${table}#${id}:`, error.message);
    throw error;
  }
}

// ─── API pública (mesma forma de antes, agora async) ──────
export const DB = {
  pacientes: {
    list: () => listTable<Paciente>("pacientes", fromPaciente),
    get: (id: number | string) => getTable<Paciente>("pacientes", fromPaciente, id),
    save: (p: Paciente) => saveTable<Paciente>("pacientes", toPaciente, fromPaciente, p),
    remove: (id: number | string) => removeTable("pacientes", id),
    // Importação em lote (clinica_id é carimbado pelo default do banco).
    async importar(lista: Paciente[]): Promise<number> {
      if (semBackend()) throw new Error("Supabase não configurado.");
      if (!lista.length) return 0;
      const rows = lista.map(toPaciente);
      const { data, error } = await sb().from("pacientes").insert(rows).select("id");
      if (error) throw error;
      return (data ?? []).length;
    },
  },

  procedimentos: {
    list: (pacienteId?: number | string) =>
      listTable<Procedimento>(
        "procedimentos",
        fromProcedimento,
        pacienteId != null ? { col: "paciente_id", val: pacienteId } : undefined,
      ),
    get: (id: number | string) => getTable<Procedimento>("procedimentos", fromProcedimento, id),
    save: (p: Procedimento) =>
      saveTable<Procedimento>("procedimentos", toProcedimento, fromProcedimento, p),
    remove: (id: number | string) => removeTable("procedimentos", id),
  },

  anamneses: {
    list: (pacienteId?: number | string) =>
      listTable<Anamnese>(
        "anamneses",
        fromAnamnese,
        pacienteId != null ? { col: "paciente_id", val: pacienteId } : undefined,
      ),
    save: (a: Anamnese) => saveTable<Anamnese>("anamneses", toAnamnese, fromAnamnese, a),
    remove: (id: number | string) => removeTable("anamneses", id),
  },

  financeiro: {
    list: () => listTable<TransacaoFinanceira>("transacoes_financeiras", fromFinanceiro),
    get: (id: number | string) =>
      getTable<TransacaoFinanceira>("transacoes_financeiras", fromFinanceiro, id),
    add: (t: TransacaoFinanceira) =>
      saveTable<TransacaoFinanceira>("transacoes_financeiras", toFinanceiro, fromFinanceiro, t),
    update: (t: TransacaoFinanceira) =>
      saveTable<TransacaoFinanceira>("transacoes_financeiras", toFinanceiro, fromFinanceiro, t),
    remove: (id: number | string) => removeTable("transacoes_financeiras", id),
  },

  agendamentos: {
    list: () => listTable<Agendamento>("agendamentos", fromAgendamento),
    get: (id: number | string) => getTable<Agendamento>("agendamentos", fromAgendamento, id),
    save: (a: Agendamento) =>
      saveTable<Agendamento>("agendamentos", toAgendamento, fromAgendamento, a),
    remove: (id: number | string) => removeTable("agendamentos", id),
  },

  estoque: {
    list: () => listTable<ItemEstoque>("itens_estoque", fromEstoque),
    get: (id: number | string) => getTable<ItemEstoque>("itens_estoque", fromEstoque, id),
    save: (i: ItemEstoque) => saveTable<ItemEstoque>("itens_estoque", toEstoque, fromEstoque, i),
    remove: (id: number | string) => removeTable("itens_estoque", id),
  },

  catalogo: {
    list: (apenasAtivos = false): Promise<ProcedimentoCatalogo[]> =>
      apenasAtivos
        ? listTable<ProcedimentoCatalogo>("procedimentos_catalogo", fromCatalogo, { col: "ativo", val: true })
        : listTable<ProcedimentoCatalogo>("procedimentos_catalogo", fromCatalogo),
    save: (c: ProcedimentoCatalogo) =>
      saveTable<ProcedimentoCatalogo>("procedimentos_catalogo", toCatalogo, fromCatalogo, c),
    remove: (id: number | string) => removeTable("procedimentos_catalogo", id),
  },

  orcamentos: {
    list(pacienteId?: number | string): Promise<Orcamento[]> {
      return listTable<Orcamento>(
        "orcamentos",
        fromOrcamento,
        pacienteId != null ? { col: "paciente_id", val: pacienteId } : undefined,
      );
    },
    async get(id: number | string): Promise<Orcamento | null> {
      if (semBackend()) return null;
      const orc = await getTable<Orcamento>("orcamentos", fromOrcamento, id);
      if (!orc) return null;
      const { data } = await sb().from("orcamento_itens").select("*").eq("orcamento_id", id).order("id");
      orc.itens = (data ?? []).map(fromOrcItem);
      return orc;
    },
    // Salva cabeçalho + substitui os itens.
    async salvar(orc: Orcamento): Promise<Orcamento | null> {
      if (semBackend()) {
        throw new Error("Supabase não configurado — não é possível salvar.");
      }
      const header = await saveTable<Orcamento>("orcamentos", toOrcamento, fromOrcamento, {
        id: orc.id,
        pacienteId: orc.pacienteId,
        status: orc.status,
        desconto: orc.desconto,
        total: orc.total,
        observacoes: orc.observacoes,
      } as Orcamento);
      await sb().from("orcamento_itens").delete().eq("orcamento_id", header.id!);
      if (orc.itens && orc.itens.length) {
        const rows = orc.itens.map((it) => toOrcItem(header.id!, it));
        const { error } = await sb().from("orcamento_itens").insert(rows);
        if (error) throw error;
      }
      return this.get(header.id!);
    },
    // Aprova e gera procedimentos (Pendente) no prontuário do paciente.
    async aprovar(id: number | string): Promise<Orcamento | null> {
      if (semBackend()) throw new Error("Supabase não configurado.");
      const { error } = await sb()
        .from("orcamentos")
        .update({ status: "aprovado", aprovado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      const orc = await this.get(id);
      if (orc && orc.itens && orc.itens.length) {
        const procs = orc.itens.map((it) => ({
          paciente_id: orc.pacienteId,
          dente: it.dente || "",
          procedimento: it.descricao,
          custo: it.valorUnitario * (it.quantidade || 1),
          status: "Pendente",
        }));
        await sb().from("procedimentos").insert(procs);
      }
      return orc;
    },
    async setStatus(id: number | string, status: Orcamento["status"]): Promise<void> {
      if (semBackend()) return;
      await sb().from("orcamentos").update({ status }).eq("id", id);
    },
    remove: (id: number | string) => removeTable("orcamentos", id),
  },

  contas: {
    // Lista contas a receber (com parcelas), opcionalmente por paciente.
    async list(pacienteId?: number | string): Promise<ContaReceber[]> {
      if (semBackend()) return [];
      let q = sb().from("contas_receber").select("*");
      if (pacienteId != null) q = q.eq("paciente_id", pacienteId);
      const { data: contas, error } = await q.order("id", { ascending: false });
      if (error) {
        console.error("[DB] listar contas:", error.message);
        return [];
      }
      const lista = (contas ?? []).map(fromConta);
      if (lista.length === 0) return lista;
      const ids = lista.map((c) => c.id);
      const { data: parc } = await sb().from("parcelas").select("*").in("conta_id", ids).order("numero");
      const porConta: Record<number, Parcela[]> = {};
      (parc ?? []).forEach((p) => {
        const m = fromParcela(p);
        (porConta[m.contaId!] ??= []).push(m);
      });
      lista.forEach((c) => (c.parcelas = porConta[c.id!] ?? []));
      return lista;
    },

    // Cria uma conta + suas parcelas.
    async criar(conta: ContaReceber, parcelas: Parcela[]): Promise<ContaReceber | null> {
      if (semBackend()) throw new Error("Supabase não configurado.");
      const { data, error } = await sb()
        .from("contas_receber")
        .insert({
          paciente_id: conta.pacienteId,
          orcamento_id: conta.orcamentoId ?? null,
          descricao: conta.descricao,
          valor_total: conta.valorTotal,
          status: conta.status ?? "aberta",
        })
        .select()
        .single();
      if (error) throw error;
      const contaId = data.id as number;
      if (parcelas.length) {
        const rows = parcelas.map((p) => ({
          conta_id: contaId,
          numero: p.numero,
          valor: p.valor,
          vencimento: orNull(p.vencimento),
          pago: p.pago ?? false,
          forma_pagamento: orNull(p.formaPagamento),
        }));
        const { error: e2 } = await sb().from("parcelas").insert(rows);
        if (e2) throw e2;
      }
      return fromConta(data);
    },

    // Gera cobrança a partir de um orçamento aprovado (divide o total em N parcelas).
    async gerarDoOrcamento(
      orcamentoId: number,
      numParcelas: number,
      primeiroVencimento: string,
    ): Promise<ContaReceber | null> {
      if (semBackend()) throw new Error("Supabase não configurado.");
      const orc = await DB.orcamentos.get(orcamentoId);
      if (!orc) throw new Error("Orçamento não encontrado.");
      const n = Math.max(1, numParcelas);
      const base = Math.floor((orc.total / n) * 100) / 100;
      const parcelas: Parcela[] = [];
      let acumulado = 0;
      for (let i = 1; i <= n; i++) {
        const valor = i === n ? Math.round((orc.total - acumulado) * 100) / 100 : base;
        acumulado += valor;
        const venc = new Date(primeiroVencimento + "T00:00:00");
        venc.setMonth(venc.getMonth() + (i - 1));
        parcelas.push({ numero: i, valor, vencimento: venc.toISOString().split("T")[0], pago: false });
      }
      return this.criar(
        {
          pacienteId: orc.pacienteId,
          orcamentoId: orc.id,
          descricao: `Tratamento (orçamento #${orc.id})`,
          valorTotal: orc.total,
          status: "aberta",
        },
        parcelas,
      );
    },

    // Marca uma parcela como paga; quita a conta se todas estiverem pagas.
    async marcarParcela(parcelaId: number, contaId: number, formaPagamento?: string): Promise<void> {
      if (semBackend()) return;
      await sb()
        .from("parcelas")
        .update({ pago: true, pago_em: new Date().toISOString().split("T")[0], forma_pagamento: orNull(formaPagamento) })
        .eq("id", parcelaId);
      const { data: pendentes } = await sb().from("parcelas").select("id").eq("conta_id", contaId).eq("pago", false);
      if ((pendentes ?? []).length === 0) {
        await sb().from("contas_receber").update({ status: "quitada" }).eq("id", contaId);
      }
    },

    async cancelar(contaId: number): Promise<void> {
      if (semBackend()) return;
      await sb().from("contas_receber").update({ status: "cancelada" }).eq("id", contaId);
    },

    remove: (id: number | string) => removeTable("contas_receber", id),
  },

  clinica: {
    // Retorna a clínica do usuário logado (RLS filtra pra clinica_atual()).
    async get(): Promise<Clinica | null> {
      if (semBackend()) return null;
      const { data, error } = await sb().from("clinicas").select("*").limit(1).maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id, nome: data.nome, cnpj: data.cnpj ?? "", telefone: data.telefone ?? "",
        email: data.email ?? "", cep: data.cep ?? "", endereco: data.endereco ?? "",
        numero: data.numero ?? "", bairro: data.bairro ?? "", cidade: data.cidade ?? "",
        uf: data.uf ?? "", logoUrl: data.logo_url ?? "",
      };
    },
    async update(c: Clinica): Promise<void> {
      if (semBackend() || !c.id) return;
      const { error } = await sb().from("clinicas").update({
        nome: c.nome, cnpj: orNull(c.cnpj), telefone: orNull(c.telefone), email: orNull(c.email),
        cep: orNull(c.cep), endereco: orNull(c.endereco), numero: orNull(c.numero),
        bairro: orNull(c.bairro), cidade: orNull(c.cidade), uf: orNull(c.uf), logo_url: orNull(c.logoUrl),
      }).eq("id", c.id);
      if (error) throw error;
    },
  },

  evolucoes: {
    list: (pacienteId: number | string) =>
      listTable<Evolucao>(
        "evolucoes",
        (r: any) => ({ id: r.id, pacienteId: r.paciente_id, texto: r.texto, autor: r.autor ?? "", criadoEm: r.created_at }),
        { col: "paciente_id", val: pacienteId },
      ),
    save: (e: Evolucao) =>
      saveTable<Evolucao>(
        "evolucoes",
        (x) => ({ paciente_id: x.pacienteId, texto: x.texto, autor: orNull(x.autor) }),
        (r: any) => ({ id: r.id, pacienteId: r.paciente_id, texto: r.texto, autor: r.autor ?? "", criadoEm: r.created_at }),
        e,
      ),
    remove: (id: number | string) => removeTable("evolucoes", id),
  },

  anexos: {
    list: (pacienteId: number | string) =>
      listTable<Anexo>(
        "anexos",
        (r: any) => ({
          id: r.id,
          pacienteId: r.paciente_id,
          nome: r.nome,
          path: r.path,
          tipo: r.tipo ?? "",
          tamanho: r.tamanho != null ? Number(r.tamanho) : undefined,
          categoria: r.categoria ?? "outro",
          autor: r.autor ?? "",
          criadoEm: r.created_at,
        }),
        { col: "paciente_id", val: pacienteId },
      ),

    // Sobe o arquivo pro Storage (RLS por clínica) e grava os metadados.
    // O caminho começa por `clinicaId` para casar com a policy de storage.
    async upload(
      pacienteId: number,
      clinicaId: number,
      file: File,
      categoria: Anexo["categoria"],
      autor?: string,
    ): Promise<Anexo> {
      if (semBackend()) throw new Error("Supabase não configurado — não é possível anexar.");
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${clinicaId}/${pacienteId}/${Date.now()}-${safe}`;
      const { error: upErr } = await sb()
        .storage.from("anexos")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        console.error("[DB] upload anexo:", upErr.message);
        throw upErr;
      }
      try {
        return await saveTable<Anexo>(
          "anexos",
          (x) => ({
            paciente_id: x.pacienteId,
            nome: x.nome,
            path: x.path,
            tipo: orNull(x.tipo),
            tamanho: x.tamanho ?? null,
            categoria: x.categoria,
            autor: orNull(x.autor),
          }),
          (r: any) => ({
            id: r.id,
            pacienteId: r.paciente_id,
            nome: r.nome,
            path: r.path,
            tipo: r.tipo ?? "",
            tamanho: r.tamanho != null ? Number(r.tamanho) : undefined,
            categoria: r.categoria ?? "outro",
            autor: r.autor ?? "",
            criadoEm: r.created_at,
          }),
          { pacienteId, nome: file.name, path, tipo: file.type, tamanho: file.size, categoria, autor } as Anexo,
        );
      } catch (e) {
        // Falhou ao gravar metadados → não deixa arquivo órfão no Storage.
        await sb().storage.from("anexos").remove([path]);
        throw e;
      }
    },

    // URL temporária assinada (bucket é privado).
    async signedUrl(path: string, segundos = 3600): Promise<string | null> {
      if (semBackend()) return null;
      const { data, error } = await sb().storage.from("anexos").createSignedUrl(path, segundos);
      if (error) {
        console.error("[DB] signedUrl anexo:", error.message);
        return null;
      }
      return data.signedUrl;
    },

    // Remove o arquivo do Storage e a linha de metadados.
    async remove(id: number, path: string): Promise<void> {
      if (semBackend()) return;
      const { error } = await sb().storage.from("anexos").remove([path]);
      if (error) console.error("[DB] remover arquivo anexo:", error.message);
      await removeTable("anexos", id);
    },
  },

  profissionais: {
    list: (apenasAtivos = false): Promise<Profissional[]> =>
      apenasAtivos
        ? listTable<Profissional>("profissionais", fromProfissional, { col: "ativo", val: true })
        : listTable<Profissional>("profissionais", fromProfissional),
    save: (p: Profissional) => saveTable<Profissional>("profissionais", toProfissional, fromProfissional, p),
    remove: (id: number | string) => removeTable("profissionais", id),
  },

  documentos: {
    list: (pacienteId: number | string) =>
      listTable<Documento>("documentos", fromDocumento, { col: "paciente_id", val: pacienteId }),
    get: (id: number | string) => getTable<Documento>("documentos", fromDocumento, id),
    save: (d: Documento) => saveTable<Documento>("documentos", toDocumento, fromDocumento, d),
    remove: (id: number | string) => removeTable("documentos", id),
  },

  usuarios: {
    // Lista perfis da clínica (admin vê todos via RLS).
    async list(): Promise<Usuario[]> {
      if (semBackend()) return [];
      const { data, error } = await sb().from("profiles").select("id, nome, papel").order("nome");
      if (error) return [];
      return (data ?? []).map((r) => ({ id: r.id, nome: r.nome ?? "", papel: r.papel }));
    },
  },

  async exportar(): Promise<string> {
    const [pacientes, procedimentos, anamneses, financeiro, agendamentos, estoque] =
      await Promise.all([
        DB.pacientes.list(),
        DB.procedimentos.list(),
        DB.anamneses.list(),
        DB.financeiro.list(),
        DB.agendamentos.list(),
        DB.estoque.list(),
      ]);
    return JSON.stringify(
      {
        _exportadoEm: new Date().toISOString(),
        pacientes,
        procedimentos,
        anamneses,
        financeiro,
        agendamentos,
        estoque,
      },
      null,
      2,
    );
  },
};
