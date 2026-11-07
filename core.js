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
    role: 'student',                    // 'student' | 'mentor' | 'admin', follows the group of the open screen
    notifications: [],                  // [{id, title, body, route, ts, read}] filled through notify()
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
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M19 19v2H6"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
    cert: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 8h10M7 11h6"/><circle cx="16" cy="17" r="3"/><path d="M14.5 19.5L14 22l2-1 2 1-.5-2.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    login: '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l4 4-4 4M4 12h10"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    rupee: '<path d="M7 4h10M7 8.5h10M7 4c5 0 6.5 1.5 6.5 4.5S11 13 7 13l7 7"/>',
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
  // Notifications: any module can call notify(); the shell shows them under the bell.
  function notify(title, body, route) {
    const n = { id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6), title, body: body || '', route: route || null, ts: Date.now(), read: false };
    state.notifications.unshift(n); emit('notify', n); return n;
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
    const order = ['Start', 'Student', 'Community', 'Mentor', 'Admin', 'How it works'];
    for (const g of order.concat(Object.keys(groups).filter((x) => !order.includes(x)))) {
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
    if (!modules[id]) id = (!id && modules.welcome) ? 'welcome' : 'home';
    const m = modules[id]; if (!m) return;
    if (state.route && modules[state.route] && modules[state.route].destroy && state.route !== id) { try { modules[state.route].destroy(); } catch (e) { console.error(e); } }
    state.route = id;
    const role = m.group === 'Mentor' ? 'mentor' : m.group === 'Admin' ? 'admin' : 'student';
    if (role !== state.role) { state.role = role; emit('role', role); }
    document.querySelectorAll('.nav-btn').forEach((b) => { if (b.dataset.id === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.getElementById('crumbGroup').textContent = (m.group === 'Student' || m.group === 'Community') ? `Student view · ${D.demo_student.name}` : m.group;
    document.getElementById('crumbTitle').textContent = m.title || m.label;
    const view = document.getElementById('view');
    view.textContent = ''; view.scrollTop = 0; window.scrollTo(0, 0);
    emit('route', id);
    try { m.render(view, ctx()); } catch (e) { console.error(e); view.append(h('div', { class: 'card' }, 'This screen failed to load: ' + e.message)); }
  }
  function ctx() { return { data: D, field: field(), state, h, esc, icon, on, emit, toast, addXP, modal, go, setField, notify }; }

  function boot() {
    const sel = document.getElementById('fieldSel');
    D.fields.forEach((f) => sel.append(h('option', { value: f.id }, f.short)));
    sel.value = state.field;
    sel.addEventListener('change', () => setField(sel.value));
    document.getElementById('whoName').textContent = D.demo_student.name;
    document.getElementById('whoAvatar').textContent = D.demo_student.name.split(' ').map((s) => s[0]).join('');
    shellInit();
    window.__nmBooted = true;
    buildNav(); renderRoute();
    renderWho();
    window.addEventListener('hashchange', renderRoute);
  }

  // ---------- Shell: theme, top-bar popovers, notifications, role switcher, search, guided tour, mobile drawer ----------
  const $ = (id) => document.getElementById(id);
  const THEME_KEY = 'nm-demo-theme';
  const THEME_ICON = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    dark: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  };
  const THEME_LABEL = { light: 'Light', dark: 'Dark', system: 'Match my device' };
  const svg = (paths, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  state.theme = (() => { try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark') return t; } catch (e) {} return 'system'; })();
  function isDark() { return state.theme === 'dark' || (state.theme === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function setTheme(mode) {
    if (!THEME_LABEL[mode]) return;
    state.theme = mode;
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
    try { if (mode === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, mode); } catch (e) {}
    renderThemeBtn(); emit('theme', mode);
  }
  function renderThemeBtn() {
    const b = $('themeBtn'); if (!b) return;
    b.innerHTML = svg(THEME_ICON[state.theme]);
    b.setAttribute('aria-label', `Colour theme: ${THEME_LABEL[state.theme]}`); b.title = `Theme: ${THEME_LABEL[state.theme]}`;
  }

  // Popovers anchored to a top-bar button (one open at a time).
  let pop = null;
  function closePop() {
    if (!pop) return;
    const p = pop; pop = null;
    p.el.remove(); p.btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', p.outside, true); document.removeEventListener('keydown', p.key, true);
  }
  function placePop(el, btn) {
    const r = btn.getBoundingClientRect(); const w = Math.min(el.offsetWidth, innerWidth - 24);
    let left = r.right - w; left = Math.max(12, Math.min(left, innerWidth - 12 - w));
    el.style.left = left + 'px'; el.style.top = (r.bottom + 8) + 'px';
    el.style.maxHeight = Math.max(200, innerHeight - r.bottom - 20) + 'px'; el.style.overflowY = 'auto';
  }
  function openPop(btn, build, label) {
    if (pop && pop.btn === btn) { closePop(); return; }
    closePop();
    const el = h('div', { class: 'pop', role: 'dialog', 'aria-label': label });
    const rebuild = () => { el.textContent = ''; build(el); };
    rebuild(); document.body.append(el); placePop(el, btn);
    btn.setAttribute('aria-expanded', 'true');
    const items = () => [...el.querySelectorAll('button:not(:disabled)')];
    const outside = (e) => { if (!el.contains(e.target) && !btn.contains(e.target)) closePop(); };
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closePop(); btn.focus(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = items(); if (!list.length) return; e.preventDefault();
        const i = list.indexOf(document.activeElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
      }
    };
    document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', key, true);
    pop = { el, btn, outside, key, rebuild };
    const first = el.querySelector('[aria-checked="true"]') || items()[0]; if (first) first.focus({ preventScroll: true });
  }

  function themeMenu(el) {
    el.append(h('div', { class: 'pop-head' }, h('b', {}, 'Theme')));
    ['light', 'dark', 'system'].forEach((m) => el.append(h('button', { class: 'pop-item', type: 'button', role: 'menuitemradio', 'aria-checked': String(state.theme === m),
      html: svg(THEME_ICON[m]) + `<span class="tx">${THEME_LABEL[m]}</span>` + (state.theme === m ? svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'tick') : ''),
      onclick: () => { setTheme(m); closePop(); } })));
  }

  // Notifications under the bell.
  function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    const d = Math.floor(s / 86400); return d === 1 ? 'Yesterday' : `${d} days ago`;
  }
  function unread() { return state.notifications.filter((n) => !n.read).length; }
  function renderBell() {
    const b = $('bellBtn'), c = $('bellCount'); if (!b || !c) return;
    const n = unread(); c.hidden = !n; c.textContent = n > 9 ? '9+' : String(n);
    b.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
    if (pop && pop.btn === b) pop.rebuild();
  }
  function markRead(id) { const n = state.notifications.find((x) => x.id === id); if (n && !n.read) { n.read = true; emit('notify:read', n); } renderBell(); }
  function markAllRead() { state.notifications.forEach((n) => { n.read = true; }); emit('notify:read', null); renderBell(); }
  function bellPanel(el) {
    const n = unread();
    el.append(h('div', { class: 'pop-head' }, h('b', {}, n ? `Notifications · ${n} new` : 'Notifications'),
      h('button', { class: 'btn sm ghost', type: 'button', disabled: !n, onclick: () => markAllRead() }, 'Mark all read')));
    const list = h('div', { class: 'notif-list' });
    if (!state.notifications.length) list.append(h('div', { class: 'empty' }, 'You are all caught up.'));
    state.notifications.forEach((x) => list.append(h('button', { class: 'notif' + (x.read ? '' : ' unread'), type: 'button',
      onclick: () => { markRead(x.id); closePop(); if (x.route && modules[x.route]) go(x.route); else if (x.route) toast('That screen is not in this build yet.', 'amber'); } },
      h('span', { class: 'nd' }), h('span', {}, h('b', {}, x.title), x.body ? h('p', {}, x.body) : null, h('time', {}, ago(x.ts))))));
    el.append(list);
  }

  // Role switcher: the top-bar person follows state.role.
  const PEOPLE = {
    student: { name: D.demo_student.name, role: 'Student', route: 'home', desc: 'Home and today’s plan' },
    mentor: { name: 'Kavita Rao', role: 'Mentor', route: 'mentor', desc: 'Mentor console and reviews' },
    admin: { name: 'Lab admin', role: 'Admin', route: 'admin', desc: 'Costs, budgets and servers' },
  };
  const initials = (s) => s.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  function renderWho() {
    const p = PEOPLE[state.role] || PEOPLE.student;
    const nm = $('whoName'), av = $('whoAvatar'), rl = $('whoRole'), btn = $('roleBtn');
    if (nm) nm.textContent = p.name;
    if (av) { av.textContent = initials(p.name); av.className = 'avatar role-' + (PEOPLE[state.role] ? state.role : 'student'); }
    if (rl) rl.textContent = `${p.role} view`;
    if (btn) btn.setAttribute('aria-label', `Viewing as ${p.role}, ${p.name}. Switch view`);
  }
  function switchRole(role) {
    const p = PEOPLE[role]; if (!p) return;
    if (modules[p.route]) go(p.route); else toast(`The ${p.role.toLowerCase()} screen is not in this build yet.`, 'amber');
  }
  function roleMenu(el) {
    el.append(h('div', { class: 'pop-head' }, h('b', {}, 'View the demo as')));
    Object.entries(PEOPLE).forEach(([k, p]) => el.append(h('button', { class: 'pop-item', type: 'button', role: 'menuitemradio', 'aria-checked': String(state.role === k),
      html: `<span class="avatar role-${k}">${esc(initials(p.name))}</span><span class="tx"><span>View as ${p.role}</span><small>${esc(p.name)} · ${esc(p.desc)}</small></span>` + (state.role === k ? svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'tick') : ''),
      onclick: () => { closePop(); switchRole(k); } })));
  }

  // Mobile and tablet drawer.
  function drawerOpen() { const a = $('app'); return !!(a && a.classList.contains('nav-open')); }
  function openDrawer() {
    const a = $('app'); if (!a) return; a.classList.add('nav-open'); $('menuBtn').setAttribute('aria-expanded', 'true'); $('menuBtn').setAttribute('aria-label', 'Close menu');
    const cur = document.querySelector('.nav-btn[aria-current="page"]') || document.querySelector('.nav-btn'); if (cur) setTimeout(() => cur.focus({ preventScroll: true }), 50);
  }
  function closeDrawer() {
    const a = $('app'); if (!a || !a.classList.contains('nav-open')) return;
    a.classList.remove('nav-open'); $('menuBtn').setAttribute('aria-expanded', 'false'); $('menuBtn').setAttribute('aria-label', 'Open menu');
  }

  // Global search / command palette (Ctrl or Cmd + K).
  let palette = null;
  function searchItems() {
    const out = [];
    Object.values(modules).sort((a, b) => a.order - b.order).forEach((m) => out.push({ group: 'Screens', icon: m.icon, title: m.label, sub: `${m.title || m.label} · ${m.group}`, kw: `${m.id} ${m.group}`, go: 'Open', run: () => go(m.id) }));
    const dark = isDark();
    out.push({ group: 'Actions', icon: 'spark', title: 'Start the guided tour', sub: 'A two-minute walk through the whole lab', kw: 'tour help guide demo walkthrough', go: 'Start', run: () => tourApi.start() });
    out.push({ group: 'Actions', icon: 'settings', title: dark ? 'Switch to light mode' : 'Switch to dark mode', sub: 'Change the colour theme', kw: 'theme dark light mode night colour color', go: 'Run', run: () => setTheme(dark ? 'light' : 'dark') });
    if (state.theme !== 'system') out.push({ group: 'Actions', icon: 'settings', title: 'Match my device theme', sub: 'Follow the light or dark setting of this device', kw: 'theme system auto', go: 'Run', run: () => setTheme('system') });
    Object.entries(PEOPLE).filter(([k]) => k !== state.role).forEach(([k, p]) => out.push({ group: 'Actions', icon: k === 'admin' ? 'shield' : k === 'mentor' ? 'mentor' : 'users', title: `View as ${p.role}`, sub: `${p.name} · ${p.desc}`, kw: 'role switch view ' + k, go: 'Switch', run: () => switchRole(k) }));
    if (unread()) out.push({ group: 'Actions', icon: 'bell', title: 'Mark all notifications read', sub: `${unread()} unread`, kw: 'notifications bell clear', go: 'Run', run: () => { markAllRead(); toast('All notifications marked read.'); } });
    out.push({ group: 'Actions', icon: 'book', title: 'Open the course documents', sub: 'The full 1-year program and every practical', kw: 'docs documents syllabus curriculum word', go: 'Open', run: () => { location.href = 'docs/'; } });
    D.fields.filter((f) => f.id !== state.field).forEach((f) => out.push({ group: 'Actions', icon: 'project', title: `Change field to ${f.short}`, sub: `${f.name} · ${f.company}`, kw: 'career field switch ' + f.name, go: 'Switch', run: () => { setField(f.id); toast(`Career field: ${f.name}`); } }));
    D.lectures.forEach((l) => out.push({ group: 'Lectures', icon: 'play', title: `Lecture ${l.id}: ${l.topic}`, sub: `Week ${l.week} · Month ${l.month} · Practical: ${l.practical}`, kw: `L${l.id} ${D.months[l.month] || ''}`, go: 'Open', run: () => { state.openLecture = l.id; emit('lecture:open', { lecture: l }); go('lecture'); } }));
    D.students.forEach((s) => { const f = D.fields.find((x) => x.id === s.field); out.push({ group: 'Students', icon: 'users', title: s.name, sub: `${f ? f.short : s.field} · ${String(s.status || '').replace(/_/g, ' ')} · ${s.id}`, kw: `${s.id} ${f ? f.name : ''} student mentor`, go: 'Mentor view', run: () => { state.openStudent = s.id; emit('student:open', { student: s }); go('mentor'); } }); });
    return out;
  }
  function filterItems(all, q) {
    q = q.trim().toLowerCase();
    if (!q) {
      const cur = D.lectures.find((l) => l.id === D.demo_student.lecture);
      return all.filter((x) => x.group === 'Screens')
        .concat(all.filter((x) => x.group === 'Actions').slice(0, 4))
        .concat(cur ? all.filter((x) => x.group === 'Lectures' && x.title.startsWith(`Lecture ${cur.id}:`)).map((x) => Object.assign({}, x, { group: 'Continue' })) : []);
    }
    const toks = q.split(/\s+/);
    const caps = { Screens: 8, Actions: 6, Lectures: 8, Students: 6 };
    const res = [];
    all.forEach((x) => {
      const hay = `${x.title} ${x.sub} ${x.kw || ''}`.toLowerCase();
      if (!toks.every((t) => hay.includes(t))) return;
      const tl = x.title.toLowerCase();
      res.push({ x, s: (tl.startsWith(q) ? 3 : 0) + (tl.includes(q) ? 2 : 0) + (/^\d+$/.test(q) && x.group === 'Lectures' && tl.startsWith(`lecture ${q}:`) ? 5 : 0) });
    });
    const groups = {};
    res.sort((a, b) => b.s - a.s).forEach(({ x }) => { (groups[x.group] = groups[x.group] || []); if (groups[x.group].length < (caps[x.group] || 6)) groups[x.group].push(x); });
    return ['Screens', 'Actions', 'Lectures', 'Students'].flatMap((g) => groups[g] || []);
  }
  function closeSearch() {
    if (!palette) return; const p = palette; palette = null;
    p.back.remove(); document.removeEventListener('keydown', p.key, true);
    if (p.ret && p.ret.focus) p.ret.focus({ preventScroll: true });
  }
  function openSearch() {
    if (palette) { palette.input.focus(); return; }
    closePop(); closeDrawer();
    const all = searchItems();
    let shown = [], sel = 0;
    const input = h('input', { type: 'text', placeholder: 'Search screens, lectures, students or actions', 'aria-label': 'Search', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'cmdkList' });
    const list = h('div', { class: 'cmdk-list', id: 'cmdkList', role: 'listbox', 'aria-label': 'Results' });
    const box = h('div', { class: 'cmdk', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search' },
      h('div', { class: 'cmdk-in', html: icon('search') }, input),
      list,
      h('div', { class: 'cmdk-foot', html: '<span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span><span style="margin-left:auto">Demo data</span>' }));
    const back = h('div', { class: 'cmdk-back', onclick: (e) => { if (e.target === back) closeSearch(); } }, box);
    function mark() {
      list.querySelectorAll('.cmdk-item').forEach((el, i) => el.setAttribute('aria-selected', String(i === sel)));
      const cur = list.querySelector('.cmdk-item[aria-selected="true"]');
      if (cur) { cur.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', cur.id); }
    }
    function run(i) { const it = shown[i]; if (!it) return; closeSearch(); setTimeout(() => it.run(), 0); }
    function draw() {
      shown = filterItems(all, input.value); sel = 0; list.textContent = '';
      if (!shown.length) { list.append(h('div', { class: 'empty' }, `Nothing matches “${input.value.trim()}”. Try a lecture topic, a student name or a screen.`)); return; }
      let g = null;
      shown.forEach((it, i) => {
        if (it.group !== g) { g = it.group; list.append(h('div', { class: 'cmdk-group', role: 'presentation' }, g)); }
        list.append(h('button', { class: 'cmdk-item', type: 'button', role: 'option', id: 'cmdk-' + i, tabindex: '-1',
          html: `<span class="ci">${icon(it.icon)}</span><span class="tx"><b>${esc(it.title)}</b><small>${esc(it.sub)}</small></span><span class="go">${esc(it.go)}</span>`,
          onmousemove: () => { if (sel !== i) { sel = i; mark(); } }, onclick: () => run(i) }));
      });
      mark();
    }
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSearch(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!shown.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    };
    input.addEventListener('input', draw);
    document.addEventListener('keydown', key, true);
    palette = { back, input, key, ret: document.activeElement };
    document.body.append(back); draw(); input.focus();
  }

  // Guided tour: walks across screens and spotlights one element per step.
  const TOUR = [
    { route: 'welcome', sel: ['#view .card', '#view > *'], title: 'Welcome to the Neuromind AI Lab', body: 'This is a clickable demo of the online lab that comes with our one-year AI course. All people and numbers are fictional demo data. The tour takes about two minutes.' },
    { route: 'home', sel: ['#view .today', '#view .card'], title: 'A student’s day starts here', body: 'Aarav, a fictional student in Month 8, sees today’s plan: one recorded lecture, a 20-minute practical and what is due this week. Every card opens the real screen.' },
    { route: 'home', sel: ['.field-pick'], title: 'Nine career fields, one lab', body: 'After Month 3 each student picks a career field. Switch it here and every practical, dataset and project changes to that field’s fictional company.' },
    { route: 'lecture', sel: ['#view .card'], title: 'Recorded lectures with checks inside', body: '104 lectures over 12 months, two a week, about 40 minutes each. Quick questions appear inside the video so students stay with it.' },
    { route: 'practical', sel: ['#view .card'], title: 'A 20-minute practical after every lecture', body: 'Students write real code in the browser. It is checked automatically within a minute. The AI tutor gives hints, never the graded answer.' },
    { route: 'workspace', sel: ['#view .card'], title: 'A cloud computer for every student', body: 'VS Code in the browser with a terminal and Docker, up to 12 hours a week. It runs on a basic laptop and shuts down after 20 idle minutes.' },
    { route: 'exam', sel: ['#view .card'], title: 'Fair exams from home', body: 'Exams run in browser lockdown mode and save answers as the student goes, so a dropped connection loses nothing.' },
    { route: 'projects', sel: ['#view .card'], title: 'Four capstones and a portfolio', body: 'Projects go to the student’s own GitHub, get a mentor review against a rubric, and turn into a portfolio website automatically.' },
    { route: 'forum', sel: ['#view .card'], title: 'Doubts answered fast', body: 'In the doubt forum the AI answers first and a mentor confirms, so no student waits a day for help.' },
    { route: 'achievements', sel: ['#view .card'], title: 'Progress students can show', body: 'XP, streaks and badges keep students going. Every certificate carries a QR code that anyone can verify.' },
    { route: 'mentor', sel: ['#view .card'], title: 'The mentor console', body: 'Mentors see who is falling behind, review capstones with a rubric and confirm forum answers from one screen.' },
    { route: 'admin', sel: ['#view .card'], title: 'Running the lab', body: 'Admins watch costs, AI key budgets and server load for the whole batch, with alerts before anything runs over.' },
    { route: 'flowmap', sel: ['#view .card'], title: 'How it all works', body: 'An animated map of the system: where student code runs and where AI answers come from (Amazon Bedrock in Mumbai).' },
    { route: null, sel: ['#searchBtn'], title: 'Explore on your own', body: 'Search any screen, lecture or student here (Ctrl K). Check the bell for updates, switch to the mentor or admin view from the name on the right, and restart this tour any time.' },
  ];
  const T = { on: false, i: 0, steps: [], token: 0, layer: null, spot: null, bubble: null, target: null };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function visibleEl(sel) {
    const list = [].concat(sel || []);
    if (list.some((x) => x.startsWith('#view'))) list.push('#view section', '#view [class*="card"]', '#view > * > *');
    for (const s of list) {
      for (const el of document.querySelectorAll(s)) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.right < 0 || r.left > innerWidth) continue;
        if (getComputedStyle(el).visibility === 'hidden') continue;
        return el;
      }
    }
    return null;
  }
  function tourPlace() {
    if (!T.on) return;
    const sp = T.spot, bb = T.bubble, el = T.target && T.target.isConnected ? T.target : null;
    const bw = bb.offsetWidth, bh = bb.offsetHeight, vw = innerWidth, vh = innerHeight, m = 12;
    if (!el) { sp.classList.add('none'); bb.style.left = Math.max(m, (vw - bw) / 2) + 'px'; bb.style.top = Math.max(m, (vh - bh) / 2) + 'px'; return; }
    sp.classList.remove('none');
    const r = el.getBoundingClientRect(), pad = 6;
    const top = Math.max(4, r.top - pad), bottom = Math.min(vh - 4, r.bottom + pad);
    const left = Math.max(4, r.left - pad), right = Math.min(vw - 4, r.right + pad);
    Object.assign(sp.style, { top: top + 'px', left: left + 'px', width: Math.max(0, right - left) + 'px', height: Math.max(0, bottom - top) + 'px' });
    let bx = Math.min(Math.max(m, left), vw - bw - m), by;
    if (vh - bottom >= bh + 2 * m) by = bottom + m;
    else if (top >= bh + 2 * m) by = top - bh - m;
    else if (vw - right >= bw + 2 * m) { bx = right + m; by = Math.min(Math.max(m, top), vh - bh - m); }
    else if (left >= bw + 2 * m) { bx = left - bw - m; by = Math.min(Math.max(m, top), vh - bh - m); }
    else { by = vh - bh - m; bx = Math.max(m, (vw - bw) / 2); }
    bb.style.left = bx + 'px'; bb.style.top = by + 'px';
  }
  function tourDraw() {
    const s = T.steps[T.i], n = T.steps.length, last = T.i === n - 1;
    const bb = T.bubble; bb.textContent = '';
    const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => tourApi.next() }, last ? 'Finish' : 'Next');
    bb.append(
      h('div', { class: 'tb-top' }, h('span', { class: 'tb-step' }, `Step ${T.i + 1} of ${n}`), h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'Close the tour', onclick: () => tourApi.stop() }, 'Skip tour')),
      h('h3', { id: 'tourTitle' }, s.title), h('p', {}, s.body),
      h('div', { class: 'tb-acts' },
        h('div', { class: 'tb-dots', 'aria-hidden': 'true' }, T.steps.map((_, k) => h('i', { class: k === T.i ? 'on' : '' }))),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', disabled: T.i === 0, onclick: () => tourApi.prev() }, 'Back'), next)));
    next.focus({ preventScroll: true });
  }
  async function tourShow(i) {
    if (!T.on) return;
    T.i = Math.max(0, Math.min(i, T.steps.length - 1));
    const tk = ++T.token, s = T.steps[T.i];
    if (s.route && state.route !== s.route) {
      go(s.route);
      for (let k = 0; k < 40 && state.route !== s.route; k++) await wait(30);
      await wait(160);
    }
    if (tk !== T.token || !T.on) return;
    closeDrawer(); closePop();
    let el = visibleEl(s.sel);
    if (el) {
      const r = el.getBoundingClientRect(), tb = (document.querySelector('.topbar') || {}).offsetHeight || 0;
      if (r.top < tb + 8 || r.bottom > innerHeight - 8) {
        const room = innerHeight - tb - 24;
        const y = scrollY + r.top - (r.height + 200 < room ? tb + (room - r.height) / 3 : tb + 16);
        window.scrollTo(0, Math.max(0, y));
        await wait(40);
      }
    }
    if (tk !== T.token || !T.on) return;
    T.target = el; tourDraw(); tourPlace();
  }
  function tourKey(e) {
    if (!T.on) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tourApi.stop(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tourApi.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); tourApi.prev(); }
  }
  const tourApi = {
    start(at) {
      if (T.on) tourApi.stop(true);
      closePop(); closeSearch(); closeDrawer();
      document.querySelectorAll('.modal-back').forEach((m) => m.remove());
      T.steps = TOUR.filter((s) => !s.route || modules[s.route]);
      if (!T.steps.length) return;
      T.on = true;
      T.layer = h('div', { class: 'tour-layer', 'aria-hidden': 'true' });
      T.spot = h('div', { class: 'tour-spot none' });
      T.bubble = h('div', { class: 'tour-bubble', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tourTitle' });
      document.body.append(T.layer, T.spot, T.bubble);
      document.addEventListener('keydown', tourKey, true);
      window.addEventListener('resize', tourPlace); window.addEventListener('scroll', tourPlace, { passive: true });
      emit('tour:start', {});
      tourShow(typeof at === 'number' ? at : 0);
    },
    stop(silent) {
      if (!T.on) return;
      T.on = false; T.token++;
      [T.layer, T.spot, T.bubble].forEach((x) => x && x.remove());
      T.layer = T.spot = T.bubble = T.target = null;
      document.removeEventListener('keydown', tourKey, true);
      window.removeEventListener('resize', tourPlace); window.removeEventListener('scroll', tourPlace);
      emit('tour:end', { step: T.i });
      if (!silent) { const b = $('tourBtn'); if (b) b.focus({ preventScroll: true }); }
    },
    next() { if (!T.on) return; if (T.i >= T.steps.length - 1) { tourApi.stop(); toast('Tour finished. Click anything to explore.', 'green'); } else tourShow(T.i + 1); },
    prev() { if (T.on && T.i > 0) tourShow(T.i - 1); },
    get active() { return T.on; },
    get step() { return T.on ? T.i : -1; },
  };

  // Believable starting notifications so the bell is never empty.
  function seedNotifications() {
    const lec = D.lectures.find((l) => l.id === D.demo_student.lecture) || D.lectures[0];
    [
      ['Mentor feedback on Capstone 2', 'Kavita Rao reviewed your final Capstone 2 milestone: 84/100, approved with two notes on your README.', 'projects', 26 * 3600e3],
      ['New lecture unlocked', `Lecture ${lec.id}: ${lec.topic}. Watch it, then do the 20-minute practical.`, 'lecture', 5 * 3600e3],
      ['Your doubt was answered', '“Why does my Router send everything to the fallback branch?” The AI answered and a mentor confirmed it.', 'forum', 42 * 60e3],
    ].forEach(([t, b, r, back]) => { const n = notify(t, b, r); n.ts = Date.now() - back; });
  }

  function shellInit() {
    renderThemeBtn();
    if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); const f = () => { if (state.theme === 'system') emit('theme', 'system'); }; if (mq.addEventListener) mq.addEventListener('change', f); }
    const kbd = $('searchKbd'); if (kbd && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) kbd.textContent = '⌘ K';
    const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
    bind('themeBtn', (e) => openPop(e.currentTarget, themeMenu, 'Theme'));
    bind('bellBtn', (e) => openPop(e.currentTarget, bellPanel, 'Notifications'));
    bind('roleBtn', (e) => openPop(e.currentTarget, roleMenu, 'Switch view'));
    bind('searchBtn', () => openSearch());
    bind('tourBtn', () => tourApi.start());
    bind('menuBtn', () => (drawerOpen() ? closeDrawer() : openDrawer()));
    bind('sideBackdrop', closeDrawer);
    on('notify', renderBell); on('notify:read', renderBell);
    on('role', renderWho);
    on('route', () => { closeDrawer(); closePop(); });
    on('field', () => closePop());
    window.addEventListener('resize', () => { closePop(); if (innerWidth > 900) closeDrawer(); });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (palette) closeSearch(); else if (!T.on) openSearch(); return; }
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !palette && !T.on && !document.querySelector('.modal-back')) { e.preventDefault(); openSearch(); return; }
      if (e.key === 'Escape' && drawerOpen()) { closeDrawer(); const b = $('menuBtn'); if (b) b.focus(); }
    });
    seedNotifications(); renderBell();
  }

  window.NM = { data: D, state, register, go, on, emit, toast, addXP, modal, h, esc, icon, field, setField, ctx, boot, notify, modules,
    tour: tourApi, setTheme, openSearch, closeSearch, markRead, markAllRead, openDrawer, closeDrawer };
})();
