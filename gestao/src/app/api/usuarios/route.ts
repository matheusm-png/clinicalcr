import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminConfigurado } from "@/lib/supabase/admin";

const PAPEIS = ["admin", "dentista", "secretaria"];

// Garante que o solicitante é admin; retorna {clinicaId} ou uma Response de erro.
async function exigirAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  if (!adminConfigurado()) return { erro: NextResponse.json({ error: "Admin não configurado no servidor." }, { status: 503 }) };

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("profiles").select("papel, clinica_id").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.papel !== "admin") {
    return { erro: NextResponse.json({ error: "Apenas administradores." }, { status: 403 }) };
  }
  return { clinicaId: perfil.clinica_id as number, admin };
}

// Criar usuário
export async function POST(req: Request) {
  const ctx = await exigirAdmin();
  if (ctx.erro) return ctx.erro;

  const { nome, email, senha, papel } = await req.json().catch(() => ({}));
  if (!email || !senha || !PAPEIS.includes(papel)) {
    return NextResponse.json({ error: "Informe email, senha e papel válido." }, { status: 400 });
  }
  if (String(senha).length < 6) {
    return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
  }

  const { admin, clinicaId } = ctx;
  const { data: created, error } = await admin.auth.admin.createUser({
    email: String(email).trim(),
    password: String(senha),
    email_confirm: true,
    user_metadata: { nome: nome || email },
  });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message || "Falha ao criar usuário." }, { status: 400 });
  }

  // Vincula à clínica do admin + define papel/nome (o trigger criou o profile).
  const { error: e2 } = await admin
    .from("profiles")
    .update({ clinica_id: clinicaId, papel, nome: nome || email })
    .eq("id", created.user.id);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: created.user.id });
}

// Alterar papel de um usuário da clínica
export async function PATCH(req: Request) {
  const ctx = await exigirAdmin();
  if (ctx.erro) return ctx.erro;

  const { id, papel } = await req.json().catch(() => ({}));
  if (!id || !PAPEIS.includes(papel)) {
    return NextResponse.json({ error: "Informe id e papel válido." }, { status: 400 });
  }
  const { admin, clinicaId } = ctx;
  // Só altera se o alvo for da mesma clínica.
  const { data: alvo } = await admin.from("profiles").select("clinica_id").eq("id", id).maybeSingle();
  if (!alvo || alvo.clinica_id !== clinicaId) {
    return NextResponse.json({ error: "Usuário não encontrado nesta clínica." }, { status: 404 });
  }
  const { error } = await admin.from("profiles").update({ papel }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
