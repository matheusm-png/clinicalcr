// Service worker mínimo da Clínica LCR (PWA).
// Cacheia APENAS assets estáticos (sem dados de paciente — LGPD). A presença
// de um handler de fetch também satisfaz a instalabilidade do PWA.
const CACHE = "lcr-static-v1";
const STATIC = /\/(_next\/static|icon-|apple-touch-icon|assets)\//;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Só intercepta assets estáticos da própria origem (stale-while-revalidate).
  if (url.origin === self.location.origin && STATIC.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
  // Demais requests (páginas, API, dados): deixa o navegador tratar (rede).
});
