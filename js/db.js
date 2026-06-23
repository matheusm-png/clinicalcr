/**
 * DB — Persistência em localStorage para a Clínica LCR.
 *
 * Dados sobrevivem a recarregamentos e fechamentos de aba no mesmo navegador.
 * Para migrar ao Supabase: substitua cada método por chamadas à sua API REST,
 * mantendo a mesma assinatura — o restante do sistema não precisará mudar.
 *
 * Schema v3 — zera automaticamente dados de versões anteriores (mocks).
 */

const _SCHEMA = '3';

/* ── Limpa dados de versões antigas (inclui todos os mocks) ── */
(function () {
  if (localStorage.getItem('lcr_version') !== _SCHEMA) {
    Object.keys(localStorage)
      .filter(k => k.startsWith('lcr_'))
      .forEach(k => localStorage.removeItem(k));
    localStorage.setItem('lcr_version', _SCHEMA);
  }
})();

/* ── Primitivos ────────────────────────────────────────────── */
function _get(key, def = []) {
  try {
    const v = localStorage.getItem('lcr_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch { return def; }
}

function _set(key, val) {
  localStorage.setItem('lcr_' + key, JSON.stringify(val));
  return val;
}

function _nextId(entity) {
  const n = (parseInt(localStorage.getItem('lcr_id_' + entity) || '0')) + 1;
  localStorage.setItem('lcr_id_' + entity, String(n));
  return n;
}

function _saveEntity(entity, item) {
  const all = _get(entity, []);
  if (item.id) {
    const i = all.findIndex(x => String(x.id) === String(item.id));
    if (i >= 0) all[i] = item; else all.push(item);
  } else {
    item.id = _nextId(entity);
    item.criadoEm = new Date().toISOString();
    all.push(item);
  }
  _set(entity, all);
  return item;
}

function _removeEntity(entity, id) {
  _set(entity, _get(entity, []).filter(x => String(x.id) !== String(id)));
}

/* ── DB object ─────────────────────────────────────────────── */
const DB = {

  /* ─ Acesso genérico (compatibilidade com código legado) ─── */
  get:  (key, def) => _get(key, def),
  save: (key, val) => _set(key, val),

  /* ─ PACIENTES ─────────────────────────────────────────────── */
  pacientes: {
    list()       { return _get('pacientes', []); },
    get(id)      { return this.list().find(p => String(p.id) === String(id)) ?? null; },
    save(p)      { return _saveEntity('pacientes', p); },
    remove(id)   { _removeEntity('pacientes', id); },
  },

  /* ─ PROCEDIMENTOS (Odontograma) ───────────────────────────── */
  procedimentos: {
    list(pacienteId) {
      const all = _get('procedimentos', []);
      return pacienteId != null
        ? all.filter(p => String(p.pacienteId) === String(pacienteId))
        : all;
    },
    get(id)      { return _get('procedimentos', []).find(p => String(p.id) === String(id)) ?? null; },
    save(p)      { return _saveEntity('procedimentos', p); },
    remove(id)   { _removeEntity('procedimentos', id); },
  },

  /* ─ ANAMNESES ─────────────────────────────────────────────── */
  anamneses: {
    list(pacienteId) {
      const all = _get('anamneses', []);
      return pacienteId != null
        ? all.filter(a => String(a.pacienteId) === String(pacienteId))
        : all;
    },
    save(a) {
      const all = _get('anamneses', []);
      a.id = _nextId('anamneses');
      a.criadoEm = new Date().toISOString();
      all.push(a);
      _set('anamneses', all);
      return a;
    },
    remove(id)   { _removeEntity('anamneses', id); },
  },

  /* ─ FINANCEIRO ────────────────────────────────────────────── */
  financeiro: {
    list()       { return _get('financeiro', []); },
    get(id)      { return this.list().find(l => String(l.id) === String(id)) ?? null; },
    add(l)       { return _saveEntity('financeiro', l); },
    update(l)    { return _saveEntity('financeiro', l); },
    remove(id)   { _removeEntity('financeiro', id); },
  },

  /* ─ AGENDAMENTOS ──────────────────────────────────────────── */
  agendamentos: {
    list()       { return _get('agendamentos', []); },
    get(id)      { return this.list().find(a => String(a.id) === String(id)) ?? null; },
    save(a)      { return _saveEntity('agendamentos', a); },
    remove(id)   { _removeEntity('agendamentos', id); },
  },

  /* ─ ESTOQUE ───────────────────────────────────────────────── */
  estoque: {
    list()       { return _get('estoque', []); },
    get(id)      { return this.list().find(i => String(i.id) === String(id)) ?? null; },
    save(item)   { return _saveEntity('estoque', item); },
    remove(id)   { _removeEntity('estoque', id); },
  },

  /* ─ Utilitários ───────────────────────────────────────────── */

  /** Exporta todos os dados como JSON string (backup manual). */
  exportar() {
    const snap = { _schema: _SCHEMA, _exportadoEm: new Date().toISOString() };
    ['pacientes','procedimentos','anamneses','financeiro','agendamentos','estoque']
      .forEach(k => { snap[k] = _get(k, []); });
    return JSON.stringify(snap, null, 2);
  },

  /** Importa dados de um JSON string produzido por exportar(). */
  importar(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    ['pacientes','procedimentos','anamneses','financeiro','agendamentos','estoque']
      .forEach(k => { if (Array.isArray(data[k])) _set(k, data[k]); });
  },

  /** Apaga todos os dados (usar com cuidado). */
  zerarTudo() {
    ['pacientes','procedimentos','anamneses','financeiro','agendamentos','estoque']
      .forEach(k => {
        localStorage.removeItem('lcr_' + k);
        localStorage.removeItem('lcr_id_' + k);
      });
  },
};

/* ── Alias de compatibilidade ──────────────────────────────── */
window.DB     = DB;
window.FakeDB = DB;   // código existente continua funcionando sem mudanças
