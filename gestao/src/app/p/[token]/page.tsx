"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import SignaturePad, { SignaturePadHandle } from "@/components/SignaturePad";
import AnamneseFicha from "@/components/AnamneseFicha";
import { FICHA_RODAPE } from "@/lib/fichaSaude";
import { Anamnese } from "@/lib/types";
import s from "./link.module.css";

// Página PÚBLICA do link do paciente: aceite do orçamento + assinatura da
// anamnese + autorização de imagem. Dados vêm de /api/p/[token].

type Item = { descricao: string; dente: string; quantidade: number; valorUnitario: number };
type Dados = {
  clinica: { nome: string; telefone: string; logoUrl: string };
  pacienteNome: string;
  autorizaImagem: boolean | null;
  concluidoEm: string | null;
  expirado: boolean;
  orcamento?: {
    status: string;
    desconto: number;
    total: number;
    observacoes: string;
    itens: Item[];
  } | null;
  anamnese?: Anamnese | null;
};

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const TEXTO_IMAGEM = FICHA_RODAPE[0].label;

export default function LinkPacientePage() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [aceita, setAceita] = useState(false);
  const [confirma, setConfirma] = useState(false);
  const [imagem, setImagem] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [concluido, setConcluido] = useState<string | null>(null);
  const pad = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/p/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok) { setErro(j.error || "Link inválido."); return; }
        setDados(j);
        setImagem(j.autorizaImagem);
        setConcluido(j.concluidoEm);
      })
      .catch(() => vivo && setErro("Sem conexão. Tente de novo."));
    return () => { vivo = false; };
  }, [token]);

  const enviar = async () => {
    setErroEnvio("");
    const assinatura = pad.current?.toDataURL();
    if (dados?.orcamento && !aceita) return setErroEnvio("Marque que aceita o orçamento.");
    if (dados?.anamnese && !confirma) return setErroEnvio("Marque que confirma as informações da anamnese.");
    if (imagem === null) return setErroEnvio("Responda se autoriza fotos e divulgação nas redes sociais.");
    if (!assinatura) return setErroEnvio("Assine no quadro antes de enviar.");
    setEnviando(true);
    try {
      const r = await fetch(`/api/p/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assinatura, aceitaOrcamento: aceita, confirmaAnamnese: confirma, autorizaImagem: imagem }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErroEnvio(j.error || "Não foi possível enviar."); return; }
      setConcluido(j.concluidoEm || new Date().toISOString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErroEnvio("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const primeiroNome = (dados?.pacienteNome || "").split(" ")[0];

  return (
    <main className={s.page}>
      <header className={s.topo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dados?.clinica.logoUrl || "/assets/logo-lcr.svg"} alt="" className={s.logo} />
        <div className={s.clinica}>{dados?.clinica.nome || "Clínica LCR"}</div>
      </header>

      <div className={s.wrap}>
        {!dados && !erro && <p className={s.muted}>Carregando…</p>}

        {erro && (
          <section className={s.card}>
            <h1 className={s.h1}>Link indisponível</h1>
            <p>{erro} Se precisar, fale com a clínica.</p>
          </section>
        )}

        {dados && concluido && (
          <section className={s.card}>
            <h1 className={s.h1}>Tudo certo{primeiroNome ? `, ${primeiroNome}` : ""}!</h1>
            <p>
              Recebemos sua assinatura em {new Date(concluido).toLocaleString("pt-BR")}. Obrigado!
              {dados.orcamento ? " Seu tratamento já está no seu prontuário na clínica." : ""}
            </p>
          </section>
        )}

        {dados && !concluido && dados.expirado && (
          <section className={s.card}>
            <h1 className={s.h1}>Este link expirou</h1>
            <p>Peça um novo link à clínica{dados.clinica.telefone ? ` pelo ${dados.clinica.telefone}` : ""}.</p>
          </section>
        )}

        {dados && !concluido && !dados.expirado && (
          <>
            <section className={s.intro}>
              <h1 className={s.h1}>Olá{primeiroNome ? `, ${primeiroNome}` : ""}!</h1>
              <p className={s.muted}>
                Confira {dados.orcamento && dados.anamnese ? "seu orçamento e sua ficha de anamnese" : dados.orcamento ? "seu orçamento" : "sua ficha de anamnese"} e
                assine no fim da página. Se algo estiver errado, fale com a clínica antes de assinar.
              </p>
            </section>

            {dados.orcamento && (
              <section className={s.card}>
                <h2 className={s.h2}>Orçamento</h2>
                <ul className={s.itens}>
                  {dados.orcamento.itens.map((it, i) => (
                    <li key={i} className={s.item}>
                      <div>
                        <div className={s.itemNome}>{it.descricao}</div>
                        <div className={s.muted}>
                          {it.dente ? `Dente${it.dente.includes(",") ? "s" : ""} ${it.dente}` : ""}
                          {it.quantidade > 1 ? `${it.dente ? " · " : ""}${it.quantidade} × ${brl(it.valorUnitario)}` : ""}
                        </div>
                      </div>
                      <strong>{brl(it.quantidade * it.valorUnitario)}</strong>
                    </li>
                  ))}
                </ul>
                {dados.orcamento.desconto > 0 && (
                  <div className={s.linha}><span>Desconto</span><span>{dados.orcamento.desconto}%</span></div>
                )}
                <div className={`${s.linha} ${s.total}`}><span>Total</span><span>{brl(dados.orcamento.total)}</span></div>
                {dados.orcamento.observacoes && <p className={s.obs}>{dados.orcamento.observacoes}</p>}
                <label className={s.check}>
                  <input type="checkbox" checked={aceita} onChange={(e) => setAceita(e.target.checked)} />
                  <span>Li e aceito o orçamento acima.</span>
                </label>
              </section>
            )}

            {dados.anamnese && (
              <section className={s.card}>
                <h2 className={s.h2}>Ficha de anamnese</h2>
                <AnamneseFicha anamnese={dados.anamnese} mostrarMeta={false} mostrarAssinatura={false} mostrarRodape={false} />
                <label className={s.check}>
                  <input type="checkbox" checked={confirma} onChange={(e) => setConfirma(e.target.checked)} />
                  <span>Confirmo que as informações da minha ficha de anamnese são verdadeiras.</span>
                </label>
              </section>
            )}

            <section className={s.card}>
              <h2 className={s.h2}>Uso de imagem</h2>
              <p className={s.textoImagem}>{TEXTO_IMAGEM}</p>
              <div className={s.simNao} role="radiogroup" aria-label="Autorização de uso de imagem">
                <button type="button" role="radio" aria-checked={imagem === true}
                  className={`${s.opcao} ${imagem === true ? s.opcaoAtiva : ""}`} onClick={() => setImagem(true)}>
                  Sim, autorizo
                </button>
                <button type="button" role="radio" aria-checked={imagem === false}
                  className={`${s.opcao} ${imagem === false ? s.opcaoAtiva : ""}`} onClick={() => setImagem(false)}>
                  Não autorizo
                </button>
              </div>
              <p className={s.muted}>Sua resposta não muda em nada o seu atendimento.</p>
            </section>

            <section className={s.card}>
              <h2 className={s.h2}>Assinatura</h2>
              <SignaturePad ref={pad} height={170} />
              <button type="button" className={s.limpar} onClick={() => pad.current?.clear()}>Limpar assinatura</button>
              {erroEnvio && <p className={s.erro}>{erroEnvio}</p>}
              <button type="button" className={s.enviar} onClick={enviar} disabled={enviando}>
                {enviando ? "Enviando…" : "Assinar e enviar"}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
