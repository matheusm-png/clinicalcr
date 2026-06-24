"use client";

import { useImperativeHandle, useRef, useState, forwardRef } from "react";

export interface SignaturePadHandle {
  toDataURL: () => string | null; // null se vazio
  clear: () => void;
  isEmpty: () => boolean;
}

/** Campo de assinatura por traço (mouse/touch). Mesmo padrão da anamnese. */
const SignaturePad = forwardRef<SignaturePadHandle, { width?: number; height?: number }>(
  function SignaturePad({ width = 460, height = 150 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [drawing, setDrawing] = useState(false);
    const [assinou, setAssinou] = useState(false);
    const last = useRef({ x: 0, y: 0 });

    const pos = (e: React.MouseEvent | React.TouchEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
      // corrige a escala entre o tamanho CSS e a resolução do canvas
      const sx = canvasRef.current!.width / rect.width;
      const sy = canvasRef.current!.height / rect.height;
      return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
    };

    const start = (e: React.MouseEvent | React.TouchEvent) => {
      last.current = pos(e);
      setDrawing(true);
      setAssinou(true);
    };
    const move = (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      const p = pos(e);
      ctx.strokeStyle = "#142020";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
    };
    const stop = () => setDrawing(false);

    useImperativeHandle(ref, () => ({
      toDataURL: () => (assinou && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null),
      clear: () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setAssinou(false);
      },
      isEmpty: () => !assinou,
    }));

    return (
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={stop}
          style={{
            width: "100%",
            height,
            border: "1px dashed var(--border)",
            borderRadius: 8,
            background: "var(--bg2)",
            touchAction: "none",
            cursor: "crosshair",
            display: "block",
          }}
        />
        {!assinou && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              pointerEvents: "none",
            }}
          >
            Assine aqui (mouse ou toque)
          </span>
        )}
      </div>
    );
  },
);

export default SignaturePad;
