"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { Anamnese } from "@/lib/types";
import { useToast } from "@/components/Toast";

// Gera o link /p/<token> pro paciente aceitar o orçamento e/ou assinar a
// anamnese no celular (junto vai a autorização de imagem). Ver migration 0034.
export default function EnviarLinkPacienteModal({
  pacienteId,
  pacienteNome,
  pacienteTel,
  orcamentoId,
  onClose,
}: {
  pacienteId: number;
  pacienteNome: string;
  pacienteTel?: string;
  orcamentoId?: number;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [anamnese, setAnamnese] = useState<Anamnese | null | undefined>(undefined);
  const [incluiOrc, setIncluiOrc] = useState(!!orcamentoId);
  const [incluiAnm, setIncluiAnm] = useState(false);
  const [gerando, setGerando] = useState(false);
  // Link já gerado para a combinação atual (evita criar um token por clique).
  const [link, setLink] = useState<{ chave: string; url: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    DB.anamneses.list(pacienteId).then((ans) => {
      if (!vivo) return;
      // A mais recente; a de cima é a que vale.
      const recente = [...ans].sort((a, b) =>
        String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")),
      )[0] ?? null;
      setAnamnese(recente);
      setIncluiAnm(!!recente && !recente.assinatura);
    });
    return () => { vivo = false; };
  }, [pacienteId]);

  const chave = `${incluiOrc ? orcamentoId : ""}|${incluiAnm ? anamnese?.id : ""}`;
  const nada = !incluiOrc && !incluiAnm;

  const obterUrl = async (): Promise<string | null> => {
    if (nada) { showToast("Escolha o que o paciente vai assinar.", "error"); return null; }
    if (link?.chave === chave) return link.url;
    setGerando(true);
    try {
      const token = await DB.linksPaciente.criar({
        pacienteId,
        orcamentoId: incluiOrc ? orcamentoId : undefined,
        anamneseId: incluiAnm ? anamnese?.id : undefined,
      });
      const url = `${window.location.origin}/p/${token}`;
      setLink({ chave, url });
      return url;
    } catch {
      showToast("Não foi possível gerar o link (a migration 0034 já foi rodada?).", "error");
      return null;
    } finally {
      setGerando(false);
    }
  };

  const tel = (pacienteTel ?? "").replace(/\D/g, "");

  const whatsapp = async () => {
    if (!tel) return showToast("Paciente sem telefone cadastrado.", "error");
    const url = await obterUrl();
    if (!url) return;
    const primeiro = pacienteNome.split(" ")[0];
    const oque = incluiOrc && incluiAnm ? "seu orçamento e sua ficha de anamnese" : incluiOrc ? "seu orçamento" : "sua ficha de anamnese";
    const msg = `Olá ${primeiro}! Segue o link para conferir e assinar ${oque}: ${url}\n(O link vale por 7 dias.)`;
    const fone = tel.length >= 11 ? `55${tel}` : tel;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const copiar = async () => {
    const url = await obterUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiado.", "success");
    } catch {
      window.prompt("Copie o link:", url);
    }
  };

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <span className="modal-title">Enviar para o paciente assinar — {pacienteNome}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
            O paciente abre o link no celular, confere e assina na tela. Junto vai a pergunta de
            autorização de fotos e divulgação nas redes sociais. O link vale 7 dias e só pode ser assinado uma vez.
          </p>

          {orcamentoId != null && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10, fontSize: 14 }}>
              <input type="checkbox" checked={incluiOrc} onChange={(e) => setIncluiOrc(e.target.checked)} />
              <span>
                <strong>Aceite do orçamento</strong>
                <br />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Ao aceitar, o orçamento é aprovado e os procedimentos vão para a ficha como &ldquo;a realizar&rdquo;.
                </span>
              </span>
            </label>
          )}

          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, opacity: anamnese ? 1 : 0.6 }}>
            <input
              type="checkbox"
              checked={incluiAnm}
              disabled={!anamnese}
              onChange={(e) => setIncluiAnm(e.target.checked)}
            />
            <span>
              <strong>Assinatura da anamnese</strong>
              <br />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {anamnese === undefined
                  ? "Carregando…"
                  : !anamnese
                    ? "Paciente ainda não tem anamnese."
                    : anamnese.assinatura
                      ? "A anamnese mais recente já está assinada (marque para assinar de novo)."
                      : "Anamnese mais recente, ainda sem assinatura."}
              </span>
            </span>
          </label>

          {link?.chave === chave && (
            <div style={{ marginTop: 14, fontSize: 12, wordBreak: "break-all", background: "var(--bg2)", padding: "8px 10px", borderRadius: 6 }}>
              {link.url}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={copiar} disabled={gerando || nada}>Copiar link</button>
          <button className="btn btn-primary" onClick={whatsapp} disabled={gerando || nada}>
            {gerando ? "Gerando…" : "Enviar no WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
