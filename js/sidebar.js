// Apply saved theme before render to avoid flash
(function () {
  if (localStorage.getItem('lcr-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

const SIDEBAR_HTML = `
<div class="sidebar-logo">
  <img src="../assets/logo-lcr.svg" alt="Clínica LCR" id="sidebar-logo-img">
  <div class="sidebar-subtitle">Gestão Odontológica</div>
</div>
<nav>
  <ul class="sidebar-nav">
    <li class="nav-group-label">Atendimento</li>
    <li>
      <a href="../pages/dashboard.html" data-page="dashboard">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Dashboard
      </a>
    </li>
    <li>
      <a href="../pages/agenda.html" data-page="agenda">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        Agenda
      </a>
    </li>
    <li>
      <a href="../pages/pacientes.html" data-page="pacientes">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Pacientes
      </a>
    </li>
    <li>
      <a href="../pages/prontuario.html" data-page="prontuario">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 12h6M9 16h6M9 8h6M5 3h14a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2z"/></svg>
        Prontuário
      </a>
    </li>
    <li class="nav-group-label">Gestão</li>
    <li>
      <a href="../pages/financeiro.html" data-page="financeiro">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        Financeiro
      </a>
    </li>
    <li>
      <a href="../pages/anamnese.html" data-page="anamnese">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
        Anamnese
      </a>
    </li>
  </ul>
</nav>
<div class="sidebar-footer">
  <div class="sidebar-user">
    <strong>Dra. Lara Camila</strong>
    CRO-BA 15247
  </div>
  <button class="dark-toggle" id="dark-toggle-btn" title="Alternar tema claro/escuro">
    <svg id="icon-moon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    <svg id="icon-sun" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  </button>
</div>
`;

const SIDEBAR_HTML_ROOT = SIDEBAR_HTML
  .replace('href="../index.html"', 'href="index.html"')
  .replace(/href="\.\.\/pages\//g, 'href="pages/');

function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('lcr-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('lcr-theme', 'dark');
  }
  updateToggleIcon();
}

function updateToggleIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const moon = document.getElementById('icon-moon');
  const sun  = document.getElementById('icon-sun');
  if (!moon || !sun) return;
  moon.style.display = isDark ? 'none'  : 'block';
  sun.style.display  = isDark ? 'block' : 'none';
}

function initSidebar() {
  const placeholder = document.getElementById('sidebar');
  if (!placeholder) return;

  const isRoot = !window.location.pathname.includes('/pages/');
  placeholder.innerHTML = isRoot ? SIDEBAR_HTML_ROOT : SIDEBAR_HTML;

  const logo = placeholder.querySelector('#sidebar-logo-img');
  if (logo && isRoot) logo.src = 'assets/logo-lcr.svg';

  // Active link
  const path = window.location.pathname;
  placeholder.querySelectorAll('a[data-page]').forEach(a => {
    const page = a.dataset.page;
    const active =
      (page === 'dashboard' && (path.endsWith('index.html') || path.endsWith('/'))) ||
      path.includes(page);
    if (active) a.classList.add('active');
  });

  // Dark mode toggle
  const toggleBtn = placeholder.querySelector('#dark-toggle-btn');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleDark);
  updateToggleIcon();
}

document.addEventListener('DOMContentLoaded', initSidebar);
