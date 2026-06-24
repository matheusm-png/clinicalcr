"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

interface ConfirmState {
  msg: string;
  okLabel: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}

interface ConfirmOpts {
  okLabel?: string;
  danger?: boolean;
}

interface ToastCtx {
  showToast: (msg: string, type?: ToastType) => void;
  confirm: (msg: string, opts?: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return c;
}

const COLORS: Record<ToastType, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  info: "var(--info)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (msg: string, type: ToastType = "info") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg, type }]);
      setTimeout(() => remove(id), 3800);
    },
    [remove],
  );

  const confirm = useCallback(
    (msg: string, opts?: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({
          msg,
          okLabel: opts?.okLabel ?? "Confirmar",
          danger: opts?.danger ?? false,
          resolve,
        });
      }),
    [],
  );

  const closeConfirm = (val: boolean) => {
    confirmState?.resolve(val);
    setConfirmState(null);
  };

  return (
    <Ctx.Provider value={{ showToast, confirm }}>
      {children}

      {/* Toasts */}
      <div
        style={{
          position: "fixed",
          zIndex: 400,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          top: "max(16px, env(safe-area-inset-top))",
          right: 16,
          left: "auto",
          maxWidth: "min(360px, calc(100vw - 32px))",
          pointerEvents: "none",
        }}
        className="toast-stack"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
              background: "var(--card)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderLeft: `4px solid ${COLORS[t.type]}`,
              borderRadius: 10,
              padding: "12px 16px",
              boxShadow: "var(--shadow-md)",
              fontSize: 13.5,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 10,
              animation: "toastIn .25s ease",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS[t.type],
                flexShrink: 0,
              }}
            />
            {t.msg}
          </div>
        ))}
      </div>

      {/* Confirm dialog — reaproveita as classes de modal já existentes */}
      {confirmState && (
        <div className="modal-overlay open" onClick={() => closeConfirm(false)}>
          <div
            className="modal"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-title">Confirmar</span>
              <button className="modal-close" onClick={() => closeConfirm(false)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: 14, lineHeight: 1.5 }}>
              {confirmState.msg}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => closeConfirm(false)}>
                Cancelar
              </button>
              <button
                className={`btn ${confirmState.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.okLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes toastIn { from { transform: translateX(16px); opacity: 0 } to { transform: none; opacity: 1 } }
        @media (max-width: 768px) {
          .toast-stack { top: auto !important; bottom: max(16px, env(safe-area-inset-bottom)) !important; left: 16px !important; right: 16px !important; max-width: none !important; }
        }
      `}</style>
    </Ctx.Provider>
  );
}
