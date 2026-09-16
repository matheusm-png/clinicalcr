"use client";

import React from "react";
import { Face, ehSuperior, letraFace, mesialADireita, nomeFace } from "@/lib/faces";

// O quadradinho de 5 faces do odontograma de papel: centro = oclusal/incisal,
// e as quatro bordas = vestibular, lingual/palatina, mesial e distal.
// A posição de cada face depende do dente, como no papel:
//   · superiores: vestibular em cima;  inferiores: vestibular embaixo
//   · lado direito do paciente (à esquerda da tela): mesial à direita
// Cervical não tem região própria no quadrado: vira uma faixa por fora,
// do lado vestibular.

type Lado = "top" | "bottom" | "left" | "right";

function ladoDaFace(face: Face, dente: string): Lado | "center" | null {
  const sup = ehSuperior(dente);
  const mDir = mesialADireita(dente);
  switch (face) {
    case "O": return "center";
    case "V": return sup ? "top" : "bottom";
    case "L": return sup ? "bottom" : "top";
    case "M": return mDir ? "right" : "left";
    case "D": return mDir ? "left" : "right";
    default: return null;
  }
}

interface Props {
  dente: string;
  faces: Face[];
  size?: number;
  cor?: string;
  cores?: Partial<Record<Face, string>>; // cor por face (odontograma: cor do status)
  onToggle?: (face: Face) => void; // presente = clicável
  mostrarLetras?: boolean;
}

export default function FacesDente({ dente, faces, size = 20, cor = "#3B82F6", cores, onToggle, mostrarLetras }: Props) {
  const S = 100;
  const a = 32; // borda do quadrado interno
  const b = S - a;
  const pad = onToggle ? 22 : 14; // espaço para a faixa cervical (mais alta quando é clicável)
  const ativo = (f: Face) => faces.includes(f);
  const corDe = (f: Face) => cores?.[f] ?? cor;
  const clicavel = !!onToggle;

  const regioes: Record<Lado | "center", string> = {
    top: `0,0 ${S},0 ${b},${a} ${a},${a}`,
    bottom: `${a},${b} ${b},${b} ${S},${S} 0,${S}`,
    left: `0,0 ${a},${a} ${a},${b} 0,${S}`,
    right: `${S},0 ${S},${S} ${b},${b} ${b},${a}`,
    center: `${a},${a} ${b},${a} ${b},${b} ${a},${b}`,
  };
  const centroLetra: Record<Lado | "center", [number, number]> = {
    top: [50, 18], bottom: [50, 84], left: [16, 51], right: [84, 51], center: [50, 51],
  };

  const vestEmCima = ehSuperior(dente);
  const cervical = vestEmCima
    ? { x: 0, y: -pad, w: S, h: pad - 4 }
    : { x: 0, y: S + 4, w: S, h: pad - 4 };

  const faces5: Face[] = ["O", "V", "L", "M", "D"];
  const altura = size * ((S + pad) / S);

  return (
    <svg
      width={size}
      height={altura}
      viewBox={vestEmCima ? `-2 ${-pad} ${S + 4} ${S + pad + 2}` : `-2 -2 ${S + 4} ${S + pad + 2}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {faces5.map((f) => {
        const lado = ladoDaFace(f, dente)!;
        const on = ativo(f);
        return (
          <g key={f} onClick={clicavel ? (e) => { e.stopPropagation(); onToggle!(f); } : undefined} style={{ cursor: clicavel ? "pointer" : undefined }}>
            <title>{nomeFace(f, dente)}</title>
            <polygon
              points={regioes[lado]}
              fill={on ? corDe(f) : clicavel ? "var(--bg, #fff)" : "none"}
              fillOpacity={on ? 0.85 : 1}
              stroke="var(--text-muted)"
              strokeWidth={clicavel ? 2 : 5}
              strokeLinejoin="round"
            />
            {mostrarLetras && (
              <text
                x={centroLetra[lado][0]}
                y={centroLetra[lado][1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={lado === "center" ? 20 : 15}
                fontWeight={700}
                fill={on ? "#fff" : "var(--text-muted)"}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {letraFace(f, dente)}
              </text>
            )}
          </g>
        );
      })}
      {(clicavel || ativo("C")) && (
        <g onClick={clicavel ? (e) => { e.stopPropagation(); onToggle!("C"); } : undefined} style={{ cursor: clicavel ? "pointer" : undefined }}>
          <title>Cervical</title>
          <rect
            x={cervical.x}
            y={cervical.y}
            width={cervical.w}
            height={cervical.h}
            rx={3}
            fill={ativo("C") ? corDe("C") : "transparent"}
            stroke={clicavel ? "var(--text-muted)" : "none"}
            strokeWidth={2}
            strokeDasharray={ativo("C") ? undefined : "6 4"}
          />
        </g>
      )}
    </svg>
  );
}
