// C8 — Permissões granulares por usuário (nível de UX/navegação).
// Modelo seguro: SEM configuração (permissoes null) o acesso é total (igual hoje);
// só bloqueia módulos marcados explicitamente como false. Admin nunca é restringido.
// Obs.: isto controla visibilidade/UX; o isolamento por clínica continua no RLS.

export type Permissoes = Record<string, boolean> | null | undefined;

export const MODULOS: { key: string; label: string; desc: string }[] = [
  { key: "agenda", label: "Agenda", desc: "Agenda e solicitações online" },
  { key: "pacientes", label: "Pacientes e prontuário", desc: "Cadastro, prontuário e anamnese" },
  { key: "clinico", label: "Relacionamento", desc: "Retornos e recuperação de pacientes" },
  { key: "proteses", label: "Próteses", desc: "Controle protético" },
  { key: "orcamentos", label: "Orçamentos", desc: "Orçamentos e simulador" },
  { key: "financeiro", label: "Financeiro", desc: "A receber, financeiro, relatórios e comissões" },
  { key: "estoque", label: "Estoque", desc: "Estoque e controle do frigobar" },
];

// Um usuário pode ver o módulo? Admin sempre pode; sem config libera; só false bloqueia.
export function podeVerModulo(papel: string, perms: Permissoes, key: string): boolean {
  if (papel === "admin") return true;
  if (!perms) return true;
  return perms[key] !== false;
}
