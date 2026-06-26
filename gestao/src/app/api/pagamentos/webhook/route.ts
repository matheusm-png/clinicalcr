import { NextResponse } from "next/server";
import { createAdminClient, adminConfigurado } from "@/lib/supabase/admin";
import { confirmarPagamento, type WebhookPagamento } from "@/lib/pagamentos/infinitepay";

// Webhook público da InfinitePay (sem login — a InfinitePay chama esta URL).
// NUNCA confiamos só no payload: revalidamos via payment_check antes de dar
// baixa. Usa o admin client (sem sessão de usuário). Responde 200 sempre,
// para a InfinitePay não reenviar em loop; só marca pago se confirmado.
export async function POST(req: Request) {
  if (!adminConfigurado()) return NextResponse.json({ ok: false }, { status: 200 });

  let body: WebhookPagamento;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 200 }); }

  const orderNsu = body.order_nsu;
  if (!orderNsu) return NextResponse.json({ ok: false }, { status: 200 });

  const admin = createAdminClient();

  // Localiza a parcela pelo order_nsu que enviamos (= id da parcela).
  const { data: parcela } = await admin
    .from("parcelas")
    .select("id, conta_id, pago, clinica_id")
    .eq("pagto_order_nsu", orderNsu)
    .maybeSingle();
  if (!parcela) return NextResponse.json({ ok: false }, { status: 200 });
  if (parcela.pago) return NextResponse.json({ ok: true, already: true }, { status: 200 });

  // Handle da clínica dona da parcela.
  const { data: clinica } = await admin
    .from("clinicas")
    .select("infinitepay_handle")
    .eq("id", parcela.clinica_id)
    .maybeSingle();
  const handle = clinica?.infinitepay_handle ?? "";
  if (!handle) return NextResponse.json({ ok: false }, { status: 200 });

  // Revalida server-to-server.
  const confirmado = await confirmarPagamento({
    handle,
    orderNsu,
    transactionNsu: body.transaction_nsu,
    slug: body.invoice_slug,
  });
  if (!confirmado) return NextResponse.json({ ok: false, confirmado: false }, { status: 200 });

  // Dá baixa na parcela.
  await admin
    .from("parcelas")
    .update({
      pago: true,
      pago_em: new Date().toISOString().split("T")[0],
      forma_pagamento: body.capture_method === "pix" ? "Pix (InfinitePay)" : "Cartão (InfinitePay)",
      pagto_slug: body.invoice_slug ?? null,
    })
    .eq("id", parcela.id);

  // Quita a conta se não restarem parcelas em aberto.
  const { data: pendentes } = await admin.from("parcelas").select("id").eq("conta_id", parcela.conta_id).eq("pago", false);
  if ((pendentes ?? []).length === 0) {
    await admin.from("contas_receber").update({ status: "quitada" }).eq("id", parcela.conta_id);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
