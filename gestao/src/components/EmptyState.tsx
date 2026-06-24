import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}

const defaultIcon = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0-2.5 5a2 2 0 0 1-1.8 1.1H8.3A2 2 0 0 1 6.5 18L4 13m16 0h-4.2a2 2 0 0 0-1.8 1.1l-.5 1a1 1 0 0 1-.9.6h-1.2a1 1 0 0 1-.9-.6l-.5-1A2 2 0 0 0 8.2 13H4" />
  </svg>
);

/** Estado vazio padronizado: ícone em círculo + título + dica + ação opcional. */
export default function EmptyState({ icon, title, hint, action, compact }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: compact ? "28px 16px" : "44px 20px",
        textAlign: "center",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--primary-light)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon ?? defaultIcon}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>{title}</div>
      {hint && <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 300 }}>{hint}</div>}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
