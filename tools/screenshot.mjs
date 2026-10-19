#!/usr/bin/env node
// Captura de página inteira via Chrome DevTools Protocol, sem dependências.
//   node tools/screenshot.mjs <url> <saida.png> [largura=1440] [altura=900] [reduced-motion=1]
// Usa viewport normal (100vh correto) e Page.captureScreenshot com captureBeyondViewport.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [url, out, w = '1440', h = '900', rm = '1'] = process.argv.slice(2);
if (!url || !out) { console.error('uso: node tools/screenshot.mjs <url> <saida.png> [w] [h] [rm]'); process.exit(1); }
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9222 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, '--user-data-dir=/tmp/lcr-shot-' + port, 'about:blank'],
  { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitPort() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json`); if (r.ok) return r.json(); } catch {}
    await sleep(200);
  }
  throw new Error('chrome não subiu');
}
try {
  const targets = await waitPort();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 768 });
  if (rm === '1') await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(2500);
  // rola a página inteira pra disparar lazy-load e observers, depois volta ao topo
  await send('Runtime.evaluate', { expression: `(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); })()`, awaitPromise: true });
  await sleep(1200);
  const { result: { result } } = await send('Runtime.evaluate', { expression: `JSON.stringify({ h: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight), rm: matchMedia('(prefers-reduced-motion: reduce)').matches, ov: document.documentElement.style.overflow, secs: document.querySelectorAll('section').length })`, returnByValue: true });
  const info = JSON.parse(result.value); console.log('info', info);
  const fullH = Math.min(info.h || +h, 20000);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: +w, height: fullH, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('ok', out, `${w}x${fullH}`);
  ws.close();
} catch (e) {
  console.error('erro:', e.message); process.exitCode = 1;
} finally {
  chrome.kill();
}
