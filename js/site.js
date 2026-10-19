/* Clínica LCR — scripts compartilhados por todas as páginas do site.
   Mensuração (dataLayer + GTM), WhatsApp com contexto, header,
   chat de pré-atendimento, FAQ e reveal de scroll. Sem dependências. */
(function () {
  'use strict';

  const WA_NUMBER = '5574991266602';
  // ID do container GTM vem do <html data-gtm="GTM-XXXXXXX">. Vazio = não carrega nada.
  const GTM_ID = (document.documentElement.dataset.gtm || '').trim();

  /* ============ Mensuração ============
     dataLayer existe sempre (pra eventos não se perderem); o GTM só entra
     quando há ID e depois do idle/primeira interação, pra não pesar o LCP. */
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    window.dataLayer.push(Object.assign({ event: event }, params || {}));
  }
  function loadGTM() {
    if (!GTM_ID || window.__lcrGtmLoaded) return;
    window.__lcrGtmLoaded = true;
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    document.head.appendChild(s);
  }
  if (GTM_ID) {
    if ('requestIdleCallback' in window) requestIdleCallback(loadGTM, { timeout: 4000 });
    else setTimeout(loadGTM, 2500);
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, loadGTM, { once: true, passive: true });
    });
  }

  /* ============ WhatsApp com contexto ============
     Qualquer <a data-wa data-origem="hero" data-servico="criancas"> recebe o
     href pronto e dispara whatsapp_click {origem, servico} ao clicar.
     data-msg sobrescreve a mensagem padrão do serviço. */
  const WA_MSGS = {
    geral:             'Olá! Vim pelo site da Clínica LCR e quero agendar uma consulta.',
    criancas:          'Olá! Vim pelo site da Clínica LCR e quero agendar uma consulta pro meu filho(a).',
    adolescentes:      'Olá! Vim pelo site da Clínica LCR e quero agendar uma avaliação ortodôntica.',
    adultos:           'Olá! Vim pelo site da Clínica LCR e quero agendar uma consulta pra mim.',
    'primeira-consulta': 'Olá! Vim pelo site da Clínica LCR e quero agendar a primeira consulta do meu filho(a).',
    emergencia:        'Olá! URGÊNCIA: meu filho(a) bateu a boca/machucou um dente e preciso de orientação da Clínica LCR.',
    clinica:           'Olá! Vim pelo site da Clínica LCR e quero saber como chegar e agendar uma visita.',
    guia:              'Olá! Li um guia no site da Clínica LCR e fiquei com uma dúvida.'
  };
  function waUrl(opts) {
    opts = opts || {};
    const msg = opts.msg || WA_MSGS[opts.servico] || WA_MSGS.geral;
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);
  }
  function setupWaLinks(root) {
    (root || document).querySelectorAll('a[data-wa]').forEach(function (a) {
      if (a.dataset.waReady) return;
      a.dataset.waReady = '1';
      a.href = waUrl({ servico: a.dataset.servico, msg: a.dataset.msg });
      a.target = '_blank';
      a.rel = 'noopener';
      a.addEventListener('click', function () {
        track('whatsapp_click', {
          origem: a.dataset.origem || 'site',
          servico: a.dataset.servico || 'geral'
        });
      });
    });
  }
  setupWaLinks();

  /* ============ Eventos genéricos ============
     <a data-track="guide_view" data-guia="trauma-dentario">, data-track="emergency_click",
     data-track="gallery_open", data-track="video_play" etc. Os parâmetros saem
     dos data-* conhecidos (guia, pergunta, origem, servico, item). */
  const PARAM_KEYS = ['guia', 'pergunta', 'origem', 'servico', 'item'];
  function paramsFrom(el) {
    const p = {};
    PARAM_KEYS.forEach(function (k) { if (el.dataset[k]) p[k] = el.dataset[k]; });
    return p;
  }
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-track]');
    if (!el) return;
    track(el.dataset.track, paramsFrom(el));
  });

  // FAQ: faq_open {pergunta} ao abrir um <details class="faq-item">
  document.querySelectorAll('details.faq-item').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      const s = d.querySelector('summary');
      const pergunta = s ? s.textContent.replace(/\+\s*$/, '').trim() : '';
      track('faq_open', { pergunta: pergunta });
    });
  });

  // Página de guia: guide_view {guia} uma vez por carregamento
  const guiaSlug = document.body.dataset.guia;
  if (guiaSlug) track('guide_view', { guia: guiaSlug });

  /* ============ Header ============
     Transparente sobre o hero cinemático da home; sólido em qualquer outra
     página (ou depois de rolar 75% da viewport). */
  const siteHeader = document.getElementById('site-header');
  const hasHero = !!document.getElementById('cinematic-hero');
  function updateHeader() {
    if (!siteHeader) return;
    const limit = hasHero ? (window.innerHeight || 800) * 0.75 : -1;
    siteHeader.classList.toggle('scrolled', window.scrollY > limit);
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  /* ============ Menu mobile ============ */
  const navToggle = document.getElementById('nav-toggle');
  if (navToggle && siteHeader) {
    navToggle.addEventListener('click', function () {
      const open = siteHeader.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    siteHeader.querySelectorAll('.site-nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        siteHeader.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ============ Dock de navegação (home) ============ */
  const dock = document.getElementById('dock');
  const dockLinks = dock ? Array.from(dock.querySelectorAll('a')) : [];
  function updateDock() {
    if (!dock) return;
    const vh = window.innerHeight || 800;
    dock.classList.toggle('visible', window.scrollY > vh * 0.75);
    let cur = dockLinks[0];
    for (const a of dockLinks) {
      const sec = document.getElementById(a.dataset.sec);
      if (sec && sec.getBoundingClientRect().top <= vh * 0.45) cur = a;
    }
    dockLinks.forEach(function (a) { a.classList.toggle('active', a === cur); });
  }
  if (dock) {
    window.addEventListener('scroll', updateDock, { passive: true });
    updateDock();
  }

  /* ============ Chat de pré-qualificação ============
     Simulação de bot → handoff pro WhatsApp com o contexto das respostas. */
  (function () {
    const toggle = document.getElementById('wa-toggle');
    const chat = document.getElementById('wa-chat');
    const body = document.getElementById('wa-chat-body');
    const actions = document.getElementById('wa-chat-actions');
    const closeBtn = document.getElementById('wa-chat-close');
    if (!toggle || !chat) return;
    const iconChat = toggle.querySelector('.wa-icon-chat');
    const iconClose = toggle.querySelector('.wa-icon-close');

    const answers = {};
    let started = false;

    const flow = [
      { bot: ['Oi! 👋 Sou a assistente virtual da Clínica LCR.', 'Pra adiantar seu atendimento, posso te fazer 3 perguntinhas rápidas?'],
        opts: [ { t: 'Pode sim! 😊', next: 1 }, { t: 'Prefiro falar direto', go: true } ] },
      { q: 'tratamento', bot: ['Que ótimo! O atendimento é pra quem?'],
        opts: [ { t: 'Pro meu filho(a) 🧒', s: 'criancas' }, { t: 'Pra mim', s: 'adultos' }, { t: 'Pra família toda', s: 'geral' } ], next: 2 },
      { q: 'interesse', bot: ['E o que você está procurando?'],
        opts: [ { t: 'Limpeza / prevenção' }, { t: 'Primeira consulta', s: 'primeira-consulta' }, { t: 'Aparelho / ortodontia', s: 'adolescentes' }, { t: 'Está doendo 😣' }, { t: 'Outro' } ], next: 3 },
      { q: 'quando', bot: ['Perfeito! E quando você prefere ser atendido?'],
        opts: [ { t: 'Essa semana' }, { t: 'Próxima semana' }, { t: 'Ainda estou decidindo' } ], next: 4 },
      { final: true, bot: ['Prontinho! 💚 Já anotei tudo aqui.', 'É só continuar no WhatsApp que a equipe te responde rapidinho.'] }
    ];

    const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

    function openChat() {
      chat.classList.add('open'); chat.setAttribute('aria-hidden', 'false');
      iconChat.style.display = 'none'; iconClose.style.display = 'block';
      if (!started) { started = true; renderStep(0); }
    }
    function closeChat() {
      chat.classList.remove('open'); chat.setAttribute('aria-hidden', 'true');
      iconChat.style.display = 'block'; iconClose.style.display = 'none';
    }
    toggle.addEventListener('click', function () { chat.classList.contains('open') ? closeChat() : openChat(); });
    closeBtn.addEventListener('click', closeChat);
    // Barra fixa do mobile: Agendar abre o chat (qualifica e manda pro WhatsApp com contexto)
    const mobileAgendar = document.getElementById('mobile-agendar');
    if (mobileAgendar) mobileAgendar.addEventListener('click', function () { chat.classList.contains('open') ? closeChat() : openChat(); });

    function addMsg(text, who) {
      const d = document.createElement('div');
      d.className = 'wa-msg ' + who; d.textContent = text;
      body.appendChild(d); body.scrollTop = body.scrollHeight;
    }
    function showTyping() {
      const t = document.createElement('div');
      t.className = 'wa-typing'; t.innerHTML = '<span></span><span></span><span></span>';
      body.appendChild(t); body.scrollTop = body.scrollHeight; return t;
    }
    function servico() { return answers._servico || 'geral'; }
    function waLink() {
      let msg = 'Olá! Vim pelo site da Clínica LCR.';
      if (answers.tratamento) msg += ' O atendimento é: ' + answers.tratamento + '.';
      if (answers.interesse)  msg += ' Procuro: ' + answers.interesse + '.';
      if (answers.quando)     msg += ' Prefiro atendimento: ' + answers.quando + '.';
      return waUrl({ msg: msg });
    }
    function goWhatsApp() {
      track('whatsapp_click', { origem: 'chat', servico: servico() });
      window.open(waLink(), '_blank', 'noopener');
    }

    async function renderStep(i) {
      const step = flow[i];
      actions.innerHTML = '';
      for (const line of step.bot) {
        const t = showTyping();
        await wait(650);
        t.remove(); addMsg(line, 'bot');
        await wait(220);
      }
      if (step.final) {
        const a = document.createElement('a');
        a.className = 'wa-cta-final'; a.href = waLink(); a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z"/></svg> Continuar no WhatsApp';
        a.addEventListener('click', function () { track('whatsapp_click', { origem: 'chat', servico: servico() }); });
        actions.appendChild(a);
        return;
      }
      step.opts.forEach(function (o) {
        const b = document.createElement('button');
        b.className = 'wa-opt'; b.textContent = o.t;
        b.addEventListener('click', function () {
          addMsg(o.t, 'user');
          if (o.s) answers._servico = o.s;
          if (o.go) { goWhatsApp(); return; }
          if (step.q) answers[step.q] = o.t;
          actions.innerHTML = '';
          renderStep(o.next != null ? o.next : step.next);
        });
        actions.appendChild(b);
      });
    }
  })();

  /* ============ Galeria (lightbox) + vídeo do tour ============ */
  (function () {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const cap = document.getElementById('lightbox-cap');
    if (lb && img && typeof lb.showModal === 'function') {
      document.querySelectorAll('a[data-gallery]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          img.src = a.getAttribute('href');
          img.alt = (a.querySelector('img') || {}).alt || '';
          cap.textContent = a.dataset.caption || '';
          lb.showModal();
        });
      });
      const close = function () { lb.close(); img.src = ''; };
      document.getElementById('lightbox-close').addEventListener('click', close);
      lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    }
    const video = document.getElementById('tour-video');
    if (video) {
      let played = false;
      video.addEventListener('play', function () {
        if (played) return; played = true;
        track('video_play', { item: 'tour-clinica' });
      });
    }
  })();

  /* ============ Depoimentos: filtro por tema + ver mais ============ */
  (function () {
    const grid = document.getElementById('reviews-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.review'));
    const empty = document.getElementById('reviews-empty');
    const more = document.getElementById('reviews-more');
    const LIMIT = 4;
    let tag = 'todos', expanded = false;
    function apply() {
      let shown = 0;
      cards.forEach(function (c) {
        const ok = tag === 'todos' || (c.dataset.tags || '').split(' ').indexOf(tag) !== -1;
        const show = ok && (expanded || shown < LIMIT);
        if (ok) shown++;
        c.hidden = !show;
      });
      if (empty) empty.hidden = shown > 0;
      if (more) more.hidden = expanded || shown <= LIMIT;
    }
    document.querySelectorAll('[data-filter-tag]').forEach(function (b) {
      b.addEventListener('click', function () {
        tag = b.dataset.filterTag; expanded = false;
        document.querySelectorAll('[data-filter-tag]').forEach(function (x) { x.classList.toggle('active', x === b); });
        apply();
        track('review_filter', { item: tag });
      });
    });
    if (more) more.addEventListener('click', function () { expanded = true; apply(); });
    apply();
  })();

  /* ============ Scroll reveal ============ */
  const revealSel = '.section-header:not(.visit-panel .section-header), .trust-item, .step-card, .team-card, .service-card, .diff-card, .faq-item, .place-card, .place-map';
  document.querySelectorAll(revealSel).forEach(function (el) { el.classList.add('reveal'); });
  const revealObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('active');
      revealObs.unobserve(el);
      // Terminada a entrada, devolve o elemento às suas transições próprias
      setTimeout(function () { el.classList.remove('reveal', 'active'); }, 1000);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(function (el) { revealObs.observe(el); });

  window.LCR = { track: track, waUrl: waUrl, setupWaLinks: setupWaLinks };
})();
