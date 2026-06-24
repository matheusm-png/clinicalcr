"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  dentista: "Dentista",
  secretaria: "Secretária",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [userNome, setUserNome] = useState("");
  const [userPapel, setUserPapel] = useState("");

  useEffect(() => {
    // Check initial theme state on client
    const theme = localStorage.getItem("lcr-theme");
    const isDarkTheme = theme === "dark" || document.documentElement.getAttribute("data-theme") === "dark";
    setIsDark(isDarkTheme);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setUserNome("Modo demonstração");
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, papel")
        .eq("id", user.id)
        .maybeSingle();
      setUserNome(profile?.nome || user.email || "");
      setUserPapel(profile?.papel || "");
    })();
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.replace("/login");
    router.refresh();
  };

  // Fechar sidebar no mobile ao mudar de rota
  useEffect(() => {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
    }
  }, [pathname]);

  const toggleDark = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("lcr-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("lcr-theme", "light");
    }
  };

  const fecharMenu = () => {
    document.getElementById("sidebar")?.classList.remove("open");
  };

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
    <aside id="sidebar">
      <button
        className="sidebar-close-btn"
        onClick={fecharMenu}
        title="Fechar menu"
      >
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="sidebar-logo">
        <img
          src="/assets/logo-lcr.svg"
          alt="Clínica LCR"
          id="sidebar-logo-img"
          style={{ width: "110px", filter: "brightness(0) invert(1)", opacity: 0.95 }}
        />
        <div className="sidebar-subtitle">Gestão Odontológica</div>
      </div>
      <nav style={{ flex: 1 }}>
        <ul className="sidebar-nav">
          <li className="nav-group-label">Atendimento</li>
          <li>
            <Link href="/admin" className={isActive("/admin") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/admin/assistente" className={isActive("/admin/assistente") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M9 10h.01M13 10h.01M17 10h.01" />
              </svg>
              Assistente IA
            </Link>
          </li>
          <li>
            <Link href="/admin/agenda" className={isActive("/admin/agenda") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Agenda
            </Link>
          </li>
          <li>
            <Link href="/admin/pacientes" className={isActive("/admin/pacientes") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Pacientes
            </Link>
          </li>
          <li>
            <Link href="/admin/prontuario" className={isActive("/admin/prontuario") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M9 12h6M9 16h6M9 8h6M5 3h14a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2z" />
              </svg>
              Prontuário
            </Link>
          </li>
          <li>
            <Link href="/admin/retornos" className={isActive("/admin/retornos") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Retornos
            </Link>
          </li>
          <li>
            <Link href="/admin/orcamentos" className={isActive("/admin/orcamentos") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M9 14l2 2 4-4M5 3h14a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2z" />
              </svg>
              Orçamentos
            </Link>
          </li>

          <li className="nav-group-label">Gestão</li>
          <li>
            <Link href="/admin/catalogo" className={isActive("/admin/catalogo") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
              Catálogo
            </Link>
          </li>
          <li>
            <Link href="/admin/financeiro" className={isActive("/admin/financeiro") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Financeiro
            </Link>
          </li>
          <li>
            <Link href="/admin/receber" className={isActive("/admin/receber") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20M6 15h4" />
              </svg>
              A Receber
            </Link>
          </li>
          <li>
            <Link href="/admin/anamnese" className={isActive("/admin/anamnese") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 14l2 2 4-4" />
              </svg>
              Anamnese
            </Link>
          </li>
          <li>
            <Link href="/admin/estoque" className={isActive("/admin/estoque") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              Estoque
            </Link>
          </li>
          <li>
            <Link href="/admin/config" className={isActive("/admin/config") ? "active" : ""}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: "17px", height: "17px" }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Configurações
            </Link>
          </li>
        </ul>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <strong>{userNome || "Carregando..."}</strong>
          {PAPEL_LABEL[userPapel] || ""}
        </div>
        <button
          className="dark-toggle"
          onClick={handleLogout}
          title="Sair"
          style={{ marginRight: "4px" }}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
        <button className="dark-toggle" onClick={toggleDark} title="Alternar tema claro/escuro">
          {isDark ? (
            <svg id="icon-sun" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg id="icon-moon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </aside>
    <div id="sidebar-backdrop" onClick={fecharMenu} aria-hidden="true" />
    </>
  );
}
