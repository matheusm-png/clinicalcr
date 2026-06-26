import type { MetadataRoute } from "next";

// PWA: torna o app instalável no celular (tela inicial, standalone).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clínica LCR — Gestão",
    short_name: "Clínica LCR",
    description: "Sistema de gestão odontológica da Clínica LCR",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EBF4F4",
    theme_color: "#1A7070",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
