// Base de medicamentos comuns na odontologia, com posologia sugerida (editável).
// Usada no editor de Receituário para inserir prescrições com um clique.
// A clínica também pode cadastrar os seus (tabela `medicamentos`).

export interface MedicamentoBase {
  nome: string;
  posologia: string;
  categoria: string;
}

export const MEDICAMENTOS_BASE: MedicamentoBase[] = [
  // Analgésicos
  { categoria: "Analgésico", nome: "Dipirona 500mg", posologia: "Tomar 1 comprimido de 6/6h em caso de dor, por até 3 dias." },
  { categoria: "Analgésico", nome: "Paracetamol 750mg", posologia: "Tomar 1 comprimido de 6/6h em caso de dor, por até 3 dias." },
  // Anti-inflamatórios
  { categoria: "Anti-inflamatório", nome: "Ibuprofeno 600mg", posologia: "Tomar 1 comprimido de 8/8h, após as refeições, por 3 dias." },
  { categoria: "Anti-inflamatório", nome: "Nimesulida 100mg", posologia: "Tomar 1 comprimido de 12/12h, após as refeições, por 3 dias." },
  { categoria: "Anti-inflamatório", nome: "Cetoprofeno 100mg", posologia: "Tomar 1 comprimido de 12/12h, após as refeições, por 3 dias." },
  // Antibióticos
  { categoria: "Antibiótico", nome: "Amoxicilina 500mg", posologia: "Tomar 1 cápsula de 8/8h, por 7 dias." },
  { categoria: "Antibiótico", nome: "Amoxicilina + Clavulanato 875mg", posologia: "Tomar 1 comprimido de 12/12h, por 7 dias." },
  { categoria: "Antibiótico", nome: "Azitromicina 500mg", posologia: "Tomar 1 comprimido ao dia, por 3 dias." },
  { categoria: "Antibiótico", nome: "Clindamicina 300mg", posologia: "Tomar 1 cápsula de 8/8h, por 7 dias. (Alérgicos à penicilina.)" },
  { categoria: "Antibiótico", nome: "Metronidazol 400mg", posologia: "Tomar 1 comprimido de 8/8h, por 7 dias." },
  // Corticoide
  { categoria: "Corticoide", nome: "Dexametasona 4mg", posologia: "Tomar 1 comprimido 1 hora antes do procedimento." },
  // Tópico / enxaguante
  { categoria: "Tópico", nome: "Digluconato de Clorexidina 0,12%", posologia: "Bochechar 15ml por 1 minuto, 2x ao dia, por 7 dias." },
  // Proteção gástrica
  { categoria: "Outros", nome: "Omeprazol 20mg", posologia: "Tomar 1 cápsula em jejum, por 7 dias. (Proteção gástrica.)" },
];

// Formata uma linha de prescrição para inserir no receituário.
export const linhaPrescricao = (nome: string, posologia: string) =>
  `${nome}\n   ${posologia}\n\n`;
