import { Paciente, Clinica, Documento } from "@/lib/types";

// Modelos de documentos clínicos. Cada modelo gera um título + conteúdo
// pré-preenchido com os dados do paciente/clínica; o dentista edita o resto
// (medicação, dias de afastamento, etc.) antes de salvar/imprimir.

export interface ModeloCtx {
  paciente: Paciente;
  clinica: Clinica | null;
}

export interface ModeloDocumento {
  id: Documento["tipo"];
  nome: string;
  gerar: (ctx: ModeloCtx) => { titulo: string; conteudo: string };
}

const hojeExtenso = () =>
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

const cidade = (c: Clinica | null) => c?.cidade || "____________";

export const MODELOS: ModeloDocumento[] = [
  {
    id: "receituario",
    nome: "Receituário",
    gerar: ({ paciente, clinica }) => ({
      titulo: "Receituário",
      conteudo:
        `Paciente: ${paciente.nome}\n\n` +
        `Prescrevo:\n\n` +
        `1. \n   \n\n` +
        `2. \n   \n\n` +
        `Orientações:\n- \n\n` +
        `${cidade(clinica)}, ${hojeExtenso()}.`,
    }),
  },
  {
    id: "atestado",
    nome: "Atestado odontológico",
    gerar: ({ paciente, clinica }) => ({
      titulo: "Atestado Odontológico",
      conteudo:
        `Atesto, para os devidos fins, que o(a) paciente ${paciente.nome}` +
        `${paciente.cpf ? `, portador(a) do CPF ${paciente.cpf},` : ""} esteve sob meus ` +
        `cuidados odontológicos nesta data, necessitando de afastamento de suas atividades ` +
        `por ____ ( ) dia(s), a partir de ${new Date().toLocaleDateString("pt-BR")}.\n\n` +
        `CID (opcional): ____\n\n` +
        `${cidade(clinica)}, ${hojeExtenso()}.`,
    }),
  },
  {
    id: "declaracao",
    nome: "Declaração de comparecimento",
    gerar: ({ paciente, clinica }) => ({
      titulo: "Declaração de Comparecimento",
      conteudo:
        `Declaro, para os devidos fins, que o(a) Sr(a). ${paciente.nome} compareceu a esta ` +
        `clínica odontológica no dia ${new Date().toLocaleDateString("pt-BR")}, no horário das ` +
        `____ às ____, para atendimento odontológico.\n\n` +
        `${cidade(clinica)}, ${hojeExtenso()}.`,
    }),
  },
  {
    id: "termo",
    nome: "Termo de consentimento",
    gerar: ({ paciente, clinica }) => ({
      titulo: "Termo de Consentimento Livre e Esclarecido",
      conteudo:
        `Eu, ${paciente.nome}${paciente.cpf ? `, CPF ${paciente.cpf}` : ""}, declaro que fui ` +
        `devidamente informado(a) pelo(a) profissional responsável sobre o procedimento ` +
        `odontológico de _______________________________, incluindo seus objetivos, riscos, ` +
        `benefícios, alternativas e cuidados pós-operatórios, e autorizo livremente a sua realização.\n\n` +
        `Declaro ainda ter esclarecido todas as minhas dúvidas antes de assinar este termo.\n\n` +
        `${cidade(clinica)}, ${hojeExtenso()}.`,
    }),
  },
  {
    id: "outro",
    nome: "Documento em branco",
    gerar: ({ clinica }) => ({
      titulo: "Documento",
      conteudo: `\n\n\n${cidade(clinica)}, ${hojeExtenso()}.`,
    }),
  },
];

// Escapa texto para uso seguro dentro do HTML de impressão.
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Monta o HTML A4 autossuficiente para impressão / "Salvar como PDF".
export function montarHtmlImpressao(doc: Documento, clinica: Clinica | null): string {
  const linhaEndereco = clinica
    ? [clinica.endereco && `${clinica.endereco}${clinica.numero ? ", " + clinica.numero : ""}`,
       clinica.bairro, [clinica.cidade, clinica.uf].filter(Boolean).join("/")]
        .filter(Boolean)
        .join(" · ")
    : "";
  const contatoClinica = clinica
    ? [clinica.telefone, clinica.email, clinica.cnpj && `CNPJ ${clinica.cnpj}`].filter(Boolean).join(" · ")
    : "";

  const assinaturaBloco = doc.assinatura
    ? `<img src="${doc.assinatura}" alt="assinatura" style="height:70px;display:block;margin:0 auto 4px;" />`
    : `<div style="height:70px"></div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${esc(doc.titulo)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #142020; margin: 0; }
  .doc { max-width: 720px; margin: 0 auto; }
  header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 28px; }
  header .nome { font-size: 20px; font-weight: 700; color: #0f766e; }
  header .meta { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.5; }
  h1 { font-size: 17px; text-align: center; letter-spacing: .5px; text-transform: uppercase; margin: 0 0 24px; }
  .conteudo { font-size: 14px; line-height: 1.9; white-space: pre-wrap; text-align: justify; }
  .assinatura { margin-top: 64px; text-align: center; }
  .assinatura .linha { width: 280px; border-top: 1px solid #142020; margin: 0 auto; padding-top: 6px; font-size: 13px; }
  .assinatura .autor { font-size: 12px; color: #555; margin-top: 2px; }
  .rodape { margin-top: 40px; text-align: center; font-size: 10px; color: #999; }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #0f766e; color: #fff; border: 0;
    padding: 10px 18px; border-radius: 8px; font-family: sans-serif; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } }
</style></head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Salvar PDF</button>
  <div class="doc">
    <header>
      <div class="nome">${esc(clinica?.nome || "Clínica Odontológica")}</div>
      ${linhaEndereco ? `<div class="meta">${esc(linhaEndereco)}</div>` : ""}
      ${contatoClinica ? `<div class="meta">${esc(contatoClinica)}</div>` : ""}
    </header>
    <h1>${esc(doc.titulo)}</h1>
    <div class="conteudo">${esc(doc.conteudo)}</div>
    <div class="assinatura">
      ${assinaturaBloco}
      <div class="linha">${esc(doc.autor || "Cirurgião(ã)-Dentista")}</div>
      <div class="autor">${esc(clinica?.nome || "")}</div>
    </div>
    <div class="rodape">Documento emitido em ${new Date(doc.criadoEm || Date.now()).toLocaleString("pt-BR")}</div>
  </div>
</body></html>`;
}
