import { createClient } from "@supabase/supabase-js";

// Cliente Supabase ADMIN — usa a service/secret key. USO EXCLUSIVO NO SERVIDOR.
// Bypassa RLS. NUNCA importar em código que vá pro cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY não configurada no servidor.");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function adminConfigurado(): boolean {
  return !!process.env.SUPABASE_SECRET_KEY;
}
