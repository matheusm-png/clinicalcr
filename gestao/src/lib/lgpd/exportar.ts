// LGPD Parte 3 — Exportação de dados.
//  • exportarPaciente(): direito de portabilidade — todos os dados de um paciente.
//  • exportarClinica(): backup geral da clínica.
// Só monta o pacote e dispara o download (JSON). O registro de auditoria
// ('exportacao') é feito por quem chama, via DB.auditoria.registrar().

import { DB } from "@/lib/db";

/** Dispara o download de um objeto como arquivo .json. */
export function baixarJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reúne TODOS os dados de um paciente (portabilidade LGPD). */
export async function exportarPaciente(pacienteId: number) {
  const [
    paciente, anamneses, procedimentos, evolucoes,
    documentos, anexos, orcamentos, contas,
    todasProteses, todosAgendamentos,
  ] = await Promise.all([
    DB.pacientes.get(pacienteId),
    DB.anamneses.list(pacienteId),
    DB.procedimentos.list(pacienteId),
    DB.evolucoes.list(pacienteId),
    DB.documentos.list(pacienteId),
    DB.anexos.list(pacienteId),
    DB.orcamentos.list(pacienteId),
    DB.contas.list(pacienteId),
    DB.proteses.list(),
    DB.agendamentos.list(),
  ]);

  const proteses = todasProteses.filter((p) => p.pacienteId === pacienteId);
  const agendamentos = todosAgendamentos.filter((a) => a.pacienteId === pacienteId);

  return {
    _meta: {
      tipo: "exportacao-paciente-lgpd",
      geradoEm: new Date().toISOString(),
      pacienteId,
      observacao:
        "Portabilidade de dados (LGPD). Anexos são listados como metadados (nome/caminho); os arquivos ficam no armazenamento seguro da clínica.",
    },
    paciente,
    anamneses,
    procedimentos,
    evolucoes,
    documentos,
    anexos,
    orcamentos,
    contas,
    proteses,
    agendamentos,
  };
}

/** Reúne os dados da clínica para backup. */
export async function exportarClinica() {
  const [
    clinica, pacientes, procedimentos, anamneses, financeiro,
    agendamentos, estoque, catalogo, orcamentos, contas,
    proteses, profissionais,
  ] = await Promise.all([
    DB.clinica.get(),
    DB.pacientes.list(),
    DB.procedimentos.list(),
    DB.anamneses.list(),
    DB.financeiro.list(),
    DB.agendamentos.list(),
    DB.estoque.list(),
    DB.catalogo.list(),
    DB.orcamentos.list(),
    DB.contas.list(),
    DB.proteses.list(),
    DB.profissionais.list(),
  ]);

  return {
    _meta: {
      tipo: "backup-clinica-lgpd",
      geradoEm: new Date().toISOString(),
      observacao: "Backup dos dados operacionais da clínica. Anexos e assinaturas ficam no armazenamento seguro.",
    },
    clinica,
    pacientes,
    procedimentos,
    anamneses,
    financeiro,
    agendamentos,
    estoque,
    catalogo,
    orcamentos,
    contas,
    proteses,
    profissionais,
  };
}
