// Catálogo odontológico padrão (C2) — lista curada de procedimentos comuns,
// agrupados por especialidade, com PREÇOS SUGERIDOS (a clínica edita depois).
// Importável de dentro da tela de Catálogo (insere para a clínica atual via RLS,
// sem migration). Os preços são médias de referência, não valores obrigatórios.

export interface ItemCatalogoPadrao {
  nome: string;
  preco: number; // sugerido em R$ (editável)
  duracaoMin?: number;
}

export interface GrupoCatalogoPadrao {
  categoria: string;
  itens: ItemCatalogoPadrao[];
}

export const CATALOGO_PADRAO: GrupoCatalogoPadrao[] = [
  {
    categoria: "Clínica Geral",
    itens: [
      { nome: "Consulta de avaliação", preco: 150, duracaoMin: 30 },
      { nome: "Consulta de urgência", preco: 200, duracaoMin: 30 },
      { nome: "Retorno / reavaliação", preco: 80, duracaoMin: 20 },
    ],
  },
  {
    categoria: "Prevenção",
    itens: [
      { nome: "Limpeza / Profilaxia", preco: 180, duracaoMin: 40 },
      { nome: "Aplicação de flúor", preco: 80, duracaoMin: 20 },
      { nome: "Aplicação de selante (por dente)", preco: 90, duracaoMin: 20 },
      { nome: "Raspagem supragengival", preco: 200, duracaoMin: 40 },
      { nome: "Orientação de higiene bucal", preco: 60, duracaoMin: 20 },
    ],
  },
  {
    categoria: "Dentística",
    itens: [
      { nome: "Restauração em resina — 1 face", preco: 200, duracaoMin: 40 },
      { nome: "Restauração em resina — 2 faces", preco: 280, duracaoMin: 50 },
      { nome: "Restauração em resina — 3 faces", preco: 350, duracaoMin: 60 },
      { nome: "Restauração em amálgama", preco: 180, duracaoMin: 40 },
      { nome: "Restauração provisória", preco: 100, duracaoMin: 20 },
      { nome: "Troca de restauração", preco: 220, duracaoMin: 40 },
      { nome: "Ajuste oclusal", preco: 120, duracaoMin: 30 },
    ],
  },
  {
    categoria: "Endodontia",
    itens: [
      { nome: "Tratamento de canal — incisivo/canino", preco: 700, duracaoMin: 80 },
      { nome: "Tratamento de canal — pré-molar", preco: 850, duracaoMin: 90 },
      { nome: "Tratamento de canal — molar", preco: 1100, duracaoMin: 120 },
      { nome: "Retratamento endodôntico", preco: 1300, duracaoMin: 120 },
      { nome: "Pulpotomia", preco: 350, duracaoMin: 60 },
    ],
  },
  {
    categoria: "Periodontia",
    itens: [
      { nome: "Raspagem e alisamento radicular (por quadrante)", preco: 250, duracaoMin: 60 },
      { nome: "Tratamento periodontal completo", preco: 1200, duracaoMin: 120 },
      { nome: "Gengivectomia", preco: 600, duracaoMin: 60 },
      { nome: "Aumento de coroa clínica", preco: 800, duracaoMin: 90 },
    ],
  },
  {
    categoria: "Cirurgia",
    itens: [
      { nome: "Extração simples", preco: 250, duracaoMin: 40 },
      { nome: "Extração de raiz residual", preco: 300, duracaoMin: 40 },
      { nome: "Extração de siso incluso", preco: 700, duracaoMin: 80 },
      { nome: "Extração de siso semi-incluso", preco: 550, duracaoMin: 60 },
      { nome: "Frenectomia", preco: 600, duracaoMin: 60 },
      { nome: "Biópsia", preco: 500, duracaoMin: 60 },
    ],
  },
  {
    categoria: "Prótese",
    itens: [
      { nome: "Coroa metalocerâmica", preco: 1200, duracaoMin: 60 },
      { nome: "Coroa de porcelana pura (zircônia/e.max)", preco: 1800, duracaoMin: 60 },
      { nome: "Coroa provisória", preco: 250, duracaoMin: 40 },
      { nome: "Prótese total (dentadura) — por arcada", preco: 1500, duracaoMin: 60 },
      { nome: "Prótese parcial removível", preco: 1300, duracaoMin: 60 },
      { nome: "Núcleo metálico fundido", preco: 350, duracaoMin: 50 },
      { nome: "Pino de fibra de vidro", preco: 300, duracaoMin: 40 },
      { nome: "Placa de bruxismo (miorrelaxante)", preco: 600, duracaoMin: 40 },
    ],
  },
  {
    categoria: "Implantodontia",
    itens: [
      { nome: "Implante unitário (instalação)", preco: 2500, duracaoMin: 90 },
      { nome: "Enxerto ósseo", preco: 1500, duracaoMin: 90 },
      { nome: "Levantamento de seio maxilar", preco: 3000, duracaoMin: 120 },
      { nome: "Prótese sobre implante (coroa)", preco: 2000, duracaoMin: 60 },
    ],
  },
  {
    categoria: "Ortodontia",
    itens: [
      { nome: "Documentação ortodôntica", preco: 350, duracaoMin: 30 },
      { nome: "Instalação de aparelho fixo (por arcada)", preco: 1500, duracaoMin: 90 },
      { nome: "Manutenção ortodôntica (mensal)", preco: 180, duracaoMin: 40 },
      { nome: "Alinhador transparente (planejamento)", preco: 6000, duracaoMin: 60 },
      { nome: "Contenção ortodôntica", preco: 400, duracaoMin: 40 },
    ],
  },
  {
    categoria: "Odontopediatria",
    itens: [
      { nome: "Consulta odontopediátrica", preco: 150, duracaoMin: 30 },
      { nome: "Restauração em dente decíduo", preco: 180, duracaoMin: 40 },
      { nome: "Pulpotomia em dente decíduo", preco: 300, duracaoMin: 50 },
      { nome: "Extração de dente decíduo", preco: 200, duracaoMin: 30 },
    ],
  },
  {
    categoria: "Estética",
    itens: [
      { nome: "Clareamento dental de consultório", preco: 800, duracaoMin: 60 },
      { nome: "Clareamento caseiro (moldeiras)", preco: 600, duracaoMin: 40 },
      { nome: "Lente de contato dental (por dente)", preco: 1800, duracaoMin: 90 },
      { nome: "Faceta em resina (por dente)", preco: 600, duracaoMin: 60 },
      { nome: "Gengivoplastia estética", preco: 800, duracaoMin: 60 },
    ],
  },
  {
    categoria: "Radiologia",
    itens: [
      { nome: "Radiografia periapical", preco: 40, duracaoMin: 15 },
      { nome: "Radiografia interproximal (bitewing)", preco: 50, duracaoMin: 15 },
      { nome: "Radiografia panorâmica", preco: 120, duracaoMin: 20 },
      { nome: "Tomografia (Cone Beam)", preco: 350, duracaoMin: 30 },
      { nome: "Escaneamento intraoral", preco: 250, duracaoMin: 30 },
    ],
  },
];

// Achata os grupos em itens prontos para inserir no catálogo.
export const catalogoPadraoFlat = (): { nome: string; categoria: string; preco: number; duracaoMin?: number }[] =>
  CATALOGO_PADRAO.flatMap((g) => g.itens.map((i) => ({ ...i, categoria: g.categoria })));
