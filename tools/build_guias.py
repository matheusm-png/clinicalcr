#!/usr/bin/env python3
"""Gera as páginas dos guias da Clínica LCR a partir de tools/guias/.

  python3 tools/build_guias.py            # gera o HTML
  python3 tools/build_guias.py --pdf      # idem + PDFs via Chrome headless (precisa do site servido em http://localhost:8124)

Entrada:  tools/guias/guias.json (metadados) + tools/guias/<slug>.html (corpo)
Saída:    guias/<slug>/index.html, guias/index.html e o bloco da home
          (entre <!-- guias:home:start --> e <!-- guias:home:end --> no index.html).

Um guia novo = um arquivo .html + uma entrada no JSON. Rodar de novo regenera tudo.
"""
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'guias'
OUT = ROOT / 'guias'
SITE = 'https://clinicalcr.com.br'
WA = '5574991266602'
TODAY = date.today().isoformat()

ICONS = {
    'bebe':    '<path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4z"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M9 7h.01M15 7h.01"/><path d="M10 10c.6.6 1.3.9 2 .9s1.4-.3 2-.9"/>',
    'coracao': '<path d="M12 21.35C6 17 2.5 13.03 2.5 9.16 2.5 6.42 4.7 4.5 7.13 4.5c1.63 0 3.22.79 4.87 2.6 1.65-1.81 3.24-2.6 4.87-2.6 2.43 0 4.63 1.92 4.63 4.66 0 3.87-3.5 7.84-9.5 12.19z"/>',
    'dente':   '<path d="M7 3c-2.5 0-4 2-4 5 0 4 2 6 2.5 11 .2 1.5 1.5 2.3 2.5 1.5 1-1 1.5-5 4-5s3 4 4 5c1 .8 2.3 0 2.5-1.5C19 14 21 12 21 8c0-3-1.5-5-4-5-2 0-3 1-5 1S9 3 7 3z"/>',
    'alerta':  '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18h.01"/>',
    'aparelho':'<path d="M3 12h18"/><path d="M5 12V8a2 2 0 0 1 4 0v4"/><path d="M15 12V8a2 2 0 0 1 4 0v4"/><path d="M10 12v4a2 2 0 0 0 4 0v-4"/>',
    'brilho':  '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M19 16l.8 2 2.2.7-2.2.7L19 21l-.8-1.6-2.2-.7 2.2-.7z"/>',
    'gaze':    '<rect x="3" y="7" width="18" height="10" rx="3"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 14h8"/>',
}
WA_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z"/></svg>'
PDF_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'


def icon(name):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % ICONS[name])


def esc(s):
    return html.escape(s, quote=True)


def wa_url(msg):
    from urllib.parse import quote
    return 'https://wa.me/%s?text=%s' % (WA, quote(msg))


MASCOTE = (ROOT / 'tools' / 'mascote.svg').read_text(encoding='utf-8').replace('<?xml version="1.0" encoding="UTF-8"?>\n', '')


def header(base):
    return MASCOTE + f'''  <header id="site-header" class="header-solid">
    <div class="container">
      <a href="{base}" class="wordmark" aria-label="Clínica LCR, início">
        <img src="{base}assets/logo-lcr-96.png" alt="" aria-hidden="true" width="38" height="38">
        <span class="wordmark-text">
          <span class="wordmark-name">Clínica LCR</span>
          <span class="wordmark-sub">Odontologia pra toda a família</span>
        </span>
      </a>
      <nav class="site-nav" id="site-nav" aria-label="Seções do site">
        <a href="{base}#criancas">Crianças</a>
        <a href="{base}#adolescentes">Adolescentes</a>
        <a href="{base}#adultos">Adultos</a>
        <a href="{base}guias/" aria-current="page">Guias</a>
        <a href="{base}#clinica">Clínica</a>
      </nav>
      <div class="header-actions">
        <a href="https://wa.me/{WA}" data-wa data-origem="header" data-servico="geral" class="btn btn-sun header-cta">Agendar</a>
        <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span></button>
      </div>
    </div>
  </header>
'''


