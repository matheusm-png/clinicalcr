// Reduz a foto no navegador antes de enviar: redimensiona (máx. lado) e converte
// para JPEG. Resolve o limite de ~4,5MB de upload da Vercel E o HEIC do iPhone
// (o canvas decodifica e reexporta como JPEG). Se algo falhar, envia o original.
export async function comprimirImagem(file: File, maxLado = 2200, quality = 0.72): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    img.decoding = "async";
    img.src = url;
    await img.decode();
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) return file;
    const escala = Math.min(1, maxLado / Math.max(w, h));
    w = Math.round(w * escala);
    h = Math.round(h * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
