export interface Paciente {
  id?: number;
  nome: string;
  nascimento?: string;
  cpf: string;
  tel: string;
  plano: string;
  status: 'Ativo' | 'Inativo';
  sexo?: string;
  estadoCivil?: string;
  rg?: string;
  orgaoEmissor?: string;
  email?: string;
  contatoEmergencia?: string;
  telEmergencia?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  proximaRevisao?: string; // data ISO (yyyy-mm-dd) da próxima revisão/recall
  criadoEm?: string;
}

export interface Procedimento {
  id?: number;
  pacienteId: number;
  dente: string | number;
  procedimento: string;
  custo: number;
  status: 'Pendente' | 'Concluído' | 'Cancelado';
  profissionalId?: number; // a quem a produção é atribuída (base da comissão)
  obs?: string;
  criadoEm?: string;
}

export interface Anamnese {
  id?: number;
  pacienteId: number;
  respostas: Record<string, any>;
  // Campos extras persistidos junto da anamnese
  pacienteNome?: string;
  assinatura?: string; // data-URL PNG da assinatura
  data?: string;
  status?: string;
  criadoEm?: string;
}

export interface TransacaoFinanceira {
  id?: number;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  status: 'pago' | 'pendente';
  formaPagto?: string;
  criadoEm?: string;
}

export interface Agendamento {
  id?: number;
  paciente: string;
  pacienteId?: number;
  proc: string;
  data: string; // data absoluta 'yyyy-mm-dd'
  hora: number; // hora (ex: 8, 9, 10...)
  min: number;  // minutos (ex: 0, 30)
  dur: number;  // duração em minutos (ex: 30, 45, 60...)
  status: 'confirmado' | 'pendente' | 'bloqueado';
  profissionalId?: number;
  marcadorId?: number;
  presenca?: 'agendado' | 'compareceu' | 'faltou';
  // Funil de recuperação (faltas/desmarcações): undefined=pendente.
  recuperacao?: 'contatado' | 'remarcado' | 'recuperado';
  cancelado?: boolean; // desmarcada pelo paciente (fora da grade, vai p/ kanban)
  obs?: string;
  criadoEm?: string;
}

export interface Marcador {
  id?: number;
  nome: string;
  cor: string;
  ativo?: boolean;
  criadoEm?: string;
}

export interface ModeloDoc {
  id?: number;
  nome: string;
  tipo: string; // categoria do documento (receituario|atestado|declaracao|termo|outro)
  titulo: string;
  conteudo: string;
  ativo?: boolean;
  criadoEm?: string;
}

export interface Medicamento {
  id?: number;
  nome: string;
  posologia: string;
  ativo?: boolean;
  criadoEm?: string;
}

export type TipoPergunta = "texto" | "sim_nao" | "numero";
export interface PerguntaModelo {
  texto: string;
  tipo: TipoPergunta;
}
export interface SecaoModelo {
  nome: string;
  perguntas: PerguntaModelo[];
}
export interface ModeloAnamnese {
  id?: number;
  nome: string;
  estrutura: SecaoModelo[];
  ativo?: boolean;
  criadoEm?: string;
}

export interface Profissional {
  id?: number;
  nome: string;
  especialidade?: string;
  cro?: string;
  cor: string;
  ativo: boolean;
  comissaoPercentual?: number; // % de comissão padrão (ex.: 40 = 40%)
  criadoEm?: string;
}

export interface ProcedimentoCatalogo {
  id?: number;
  nome: string;
  categoria?: string;
  preco: number;
  duracaoMin?: number;
  ativo?: boolean;
  criadoEm?: string;
}

export interface OrcamentoItem {
  id?: number;
  orcamentoId?: number;
  catalogoId?: number;
  descricao: string;
  dente?: string;
  quantidade: number;
  valorUnitario: number;
}

export interface Orcamento {
  id?: number;
  pacienteId: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  desconto: number;
  total: number;
  observacoes?: string;
  aprovadoEm?: string;
  criadoEm?: string;
  itens?: OrcamentoItem[];
}

export interface Evolucao {
  id?: number;
  pacienteId: number;
  texto: string;
  autor?: string;
  criadoEm?: string;
}

export interface Anexo {
  id?: number;
  pacienteId: number;
  nome: string;        // nome original do arquivo
  path: string;        // caminho no Storage
  tipo?: string;       // mime type
  tamanho?: number;    // bytes
  categoria: 'foto' | 'raio-x' | 'documento' | 'outro';
  autor?: string;
  criadoEm?: string;
}

export interface Documento {
  id?: number;
  pacienteId: number;
  tipo: 'receituario' | 'atestado' | 'declaracao' | 'termo' | 'outro';
  titulo: string;
  conteudo: string;
  assinatura?: string; // data-URL PNG
  autor?: string;
  criadoEm?: string;
}

export interface Clinica {
  id?: number;
  nome: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  logoUrl?: string;
  agendaHoraInicio?: number; // hora de abertura da agenda (default 7)
  agendaHoraFim?: number;    // hora de fechamento da agenda (default 19)
  infinitepayHandle?: string; // InfiniteTag (sem $) p/ gerar links de pagamento (S9)
  agendamentoOnline?: boolean; // liga/desliga o agendamento online público (S8)
}

export type PeriodoPreferido = 'manha' | 'tarde' | 'qualquer';

export interface SolicitacaoAgendamento {
  id?: number;
  nome: string;
  telefone: string;
  email?: string;
  procedimento?: string;
  dataPreferida?: string;
  periodo: PeriodoPreferido;
  horaPreferida?: number;
  minPreferida?: number;
  obs?: string;
  status: 'pendente' | 'aceita' | 'recusada';
  agendamentoId?: number;
  criadoEm?: string;
}

export interface Usuario {
  id: string;
  nome?: string;
  papel: 'admin' | 'dentista' | 'secretaria';
}

export type StatusProtese = 'solicitada' | 'laboratorio' | 'retornou' | 'instalada';

export interface Protese {
  id?: number;
  pacienteId: number;
  tipo: string;            // coroa, PPR, prótese total, faceta…
  dente?: string;          // elemento(s) dentário(s)
  laboratorio?: string;
  cor?: string;            // escala de cor (ex.: A2)
  material?: string;       // zircônia, metalocerâmica…
  valor?: number;          // custo do laboratório
  status: StatusProtese;
  enviadoEm?: string;
  previsaoRetorno?: string;
  instaladoEm?: string;
  obs?: string;
  criadoEm?: string;
}

export interface Parcela {
  id?: number;
  contaId?: number;
  numero: number;
  valor: number;
  vencimento?: string;
  pago: boolean;
  pagoEm?: string;
  formaPagamento?: string;
  // Link de pagamento InfinitePay (S9)
  pagtoLink?: string;      // URL do checkout gerado
  pagtoOrderNsu?: string;  // order_nsu enviado (= id da parcela)
  pagtoSlug?: string;      // invoice_slug confirmado pelo webhook
}

export interface ContaReceber {
  id?: number;
  pacienteId: number;
  orcamentoId?: number;
  descricao: string;
  valorTotal: number;
  status: 'aberta' | 'quitada' | 'cancelada';
  criadoEm?: string;
  parcelas?: Parcela[];
}

export interface ItemEstoque {
  id?: number;
  nome: string;
  quantidade: number;
  minimo: number;
  categoria: string;
  fornecedor: string;
  unidade?: string;
  obs?: string;
  criadoEm?: string;
}
