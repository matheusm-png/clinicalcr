"use client";

import { useEffect } from "react";

// Registra o service worker (PWA) no cliente. Silencioso em caso de falha.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
