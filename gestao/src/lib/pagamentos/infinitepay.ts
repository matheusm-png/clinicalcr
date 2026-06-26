// ============================================================
// InfinitePay — Checkout Integrado (S9, link de pagamento online).
// Cliente HTTP enxuto, SEM SDK. USO EXCLUSIVO NO SERVIDOR.
//
// API (docs.infinitepay.io / ajuda.infinitepay.io):
//   POST https://api.checkout.infinitepay.io/links         → cria link
//   POST https://api.checkout.infinitepay.io/payment_check → valida pagamento
//
// A única credencial é o `handle` (InfiniteTag, sem o "$"). Não há secret key
// na criação do link → a CONFIRMAÇÃO do pagamento NUNCA confia só no webhook:
// sempre revalida via payment_check (server-to-server) antes de dar baixa.
//
// MOCK-AWARE: sem handle configurado, `criarLink` devolve um link de
// demonstração e não chama a rede — permite testar o fluxo sem conta real.
// ============================================================

const BASE = "https://api.checkout.infinitepay.io";

export type CaptureMethod = "pix" | "credit_card";

export interface ItemPagamento {
  quantity: number;
  price: number; // EM CENTAVOS
  description: string;
}

export interface CriarLinkParams {
  handle: string;
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
  items: ItemPagamento[];
  customer?: { name?: string; email?: string; phone_number?: string };
}

export interface LinkCriado {
  url: string;
  mock: boolean;
}

export interface WebhookPagamento {
  invoice_slug?: string;
  order_nsu?: string;
  transaction_nsu?: string;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: CaptureMethod;
  receipt_url?: string;
  items?: ItemPagamento[];
}

// Há credencial real configurada?
export function infinitepayConfigurado(handle?: string): boolean {
  return !!(handle && handle.trim());
}

// Normaliza a InfiniteTag: tira "$", espaços e "@".
export function normalizarHandle(h?: string): string {
  return (h || "").trim().replace(/^[$@]+/, "");
}

// Cria um link de pagamento. Reais → centavos é responsabilidade do chamador.
export async function criarLink(p: CriarLinkParams): Promise<LinkCriado> {
  const handle = normalizarHandle(p.handle);

  // Modo demonstração: sem handle, devolve um link fake (não cobra nada).
  if (!handle) {
    return { url: `https://checkout.infinitepay.com.br/demo?nsu=${encodeURIComponent(p.orderNsu)}`, mock: true };
  }

  const res = await fetch(`${BASE}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle,
      order_nsu: p.orderNsu,
      redirect_url: p.redirectUrl,
      webhook_url: p.webhookUrl,
      items: p.items,
      ...(p.customer ? { customer: p.customer } : {}),
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`InfinitePay /links ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("InfinitePay não retornou a URL do link.");
  return { url: data.url, mock: false };
}

// Revalida um pagamento server-to-server (chamado ao receber o webhook).
// Retorna true se a InfinitePay confirma que o pedido está pago.
export async function confirmarPagamento(args: {
  handle: string;
  orderNsu: string;
  transactionNsu?: string;
  slug?: string;
}): Promise<boolean> {
  const handle = normalizarHandle(args.handle);
  if (!handle) return false;

  const res = await fetch(`${BASE}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle,
      order_nsu: args.orderNsu,
      transaction_nsu: args.transactionNsu,
      slug: args.slug,
    }),
  });
  if (!res.ok) return false;
  const data = (await res.json().catch(() => ({}))) as { paid?: boolean; success?: boolean; status?: string };
  // A API sinaliza sucesso por `paid`/`success`/`status` conforme o pedido —
  // aceitamos qualquer indicação afirmativa.
  return data.paid === true || data.success === true || data.status === "paid" || data.status === "success";
}
