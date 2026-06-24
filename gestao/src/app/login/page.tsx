"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (!isSupabaseConfigured()) {
      // Sem backend ainda — entra direto no painel (modo demonstração).
      router.replace("/admin");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      setErro("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    // Sessão criada — proxy.ts cuida do redirect, mas empurramos já.
    router.replace("/admin");
    router.refresh();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "24px",
      }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: "380px", padding: "32px" }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <img
            src="/assets/logo-lcr.svg"
            alt="Clínica LCR"
            style={{ width: "120px", margin: "0 auto 12px" }}
          />
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            Gestão Odontológica
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              className="form-control"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {erro && (
            <div
              style={{
                color: "var(--danger)",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              {erro}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
