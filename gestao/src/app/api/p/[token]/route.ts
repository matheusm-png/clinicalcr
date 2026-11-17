import { NextResponse } from "next/server";
import { createAdminClient, adminConfigurado } from "@/lib/supabase/admin";
import { procedimentosDoOrcamento } from "@/lib/orcamentoAprovacao";
import { Orcamento } from "@/lib/types";

// Rota PÚBLICA (sem login) do link /p/<token>: o paciente vê o orçamento e/ou a
// anamnese e assina. O token é a única credencial — por isso esta rota usa a
// service key e devolve SÓ o que o link cobre (nada de listar tabelas).
// Ver migration 0034.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ASSINATURA = 400_000; // ~400 KB de data-URL; a do canvas fica bem abaixo

type Link = {
  id: number;
  clinica_id: number;
  paciente_id: number;
  orcamento_id: number | null;
  anamnese_id: number | null;
  expira_em: string;
  aberto_em: string | null;
  concluido_em: string | null;
};

async function carregarLink(token: string) {
  if (!UUID.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("links_paciente")
    .select("id, clinica_id, paciente_id, orcamento_id, anamnese_id, expira_em, aberto_em, concluido_em")
    .eq("token", token)
    .maybeSingle();
  return data ? (data as Link) : null;
}

const ipDe = (req: Request) =>
  (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!adminConfigurado()) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });
  const { token } = await params;
  const link = await carregarLink(token);
  if (!link) return NextResponse.json({ error: "Link inválido." }, { status: 404 });

  const admin = createAdminClient();
  const expirado = !link.concluido_em && new Date(link.expira_em).getTime() < Date.now();

  const [{ data: clinica }, { data: paciente }] = await Promise.all([
    admin.from("clinicas").select("nome, telefone, logo_url").eq("id", link.clinica_id).maybeSingle(),
    admin.from("pacientes").select("nome, autoriza_imagem").eq("id", link.paciente_id).maybeSingle(),
  ]);

  const base = {
    clinica: { nome: clinica?.nome ?? "Clínica", telefone: clinica?.telefone ?? "", logoUrl: clinica?.logo_url ?? "" },
    pacienteNome: paciente?.nome ?? "",
    // Pré-marca a escolha anterior (se houver); o paciente confirma ou troca.
    autorizaImagem: typeof paciente?.autoriza_imagem === "boolean" ? paciente.autoriza_imagem : null,
    concluidoEm: link.concluido_em,
    expirado,
  };
  // Expirado: não devolve dado de saúde nem valores.
  if (expirado) return NextResponse.json(base);

  let orcamento = null;
  if (link.orcamento_id) {
    const { data: o } = await admin
      .from("orcamentos")
      .select("id, paciente_id, status, desconto, total, observacoes, aceite_em, created_at")
      .eq("id", link.orcamento_id)
      .eq("paciente_id", link.paciente_id)
      .maybeSingle();
    if (o) {
      const { data: itens } = await admin
        .from("orcamento_itens")
        .select("descricao, dente, quantidade, valor_unitario")
        .eq("orcamento_id", o.id)
        .order("id");
      orcamento = {
        status: o.status,
        desconto: Number(o.desconto) || 0,
        total: Number(o.total) || 0,
        observacoes: o.observacoes ?? "",
        aceiteEm: o.aceite_em,
        criadoEm: o.created_at,
        itens: (itens ?? []).map((it) => ({
          descricao: it.descricao,
          dente: it.dente ?? "",
          quantidade: it.quantidade,
          valorUnitario: Number(it.valor_unitario) || 0,
        })),
      };
    }
  }

  let anamnese = null;
  if (link.anamnese_id) {
    const { data: a } = await admin
      .from("anamneses")
      .select("id, respostas, data, status, assinatura, assinada_em, created_at")
      .eq("id", link.anamnese_id)
      .eq("paciente_id", link.paciente_id)
      .maybeSingle();
    if (a) {
      anamnese = {
        pacienteId: link.paciente_id,
        respostas: a.respostas ?? {},
        data: a.data ?? "",
        status: a.status ?? "",
        assinatura: a.assinatura ?? "",
        assinadaEm: a.assinada_em ?? undefined,
        criadoEm: a.created_at,
      };
    }
  }

  if (!link.aberto_em) {
    await admin.from("links_paciente").update({ aberto_em: new Date().toISOString() }).eq("id", link.id);
  }

  return NextResponse.json({ ...base, orcamento, anamnese });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!adminConfigurado()) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });
  const { token } = await params;
  const link = await carregarLink(token);
  if (!link) return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  if (link.concluido_em) return NextResponse.json({ error: "Este link já foi assinado." }, { status: 409 });
  if (new Date(link.expira_em).getTime() < Date.now()) {
    return NextResponse.json({ error: "Este link expirou. Peça um novo à clínica." }, { status: 410 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }

  const assinatura = typeof body.assinatura === "string" ? body.assinatura : "";
  if (!assinatura.startsWith("data:image/png;base64,") || assinatura.length > MAX_ASSINATURA) {
    return NextResponse.json({ error: "Assine no quadro antes de enviar." }, { status: 400 });
  }
  if (link.orcamento_id && body.aceitaOrcamento !== true) {
    return NextResponse.json({ error: "Marque que aceita o orçamento." }, { status: 400 });
  }
  if (link.anamnese_id && body.confirmaAnamnese !== true) {
    return NextResponse.json({ error: "Marque que confirma as informações da anamnese." }, { status: 400 });
  }

  // Fotos/redes sociais: escolha obrigatória, mas "não" é uma resposta válida
  // (consentimento livre — não condiciona o orçamento nem a anamnese).
  if (typeof body.autorizaImagem !== "boolean") {
    return NextResponse.json({ error: "Responda se autoriza fotos e divulgação nas redes sociais." }, { status: 400 });
  }
  const autorizaImagem = body.autorizaImagem;

  const admin = createAdminClient();
  const agora = new Date().toISOString();
  const ip = ipDe(req);

  // "Reserva" o link antes de mexer em qualquer coisa: dois envios simultâneos
  // (toque duplo, rede lenta) não podem aprovar o orçamento duas vezes.
  const { data: reservado } = await admin
    .from("links_paciente")
    .update({ concluido_em: agora })
    .eq("id", link.id)
    .is("concluido_em", null)
    .select("id");
  if (!reservado || reservado.length === 0) {
    return NextResponse.json({ error: "Este link já foi assinado." }, { status: 409 });
  }

  // Se aprovar o orçamento e depois falhar, volta o status: senão a nova tentativa
  // acharia "já aprovado" e não geraria os procedimentos.
  let desfazerOrc: { id: number; status: string } | null = null;
  try {
    // Anamnese primeiro: regravar a assinatura é inofensivo numa nova tentativa;
    // inserir procedimentos não é — por isso o orçamento fica por último.
    const { error: ei } = await admin
      .from("pacientes")
      .update({ autoriza_imagem: autorizaImagem, autoriza_imagem_em: agora })
      .eq("id", link.paciente_id);
    if (ei) throw ei;

    if (link.anamnese_id) {
      // A ficha tem o campo no rodapé (autorizacaoFoto): grava junto, mesclando
      // nas respostas que já existem.
      const { data: an } = await admin
        .from("anamneses")
        .select("respostas")
        .eq("id", link.anamnese_id)
        .eq("paciente_id", link.paciente_id)
        .single();
      const respostas = { ...((an?.respostas as Record<string, unknown>) ?? {}), autorizacaoFoto: autorizaImagem ? "sim" : "não" };
      const { error: ea } = await admin
        .from("anamneses")
        .update({ respostas, assinatura, assinada_em: agora, assinada_ip: ip, status: "Assinado" })
        .eq("id", link.anamnese_id)
        .eq("paciente_id", link.paciente_id);
      if (ea) throw ea;
    }
    if (link.orcamento_id) {
      const { data: o, error: eo } = await admin
        .from("orcamentos")
        .select("id, paciente_id, status")
        .eq("id", link.orcamento_id)
        .eq("paciente_id", link.paciente_id)
        .single();
      if (eo || !o) throw new Error("orçamento não encontrado");

      const jaAprovado = o.status === "aprovado";
      const { error: eu } = await admin
        .from("orcamentos")
        .update({
          aceite_assinatura: assinatura,
          aceite_em: agora,
          aceite_ip: ip,
          ...(jaAprovado ? {} : { status: "aprovado", aprovado_em: agora }),
        })
        .eq("id", o.id);
      if (eu) throw eu;
      if (!jaAprovado) desfazerOrc = { id: o.id, status: o.status };

      // Se a clínica já tinha aprovado no app, os procedimentos já existem.
      if (!jaAprovado) {
        const { data: itens } = await admin
          .from("orcamento_itens")
          .select("descricao, dente, quantidade, valor_unitario")
          .eq("orcamento_id", o.id)
          .order("id");
        const orc = {
          pacienteId: link.paciente_id,
          itens: (itens ?? []).map((it) => ({
            descricao: it.descricao,
            dente: it.dente ?? "",
            quantidade: it.quantidade,
            valorUnitario: Number(it.valor_unitario) || 0,
          })),
        } as Orcamento;
        // Sem usuário logado, o default clinica_atual() não resolve: carimba à mão.
        const procs = procedimentosDoOrcamento(orc, null).map((p) => ({ ...p, clinica_id: link.clinica_id }));
        if (procs.length) {
          const { error: ep } = await admin.from("procedimentos").insert(procs);
          if (ep) throw ep;
        }
      }
    }
  } catch (e) {
    console.error("[p/token] falha ao registrar assinatura:", e);
    if (desfazerOrc) {
      await admin
        .from("orcamentos")
        .update({ status: desfazerOrc.status, aprovado_em: null, aceite_assinatura: null, aceite_em: null, aceite_ip: null })
        .eq("id", desfazerOrc.id);
    }
    // Libera o link pra nova tentativa.
    await admin.from("links_paciente").update({ concluido_em: null }).eq("id", link.id);
    return NextResponse.json({ error: "Não foi possível registrar. Tente de novo." }, { status: 502 });
  }

  // Rastreabilidade (LGPD): quem assinou foi o paciente, pelo link.
  const detalhe = [
    link.orcamento_id && "orçamento aceito",
    link.anamnese_id && "anamnese assinada",
    `imagem/redes: ${autorizaImagem ? "autoriza" : "não autoriza"}`,
  ]
    .filter(Boolean)
    .join(" + ");
  await admin.from("auditoria").insert({
    clinica_id: link.clinica_id,
    usuario_id: null,
    usuario_nome: "Paciente (link)",
    acao: "edicao",
    entidade: "paciente",
    entidade_id: link.paciente_id,
    detalhe: `${detalhe} · IP ${ip ?? "?"}`,
  });

  return NextResponse.json({ ok: true, concluidoEm: agora });
}