def footer(base):
    return f'''  <footer>
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <div class="footer-brand">
            <img src="{base}assets/logo-lcr-96.png" alt="Logo Clínica LCR" width="44" height="44">
            <div>
              <div class="footer-brand-name">Clínica LCR</div>
              <div class="footer-brand-sub">Odontologia pra toda a família</div>
            </div>
          </div>
          <p>Prevenção, atendimento infantil e especialidades odontológicas em Irecê - BA, com acompanhamento de longo prazo pra sua família.</p>
          <p><a href="{base}guias/" style="color:var(--aqua-400);font-weight:700">Guias gratuitos</a> · <a href="{base}#clinica" style="color:var(--aqua-400);font-weight:700">A clínica</a></p>
        </div>
        <div class="footer-col">
          <h3>Contato</h3>
          <p><strong>WhatsApp:</strong> (74) 99126-6602</p>
          <p><strong>Telefone:</strong> (74) 99930-8146</p>
          <p>clinicalcr@outlook.com</p>
          <p>Rua Réggio Emília, 210 E, Centro<br>Irecê - BA · CEP 44860-111</p>
        </div>
        <div class="footer-col">
          <h3>Horário</h3>
          <p><strong>Seg a Sex:</strong> 8h–12h · 14h–18h</p>
          <p><strong>Sábado:</strong> com agendamento prévio</p>
          <p style="margin-top:18px"><a href="https://wa.me/{WA}" data-wa data-origem="footer" data-servico="geral" style="color:var(--aqua-400);font-weight:700">Agendar no WhatsApp →</a></p>
        </div>
      </div>
      <div class="copyright">
        LCR Clínica Odontológica · CNPJ 27.211.223/0001-54<br>
        Responsável técnica: Dra. Lara Camila Moitinho Moura, CRO-BA 15.247<br>
        © 2026 Clínica LCR. Todos os direitos reservados.
      </div>
    </div>
  </footer>
'''


def mobile_bar():
    return f'''  <div class="mobile-bar" id="mobile-bar">
    <a href="https://wa.me/{WA}" data-wa data-origem="barra-mobile" data-servico="geral" class="mobile-bar-btn primary">{WA_SVG} Agendar</a>
    <a href="https://maps.app.goo.gl/RV3zCA5skEBB8r4Y6" target="_blank" rel="noopener" class="mobile-bar-btn" data-track="como_chegar_click" data-origem="barra-mobile">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Como chegar
    </a>
  </div>
'''


def head(base, title, desc, url, extra_ld=None, og_type='website'):
    ld = '' if not extra_ld else '  <script type="application/ld+json">\n%s\n  </script>\n' % json.dumps(extra_ld, ensure_ascii=False, indent=2)
    return f'''<!DOCTYPE html>
<html lang="pt-BR" data-gtm="">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{url}">
  <link rel="icon" type="image/png" href="{base}assets/logo-lcr.png">
  <link rel="apple-touch-icon" href="{base}assets/logo-lcr.png">
  <meta name="theme-color" content="#0A302E">
  <meta property="og:type" content="{og_type}">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="Clínica LCR">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}/assets/og-guias.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&display=swap" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&display=swap"></noscript>
  <link rel="stylesheet" href="{base}css/site.css">
{ld}</head>
'''


def guide_card(g, cats, base):
    cat = cats[g['categoria']]
    pdf = f'{base}guias/downloads/{g["slug"]}-clinica-lcr.pdf'
    urg = '<span class="guide-badge">Emergência</span>' if g['categoria'] == 'emergencia' else ''
    masc = {'infantil': 'm-bebe', 'ortodontia': 'm-teen', 'adultos': 'm-adulto', 'emergencia': 'm-alerta'}[g['categoria']]
    return f'''        <article class="guide-card" data-cat="{g['categoria']}" data-fases="{' '.join(g['fases'])}">
          <a href="{base}guias/{g['slug']}/" class="guide-cover cat-{g['categoria']}" data-track="guide_view" data-guia="{g['slug']}" aria-hidden="true" tabindex="-1"><svg class="mascot mascot-cover"><use href="#{masc}"/></svg>{urg}</a>
          <div class="guide-card-body">
            <span class="guide-cat">{esc(cat['nome'])}</span>
            <h3><a href="{base}guias/{g['slug']}/" data-track="guide_view" data-guia="{g['slug']}">{esc(g['titulo'])}</a></h3>
            <p>{esc(g['resumo'])}</p>
            <div class="guide-card-foot">
              <a href="{base}guias/{g['slug']}/" class="guide-read" data-track="guide_view" data-guia="{g['slug']}">Ler o guia</a>
              <a href="{pdf}" class="guide-pdf" download data-track="guide_download" data-guia="{g['slug']}" title="Baixar em PDF">PDF</a>
            </div>
          </div>
        </article>
'''


