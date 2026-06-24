"use client";

import React from "react";
import { Procedimento } from "@/lib/types";

const DENTES_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const DENTES_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ANTERIORES = new Set([13, 12, 11, 21, 22, 23, 43, 42, 41, 31, 32, 33]);

const STATE_COLORS = {
  "a-realizar": { fill: "#3B82F6", stroke: "#2563EB" },
  realizado: { fill: "#22C55E", stroke: "#16A34A" },
  "pre-existente": { fill: "#F59E0B", stroke: "#D97706" },
  normal: { fill: "none", stroke: "var(--text-muted)" },
};

const PROC_VISUALS: Record<string, { color: string }> = {
  Restauração: { color: "#3B82F6" },
  Extração: { color: "#EF4444" },
  Canal: { color: "#F59E0B" },
  Implante: { color: "#475569" },
  Ortodontia: { color: "#8B5CF6" },
  Prótese: { color: "#10B981" },
  Clareamento: { color: "#6ee7b7" },
};

interface OdontogramaProps {
  procedimentos: Procedimento[];
  selectedTeeth: Set<string>;
  onSelectTeeth: (teeth: Set<string>) => void;
  onDenteClick: (num: string, hasProcs: boolean) => void;
}

export default function Odontograma({
  procedimentos,
  selectedTeeth,
  onSelectTeeth,
  onDenteClick,
}: OdontogramaProps) {
  // Indexar procedimentos por dente
  const denteProcs: Record<string, Procedimento[]> = {};
  procedimentos.forEach((p) => {
    if (p.dente) {
      const dentes = p.dente.toString().split(",").map((d) => d.trim());
      dentes.forEach((d) => {
        if (!denteProcs[d]) denteProcs[d] = [];
        denteProcs[d].push(p);
      });
    }
  });

  const handleDenteClick = (num: string, event: React.MouseEvent) => {
    const numStr = num.toString();
    const hasProcs = !!denteProcs[numStr] && denteProcs[numStr].length > 0;

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const newSelected = new Set(selectedTeeth);
      if (newSelected.has(numStr)) {
        newSelected.delete(numStr);
      } else {
        newSelected.add(numStr);
      }
      onSelectTeeth(newSelected);
    } else {
      onDenteClick(numStr, hasProcs);
    }
  };

  const renderDenteSVG = (num: number) => {
    const numStr = num.toString();
    const procs = denteProcs[numStr] || [];
    const isSelected = selectedTeeth.has(numStr);

    let baseColor = "var(--text-muted)";
    let fillOpacity = "0";
    const strokeW = "1.6";
    const isProtese = procs.some((p) => p.procedimento === "Prótese");

    if (procs.length > 0) {
      const last = procs[procs.length - 1];
      const s = STATE_COLORS[last.status as keyof typeof STATE_COLORS] || STATE_COLORS.normal;
      baseColor = s.stroke;
      fillOpacity = "0.1";
    }

    if (isProtese) fillOpacity = "0.5";

    let overlays = "";
    procs.forEach((p) => {
      const theme = PROC_VISUALS[p.procedimento] || { color: baseColor };
      const color = STATE_COLORS[p.status as keyof typeof STATE_COLORS]?.stroke || theme.color;

      if (p.procedimento === "Extração") {
        overlays += `<path d="M5,5 L20,30 M20,5 L5,30" stroke="${color}" stroke-width="3" stroke-linecap="round" />`;
      } else if (p.procedimento === "Ortodontia") {
        overlays += `<rect x="8" y="12" width="12" height="8" rx="1" fill="${color}" fill-opacity="0.8" />`;
        overlays += `<line x1="0" y1="16" x2="28" y2="16" stroke="${color}" stroke-width="1.5" opacity="0.6" />`;
      } else if (p.procedimento === "Implante") {
        overlays += `<path d="M12,22 L16,22 L14,32 Z M10,24 L18,24 M11,27 L17,27 M12,30 L16,30" stroke="${color}" fill="${color}" stroke-width="1" />`;
      } else if (p.procedimento === "Canal") {
        overlays += `<path d="M14,15 L14,30" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />`;
      } else if (p.procedimento === "Restauração") {
        overlays += `<circle cx="14" cy="14" r="5" fill="${color}" fill-opacity="0.6" stroke="${color}" stroke-width="1" />`;
      }
    });

    const isAnterior = ANTERIORES.has(num);

    return (
      <div
        key={num}
        className={`dente-wrap ${isSelected ? "selected" : ""}`}
        onClick={(e) => handleDenteClick(numStr, e)}
        title={`Dente ${numStr}`}
        style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}
      >
        <div className="dente-num" style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-muted)" }}>
          {numStr}
        </div>
        {isAnterior ? (
          <svg className="dente-svg" width="22" height="34" viewBox="0 0 22 34">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11,2.5 C8.5,2.5 6,4 5.5,7.5 C5,11 5.5,17 7,22.5 C8,26.5 9.5,30 11,33 C12.5,30 14,26.5 15,22.5 C16.5,17 17,11 16.5,7.5 C16,4 13.5,2.5 11,2.5Z"
              fill={baseColor}
              fillOpacity={fillOpacity}
              stroke={baseColor}
              strokeWidth={strokeW}
            />
            <g className="overlays" transform="translate(-3,0)" dangerouslySetInnerHTML={{ __html: overlays }} />
          </svg>
        ) : (
          <svg className="dente-svg" width="28" height="34" viewBox="0 0 28 34">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5,11 C4.5,7.5 6.5,4.5 9.5,4 C10,3.5 10.5,3 11.2,3 C11.6,2.4 12,2.4 12.5,2.5 C13,2.4 13.4,2.4 13.8,3 C14.5,3 15,3.5 15.5,4 C18.5,4.5 20.5,7.5 20.5,11 C21,17.5 19.5,24.5 18,28.5 C17,31 15.5,33 14.5,33.5 L10.5,33.5 C9.5,33 8,31 7,28.5 C5.5,24.5 4,17.5 4.5,11Z"
              fill={baseColor}
              fillOpacity={fillOpacity}
              stroke={baseColor}
              strokeWidth={strokeW}
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.5,4 C10.5,2 11.2,1.5 12.5,1.5 C13.8,1.5 14.5,2 15.5,4"
              fill="none"
              stroke={baseColor}
              strokeWidth="1.2"
              opacity="0.6"
            />
            <g className="overlays" dangerouslySetInnerHTML={{ __html: overlays }} />
          </svg>
        )}
      </div>
    );
  };

  return (
    <div
      id="odontograma"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        padding: "30px",
        background: "var(--bg2)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="odonto-row" style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        {DENTES_SUPERIOR.map((n) => renderDenteSVG(n))}
      </div>
      <div className="odonto-row bottom" style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "20px" }}>
        {DENTES_INFERIOR.map((n) => renderDenteSVG(n))}
      </div>
    </div>
  );
}
