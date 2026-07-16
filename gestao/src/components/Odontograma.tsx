"use client";

import React, { useRef, useState } from "react";
import { Procedimento } from "@/lib/types";

const DENTES_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const DENTES_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ANTERIORES = new Set([13, 12, 11, 21, 22, 23, 43, 42, 41, 31, 32, 33]);

// Sextantes (divisão padrão da boca em 6 grupos) — alguns procedimentos
// (profilaxia, raspagem) são lançados por sextante inteiro.
const SEXTANTES: { id: string; label: string; teeth: number[] }[] = [
  { id: "S1", label: "Sup. dir.", teeth: [18, 17, 16, 15, 14] },
  { id: "S2", label: "Sup. ant.", teeth: [13, 12, 11, 21, 22, 23] },
  { id: "S3", label: "Sup. esq.", teeth: [24, 25, 26, 27, 28] },
  { id: "S4", label: "Inf. esq.", teeth: [34, 35, 36, 37, 38] },
  { id: "S5", label: "Inf. ant.", teeth: [43, 42, 41, 31, 32, 33] },
  { id: "S6", label: "Inf. dir.", teeth: [44, 45, 46, 47, 48] },
];

const STATE_COLORS = {
  "a-realizar": { fill: "#3B82F6", stroke: "#2563EB" },
  realizado: { fill: "#22C55E", stroke: "#16A34A" },
  "pre-existente": { fill: "#F59E0B", stroke: "#D97706" },
  normal: { fill: "none", stroke: "var(--text-muted)" },
};