def build_guide(g, data, body_src):
    base = '../../'
    cats = data['categorias']
    url = f'{SITE}/guias/{g["slug"]}/'
    pdf_rel = f'../downloads/{g["slug"]}-clinica-lcr.pdf'
    title = f'{g["seo_titulo"]} | Clínica LCR'
    # índice a partir dos h2
    h2s = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body_src)
    toc = '\n'.join(f'          <li><a href="#{i}">{t}</a></li>' for i, t in h2s)
    cta_mid = f'''
<aside class="guide-cta guide-cta-mid">
  <strong>Prefere perguntar pra gente?</strong>
  <p>Manda sua dúvida no WhatsApp. A equipe da LCR responde e, se fizer sentido, já encaixa a consulta.</p>
  <a href="https://wa.me/{WA}" data-wa data-origem="guia-{g['slug']}" data-servico="guia" data-msg="{esc(g['wa_msg'])}" class="btn btn-aqua">{WA_SVG} Falar no WhatsApp</a>
</aside>
'''
    body = body_src.replace('<!-- cta -->', cta_mid, 1)
    related = ''.join(guide_card(x, cats, base) for x in data['guias'] if x['slug'] in g['relacionados'])
    share = wa_url(f'Guarda esse guia da Clínica LCR: {g["titulo"]}, {g["subtitulo"]}. {url}')
    ld = [
        {
            "@context": "https://schema.org",
            "@type": "MedicalWebPage",
            "name": g['seo_titulo'],
            "url": url,
            "description": g['resumo'],
            "inLanguage": "pt-BR",
            "dateModified": TODAY,
            "audience": {"@type": "PeopleAudience", "audienceType": "pais e responsáveis"},
            "publisher": {"@type": "Dentist", "name": "Clínica LCR Odontologia", "url": SITE + '/'},
            "reviewedBy": {"@type": "Person", "name": "Dra. Lara Camila Moitinho Moura", "jobTitle": "Cirurgiã-Dentista", "identifier": "CRO-BA 15.247"}
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Início", "item": SITE + '/'},
                {"@type": "ListItem", "position": 2, "name": "Guias", "item": SITE + '/guias/'},
                {"@type": "ListItem", "position": 3, "name": g['titulo'], "item": url}
            ]
        }
    ]
    cat = cats[g['categoria']]
    fases = ' · '.join(data['fases'][f] for f in g['fases'])
    page = head(base, title, g['resumo'], url, ld, 'article') + f'''<body data-guia="{g['slug']}" class="page-guide">
{header(base)}
  <main>
    <section class="guide-hero cat-{g['categoria']}">
      <div class="container">
        <nav class="crumbs" aria-label="Você está em"><a href="{base}">Início</a> › <a href="{base}guias/">Guias</a> › <span>{esc(g['titulo'])}</span></nav>
        <span class="chip">{esc(cat['nome'])} · {fases}</span>
        <h1>{esc(g['titulo'])}<span class="guide-sub">{esc(g['subtitulo'])}</span></h1>
        <p class="guide-summary">{esc(g['resumo'])}</p>
        <p class="guide-meta">Leitura de {g['leitura']} min · Clínica LCR, Irecê-BA · <span class="placeholder" data-placeholder="Revisão clínica pendente">Revisado pela Dra. Lara Camila, CRO-BA 15.247</span></p>
        <div class="guide-actions">
          <a href="{pdf_rel}" class="btn btn-outline-ink" download data-track="guide_download" data-guia="{g['slug']}">{PDF_SVG} Baixar em PDF</a>
          <a href="https://wa.me/{WA}" data-wa data-origem="guia-{g['slug']}-topo" data-servico="guia" data-msg="{esc(g['wa_msg'])}" class="btn btn-sun">{WA_SVG} {esc(g['wa_cta'])}</a>
        </div>
      </div>
    </section>

    <div class="container guide-layout">
      <aside class="guide-toc">
        <strong>Neste guia</strong>
        <ol>
{toc}
        </ol>
      </aside>
      <article class="guide-body">
{body}
        <aside class="guide-cta guide-cta-end">
          <h2 id="agendar">Ficou com alguma dúvida ou quer agendar?</h2>
          <p>Esse guia não substitui a consulta. Se o seu caso tem alguma particularidade, chama a gente: a conversa é rápida e sem compromisso.</p>
          <div class="guide-cta-buttons">
            <a href="https://wa.me/{WA}" data-wa data-origem="guia-{g['slug']}-fim" data-servico="guia" data-msg="{esc(g['wa_msg'])}" class="btn btn-sun">{WA_SVG} {esc(g['wa_cta'])}</a>
            <a href="{share}" target="_blank" rel="noopener" class="btn btn-outline-ink" data-track="guide_share" data-guia="{g['slug']}">Enviar pra alguém</a>
          </div>
        </aside>
        <p class="guide-disclaimer">Conteúdo informativo da Clínica LCR. Não substitui avaliação e orientação profissional. Em caso de dor, sangramento que não para ou trauma, procure atendimento.</p>
        <p class="print-only">Guia completo e atualizado em {url}</p>
      </article>
    </div>

    <section class="guide-related bg-soft">
      <div class="container">
        <div class="section-header">
          <span class="chip">Continue lendo</span>
          <h2>Guias relacionados</h2>
        </div>
        <div class="guide-grid">
{related}        </div>
        <p style="text-align:center;margin-top:28px"><a href="{base}guias/" class="btn btn-outline-ink">Ver todos os guias</a></p>
      </div>
    </section>
  </main>
{footer(base)}{mobile_bar()}  <script src="{base}js/site.js" defer></script>
</body>
</html>
'''
    out = OUT / g['slug'] / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding='utf-8')
    return out


