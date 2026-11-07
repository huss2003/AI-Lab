/* Neuromind AI Lab demo — core runtime shared by every module.
   Modules call NM.register(id, def). The shell builds the nav, routes on location.hash, and re-renders on field change.
   All data is fictional mock data (window.NM_DATA). Nothing leaves the browser. */
(function () {
  const D = window.NM_DATA;
  const listeners = {};
  const modules = {};
  const state = {
    field: 'data_analytics',            // currently selected career field (id from NM_DATA.fields)
    route: null,
    xp: D.demo_student.xp,
    // Shared demo progress: modules write here and emit events so other views (mentor console, home) reflect it live.
    progress: { lecturesWatched: 64, mcqCorrect: 0, mcqAnswered: 0, practicalScore: null, examScore: null, milestoneStatus: 'in_progress', portfolioPublished: false, certificates: 3 },
  };
  try { const f = localStorage.getItem('nm-demo-field'); if (f && D.fields.some((x) => x.id === f)) state.field = f; } catch (e) {}

  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    exam: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    project: '<path d="M4 7h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 7V5h6v2"/>',
    mentor: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    flow: '<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.5 6h9M6.3 8.2l4.5 7.6M17.7 8.2l-4.5 7.6"/>',
    spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    github: '<path d="M9 19c-4 1.2-4-2-5.5-2.5M14.5 21v-3.2a2.8 2.8 0 0 0-.8-2.2c2.6-.3 5.3-1.3 5.3-5.8a4.5 4.5 0 0 0-1.2-3.1 4.2 4.2 0 0 0-.1-3.1s-1-.3-3.2 1.2a11 11 0 0 0-5.8 0C6.5 3.3 5.5 3.6 5.5 3.6a4.2 4.2 0 0 0-.1 3.1 4.5 4.5 0 0 0-1.2 3.1c0 4.5 2.7 5.5 5.3 5.8a2.8 2.8 0 0 0-.8 2.2V21"/>',
    forum: '<path d="M4 5h16v11H9l-5 4z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
  };
  function icon(name, cls) {
    return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
  }

  // Tiny element helper: h('div', {class: 'card', onclick: fn}, 'text', childNode, ...)
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return () => { listeners[evt] = listeners[evt].filter((f) => f !== fn); }; }
  function emit(evt, payload) { (listeners[evt] || []).slice().forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); }

  function toast(msg, kind) {
    let box = document.querySelector('.toasts');
    if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: 'toast ' + (kind || '') }, msg);
    box.append(t); setTimeout(() => t.remove(), 3600);
  }
  function addXP(n, reason) { state.xp += n; emit('xp', { xp: state.xp, gained: n, reason }); toast(`+${n} XP · ${reason}`, 'green'); }

  function modal(contentNode) {
    const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } });
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, contentNode);
    function close() { back.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    back.append(box); document.body.append(back);
    return { close, box };
  }

  const field = () => D.fields.find((f) => f.id === state.field) || D.fields[0];
  function setField(id) {
    if (!D.fields.some((f) => f.id === id) || id === state.field) return;
    state.field = id; try { localStorage.setItem('nm-demo-field', id); } catch (e) {}
    const sel = document.getElementById('fieldSel'); if (sel) sel.value = id;
    emit('field', field()); renderRoute();
  }

  function register(id, def) { modules[id] = Object.assign({ id, order: 50, group: 'Student' }, def); if (document.readyState !== 'loading' && window.__nmBooted) buildNav(); }
  function go(id) { if (location.hash !== '#' + id) location.hash = id; else renderRoute(); }

  function buildNav() {
    const nav = document.getElementById('nav'); if (!nav) return;
    nav.textContent = '';
    const groups = {};
    Object.values(modules).sort((a, b) => a.order - b.order).forEach((m) => { (groups[m.group] = groups[m.group] || []).push(m); });
    for (const g of ['Student', 'Mentor', 'How it works']) {
      if (!groups[g]) continue;
      const wrap = h('div', { class: 'nav-group' }, h('span', {}, g));
      groups[g].forEach((m) => wrap.append(h('button', { class: 'nav-btn', 'data-id': m.id, html: icon(m.icon) + `<span>${esc(m.label)}</span>`, onclick: () => go(m.id) })));
      nav.append(wrap);
    }
    markNav();
  }
  function markNav() { document.querySelectorAll('.nav-btn').forEach((b) => { if (b.dataset.id === state.route) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }

  function renderRoute() {
    let id = (location.hash || '').slice(1);
    if (!modules[id]) id = 'home';
    const m = modules[id]; if (!m) return;
    if (state.route && modules[state.route] && modules[state.route].destroy && state.route !== id) { try { modules[state.route].destroy(); } catch (e) { console.error(e); } }
    state.route = id;
    document.querySelectorAll('.nav-btn').forEach((b) => { if (b.dataset.id === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.getElementById('crumbGroup').textContent = m.group === 'Student' ? `Student view · ${D.demo_student.name}` : m.group;
    document.getElementById('crumbTitle').textContent = m.title || m.label;
    const view = document.getElementById('view');
    view.textContent = ''; view.scrollTop = 0; window.scrollTo(0, 0);
    try { m.render(view, ctx()); } catch (e) { console.error(e); view.append(h('div', { class: 'card' }, 'This screen failed to load: ' + e.message)); }
  }
  function ctx() { return { data: D, field: field(), state, h, esc, icon, on, emit, toast, addXP, modal, go, setField }; }

  function boot() {
    const sel = document.getElementById('fieldSel');
    D.fields.forEach((f) => sel.append(h('option', { value: f.id }, f.short)));
    sel.value = state.field;
    sel.addEventListener('change', () => setField(sel.value));
    document.getElementById('whoName').textContent = D.demo_student.name;
    document.getElementById('whoAvatar').textContent = D.demo_student.name.split(' ').map((s) => s[0]).join('');
    window.__nmBooted = true;
    buildNav(); renderRoute();
    window.addEventListener('hashchange', renderRoute);
  }

  window.NM = { data: D, state, register, go, on, emit, toast, addXP, modal, h, esc, icon, field, setField, ctx, boot };
})();