// Categoria visual por palavra-chave no nome do procedimento (o catálogo tem ~66
// nomes descritivos; o casamento por keyword faz a maioria desenhar algo).
// NOTA: os símbolos/cores definitivos por procedimento serão ajustados quando a
// Mila enviar a lista completa de procedimentos + valores.
type CatVisual = "restauracao" | "extracao" | "canal" | "implante" | "ortodontia" | "protese" | "clareamento" | "";
const CAT_COLOR: Record<Exclude<CatVisual, "">, string> = {
  restauracao: "#3B82F6",
  extracao: "#EF4444",
  canal: "#F59E0B",
  implante: "#475569",
  ortodontia: "#8B5CF6",
  protese: "#10B981",
  clareamento: "#6ee7b7",
};
function catProc(nome: string): CatVisual {
  const n = (nome || "").toLowerCase();
  if (/(exodontia|extra[çc][aã]o|extrair|extra[íi]d)/.test(n)) return "extracao";
  if (/(canal|endodon|pulpar|pulpotomia)/.test(n)) return "canal";
  if (/(implante|implantod)/.test(n)) return "implante";
  if (/(ortodon|aparelho|bracket|contenç)/.test(n)) return "ortodontia";
  if (/(restaura|resina|am[aá]lgama|f[aá]ceta|sela)/.test(n)) return "restauracao";
  if (/(coroa|pr[óo]tese|prot[eé]tic|onlay|inlay|piv[oô]|pino|bloco)/.test(n)) return "protese";
  if (/(clareamento|clarea)/.test(n)) return "clareamento";
  return "";
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Estado do arraste (marquee). moved evita disparar o clique do dente após arrastar.
  const dragRef = useRef<{ startX: number; startY: number; additive: boolean; base: Set<string> } | null>(null);
  const movedRef = useRef(false);

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
    // Se acabou de arrastar, ignora o clique.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const numStr = num.toString();
    const hasProcs = !!denteProcs[numStr] && denteProcs[numStr].length > 0;

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const newSelected = new Set(selectedTeeth);
      if (newSelected.has(numStr)) newSelected.delete(numStr);
      else newSelected.add(numStr);
      onSelectTeeth(newSelected);
    } else {
      onDenteClick(numStr, hasProcs);
    }
  };

  // ── Seleção por arraste (marquee) ────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const isDente = (e.target as HTMLElement).closest(".dente-wrap");
    if (!additive && !isDente) onSelectTeeth(new Set());
    dragRef.current = {
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      additive,
      base: new Set(selectedTeeth),
    };
    movedRef.current = false;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    const el = containerRef.current;
    if (!drag || !el) return;
    const rect = el.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const w = Math.abs(curX - drag.startX);
    const h = Math.abs(curY - drag.startY);
    if (w <= 5 && h <= 5) return;

    movedRef.current = true;
    const left = Math.min(drag.startX, curX);
    const top = Math.min(drag.startY, curY);
    setMarquee({ x: left, y: top, w, h });

    const mRect = { left: rect.left + left, top: rect.top + top, right: rect.left + left + w, bottom: rect.top + top + h };
    const hits = new Set<string>(drag.additive ? drag.base : []);
    el.querySelectorAll<HTMLElement>(".dente-wrap").forEach((d) => {
      const dr = d.getBoundingClientRect();
      const overlap = !(mRect.right < dr.left || mRect.left > dr.right || mRect.bottom < dr.top || mRect.top > dr.bottom);
      if (overlap && d.dataset.num) hits.add(d.dataset.num);
    });
    onSelectTeeth(hits);
  };

  const endDrag = () => {
    dragRef.current = null;
    setMarquee(null);
  };

  // ── Sextante: alterna o grupo inteiro na seleção ─────────────
  const toggleSextante = (teeth: number[]) => {
    const nums = teeth.map(String);
    const todosSelecionados = nums.every((n) => selectedTeeth.has(n));
    const next = new Set(selectedTeeth);
    if (todosSelecionados) nums.forEach((n) => next.delete(n));
    else nums.forEach((n) => next.add(n));
    onSelectTeeth(next);
  };

  const renderDenteSVG = (num: number) => {
    const numStr = num.toString();
    const procs = denteProcs[numStr] || [];
    const isSelected = selectedTeeth.has(numStr);

    let baseColor = "var(--text-muted)";
    let fillOpacity = "0";
    const strokeW = "1.6";
    const isProtese = procs.some((p) => catProc(p.procedimento) === "protese");

    if (procs.length > 0) {
      const last = procs[procs.length - 1];
      const s = STATE_COLORS[last.status as keyof typeof STATE_COLORS] || STATE_COLORS.normal;
      baseColor = s.stroke;
      fillOpacity = "0.1";
    }

    if (isProtese) fillOpacity = "0.5";

    let overlays = "";
    procs.forEach((p) => {
      const cat = catProc(p.procedimento);
      const color = STATE_COLORS[p.status as keyof typeof STATE_COLORS]?.stroke || (cat ? CAT_COLOR[cat] : baseColor);

      if (cat === "extracao") {
        overlays += `<path d="M5,5 L20,30 M20,5 L5,30" stroke="${color}" stroke-width="3" stroke-linecap="round" />`;
      } else if (cat === "ortodontia") {
        overlays += `<rect x="8" y="12" width="12" height="8" rx="1" fill="${color}" fill-opacity="0.8" />`;
        overlays += `<line x1="0" y1="16" x2="28" y2="16" stroke="${color}" stroke-width="1.5" opacity="0.6" />`;
      } else if (cat === "implante") {
        overlays += `<path d="M12,22 L16,22 L14,32 Z M10,24 L18,24 M11,27 L17,27 M12,30 L16,30" stroke="${color}" fill="${color}" stroke-width="1" />`;
      } else if (cat === "canal") {
        overlays += `<path d="M14,15 L14,30" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />`;
      } else if (cat === "restauracao") {
        overlays += `<circle cx="14" cy="14" r="5" fill="${color}" fill-opacity="0.6" stroke="${color}" stroke-width="1" />`;
      } else if (cat === "clareamento") {
        overlays += `<circle cx="14" cy="16" r="7" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.7" />`;
      }
    });

    const isAnterior = ANTERIORES.has(num);

    return (
      <div
        key={num}
        data-num={numStr}
        className={`dente-wrap ${isSelected ? "selected" : ""}`}
        onClick={(e) => handleDenteClick(numStr, e)}
        title={`Dente ${numStr}`}
        style={{
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          borderRadius: 4,
          padding: "2px",
          background: isSelected ? "var(--primary-light)" : "transparent",
          outline: isSelected ? "2px solid var(--primary)" : "none",
        }}
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
    <div>
      {/* Barra de sextantes */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 2 }}>Selecionar sextante:</span>
        {SEXTANTES.map((s) => {
          const ativo = s.teeth.map(String).every((n) => selectedTeeth.has(n));
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSextante(s.teeth)}
              title={`${s.label} (${s.teeth.join(", ")})`}
              style={{
                fontSize: 11,
                padding: "3px 9px",
                borderRadius: 4,
                border: `1px solid ${ativo ? "var(--primary)" : "var(--border-solid, var(--border))"}`,
                background: ativo ? "var(--primary-light)" : "transparent",
                color: ativo ? "var(--primary-darker)" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {s.id} <span style={{ fontWeight: 400 }}>· {s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Odontograma (com marquee de seleção) */}
      <div
        ref={containerRef}
        id="odontograma"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          padding: "30px",
          background: "var(--bg2)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          userSelect: "none",
        }}
      >
        <div className="odonto-row" style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          {DENTES_SUPERIOR.map((n) => renderDenteSVG(n))}
        </div>
        <div className="odonto-row bottom" style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "20px" }}>
          {DENTES_INFERIOR.map((n) => renderDenteSVG(n))}
        </div>

        {marquee && (
          <div
            style={{
              position: "absolute",
              left: marquee.x,
              top: marquee.y,
              width: marquee.w,
              height: marquee.h,
              border: "1px solid var(--primary)",
              background: "rgba(20,112,112,0.12)",
              borderRadius: 2,
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        )}
      </div>
    </div>
  );
}
