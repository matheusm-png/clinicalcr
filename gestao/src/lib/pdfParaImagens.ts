// Converte um PDF (ficha escaneada) em imagens JPEG, uma por página, no navegador.
// Assim fichas digitalizadas na impressora/scanner entram na mesma fila das fotos.
// O pdf.js é carregado só quando precisa (import dinâmico) e o worker é servido
// de /public (copiado de node_modules/pdfjs-dist/build/pdf.worker.min.mjs —
// ao atualizar o pdfjs-dist, copie o worker de novo).
export async function pdfParaImagens(file: File, maxLado = 2200, quality = 0.75, maxPaginas = 8): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const blobs: Blob[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPaginas); n++) {
      const pagina = await doc.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const escala = maxLado / Math.max(base.width, base.height);
      const vp = pagina.getViewport({ scale: escala });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.fillStyle = "#fff"; // PDFs sem fundo viram preto no JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (blob) blobs.push(blob);
      pagina.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return blobs;
}