def emergency_banner(base):
    return f'''  <!-- Banner de emergência -->
  <section class="emergency-wrap" aria-label="Emergência dentária">
    <div class="container">
      <div class="emergency-banner">
        <span class="emergency-mark" aria-hidden="true">!</span>
        <div class="emergency-text">
          <h2>Seu filho bateu a boca agora?</h2>
          <p>Veja o que fazer nos primeiros minutos e fale com a LCR o quanto antes. Cada minuto conta quando um dente permanente sai inteiro.</p>
        </div>
        <div class="emergency-actions">
          <a href="{base}guias/trauma-dentario/" class="btn btn-sun" data-track="emergency_click" data-origem="banner-guia">Abrir o guia de emergência</a>
          <a href="https://wa.me/{WA}" data-wa data-origem="banner-emergencia" data-servico="emergencia" class="btn btn-outline-light" data-track="emergency_click">{WA_SVG} WhatsApp de urgência</a>
        </div>
      </div>
    </div>
  </section>
'''


def build_hub(data):
    base = '../'
    cats = data['categorias']
    url = f'{SITE}/guias/'
    n = len(data['guias'])
    cards = ''.join(guide_card(g, cats, base) for g in data['guias'])
    cat_counts = {k: sum(1 for g in data['guias'] if g['categoria'] == k) for k in cats}
    cat_btns = ''.join(f'          <button type="button" class="filter-btn" data-filter-cat="{k}">{esc(v["nome"])} <span>{cat_counts[k]}</span></button>\n' for k, v in cats.items())
    fase_btns = ''.join(f'          <button type="button" class="filter-chip" data-filter-fase="{k}">{esc(v)}</button>\n' for k, v in data['fases'].items())
    ld = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Guias gratuitos da Clínica LCR",
        "url": url,
        "description": "Guias gratuitos de saúde bucal pra cada fase do sorriso: bebê, troca dos dentes, aparelho, clareamento e emergências.",
        "publisher": {"@type": "Dentist", "name": "Clínica LCR Odontologia", "url": SITE + '/'}
    }
    page = head(base, 'Guias gratuitos de saúde bucal pra cada fase | Clínica LCR',
                'Guias gratuitos da Clínica LCR, em Irecê-BA: primeiro dentinho, primeira consulta, troca dos dentes, trauma, aparelho fixo, clareamento e pós-extração. Leia no site ou baixe em PDF.',
                url, ld) + f'''<body class="page-hub">
{header(base)}
  <main>
    <section class="hub-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Você está em"><a href="{base}">Início</a> › <span>Guias</span></nav>
        <span class="chip">Biblioteca da LCR</span>
        <h1>Guias gratuitos pra cuidar do <span class="squiggle">sorriso</span> em casa</h1>
        <p>Orientações simples e confiáveis pra cada fase da família. Leia aqui no site ou baixe em PDF pra consultar no celular, mesmo sem internet. Sem cadastro.</p>
        <div class="hub-facts">
          <div><strong>{n}</strong><span>guias</span></div>
          <div><strong>PDF</strong><span>pra ler no celular</span></div>
          <div><strong>100%</strong><span>gratuitos, sem cadastro</span></div>
        </div>
      </div>
    </section>

    <section class="hub-list">
      <div class="container">
        <div class="filters" id="filters">
          <p class="filters-label">Qual assunto você procura?</p>
          <div class="filter-row" role="group" aria-label="Filtrar por categoria">
          <button type="button" class="filter-btn active" data-filter-cat="todos">Todos <span>{n}</span></button>
{cat_btns}          </div>
          <div class="filter-row" role="group" aria-label="Filtrar por fase">
{fase_btns}          </div>
        </div>
        <p class="filters-empty" id="filters-empty" hidden>Nenhum guia com esse filtro ainda. Chama a gente no WhatsApp que a gente orienta.</p>
        <div class="guide-grid" id="guide-grid">
{cards}        </div>
      </div>
    </section>

{emergency_banner(base)}
    <section>
      <div class="container">
        <div class="section-header">
          <span class="chip">Como usar</span>
          <h2>Feitos pra consultar quando precisar</h2>
        </div>
        <div class="howto-grid">
          <div class="howto"><span class="step-num">1</span><h3>Escolha o assunto</h3><p>Filtre pela fase do seu filho (ou pela sua) e abra o guia que combina com o momento.</p></div>
          <div class="howto"><span class="step-num">2</span><h3>Leia ou baixe</h3><p>Leia aqui mesmo ou baixe o PDF pra ter no celular quando precisar, inclusive sem internet.</p></div>
          <div class="howto"><span class="step-num">3</span><h3>Ficou com dúvida?</h3><p>Os guias não substituem a consulta. Fale com a LCR pelo WhatsApp sempre que precisar.</p></div>
        </div>
      </div>
    </section>

    <section aria-label="Agendar consulta">
      <div class="container">
        <div class="cta-panel on-dark">
          <span class="cta-kicker">Quer cuidar do sorriso de perto? ✦</span>
          <h2>Vamos cuidar do sorriso<br>da sua família?</h2>
          <p class="cta-sub">Crianças, adolescentes e adultos, na mesma clínica, no centro de Irecê.</p>
          <div class="cta-buttons">
            <a href="https://wa.me/{WA}" data-wa data-origem="guias-cta-final" data-servico="geral" class="btn btn-sun btn-pulse">Agendar no WhatsApp</a>
            <a href="{base}#clinica" class="btn btn-outline-light">Conhecer a clínica</a>
          </div>
        </div>
      </div>
    </section>
  </main>
{footer(base)}{mobile_bar()}  <script src="{base}js/site.js" defer></script>
  <script>
    // Filtro do hub: categoria (um por vez) + fase (um por vez). Sem lib.
    (function () {{
      const cards = Array.from(document.querySelectorAll('#guide-grid .guide-card'));
      const empty = document.getElementById('filters-empty');
      let cat = 'todos', fase = null;
      function apply() {{
        let shown = 0;
        cards.forEach(function (c) {{
          const okCat = cat === 'todos' || c.dataset.cat === cat;
          const okFase = !fase || c.dataset.fases.split(' ').indexOf(fase) !== -1;
          const show = okCat && okFase;
          c.hidden = !show; if (show) shown++;
        }});
        empty.hidden = shown > 0;
      }}
      document.querySelectorAll('[data-filter-cat]').forEach(function (b) {{
        b.addEventListener('click', function () {{
          cat = b.dataset.filterCat;
          document.querySelectorAll('[data-filter-cat]').forEach(function (x) {{ x.classList.toggle('active', x === b); }});
          apply();
          if (window.LCR) LCR.track('guide_filter', {{ item: 'cat:' + cat }});
        }});
      }});
      document.querySelectorAll('[data-filter-fase]').forEach(function (b) {{
        b.addEventListener('click', function () {{
          fase = (fase === b.dataset.filterFase) ? null : b.dataset.filterFase;
          document.querySelectorAll('[data-filter-fase]').forEach(function (x) {{ x.classList.toggle('active', x.dataset.filterFase === fase); }});
          apply();
          if (window.LCR) LCR.track('guide_filter', {{ item: 'fase:' + (fase || 'todas') }});
        }});
      }});
    }})();
  </script>
</body>
</html>
'''
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'index.html').write_text(page, encoding='utf-8')


