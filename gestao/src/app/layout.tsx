import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Gestão — Clínica LCR",
  description: "Sistema de Gestão Odontológica da Clínica LCR",
  applicationName: "Clínica LCR",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Clínica LCR" },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A7070",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  if (localStorage.getItem('lcr-theme') === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.removeAttribute('data-theme');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Aviso de navegador desatualizado. O Next 16 exige Safari 16.4+ /
            Chrome 111+ / Firefox 111+; abaixo disso a página aparece mas o JS
            não roda (o login só "pisca"). Este script é ES5 puro de propósito,
            pra rodar justamente nesses navegadores. Teste: ?aviso-navegador */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var ok = true;
                try {
                  new RegExp('(?<=a)b');
                  if (typeof Array.prototype.at !== 'function' || typeof Object.hasOwn !== 'function') ok = false;
                } catch (e) { ok = false; }
                if (location.search.indexOf('aviso-navegador') !== -1) ok = false;
                if (ok) return;
                var ua = navigator.userAgent;
                var m = ua.match(/Version\\/([0-9.]+).*Safari/);
                var versao = m ? 'Safari ' + m[1] : '';
                function mostrar() {
                  if (document.getElementById('aviso-navegador')) return;
                  var d = document.createElement('div');
                  d.id = 'aviso-navegador';
                  d.setAttribute('role', 'alert');
                  d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#F4F7F7;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1d2b2b;';
                  d.innerHTML =
                    '<div style="max-width:460px;background:#fff;border-radius:14px;padding:28px;box-shadow:0 6px 24px rgba(0,0,0,.08);line-height:1.5">' +
                      '<img src="/assets/logo-lcr.svg" alt="Clínica LCR" style="width:110px;display:block;margin:0 auto 16px">' +
                      '<h1 style="font-size:19px;margin:0 0 10px;color:#1A7070">Seu navegador está desatualizado</h1>' +
                      '<p style="margin:0 0 12px;font-size:15px">O sistema da Clínica LCR não funciona neste navegador' + (versao ? ' (<strong>' + versao + '</strong>)' : '') + '. Por isso o login não entra: não é a sua senha.</p>' +
                      '<p style="margin:0 0 6px;font-size:15px"><strong>Para resolver, escolha uma opção:</strong></p>' +
                      '<ol style="margin:0 0 14px;padding-left:20px;font-size:15px">' +
                        '<li style="margin-bottom:6px">Atualize o Mac em <em>Ajustes do Sistema › Atualização de Software</em> (precisa do Safari 16.4 ou mais novo).</li>' +
                        '<li>Ou instale o <strong>Google Chrome</strong> ou o <strong>Firefox</strong> e abra <strong>app.clinicalcr.com.br</strong> por ele.</li>' +
                      '</ol>' +
                      '<p style="margin:0;font-size:13px;color:#5b6b6b">No celular o sistema continua funcionando normalmente.</p>' +
                    '</div>';
                  document.body.appendChild(d);
                }
                if (document.body) mostrar();
                else document.addEventListener('DOMContentLoaded', mostrar);
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
