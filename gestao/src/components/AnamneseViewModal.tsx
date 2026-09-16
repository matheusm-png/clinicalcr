"use client";

import { Anamnese } from "@/lib/types";
import AnaliseRiscoIA from "@/components/AnaliseRiscoIA";
import {
  FICHA_IDENTIFICACAO,
  FICHA_QUEIXA,
  FICHA_DOENCAS,
  FICHA_GERAL,
  FICHA_TEXTO_LIVRE,
  FICHA_RODAPE,
  FICHA_COMPLEMENTAR,
  ehCampoDaFicha,
  posicaoNaFicha,
  rotuloFicha,
} from "@/lib/fichaSaude";

// Normaliza a resposta para "sim" | "não" | null (null = não é sim/não).
const simNao = (v: unknown): "sim" | "não" | null => {
  const s = typeof v === "boolean" ? (v ? "sim" : "não") : String(v ?? "").trim().toLowerCase();
  if (s === "sim") return "sim";
  if (s === "não" || s === "nao") return "não";
  return null;
};

const vazio = (v: unknown) => v == null || String(v).trim() === "";

export default function AnamneseViewModal({
  anamnese,
  pacienteNome,
  onClose,
  onEditar,
}: {
  anamnese: Anamnese;
  pacienteNome?: string;
  onClose: () => void;
  onEditar?: () => void;
}) {
  const r = anamnese.respostas || {};
  const nome = pacienteNome || anamnese.pacienteNome;

  // Identificação: só os campos que a anamnese guarda (nome/tel/etc. ficam no
  // cadastro do paciente, não nas respostas).
  const identificacao = FICHA_IDENTIFICACAO.filter((c) => !vazio(r[c.key]));

  // Complementares (fora do papel) só aparecem se foram respondidos.
  const complementares = FICHA_COMPLEMENTAR.filter((q) => !vazio(r[q.key]));

  // Qualquer chave que não seja da ficha nem complementar — nunca some, vai pro fim.
  const chavesConhecidas = new Set<string>([
    ...FICHA_COMPLEMENTAR.map((q) => q.key),
    ...FICHA_SAUDE_TODAS_DESC(),
  ]);
  const extras = Object.keys(r)
    .filter((k) => !k.startsWith("_") && !ehCampoDaFicha(k) && !chavesConhecidas.has(k) && !vazio(r[k]))
    .sort((a, b) => posicaoNaFicha(a) - posicaoNaFicha(b));

  const dataRegistro = anamnese.data || anamnese.criadoEm;

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Anamnese{nome ? ` — ${nome}` : ""}</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {/* Metadados */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18, fontSize: 12.5, color: "var(--text-muted)" }}>
            {dataRegistro ? (
              <span>📅 {new Date(dataRegistro.length <= 10 ? dataRegistro + "T00:00:00" : dataRegistro).toLocaleDateString("pt-BR")}</span>
            ) : (
              <span style={{ color: "var(--warning)" }}>📅 Sem data registrada</span>
            )}
            <span>📋 {typeof r._modelo === "string" && r._modelo ? r._modelo : "Anamnese Odontológica Padrão"}</span>
            {typeof r._autor === "string" && r._autor && <span>👤 {r._autor}</span>}
            {anamnese.status && <span className="badge badge-success">{anamnese.status}</span>}
          </div>

          {/* Identificação (cabeçalho da ficha) */}
          {identificacao.length > 0 && (
            <>
              <Titulo>Identificação</Titulo>
              <Bloco>
                {identificacao.map((c) => (
                  <LinhaTexto key={c.key} respostas={r} chave={c.key} rotulo={c.label} />
                ))}
              </Bloco>
            </>
          )}

          {/* Queixa principal */}
          <Titulo>{FICHA_QUEIXA.label}</Titulo>
          <Bloco>
            <div style={{ padding: "10px 14px", fontSize: 13.5, whiteSpace: "pre-wrap", color: vazio(r[FICHA_QUEIXA.key]) ? "var(--text-muted)" : undefined }}>
              {vazio(r[FICHA_QUEIXA.key]) ? "—" : String(r[FICHA_QUEIXA.key])}
            </div>
          </Bloco>

          {/* Questionário de Saúde — exatamente a sequência do impresso */}
          <Titulo>Questionário de Saúde</Titulo>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 6px 2px" }}>
            Sofre de alguma das seguintes doenças?
          </div>
          <Bloco>
            {FICHA_DOENCAS.map((q) => (
              <LinhaSimNao key={q.key} respostas={r} chave={q.key} rotulo={q.label} descChave={q.desc} />
            ))}
          </Bloco>
          <Bloco>
            {FICHA_GERAL.map((q) => (
              <LinhaSimNao key={q.key} respostas={r} chave={q.key} rotulo={q.label} descChave={q.desc} />
            ))}
          </Bloco>

          {/* Texto livre — antecedentes → observações */}
          <Bloco>
            {FICHA_TEXTO_LIVRE.map((c) => (
              <LinhaTexto key={c.key} respostas={r} chave={c.key} rotulo={c.label} />
            ))}
          </Bloco>

          {/* Rodapé da ficha */}
          <Bloco>
            <LinhaSimNao
              respostas={r}
              chave={vazio(r.autorizacaoFoto) && !vazio(r.autoriza_fotos) ? "autoriza_fotos" : "autorizacaoFoto"}
              rotulo={FICHA_RODAPE[0].label}
            />
            {!vazio(r.local_data) && <LinhaTexto respostas={r} chave="local_data" rotulo="Local / Data" />}
          </Bloco>

          {/* Perguntas fora da ficha de papel */}
          {complementares.length > 0 && (
            <>
              <Titulo>Complementar (não consta na ficha de papel)</Titulo>
              <Bloco>
                {complementares.map((q) => (
                  <LinhaSimNao key={q.key} respostas={r} chave={q.key} rotulo={q.label} descChave={q.desc} />
                ))}
              </Bloco>
            </>
          )}

          {/* Respostas de modelos próprios / campos antigos */}
          {extras.length > 0 && (
            <>
              <Titulo>Outras respostas registradas</Titulo>
              <Bloco>
                {extras.map((k) =>
                  simNao(r[k]) ? (
                    <LinhaSimNao key={k} respostas={r} chave={k} rotulo={rotuloFicha(k)} />
                  ) : (
                    <LinhaTexto key={k} respostas={r} chave={k} rotulo={rotuloFicha(k)} />
                  ),
                )}
              </Bloco>
            </>
          )}

          {/* Assinatura */}
          {anamnese.assinatura && (
            <>
              <Titulo>Assinatura do paciente</Titulo>
              <div style={{ border: "1.5px dashed var(--border-solid)", borderRadius: "var(--radius)", background: "#fff", padding: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={anamnese.assinatura} alt="Assinatura do paciente" style={{ maxWidth: "100%", maxHeight: 140, display: "block", margin: "0 auto" }} />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <AnaliseRiscoIA respostas={anamnese.respostas} pacienteNome={nome} />
          <div style={{ display: "flex", gap: 8 }}>
            {onEditar && (
              <button className="btn btn-outline" onClick={onEditar}>Editar</button>
            )}
            <button className="btn btn-primary" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Chaves "_desc" de todas as perguntas da ficha — já mostradas junto da pergunta,
// não devem reaparecer na lista de extras.
function FICHA_SAUDE_TODAS_DESC(): string[] {
  return [...FICHA_DOENCAS, ...FICHA_GERAL].flatMap((q) => (q.desc ? [q.desc] : []));
}

// ── Componentes de apresentação ──────────────────────────────
// No escopo do módulo (e não dentro do componente da página) para o React não
// remontar a árvore a cada render.

type Respostas = Record<string, unknown>;

// Linha de pergunta sim/não, no mesmo formato do papel. Pergunta da ficha sem
// resposta aparece como "—": no impresso ela existe, e sumir da tela quebra a
// conferência linha a linha com o papel.
function LinhaSimNao({
  respostas,
  chave,
  rotulo,
  descChave,
}: {
  respostas: Respostas;
  chave: string;
  rotulo: string;
  descChave?: string;
}) {
  const resp = simNao(respostas[chave]);
  const desc = descChave && !vazio(respostas[descChave]) ? String(respostas[descChave]).trim() : "";
  return (
    <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 13.5 }}>{rotulo}</span>
        {resp === null ? (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)", flexShrink: 0 }}>—</span>
        ) : (
          <span className={`badge ${resp === "sim" ? "badge-danger" : "badge-success"}`} style={{ flexShrink: 0 }}>
            {resp === "sim" ? "Sim" : "Não"}
          </span>
        )}
      </div>
      {desc && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", background: "var(--bg2)", borderRadius: 6, padding: "6px 10px" }}>
          {desc}
        </div>
      )}
    </div>
  );
}

function LinhaTexto({ respostas, chave, rotulo }: { respostas: Respostas; chave: string; rotulo: string }) {
  const semValor = vazio(respostas[chave]);
  return (
    <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--text-muted)", marginBottom: 3 }}>
        {rotulo}
      </div>
      <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", color: semValor ? "var(--text-muted)" : undefined }}>
        {semValor ? "—" : String(respostas[chave])}
      </div>
    </div>
  );
}

function Bloco({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: 18 }}>
      {children}
    </div>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <div className="modal-section-title">{children}</div>;
}
