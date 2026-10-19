# Site da Clínica LCR — como manter

Site estático (HTML, CSS e JS puros) na raiz do repositório. Deploy automático na Netlify a cada push na `main`.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | Home. Seções na ordem da jornada do pai: hero → prova → públicos → especialidades → fases → guias → emergência → 1ª consulta → depoimentos → clínica → equipe → sobre → FAQ → CTA. |
| `css/site.css` | CSS compartilhado por todas as páginas (tokens, componentes, print). |
| `js/site.js` | Compartilhado: dataLayer/GTM, WhatsApp com contexto, menu, chat, lightbox, filtros, reveal. |
| `js/home.js` | Só da home: hero cinemático (GSAP), tilt e coreografia. |
| `guias/` | Hub (`guias/index.html`), uma pasta por guia (`guias/<slug>/index.html`) e `guias/downloads/*.pdf`. **Gerados, não editar à mão.** |
| `tools/guias/` | Fonte dos guias: `guias.json` (metadados) + `<slug>.html` (corpo). |
| `tools/build_guias.py` | Gera os guias, o hub e o bloco de guias da home. |
| `assets/clinica/` | Fotos (WebP 800/1600) e tour (`tour.mp4` + poster) extraídos das filmagens. |

## Guias

```bash
python3 tools/build_guias.py          # regenera HTML (guias/, hub e bloco da home)
python3 tools/build_guias.py --pdf    # idem + PDFs (precisa do site servido em http://localhost:8124)
```

Guia novo = um `tools/guias/<slug>.html` (corpo com `<h2 id="...">`, `<!-- cta -->` onde entra o CTA do meio)
+ uma entrada em `guias.json` (slug, título, resumo, categoria, fases, ícone, mensagem de WhatsApp, relacionados).
Os PDFs saem do `@media print` do `site.css`, impressos pelo Chrome headless.

## WhatsApp com contexto

Qualquer link `<a data-wa data-origem="onde" data-servico="criancas|adolescentes|adultos|primeira-consulta|emergencia|clinica|guia|geral" data-msg="opcional">`
recebe o `href` pronto e dispara `whatsapp_click {origem, servico}` no dataLayer. Mensagens padrão em `js/site.js` (`WA_MSGS`).

## Mensuração

`window.dataLayer` existe sempre. O GTM só carrega quando `<html data-gtm="GTM-XXXXXXX">` tiver o ID
(em `index.html` e no `head()` de `tools/build_guias.py`). Eventos: `whatsapp_click {origem, servico}`,
`guide_view {guia}`, `guide_download {guia}`, `guide_share {guia}`, `guide_filter {item}`, `emergency_click`,
`gallery_open {item}`, `video_play {item}`, `faq_open {pergunta}`, `review_filter {item}`,
`agendar_online_click {origem}`, `como_chegar_click {origem}`.

## Placeholders visíveis (material pendente)

Tudo que depende de material real está marcado com `class="placeholder" data-placeholder="..."` (etiqueta amarela)
ou `.photo-placeholder`. Buscar por `data-placeholder` no `index.html` antes de publicar:

- Nota e nº de avaliações no Google (faixa de prova e seção de depoimentos).
- Depoimentos reais (seção `#depoimentos` está com `hidden`; modelo de card comentado dentro).
- O que a criança leva pra casa no fim da 1ª consulta (passo 5).
- Estacionamento e acessibilidade (bloco da clínica).
- Fotos e frase pessoal do Dr. Welington, Dra. Talita e Dra. Paloma; frase da Dra. Lara.
- Confirmar especialidades registradas no CRO-BA de cada profissional (só então usar "especialista em").
- Inscrição da clínica no CRO-BA (rodapé).
- Revisão clínica dos 7 guias pela Dra. Lara (etiqueta "Revisão clínica pendente"; depois, regenerar os PDFs).
- ID do container GTM.

## Regras que o site segue

- CFO: sem preço, sem forma de pagamento, sem antes e depois, sem promessa de resultado, CRO visível.
- LGPD: nenhuma foto de criança sem autorização escrita dos pais; depoimentos só com inicial e sem nome de criança.
- Nada inventado: números só os verificáveis (4 dentistas, +30 procedimentos do catálogo, horário, endereço).
