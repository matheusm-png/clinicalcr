"use client";

import { ReactNode } from "react";

interface TopbarProps {
  title: string;
  children?: ReactNode;
}

export default function Topbar({ title, children }: TopbarProps) {
  const toggleSidebar = () => {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.classList.toggle("open");
    }
  };

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center" }}>
        <button className="mobile-menu-btn" onClick={toggleSidebar} title="Abrir menu">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        {children}
        <div className="avatar">LC</div>
      </div>
    </header>
  );
}
