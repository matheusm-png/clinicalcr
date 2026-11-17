"use client";

import { Anamnese } from "@/lib/types";
import AnaliseRiscoIA from "@/components/AnaliseRiscoIA";
import AnamneseFicha from "@/components/AnamneseFicha";

export default function AnamneseViewModal({
  anamnese,
  pacienteNome,
  onClose,
  onEditar,
}: {
  anamnese: Anamnese;
  pacienteNome?: string;
  onClose: () => void;
  onEditar?: () => void;
}) {
  const nome = pacienteNome || anamnese.pacienteNome;

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Anamnese{nome ? ` — ${nome}` : ""}</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <AnamneseFicha anamnese={anamnese} />
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <AnaliseRiscoIA respostas={anamnese.respostas} pacienteNome={nome} />
          <div style={{ display: "flex", gap: 8 }}>
            {onEditar && (
              <button className="btn btn-outline" onClick={onEditar}>Editar</button>
            )}
            <button className="btn btn-primary" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
