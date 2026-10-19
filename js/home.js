/* Clínica LCR — scripts só da home: hero cinemático (GSAP), tilt dos passos e coreografia de entrada. */
(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let heroInited = false;

  // Tenta iniciar o hero cinemático (desktop E mobile). Condições reavaliadas a
  // cada chamada: GSAP pode chegar depois (CDN async) e a viewport pode começar
  // em 0 (pré-render).
  function initHero() {
    if (heroInited) return true;
    if (prefersReducedMotion || window.innerWidth === 0) return false;
    if (!window.gsap) return false;
    heroInited = true;

    // Opacidade-alvo das fotos de fundo (sutil de propósito).
    // A FRENTE aparece mais (zoom + alpha maior) e a logo fica levemente
    // translúcida pra fachada respirar através do dente.
    const PHOTO_ALPHA = 0.3;
    const FRENTE_ALPHA = 0.38;
    const FRENTE_ZOOM = 1.35;

    // Garante o estado inicial correto das camadas e efeitos
    gsap.set('#hero-photo-frente', { autoAlpha: FRENTE_ALPHA, scale: FRENTE_ZOOM });
    gsap.set('#hero-photo-interior', { autoAlpha: 0, scale: 1.12 });
    gsap.set('#mask-text', { autoAlpha: 0 });
    gsap.set('#mask-logo', { autoAlpha: 1, scale: 1, rotate: -3 });
    gsap.set('.fixed-gradient-bg', { scale: 1, rotate: 3 });
    gsap.set('#hero-bg-grad', { opacity: 0 });
    gsap.set('#hero-glow', { autoAlpha: 0.8, scale: 0.8 });
    gsap.set('#cine-title', { scale: 15, rotate: 2.5, letterSpacing: '-0.06em' });
    gsap.set('#hero-rest', { autoAlpha: 0, y: 40 });
    gsap.set('.hero-orbit', { autoAlpha: 1, scale: 1 });
    gsap.set('.scroll-indicator', { autoAlpha: 1, y: 0 });

    // A intro agora é TEMPO-BASEADA (não presa ao scroll): o primeiro gesto
    // de scroll dá o "play" num filme de ~2,6s e o scroll fica travado até
    // ele terminar. A inércia do trackpad não tem como atropelar a animação
    // — o pouso é sempre a tela da headline.

    // Chegou por âncora ou com scroll restaurado? Não prende: estado final.
    // Pula a intro no mobile e em visita repetida na mesma sessão: o visitante
    // cai direto na headline com os CTAs. A intro fica pra primeira visita no desktop.
    let introSeen = false;
    try { introSeen = sessionStorage.getItem('lcr_intro') === '1'; } catch (e) {}
    if (location.hash || window.scrollY > 10 || introSeen || window.innerWidth < 768) { finishHeroInstant(); return true; }
    try { sessionStorage.setItem('lcr_intro', '1'); } catch (e) {}

    // Trava o scroll durante a intro
    const lockEl = document.documentElement;
    lockEl.style.overflow = 'hidden';
    lockEl.style.overscrollBehavior = 'none';
    lockEl.style.touchAction = 'none';
    document.body.style.overflow = 'hidden';
    const blockTouch = (e) => { e.preventDefault(); };
    window.addEventListener('touchmove', blockTouch, { passive: false });

    // Destravamento: idealmente numa pausa curta do wheel (pra não herdar
    // inércia do gesto do play), mas com TETO de 450ms — quem continua
    // scrollando quer seguir adiante, nunca pode ficar preso.
    let lastWheel = 0;
    let unlockDeadline = 0;
    const noteWheel = () => { lastWheel = performance.now(); };
    window.addEventListener('wheel', noteWheel, { passive: true });
    const release = () => {
      lockEl.style.overflow = '';
      lockEl.style.overscrollBehavior = '';
      lockEl.style.touchAction = '';
      document.body.style.overflow = '';
      window.removeEventListener('wheel', noteWheel);
      window.removeEventListener('touchmove', blockTouch);
    };
    const unlock = () => {
      if (!unlockDeadline) unlockDeadline = performance.now() + 350;
      const now = performance.now();
      if (now - lastWheel >= 200 || now >= unlockDeadline) release();
      else setTimeout(unlock, 60);
    };

    // Objeto auxiliar para controle linear da escala e rotação compensadas
    const logoAnim = { scale: 1, rotation: -3 };

    const tl = gsap.timeline({ paused: true, onComplete: unlock });
    tl
      // FASE 1: a logo cresce (zoom in) e gira levemente. A tinta interna compensa
      // a transformação para ficar fixa. A luz aqua se dissipa e a tinta em tela
      // cheia surge — no fim da fase, a tela é toda clara.
      .to(logoAnim, {
        scale: 15, // cobre a tela toda, incluindo concavidades da logo
        rotation: 0,
        ease: 'power2.in',
        duration: 0.65,
        onUpdate: () => {
          gsap.set('#mask-logo', { scale: logoAnim.scale, rotate: logoAnim.rotation });
          gsap.set('.fixed-gradient-bg', { scale: 1 / logoAnim.scale, rotate: -logoAnim.rotation });
        }
      }, 0)
      .to('#hero-glow', { scale: 2.5, autoAlpha: 0, ease: 'power2.in', duration: 0.65 }, 0)
      // a foto da FRENTE mergulha junto com o zoom (empurrão + fade)
      .to('#hero-photo-frente', { autoAlpha: 0, scale: FRENTE_ZOOM + 0.15, ease: 'power2.in', duration: 0.6 }, 0)
      // o ghost da fachada dentro do dente se dissolve cedo: a tinta fica
      // pura antes do handoff pro fundo em tela cheia
      .to('.logo-photo-inner', { autoAlpha: 0, ease: 'power1.in', duration: 0.4 }, 0)
      .to('#hero-bg-grad', { opacity: 1, ease: 'power2.inOut', duration: 0.65 }, 0)
      .to('.hero-orbit', { autoAlpha: 0, scale: 1.4, ease: 'power2.in', duration: 0.5 }, 0)
      .to('.scroll-indicator', { autoAlpha: 0, y: 20, ease: 'power2.in', duration: 0.35 }, 0)

      // Handoff invisível: desligamos a logo e ligamos a headline.
      // A troca é imperceptível porque a headline usa a MESMA tinta do fundo.
      .set('#mask-logo', { autoAlpha: 0 })
      .set('#mask-text', { autoAlpha: 1 })

      // FASE 2: a headline diminui (zoom out) e se endireita, enquanto a tinta de
      // fundo se dissipa e revela o verde-noite — a nova capa da marca.
      .to('#cine-title', {
        scale: 1,
        rotate: 0,
        letterSpacing: '-0.02em',
        ease: 'power3.out',
        duration: 0.7
      })
      .to('#hero-bg-grad', { opacity: 0, ease: 'power2.inOut', duration: 0.7 }, '<')
      // a foto do INTERIOR assenta atrás da headline (fade + acomodação)
      .to('#hero-photo-interior', { autoAlpha: PHOTO_ALPHA, scale: 1.06, ease: 'power2.out', duration: 0.8 }, '<')
      .to('#hero-rest', { autoAlpha: 1, y: 0, ease: 'power3.out', duration: 0.4 }, '-=0.35');

    // O primeiro gesto (wheel, swipe, tecla ou clique no indicador) dá o play
    let played = false;
    const play = () => { if (!played) { played = true; tl.play(); } };
    window.addEventListener('wheel', play, { passive: true });
    window.addEventListener('touchmove', play, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') play();
    });
    const scrollInd = document.querySelector('.scroll-indicator');
    if (scrollInd) {
      scrollInd.style.pointerEvents = 'auto';
      scrollInd.style.cursor = 'pointer';
      scrollInd.addEventListener('click', play);
    }

    // Parallax sutil no hero (só ponteiro fino): cada camada com uma
    // profundidade, seguindo o cursor com física suave
    if (window.matchMedia('(pointer: fine)').matches) {
      const layers = [
        ['#hero-photo-frente', 14],
        ['#hero-photo-interior', 10],
        ['#hero-glow', 26],
        ['.hero-orbit', 18]
      ].map(([sel, depth]) => [
        gsap.quickTo(sel, 'x', { duration: 0.7, ease: 'power2.out' }),
        gsap.quickTo(sel, 'y', { duration: 0.7, ease: 'power2.out' }),
        depth
      ]);
      document.querySelector('.cinema-sticky').addEventListener('pointermove', (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        for (const [qx, qy, depth] of layers) { qx(nx * depth); qy(ny * depth); }
      });
    }

    return true;
  }

  // Estado final do hero sem animação (âncora/refresh no meio da página)
  function finishHeroInstant() {
    gsap.set('#hero-photo-frente', { autoAlpha: 0 });
    gsap.set('#hero-photo-interior', { autoAlpha: 0.3, scale: 1.06 });
    gsap.set('#mask-logo', { autoAlpha: 0 });
    gsap.set('#hero-glow', { autoAlpha: 0 });
    gsap.set('.hero-orbit', { autoAlpha: 0 });
    gsap.set('.scroll-indicator', { autoAlpha: 0 });
    gsap.set('#mask-text', { autoAlpha: 1 });
    gsap.set('#cine-title', { scale: 1, rotate: 0, letterSpacing: '-0.02em' });
    gsap.set('#hero-rest', { autoAlpha: 1, y: 0 });
  }

  function staticHeroFallback() {
    // Fallback (reduced-motion ou GSAP indisponível): hero estático
    const ml = document.getElementById('mask-logo');
    const mt = document.getElementById('mask-text');
    const hr = document.getElementById('hero-rest');
    const bg = document.getElementById('hero-bg-grad');
    const glow = document.getElementById('hero-glow');
    const orbit = document.querySelector('.hero-orbit');
    const scrollInd = document.querySelector('.scroll-indicator');
    const pf = document.getElementById('hero-photo-frente');
    const pi = document.getElementById('hero-photo-interior');
    if (pf) pf.style.display = 'none';
    if (pi) { pi.style.opacity = '0.3'; pi.style.visibility = 'visible'; }
    if (ml) ml.style.display = 'none';
    if (bg) bg.style.display = 'none';
    if (glow) glow.style.display = 'none';
    if (orbit) orbit.style.display = 'none';
    if (scrollInd) scrollInd.style.display = 'none';
    if (mt) {
      mt.style.position = 'relative';
      mt.style.opacity = '1';
      mt.style.visibility = 'visible';
    }
    const title = document.getElementById('cine-title');
    if (title) {
      title.style.transform = 'none';
      title.style.letterSpacing = 'normal';
    }
    if (hr) {
      hr.style.opacity = '1';
      hr.style.visibility = 'visible';
      hr.style.transform = 'none';
    }
  }

  if (!initHero()) {
    if (prefersReducedMotion) {
      staticHeroFallback();
    } else {
      // Espera GSAP e/ou uma viewport com largura conhecida (até ~8s)
      let heroTries = 0;
      const heroPoll = setInterval(() => {
        if (initHero()) { clearInterval(heroPoll); return; }
        if (++heroTries > 80) {
          clearInterval(heroPoll);
          staticHeroFallback();
        }
      }, 100);
    }
  }


  // Tilt 3D nos passos da primeira visita (estilo Apple TV): o card inclina
  // seguindo o cursor; o brilho (::after) acompanha via CSS vars
  if (window.gsap && !prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.step-card').forEach(card => {
      gsap.set(card, { transformPerspective: 700 });
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2.out' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2.out' });
      const ty = gsap.quickTo(card, 'y', { duration: 0.5, ease: 'power2.out' });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        rx(-py * 8); ry(px * 10); ty(-6);
        card.style.setProperty('--mx', ((px + 0.5) * 100) + '%');
        card.style.setProperty('--my', ((py + 0.5) * 100) + '%');
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); ty(0); });
    });
  }

  // Coreografia de entrada por seção: divide o título em palavras (.w com
  // índice --wi), marca subtítulos em ordem (--ci) e liga .in-view quando o
  // bloco aparece. Sem JS nada fica escondido (.choreo só entra aqui).
  function splitTitleWords(h2) {
    let idx = 0;
    Array.from(h2.childNodes).forEach(node => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.style.setProperty('--wi', idx++);
          w.textContent = part;
          frag.appendChild(w);
        });
        h2.replaceChild(frag, node);
      } else if (node.nodeType === 1) {
        node.classList.add('w');
        node.style.setProperty('--wi', idx++);
      }
    });
  }
  function setupChoreo(container, titleSel, subSels) {
    if (!container) return;
    const h2 = container.querySelector(titleSel);
    if (h2) { splitTitleWords(h2); h2.classList.add('choreo-title'); }
    (subSels || []).forEach((sel, i) => {
      const el = container.querySelector(sel);
      if (el) { el.classList.add('choreo-sub'); el.style.setProperty('--ci', i); }
    });
    container.classList.add('choreo');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { container.classList.add('in-view'); io.disconnect(); }
      });
    }, { threshold: 0.2 });
    io.observe(container);
  }
  setupChoreo(document.querySelector('.visit-panel'), '.section-header h2',
    ['.section-header p', '.visit-note']);
  setupChoreo(document.querySelector('.doctor-grid'), '.doctor-info h2',
    ['.doctor-cro', '.doctor-info p:nth-of-type(1)', '.doctor-info p:nth-of-type(2)']);
})();