def build_home_block(data):
    base = ''
    cats = data['categorias']
    n = len(data['guias'])
    cards = ''.join(guide_card(g, cats, base) for g in data['guias'] if g.get('home'))
    block = f'''  <!-- 6. Guias gratuitos: o ativo de confiança + SEO -->
  <section id="guias">
    <div class="container">
      <div class="section-header">
        <span class="chip">Guias da LCR</span>
        <h2>Guias gratuitos pra <span class="squiggle">cada fase</span> do sorriso</h2>
        <p>Orientações simples pra cuidar em casa. Leia no site ou baixe o PDF pra ler no celular. Sem cadastro.</p>
      </div>
      <div class="guide-grid guide-grid-home">
{cards}      </div>
      <p style="text-align:center;margin-top:32px"><a href="guias/" class="btn btn-outline-ink">Ver todos os {n} guias</a></p>
    </div>
  </section>

{emergency_banner(base)}'''
    index = ROOT / 'index.html'
    s = index.read_text(encoding='utf-8')
    a, b = '  <!-- guias:home:start -->\n', '  <!-- guias:home:end -->\n'
    if a not in s:
        raise SystemExit('index.html sem os marcadores guias:home:start/end')
    i, j = s.index(a) + len(a), s.index(b)
    s = s[:i] + block + s[j:]
    index.write_text(s, encoding='utf-8')


def build_pdfs(data, base_url='http://localhost:8124'):
    """Imprime cada guia em PDF com o Chrome headless (usa o @media print do site.css)."""
    import subprocess
    chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    (OUT / 'downloads').mkdir(parents=True, exist_ok=True)
    for g in data['guias']:
        out = OUT / 'downloads' / f"{g['slug']}-clinica-lcr.pdf"
        subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                        '--virtual-time-budget=6000', f'--print-to-pdf={out}',
                        f"{base_url}/guias/{g['slug']}/"], check=True, capture_output=True)
        print('ok', out.relative_to(ROOT), out.stat().st_size // 1024, 'KB')


def main():
    import sys
    data = json.loads((SRC / 'guias.json').read_text(encoding='utf-8'))
    for g in data['guias']:
        body = (SRC / f'{g["slug"]}.html').read_text(encoding='utf-8')
        out = build_guide(g, data, body)
        print('ok', out.relative_to(ROOT))
    build_hub(data)
    print('ok guias/index.html')
    build_home_block(data)
    print('ok bloco da home')
    if '--pdf' in sys.argv:
        build_pdfs(data)


if __name__ == '__main__':
    main()
