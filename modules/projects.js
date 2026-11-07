/* Projects and portfolio: the capstone journey through to a public portfolio and QR-verifiable certificates.
   Flow: 4 capstones on a year timeline -> the active student's current milestone (from data.demo_student: capstone + capstone_month)
   -> automatic acceptance tests -> mentor rubric review -> publish to the student's GitHub -> auto-built portfolio site -> certificates.
   Everything is scripted mock data. */
(function () {
  const ID = 'projects';
  const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  const SLOTS = ['C1', 'C2', 'C3', 'C4'];
  const SD = () => NM.data.demo_student;
  const nowMonth = () => SD().month || 8;
  // Mentor scores of capstones each demo student finished earlier in the year (demo data).
  const SCORES = { S1001: { C1: 88, C2: 91 }, S1003: { C1: 86 }, S1004: { C1: 92, C2: 90, C3: 94 } };
  // Which certificate the current milestone approval issues straight away: Aarav gets Capstone 3 at Month 8, Ishita Capstone 1 at Month 3.
  const CERT_ON_APPROVE = { S1001: 'C3', S1002: 'C1' };
  const LIVE_DATE = { C1: '28 Apr 2027', C3: '20 Aug 2027' };
  const COMMON_MINI = [{ month: 1, title: 'AI foundations notes', common: true }, { month: 2, title: 'Python practice set', common: true }, { month: 3, title: 'Prompt and API lab', common: true }];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${+m[3]} ${MON[+m[2] - 1]} ${m[1]}` : String(iso || ''); };
  const store = {};          // per-field demo state, keyed by field id (survives re-renders and field switches)
  const timers = new Set();
  let live = null;           // { cleanup } for the currently mounted render

  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const T = (ms) => (reduced() ? 60 : ms);
  function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, T(ms)); timers.add(t); }
  function clearTimers() { timers.forEach(clearTimeout); timers.clear(); }

  // ---------- small helpers ----------
  const kebab = (title) => {
    let t = String(title || '').replace(/\([^)]*\)/g, ' ');
    if (t.includes(':')) t = t.split(':')[0];
    return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'capstone';
  };
  const cleanTech = (s) => String(s).replace(/\s*\(.*$/, '').trim();
  const hash7 = (s) => { let x = 2166136261; for (const ch of String(s)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return x.toString(16).padStart(8, '0').slice(0, 7); };
  const seeded = (s) => { let x = parseInt(hash7(s), 16) || 7; return () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return (x >>> 8) / 16777216; }; };
  function shortLine(d) {
    let t = String(d).split(/[(:;,]| - | — /)[0].trim();
    const w = t.split(/\s+/);
    if (w.length > 9) t = w.slice(0, 9).join(' ');
    if (/^[A-Z][a-z]+(\s|-|$)/.test(t)) t = t[0].toLowerCase() + t.slice(1);
    return t;
  }
  const firstSentence = (s) => { const m = String(s).match(/^(.+?[.!?])(\s|$)/); return m ? m[1] : String(s); };
  const capOf = (data, f, slot) => (slot === 'C1' ? data.common.capstone : f.capstones.find((c) => c.slot === slot) || f.capstones[SLOTS.indexOf(slot) - 1] || f.capstones[0]);
  function scoreOf(S, slot) { const t = SCORES[S.id]; if (t && t[slot] != null) return t[slot]; return 80 + (parseInt(hash7(S.id + slot), 16) % 13); }

  // The active student's current capstone milestone.
  function curInfo(data, f) {
    const S = data.demo_student;
    const slot = SLOTS.includes(S.capstone) ? S.capstone : 'C3';
    const cap = capOf(data, f, slot);
    const month = S.capstone_month || nowMonth();
    const ms = cap.milestones.find((m) => m.month === month) || cap.milestones[0];
    const last = cap.milestones[cap.milestones.length - 1];
    const next = cap.milestones.find((m) => m.month === ms.month + 1) || null;
    const n = slot.slice(1);
    const nextText = next ? `Publish it and start the Month ${next.month} milestone${slot === 'C4' && next.month === 12 ? ', which you present at Demo Day' : ''}.`
      : slot === 'C1' ? `Capstone 1 is complete. Publish it, then Capstone 2 for ${f.company} starts in Month 4.` : 'Publish it to finish this capstone.';
    const certSlot = CERT_ON_APPROVE[S.id] === slot ? slot : null;
    return { slot, n, cap, month: ms.month, ms, last, next, final: ms === last, nextText, certSlot, company: slot === 'C1' ? data.common.company : f.company, idx: SLOTS.indexOf(slot) };
  }

  function journey(data, f) {
    const S = data.demo_student, info = curInfo(data, f);
    return SLOTS.map((slot, i) => {
      const cap = capOf(data, f, slot);
      const cert = (S.certificates || []).find((x) => x.slot === slot);
      return { slot, cap, months: cap.milestones.map((m) => m.month), company: slot === 'C1' ? data.common.company : f.company,
        before: i < info.idx, current: i === info.idx, after: i > info.idx, score: i < info.idx ? scoreOf(S, slot) : null, issued: cert ? fmtDate(cert.date) : null };
    });
  }

  // Certificates issued live in this session (shared with Exams and Achievements through NM.state.liveCerts).
  function liveCerts() { return (NM.state.liveCerts = NM.state.liveCerts || {}); }
  function syncCertCount() { NM.state.progress.certificates = (SD().certificates || []).length + Object.keys(liveCerts()).length; }
  function issueLive(slot, info) { const L = liveCerts(); if (L[slot] || (SD().certificates || []).some((x) => x.slot === slot)) return false; L[slot] = info; syncCertCount(); return true; }
  function dropLive(slot) { delete liveCerts()[slot]; syncCertCount(); }

  // ---------- mentor review (rubric scores that add up to a total out of 100) ----------
  function makeReview(info, p) {
    p = p || {};
    const cap = info.cap;
    const rub = cap.rubric || [];
    const fr = [0.9, 0.85, 0.88, 0.8, 0.92, 0.86];
    const scores = rub.map((r, i) => ({ criterion: r.criterion, weight: r.weight, excellent: r.excellent, acceptable: r.acceptable, score: Math.round(r.weight * fr[i % fr.length]) }));
    const sum = () => scores.reduce((a, s) => a + s.score, 0);
    const maxTotal = scores.reduce((a, s) => a + s.weight, 0);
    if (Array.isArray(p.scores) && p.scores.length === scores.length) {
      scores.forEach((s, i) => { const v = p.scores[i]; const n = typeof v === 'number' ? v : v && +v.score; if (Number.isFinite(n)) s.score = Math.max(0, Math.min(s.weight, Math.round(n))); });
    } else if (p.score != null && p.score !== '' && Number.isFinite(+p.score)) {
      let diff = Math.max(0, Math.min(maxTotal, Math.round(+p.score))) - sum();
      let guard = 1000, i = 0;
      while (diff !== 0 && guard-- > 0 && scores.length) {
        const s = scores[i % scores.length]; i++;
        if (diff > 0 && s.score < s.weight) { s.score++; diff--; } else if (diff < 0 && s.score > 0) { s.score--; diff++; }
      }
    }
    const total = sum();
    const decision = p.decision == null || /approv|accept|pass/i.test(String(p.decision)) ? 'approved' : 'changes';
    const ranked = scores.slice().sort((a, b) => b.score / b.weight - a.score / a.weight);
    const best = ranked[0], weak = ranked[ranked.length - 1];
    const tests = info.ms.tests.length;
    let comment = typeof p.comment === 'string' && p.comment.trim() ? p.comment.trim() : null;
    if (!comment && best && weak) {
      comment = decision === 'approved'
        ? `Solid, working submission and all ${tests} acceptance tests pass. "${best.criterion}" is your strongest area. To move "${weak.criterion}" from acceptable to excellent, aim for this: ${weak.excellent}. Approved. ${info.nextText}`
        : `Good start, but not ready yet. "${weak.criterion}" needs work before I can approve it. Aim for this: ${weak.excellent}. Fix it and resubmit; the tests will run again.`;
    }
    const mentor = typeof p.mentor === 'string' ? p.mentor : (p.mentor && p.mentor.name) || 'Kavita Rao';
    return { scores, total, maxTotal, decision, comment: comment || '', mentor };
  }

  function freshState(f, progress) {
    const info = curInfo(NM.data, f), m = info.ms;
    const st = { phase: 'draft', checked: m.deliverables.map((_, i) => i < m.deliverables.length - 1), testsDone: 0, justPassed: -1, review: null, reviewing: false,
      pub: { stage: 0, commits: 0, readme: null }, selected: info.slot, flash: false, xpGiven: false, demo: { picked: null, booked: null } };
    const ms = progress.milestoneStatus;
    if (ms === 'submitted' || ms === 'in_review') { st.phase = 'review'; st.testsDone = m.tests.length; st.checked = st.checked.map(() => true); }
    if (ms === 'approved' || ms === 'changes_requested') {
      st.review = makeReview(info, { decision: ms === 'approved' ? 'approved' : 'changes' });
      st.phase = ms === 'approved' ? 'approved' : 'changes'; st.testsDone = m.tests.length; st.checked = st.checked.map(() => true); st.xpGiven = true;
      if (ms === 'approved' && progress.portfolioPublished) { st.pub.stage = 6; st.pub.commits = 4; }
    }
    return st;
  }
  function getSt(f, progress) { if (!store[f.id]) store[f.id] = freshState(f, progress); return store[f.id]; }

  // Capture mentor decisions even while this screen is not open (e.g. the investor approves from the mentor console).
  NM.on('milestone:reviewed', (p) => {
    p = p || {};
    const D = NM.data, f = NM.field(), info = curInfo(D, f), cap = info.cap;
    const who = p.student || p.studentId;
    const whoKey = who && typeof who === 'object' ? who.id || who.name : who;
    if (whoKey && whoKey !== D.demo_student.id && whoKey !== D.demo_student.name) return;
    if (p.month != null && +p.month !== info.month) return;
    const capKey = p.capstone && typeof p.capstone === 'object' ? p.capstone.id || p.capstone.title : p.capstone;
    if (capKey && capKey !== cap.id && capKey !== cap.title && capKey !== info.slot) {
      const known = D.fields.some((x) => x.capstones.some((cc) => cc.id === capKey || cc.title === capKey)) || capKey === D.common.capstone.id;
      if (known) return;
    }
    const st = getSt(f, NM.state.progress), m = info.ms;
    st.review = makeReview(info, p);
    st.phase = st.review.decision === 'approved' ? 'approved' : 'changes';
    st.testsDone = m.tests.length; st.checked = st.checked.map(() => true); st.reviewing = false;
    NM.state.progress.milestoneStatus = st.phase === 'approved' ? 'approved' : 'changes_requested';
    const sc = p.score != null ? p.score : st.review.total;
    if (st.phase === 'approved' && info.certSlot) issueLive(info.certSlot, { date: LIVE_DATE[info.certSlot] || 'Today', score: sc });
    if (NM.notify) {
      const mentor = p.mentor || st.review.mentor || 'Your mentor';
      if (st.phase === 'approved') NM.notify('Milestone approved', `${mentor} approved Capstone ${info.n}, Month ${info.month} with ${sc}/100. ${info.certSlot ? `Your Capstone ${info.n} certificate is ready and you can publish to GitHub.` : 'You can publish it to GitHub now.'}`, 'projects');
      else NM.notify('Changes requested', `${mentor} asked for changes on Capstone ${info.n}, Month ${info.month} (${sc}/100). Read the feedback, fix it and resubmit.`, 'projects');
    }
  });

  // ---------- QR code ----------
  let qrPromise = null;
  function loadQR() {
    if (typeof window.qrcode === 'function') return Promise.resolve(window.qrcode);
    if (!qrPromise) {
      qrPromise = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = QR_URL; s.async = true; s.crossOrigin = 'anonymous';
        const to = setTimeout(() => rej(new Error('timeout')), 5000);
        s.onload = () => { clearTimeout(to); typeof window.qrcode === 'function' ? res(window.qrcode) : rej(new Error('missing')); };
        s.onerror = () => { clearTimeout(to); rej(new Error('load failed')); };
        document.head.append(s);
      }).catch((e) => { qrPromise = null; throw e; });
    }
    return qrPromise;
  }
  function matrixSvg(n, dark, label) {
    const m = 4; let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges" role="img" aria-label="${label}"><path class="qd" d="${d}"/></svg>`;
  }
  function placeholderSvg(url) {
    const n = 25, rnd = seeded(url);
    const finder = (r, c) => { for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) { const y = r - fr, x = c - fc; if (y >= 0 && y < 7 && x >= 0 && x < 7) return { hit: true, dark: y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4) }; } return { hit: false }; };
    const cells = []; for (let r = 0; r < n; r++) { cells.push([]); for (let c = 0; c < n; c++) { const fz = finder(r, c); cells[r].push(fz.hit ? fz.dark : rnd() > 0.52); } }
    return matrixSvg(n, (r, c) => cells[r][c], 'Placeholder QR pattern');
  }
  function drawQR(box, url, note) {
    box.innerHTML = placeholderSvg(url);
    note.textContent = 'Loading QR code…';
    loadQR().then((qrcode) => {
      if (!box.isConnected) return;
      const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      box.innerHTML = matrixSvg(qr.getModuleCount(), (r, c) => qr.isDark(r, c), 'QR code for ' + url);
      note.textContent = 'Scan to verify';
    }).catch(() => { if (box.isConnected) note.textContent = 'Offline preview: placeholder pattern'; });
  }

  // ---------- styles ----------
  function injectCSS() {
    if (document.getElementById('m-' + ID)) return;
    const css = `
.m-projects{display:grid;gap:20px;min-width:0}
.m-projects section{scroll-margin-top:96px}
.m-projects .mp-caps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:6px}
.m-projects .mp-cap{display:grid;gap:8px;align-content:start;text-align:left;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:var(--radius);padding:14px;cursor:pointer;min-width:0;position:relative;transition:border-color .2s,box-shadow .2s}
.m-projects .mp-cap:hover{border-color:var(--brand)}
.m-projects .mp-cap.sel{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.m-projects .mp-cap.cur::before{content:'Now';position:absolute;top:-9px;right:12px;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:var(--brand);color:var(--on-brand);padding:2px 8px;border-radius:99px}
.m-projects .mp-cap-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between}
.m-projects .mp-slot{font-family:var(--display);font-weight:700;font-size:12px;background:var(--brand-soft);color:var(--brand);border-radius:6px;padding:2px 7px;flex:none}
.m-projects .mp-cap-title{font-family:var(--display);font-size:14px;line-height:1.3;overflow-wrap:anywhere}
.m-projects .mp-mo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:2px}
.m-projects .mp-mo i{font-style:normal;font-size:11px;font-weight:700;text-align:center;border-radius:5px;padding:3px 0;background:var(--surface-2);color:var(--faint)}
.m-projects .mp-mo i.done{background:var(--green-soft);color:var(--green)}
.m-projects .mp-mo i.now{background:var(--brand);color:var(--on-brand)}
.m-projects .mp-mini{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:16px}
.m-projects .mp-chip{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;border:1px solid var(--line);border-radius:99px;padding:4px 10px;background:var(--surface);color:var(--muted);min-width:0;max-width:100%}
.m-projects .mp-chip b{color:var(--fg);font-size:11.5px;flex:none}
.m-projects .mp-chip.done{background:var(--green-soft);border-color:transparent;color:var(--fg)}
.m-projects .mp-chip.done b{color:var(--green)}
.m-projects .mp-chip.now{border-color:var(--brand);color:var(--brand)}
.m-projects .mp-chip svg{width:13px;height:13px;flex:none;color:var(--green)}
.m-projects .mp-detail{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:20px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}
.m-projects .mp-detail p{font-size:13.5px}
.m-projects .mp-tags{display:flex;flex-wrap:wrap;gap:6px}
.m-projects .mp-tag{font-size:12px;font-weight:600;background:var(--surface-2);color:var(--fg);border-radius:6px;padding:3px 8px}
.m-projects details.mp-ms{border:1px solid var(--line);border-radius:var(--radius-sm);padding:8px 12px;background:var(--surface)}
.m-projects details.mp-ms[open]{background:var(--surface-2)}
.m-projects details.mp-ms summary{cursor:pointer;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:700;font-size:13px;list-style:none}
.m-projects details.mp-ms summary::-webkit-details-marker{display:none}
.m-projects details.mp-ms summary::after{content:'+';margin-left:auto;color:var(--muted);font-weight:800}
.m-projects details.mp-ms[open] summary::after{content:'–'}
.m-projects .mp-ms ul{margin:8px 0 2px;padding-left:18px;display:grid;gap:4px;font-size:12.5px;color:var(--muted)}
.m-projects .mp-rub{display:grid;gap:7px}
.m-projects .mp-rub-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(50px,90px) 34px;gap:10px;align-items:center;font-size:12.5px}
.m-projects .mp-bar{height:6px;background:var(--surface-2);border-radius:99px;overflow:hidden}
.m-projects .mp-bar i{display:block;height:100%;background:var(--brand);border-radius:inherit;transition:width .6s ease}
.m-projects .mp-bar.green i{background:var(--green)}
.m-projects .mp-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:0 0 16px;list-style:none;padding:0}
.m-projects .mp-steps li{display:grid;gap:6px;font-size:12px;font-weight:700;color:var(--faint);min-width:0;overflow-wrap:anywhere}
.m-projects .mp-steps li::before{content:'';height:4px;border-radius:99px;background:var(--surface-2)}
.m-projects .mp-steps li.done{color:var(--green)} .m-projects .mp-steps li.done::before{background:var(--green)}
.m-projects .mp-steps li.now{color:var(--brand)} .m-projects .mp-steps li.now::before{background:var(--brand)}
.m-projects .mp-steps li.bad{color:var(--red)} .m-projects .mp-steps li.bad::before{background:var(--red)}
.m-projects .mp-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:16px;align-items:start}
.m-projects .mp-pane{border:1px solid var(--line);border-radius:var(--radius);padding:14px;display:grid;gap:10px;align-content:start;min-width:0;background:var(--surface)}
.m-projects .mp-deliv{display:grid}
.m-projects .mp-deliv label{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--line);font-size:13px;cursor:pointer}
.m-projects .mp-deliv label:first-child{border-top:0}
.m-projects .mp-deliv input{accent-color:var(--brand);margin-top:2px;width:16px;height:16px;flex:none;cursor:pointer}
.m-projects .mp-deliv input:disabled{cursor:default}
.m-projects .mp-deliv span{min-width:0;overflow-wrap:anywhere}
.m-projects .check .ic svg{width:12px;height:12px}
.m-projects .check .ic .spin{width:11px;height:11px;border-width:2px}
.m-projects .check.just .ic{animation:mp-pop .35s ease}
@keyframes mp-pop{from{transform:scale(.3)}60%{transform:scale(1.15)}}
.m-projects .mp-ct{min-width:0;display:grid;gap:2px;font-size:13px;overflow-wrap:anywhere}
.m-projects .check.wait .mp-ct{color:var(--muted)}
.m-projects .mp-sum{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;font-weight:700}
.m-projects .mp-review{display:grid;gap:12px;border:1px solid var(--line);border-radius:var(--radius);padding:16px;margin-top:16px;background:var(--surface)}
.m-projects .mp-review.wait{border-left:3px solid var(--amber)}
.m-projects .mp-review.ok{border-left:3px solid var(--green)}
.m-projects .mp-review.bad{border-left:3px solid var(--red)}
.m-projects .mp-review table td{font-size:13px}
.m-projects .mp-review table .mp-bar{min-width:70px}
.m-projects .mp-review tfoot td{font-weight:800;background:var(--surface-2)}
.m-projects .mp-quote{border-left:3px solid var(--brand);background:var(--surface-2);border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:10px 14px;font-size:13.5px}
.m-projects .mp-who{display:flex;gap:10px;align-items:center;min-width:0}
.m-projects .mp-who .avatar{background:var(--green-soft);color:var(--green)}
.m-projects .mp-row2{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:20px;align-items:start}
.m-projects .mp-commits{display:grid;gap:3px;margin-top:6px;font-family:var(--mono);font-size:12px;background:var(--code-bg);color:var(--code-fg);border-radius:var(--radius-sm);padding:10px 12px;overflow-x:auto}
.m-projects .mp-commits div{white-space:nowrap}
.m-projects .mp-commits .hx{color:var(--code-num)}
.m-projects .mp-commits .dm{color:var(--code-muted)}
.m-projects textarea.mp-readme{min-height:280px;font-family:var(--mono);font-size:12.5px;line-height:1.55;resize:vertical;margin-top:6px}
.m-projects .mp-sub{font-size:12.5px;color:var(--muted);overflow-wrap:anywhere}
.m-projects .mp-mono{font-family:var(--mono);font-size:12px;overflow-wrap:anywhere}
.m-projects .mp-browser{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface);min-width:0;box-shadow:var(--shadow)}
.m-projects .mp-bbar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface-2);border-bottom:1px solid var(--line)}
.m-projects .mp-dots{display:flex;gap:6px;flex:none}
.m-projects .mp-dots i{width:10px;height:10px;border-radius:50%;background:var(--line)}
.m-projects .mp-dots i:nth-child(1){background:var(--red)} .m-projects .mp-dots i:nth-child(2){background:var(--amber)} .m-projects .mp-dots i:nth-child(3){background:var(--green)}
.m-projects .mp-url{flex:1;min-width:0;font-family:var(--mono);font-size:12px;background:var(--surface);border:1px solid var(--line);border-radius:99px;padding:4px 12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-projects .mp-site{padding:28px clamp(16px,4vw,40px);display:grid;gap:22px;background:var(--bg)}
.m-projects .mp-site h4{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.m-projects .mp-hero{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.m-projects .mp-hero > div{min-width:0;flex:1 1 240px;display:grid;gap:4px}
.m-projects .mp-av{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--brand),var(--violet));color:var(--on-brand);display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:22px;flex:none}
.m-projects .mp-pgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.m-projects .mp-pcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px;display:grid;gap:6px;align-content:start;min-width:0}
.m-projects .mp-pcard.dim{border-style:dashed;background:transparent}
.m-projects .mp-pcard.flash{animation:mp-flash 2s ease}
@keyframes mp-flash{0%,40%{box-shadow:0 0 0 4px var(--green-soft);border-color:var(--green)}100%{box-shadow:0 0 0 0 transparent}}
.m-projects .mp-pcard b{font-family:var(--display);font-size:14px;line-height:1.3}
.m-projects .mp-pcard .mp-sub{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.m-projects .lnk{background:none;border:0;padding:0;font:inherit;text-align:left;cursor:pointer;justify-self:start}
.m-projects .lnk:hover{text-decoration:underline}
.m-projects button.mp-chip{cursor:pointer;font:inherit;font-size:12.5px;text-align:left}
.m-projects button.mp-chip:hover{border-color:var(--brand);color:var(--brand)}
.m-projects button.mp-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.m-projects .mp-flashcard{animation:mp-flash 1.6s ease}
.m-projects .mp-repo{font-family:var(--mono);font-size:12px;color:var(--brand);overflow-wrap:anywhere}
.m-projects .mp-certs{display:grid;gap:8px}
.m-projects .mp-cert{display:flex;gap:12px;align-items:center;width:100%;text-align:left;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:var(--radius-sm);padding:10px 12px;cursor:pointer;min-width:0}
.m-projects .mp-cert:hover:not(:disabled){border-color:var(--brand)}
.m-projects .mp-cert:disabled{cursor:not-allowed;border-style:dashed}
.m-projects .mp-cert:disabled .ix{background:var(--surface-2);color:var(--faint)}
.m-projects .mp-cert .ix{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;background:var(--amber-soft);color:var(--amber);flex:none}
.m-projects .mp-cert .ix svg{width:18px;height:18px}
.m-projects .mp-cert .tx{flex:1;min-width:0;display:grid;gap:1px}
.m-projects .mp-cert .tx b{font-size:13.5px;overflow-wrap:anywhere}
.m-projects .mp-cert .tx span{font-size:12px;color:var(--muted);overflow-wrap:anywhere}
.m-projects.mp-modal{display:grid;gap:14px;min-width:0}
.m-projects .mp-paper{border:1px solid var(--line);border-radius:12px;padding:6px;background:var(--surface)}
.m-projects .mp-paper-in{border:2px solid var(--brand);border-radius:8px;padding:20px 18px;display:grid;gap:8px;text-align:center;background:linear-gradient(180deg,var(--brand-soft),var(--surface) 55%)}
.m-projects .mp-paper-in h2{font-size:21px}
.m-projects .mp-name{font-family:var(--display);font-size:24px;font-weight:700;color:var(--brand);line-height:1.2}
.m-projects .mp-paper-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;text-align:left;flex-wrap:wrap;margin-top:8px;padding-top:12px;border-top:1px dashed var(--line)}
.m-projects .mp-paper-foot > div:first-child{min-width:0;flex:1 1 180px;display:grid;gap:2px}
.m-projects .mp-qrwrap{display:grid;gap:4px;justify-items:center;flex:none}
.m-projects .mp-qr{width:104px;height:104px;background:var(--code-fg);border-radius:6px;overflow:hidden}
.m-projects .mp-qr svg{width:100%;height:100%;display:block}
.m-projects .mp-qr .qd{fill:var(--code-bg)}
.m-projects .mp-valid{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.m-projects .mp-valid .ok{width:40px;height:40px;border-radius:50%;background:var(--green-soft);color:var(--green);display:grid;place-items:center;flex:none}
.m-projects .mp-valid .ok svg{width:22px;height:22px}
.m-projects .mp-vsite{padding:18px;display:grid;gap:10px;background:var(--bg)}
.m-projects .mp-dslots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.m-projects .mp-dgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.m-projects .mp-dslot{display:grid;gap:2px;justify-items:center;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:var(--radius-sm);padding:10px 4px;cursor:pointer;min-width:0;font:inherit}
.m-projects .mp-dslot:hover:not(:disabled){border-color:var(--brand)}
.m-projects .mp-dslot b{font-size:14px}
.m-projects .mp-dslot span{color:var(--green)}
.m-projects .mp-dslot:disabled{cursor:not-allowed;background:var(--surface-2);color:var(--faint);border-style:dashed}
.m-projects .mp-dslot:disabled span{color:var(--faint)}
.m-projects .mp-dslot.sel{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.m-projects .mp-dslot.mine{background:var(--green-soft);border-color:var(--green)}
@media (max-width:1100px){.m-projects .mp-caps{grid-template-columns:repeat(2,minmax(0,1fr))}.m-projects .mp-row2,.m-projects .mp-body{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){.m-projects .mp-detail,.m-projects .mp-dslots{grid-template-columns:minmax(0,1fr)}}
@media (max-width:640px){.m-projects .mp-pgrid{grid-template-columns:minmax(0,1fr)}.m-projects .mp-steps li{font-size:10.5px}.m-projects .mp-site{padding:20px 16px}}
@media (max-width:520px){.m-projects .mp-dgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.m-projects .mp-caps{grid-template-columns:minmax(0,1fr)}.m-projects .mp-qr{width:88px;height:88px}}
@media (prefers-reduced-motion: reduce){.m-projects *,.m-projects *::before{animation:none!important;transition:none!important}}
`;
    const el = document.createElement('style'); el.id = 'm-' + ID; el.textContent = css; document.head.append(el);
  }

  // ---------- module ----------
  NM.register(ID, {
    label: 'Projects & portfolio', title: 'Projects and portfolio', icon: 'project', group: 'Student', order: 50,

    render(root, c) {
      if (live) live.cleanup();   // field switch re-renders without destroy(): finish and clear the previous run first
      injectCSS();
      const { h, data, state, icon, field: f } = c;
      const S = data.demo_student, gh = S.github;
      const st = getSt(f, state.progress);
      const J = journey(data, f);
      const info = curInfo(data, f), NOW = nowMonth();
      const cap = info.cap, m8 = info.ms, CUR = J[info.idx], CN = info.n, MM = info.month;
      const repo = kebab(cap.title);
      const first = S.name.split(' ')[0];
      const smooth = () => (reduced() ? 'auto' : 'smooth');
      const mod = this;

      const wrap = h('div', { class: 'm-projects' });
      const secTimeline = h('section', { class: 'card' });
      const secMilestone = h('section', { class: 'card', id: 'mp-milestone' });
      const secDemo = info.slot === 'C4' ? h('section', { class: 'card', id: 'mp-demoday' }) : null;
      const secPublish = h('section', { class: 'card', id: 'mp-publish' });
      const secCerts = h('section', { class: 'card' });
      const secPortfolio = h('section', { class: 'card', id: 'mp-portfolio' });
      wrap.append(secTimeline, secMilestone);
      if (secDemo) wrap.append(secDemo);
      wrap.append(h('div', { class: 'mp-row2' }, secPublish, secCerts), secPortfolio);
      root.append(wrap);
      const fill = (el, ...kids) => { el.textContent = ''; el.append(...kids.flat().filter(Boolean)); };
      const scrollTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: smooth(), block: 'start' }); };

      function capStatus(j) {
        if (j.before) return { label: `Approved · ${j.score}/100`, cls: 'green' };
        if (j.after) return { label: 'Upcoming', cls: '' };
        return ({ draft: { label: 'In progress', cls: 'blue' }, testing: { label: 'Running tests', cls: 'blue' }, review: { label: 'In mentor review', cls: 'amber' },
          changes: { label: 'Changes requested', cls: 'red' }, approved: { label: st.pub.stage === 6 ? 'Approved · published' : 'Approved', cls: 'green' } })[st.phase];
      }
      const phaseLabel = () => ({ draft: 'In progress', testing: 'Running tests', review: 'Waiting for mentor review', changes: 'Changes requested', approved: 'Approved' })[st.phase];

      // ----- 1. Timeline + capstone detail -----
      function fillTimeline() {
        const caps = h('div', { class: 'mp-caps' }, J.map((j) => {
          const s = capStatus(j);
          return h('button', { class: 'mp-cap' + (st.selected === j.slot ? ' sel' : '') + (j.current ? ' cur' : ''), 'aria-pressed': st.selected === j.slot ? 'true' : 'false',
            onclick: () => { st.selected = j.slot; fillTimeline(); } },
            h('div', { class: 'mp-cap-top' }, h('span', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'mp-slot' }, j.slot), h('span', { class: 'tiny muted' }, `Months ${j.months[0]}–${j.months[2]}`)), h('span', { class: 'pill ' + s.cls }, s.label)),
            h('b', { class: 'mp-cap-title' }, j.cap.title),
            h('span', { class: 'tiny muted' }, j.slot === 'C1' ? `${j.company} · common to all fields` : j.company),
            h('div', { class: 'mp-mo', style: { gridTemplateColumns: `repeat(${j.months.length},minmax(0,1fr))` } }, j.months.map((m) => h('i', { class: m < NOW ? 'done' : m === NOW ? 'now' : '' }, `M${m}`))));
        }));
        const minis = h('div', { class: 'mp-mini' }, h('span', { class: 'eyebrow', style: { marginRight: '4px' } }, 'Monthly mini-projects'),
          COMMON_MINI.concat(f.standalone || []).map((s) => h('button', { class: 'mp-chip ' + (s.month < NOW ? 'done' : s.month === NOW ? 'now' : ''), title: s.month < NOW ? 'Done' : s.month === NOW ? 'This month' : 'Upcoming', onclick: () => openMini(s),
            html: (s.month < NOW ? icon('check') : '') + `<b>M${s.month}</b><span>${c.esc(s.title)}</span>` })));
        fill(secTimeline,
          h('div', { class: 'card-head' },
            h('div', {}, h('div', { class: 'eyebrow' }, `Capstone journey · ${S.name} · ${NOW <= 3 ? `common foundation, then ${f.name}` : f.name}`), h('h2', {}, 'Four capstones, one public portfolio')),
            h('span', { class: 'pill blue' }, `Month ${NOW} of 12`)),
          h('p', { class: 'small muted' }, `Each capstone is a real tool built for a fictional company. Months 1 to 3 are the same for everyone; from Month 4 the work is for ${f.company}. Tap a capstone to see what it involves.`),
          caps, minis, capDetail(J.find((j) => j.slot === st.selected) || CUR));
      }

      function openMini(s) {
        const done = s.month < NOW, now = s.month === NOW;
        const co = s.common ? data.common.company : f.company;
        const browser = /browser/i.test((S.workspace && S.workspace.env) || '');
        const m = c.modal(h('div', { class: 'm-projects mp-modal' },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', {}, h('div', { class: 'eyebrow' }, `Month ${s.month} mini-project · ${s.common ? 'Common foundation' : f.short}`), h('h3', {}, s.title)),
            h('span', { class: 'pill ' + (done ? 'green' : now ? 'blue' : '') }, done ? 'Done' : now ? 'This month' : 'Upcoming')),
          h('p', { class: 'small muted' }, `A short standalone project for Month ${s.month}, "${data.months[s.month]}". It practises the month's skills on ${co} data, next to the capstone work.`),
          h('div', { class: 'note' }, done ? `Finished in Month ${s.month}. Automatic checks passed and the code is in ${gh}'s GitHub with the rest of the lab work.` : now ? (browser ? 'Open now. It runs in the in-browser Python lab and is checked automatically when submitted.' : 'Open now. It runs in the cloud workspace and is checked automatically when submitted.') : `Opens in Month ${s.month}, after the earlier months are done.`),
          h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, now ? (browser ? h('button', { class: 'btn', onclick: () => { m.close(); c.go('practical'); } }, 'Open the practical') : h('button', { class: 'btn', onclick: () => { m.close(); c.go('workspace'); } }, 'Open the cloud workspace')) : null, h('button', { class: 'btn primary', onclick: () => m.close() }, 'Close'))));
      }
      function flashEl(id) { const el = document.getElementById(id); if (!el) return; el.classList.remove('mp-flashcard'); void el.offsetWidth; el.classList.add('mp-flashcard'); }

      function capDetail(j) {
        const msState = (m) => {
          if (j.before) return ['Done', 'green'];
          if (j.after) return ['Upcoming', ''];
          if (m.month < MM) return ['Done', 'green'];
          if (m.month === MM) { const s = capStatus(j); return [phaseLabel(), s.cls]; }
          return ['Upcoming', ''];
        };
        const open = (m) => (j.current ? m.month === MM : m === j.cap.milestones[0]);
        return h('div', { class: 'mp-detail' },
          h('div', { class: 'stack' },
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'mp-slot' }, j.slot), h('h3', { style: { minWidth: 0, flex: '1 1 200px' } }, j.cap.title), h('span', { class: 'pill violet' }, j.cap.level)),
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'eyebrow' }, 'The problem'), h('p', {}, j.cap.problem)),
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'eyebrow' }, 'What students build'), h('p', {}, j.cap.build)),
            h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'eyebrow' }, 'Tech stack'), h('div', { class: 'mp-tags' }, j.cap.stack.map((t) => h('span', { class: 'mp-tag' }, t)))),
            j.current ? h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn primary sm', onclick: () => { scrollTo('mp-milestone'); flashEl('mp-milestone'); } }, `Go to the Month ${MM} milestone`),
              secDemo ? h('button', { class: 'btn sm', onclick: () => { scrollTo('mp-demoday'); flashEl('mp-demoday'); } }, 'Book your Demo Day slot') : null) : null),
          h('div', { class: 'stack' },
            h('div', { class: 'eyebrow' }, 'Milestones'),
            j.cap.milestones.map((m) => {
              const [lab, cls] = msState(m);
              const d = h('details', { class: 'mp-ms' },
                h('summary', {}, h('span', {}, `Month ${m.month}`), h('span', { class: 'pill ' + (m.type === 'merged' ? 'violet' : '') }, m.type === 'merged' ? 'In-class milestone' : 'Homework milestone'), h('span', { class: 'pill ' + cls }, lab)),
                h('ul', {}, m.deliverables.map((x) => h('li', {}, x))));
              if (open(m)) d.open = true;
              return d;
            }),
            h('div', { class: 'eyebrow', style: { marginTop: '4px' } }, 'How the mentor grades it'),
            h('div', { class: 'mp-rub' }, (j.cap.rubric || []).map((r) => h('div', { class: 'mp-rub-row', title: 'Excellent: ' + r.excellent },
              h('span', {}, r.criterion), h('div', { class: 'mp-bar' }, h('i', { style: { width: `${Math.min(100, r.weight / 30 * 100)}%` } })), h('span', { class: 'num tiny muted' }, `${r.weight}%`))))));
      }

      // ----- 2. Current milestone -----
      function startTests() {
        st.phase = 'testing'; st.testsDone = 0; st.justPassed = -1; st.review = null; st.xpGiven = false;
        state.progress.milestoneStatus = 'submitted';
        refreshAll();
        const tick = () => {
          if (st.phase !== 'testing') return;
          st.justPassed = st.testsDone; st.testsDone++;
          if (st.testsDone >= m8.tests.length) { finishTests(); return; }
          fillMilestone(); later(tick, 850);
        };
        later(tick, 900);
      }
      function finishTests() {
        st.testsDone = m8.tests.length; st.phase = 'review';
        state.progress.milestoneStatus = 'submitted';
        c.emit('milestone:submitted', { capstone: cap.id, title: cap.title, slot: info.slot, month: MM, field: f.id, student: S.id, tests: { passed: m8.tests.length, total: m8.tests.length } });
        refreshAll();
        c.toast('All tests passed. Sent to your mentor for review.', 'green');
      }
      function simulateReview() {
        st.reviewing = true; fillMilestone();
        later(() => {
          const r = makeReview(info, { decision: 'approved' });
          c.emit('milestone:reviewed', { capstone: cap.id, title: cap.title, slot: info.slot, month: MM, decision: 'approved', score: r.total, scores: r.scores.map((s) => s.score), comment: r.comment, mentor: r.mentor, student: S.id, field: f.id });
        }, 1400);
      }

      function fillMilestone() {
        const n = m8.tests.length;
        const pill = capStatus(CUR);
        const order = ['draft', 'testing', 'review', 'approved'];
        const pi = st.phase === 'changes' ? 2 : order.indexOf(st.phase);
        const published = st.pub.stage === 6;
        const steps = ['Build', 'Automatic tests', 'Mentor review', 'Approved', 'Published'].map((t, i) => {
          let cls = '';
          if (published || i < pi || (st.phase === 'approved' && i === 3)) cls = 'done';
          else if (i === pi) cls = st.phase === 'changes' ? 'bad' : 'now';
          if (st.phase === 'approved' && i === 4 && !published) cls = 'now';
          return h('li', { class: cls }, t);
        });

        const editable = st.phase === 'draft' || st.phase === 'changes';
        const submitBtn = h('button', { class: 'btn primary', onclick: startTests }, st.phase === 'changes' ? 'Resubmit milestone' : st.phase === 'draft' ? 'Submit milestone' : 'Submitted');
        const hint = h('span', { class: 'tiny muted' });
        const syncSubmit = () => {
          const all = st.checked.every(Boolean);
          submitBtn.disabled = !editable || !all;
          hint.textContent = !editable ? '' : all ? 'Ready. Tests run as soon as you submit.' : `Tick all ${st.checked.length} items to submit.`;
        };
        const deliv = h('div', { class: 'mp-deliv' }, m8.deliverables.map((d, i) => {
          const cb = h('input', { type: 'checkbox', onchange: (e) => { st.checked[i] = e.target.checked; syncSubmit(); } });
          cb.checked = !!st.checked[i]; cb.disabled = !editable;
          return h('label', {}, cb, h('span', {}, d));
        }));
        syncSubmit();

        const checks = h('div', {}, m8.tests.map((t, i) => {
          let cls = 'wait', ic = '·', sub = st.phase === 'draft' || st.phase === 'changes' ? 'Runs when you submit' : 'Queued';
          if (i < st.testsDone) { cls = 'pass' + (i === st.justPassed ? ' just' : ''); ic = icon('check'); sub = `Passed in ${(2 + (parseInt(hash7(t), 16) % 90) / 10).toFixed(1)} s`; }
          else if (st.phase === 'testing' && i === st.testsDone) { cls = 'run'; ic = '<span class="spin"></span>'; sub = 'Running in an isolated lab container…'; }
          return h('div', { class: 'check ' + cls }, h('span', { class: 'ic', html: ic }), h('div', { class: 'mp-ct' }, h('span', {}, t), h('span', { class: 'tiny muted' }, sub)));
        }));
        let sum;
        if (st.phase === 'testing') sum = h('div', { class: 'mp-sum' }, h('span', { class: 'spin', style: { color: 'var(--brand)' } }), `Running test ${Math.min(st.testsDone + 1, n)} of ${n}`);
        else if (st.testsDone >= n && st.phase !== 'draft') sum = h('div', { class: 'mp-sum', style: { color: 'var(--green)' } }, h('span', { html: icon('check'), style: { width: '16px', height: '16px', display: 'inline-flex' } }), `${n} of ${n} tests passed`);
        else sum = h('div', { class: 'mp-sum muted' }, `${n} tests · run automatically, the same for every student`);

        fill(secMilestone,
          h('div', { class: 'card-head' },
            h('div', { style: { minWidth: 0, flex: '1 1 300px' } }, h('div', { class: 'eyebrow' }, `Current milestone · Capstone ${CN} · Month ${MM}${info.final ? ' (final)' : ''}`), h('h2', {}, cap.title), h('div', { class: 'small muted', style: { marginTop: '4px' } }, `${data.months[MM]} · for ${info.company}`)),
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'pill ' + pill.cls }, phaseLabel()), h('button', { class: 'btn ghost sm', title: 'Start this demo flow again', onclick: resetDemo }, 'Reset demo'))),
          h('ol', { class: 'mp-steps', 'aria-label': 'Milestone progress' }, steps),
          h('div', { class: 'mp-body' },
            h('div', { class: 'mp-pane' },
              h('h4', {}, 'What you hand in'),
              h('p', { class: 'tiny muted' }, 'Tick each item once it is in your project repository.'),
              deliv,
              h('div', { class: 'row', style: { gap: '10px' } }, submitBtn, hint)),
            h('div', { class: 'mp-pane' },
              h('h4', {}, 'Acceptance tests'),
              sum, checks)),
          reviewArea());
      }

      function reviewArea() {
        if (st.phase === 'review') {
          return h('div', { class: 'mp-review wait' },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },
              h('div', { class: 'stack', style: { gap: '4px', minWidth: 0, flex: '1 1 260px' } }, h('h3', {}, 'Waiting for mentor review'),
                h('p', { class: 'small muted' }, 'Your submission is in your mentor’s queue with the test results attached. The mentor scores it against the rubric and writes feedback.')),
              h('span', { class: 'pill amber' }, 'In queue')),
            st.reviewing
              ? h('div', { class: 'row small' }, h('span', { class: 'spin', style: { color: 'var(--brand)' } }), `Your mentor, Kavita Rao, is reviewing ${first}'s submission…`)
              : h('div', { class: 'row' },
                h('button', { class: 'btn primary', onclick: simulateReview, html: icon('mentor') + '<span>Simulate mentor review</span>' }),
                h('button', { class: 'btn', onclick: () => c.go('mentor') }, 'Open the mentor console'),
                h('span', { class: 'tiny muted' }, 'Demo: approve it here, or from the mentor console.')));
        }
        if ((st.phase === 'approved' || st.phase === 'changes') && st.review) {
          const r = st.review, ok = st.phase === 'approved';
          const table = h('div', { class: 'table-wrap' }, h('table', {},
            h('thead', {}, h('tr', {}, h('th', {}, 'Rubric criterion'), h('th', {}, 'Weight'), h('th', {}, 'Score'), h('th', { style: { textAlign: 'right' } }, 'Points'))),
            h('tbody', {}, r.scores.map((s) => h('tr', {}, h('td', {}, s.criterion), h('td', { class: 'num muted' }, `${s.weight}`),
              h('td', {}, h('div', { class: 'mp-bar green' }, h('i', { style: { width: `${s.weight ? s.score / s.weight * 100 : 0}%` } }))),
              h('td', { class: 'num', style: { textAlign: 'right' } }, `${s.score} / ${s.weight}`)))),
            h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td', { class: 'num muted' }, `${r.maxTotal}`), h('td', {}), h('td', { class: 'num', style: { textAlign: 'right' } }, `${r.total} / ${r.maxTotal}`)))));
          return h('div', { class: 'mp-review ' + (ok ? 'ok' : 'bad') },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },
              h('div', { class: 'mp-who' }, h('span', { class: 'avatar' }, r.mentor.split(' ').map((x) => x[0]).join('').slice(0, 2)),
                h('div', { style: { minWidth: 0 } }, h('b', { class: 'small' }, `Mentor review · ${r.mentor}`), h('div', { class: 'tiny muted' }, 'Scored against the capstone rubric · demo data'))),
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'stat' }, h('b', { class: 'num', style: { color: ok ? 'var(--green)' : 'var(--red)' } }, `${r.total}/${r.maxTotal}`)), h('span', { class: 'pill ' + (ok ? 'green' : 'red') }, ok ? 'Approved' : 'Changes requested'))),
            table,
            h('div', { class: 'mp-quote' }, r.comment),
            ok
              ? h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => scrollTo('mp-publish'), html: icon('github') + `<span>${st.pub.stage === 6 ? 'See what was published' : 'Next: publish to GitHub'}</span>` }),
                secDemo ? h('button', { class: 'btn', onclick: () => { scrollTo('mp-demoday'); flashEl('mp-demoday'); } }, st.demo.booked ? 'See your Demo Day slot' : 'Book your Demo Day slot') : null,
                h('span', { class: 'tiny muted' }, info.certSlot ? `Capstone ${CN} certificate unlocked.` : info.slot === 'C4' ? 'Capstone 4 and the program certificate follow Demo Day in Month 12.' : `The Capstone ${CN} certificate follows when the Month ${info.last.month} milestone is approved.`))
              : h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { st.phase = 'changes'; st.testsDone = 0; st.review = r; state.progress.milestoneStatus = 'changes_requested'; fillMilestone(); scrollTo('mp-milestone'); } }, 'Make changes and resubmit')));
        }
        if (st.phase === 'draft') return h('p', { class: 'note', style: { marginTop: '16px' } }, 'After you submit: the tests run automatically, then your mentor scores the work with the rubric and approves it or asks for changes.');
        return null;
      }

      function resetDemo() {
        st.phase = 'draft'; st.pub.stage = 0;   // so cleanup does not "finish" anything we are throwing away
        if (live) live.cleanup();
        store[f.id] = freshState(f, { milestoneStatus: 'in_progress', portfolioPublished: false });
        if (info.certSlot) dropLive(info.certSlot);
        Object.assign(state.progress, { milestoneStatus: 'in_progress', portfolioPublished: false });
        syncCertCount();
        root.textContent = '';
        mod.render(root, NM.ctx());
        c.toast('Demo flow reset for this field.');
      }

      // ----- 3. Publish to GitHub -----
      function commitsList() {
        const ms7 = cap.milestones.find((m) => m.month === MM - 1) || cap.milestones[0];
        return [
          `feat: ${shortLine(ms7.deliverables[0])}`,
          `feat: ${shortLine(m8.deliverables[0])}`,
          `feat: ${shortLine(m8.deliverables[1] || m8.deliverables[0])}`,
          `test: add the ${m8.tests.length} Month ${MM} acceptance tests`,
        ].map((msg) => ({ msg, hash: hash7(f.id + msg) }));
      }
      function readmeDraft() {
        const ms9 = info.next;
        const score = st.review ? `${st.review.total}/${st.review.maxTotal}` : 'approved';
        const doneMs = cap.milestones.filter((m) => m.month <= MM).map((m) => m.month);
        const doneTxt = doneMs.length > 1 ? `Month ${doneMs.slice(0, -1).join(', ')} and ${doneMs[doneMs.length - 1]} milestones are complete` : `The Month ${doneMs[0]} milestone is complete`;
        return [
          `# ${cap.title}`, '',
          `Capstone ${CN} · ${info.slot === 'C1' ? 'Common foundation' : f.name} · Neuromind AI Creator Program (Batch ${S.batch})`,
          `Built for ${info.company}, a fictional company used in the course.`, '',
          '## Purpose', cap.problem, '',
          '## How it works', cap.build, '',
          '## Tech used', ...cap.stack.map((t) => `- ${t}`), '',
          '## Status and limits',
          `- ${doneTxt}; mentor score ${score}.`,
          ms9 ? `- Still to come in Month ${ms9.month}${info.slot === 'C4' && ms9.month === 12 ? ' (presented live at Demo Day)' : ''}: ${shortLine(ms9.deliverables[0])}.` : '- All milestones of this capstone are complete.',
          '- Runs on the lab practice datasets only. No real customer data.',
          '- AI output is checked by automatic tests, and a person approves anything risky.',
        ].join('\n');
      }
      function startPublish() {
        st.pub.stage = 1; st.pub.commits = 0; fillPublish();
        later(() => { st.pub.stage = 2; fillPublish();
          later(() => { st.pub.stage = 3; fillPublish();
            const push = () => {
              if (st.pub.stage !== 3) return;
              st.pub.commits++;
              if (st.pub.commits >= 4) { later(() => { if (st.pub.stage !== 3) return; st.pub.stage = 4; if (st.pub.readme == null) st.pub.readme = readmeDraft(); fillPublish(); }, 500); }
              else later(push, 450);
              fillPublish();
            };
            later(push, 450);
          }, 900);
        }, 700);
      }
      function pubNotify() {
        if (st.pubNotified || !c.notify) return; st.pubNotified = true;
        c.notify('Portfolio published', `${cap.title} is public at github.com/${gh}/${repo}, and your portfolio site https://${gh}.github.io has rebuilt.`, 'projects');
      }
      function finishPublish() {
        st.pub.stage = 6; st.flash = true; pubNotify();
        state.progress.portfolioPublished = true;
        c.emit('portfolio:published', { repo: `${gh}/${repo}`, url: `https://github.com/${gh}/${repo}`, site: `https://${gh}.github.io`, capstone: cap.id, field: f.id, student: S.id });
        refreshAll();
        c.addXP(60, 'Capstone published to GitHub');
      }
      function fillPublish() {
        const ok = st.phase === 'approved';
        const stage = st.pub.stage;
        const commits = commitsList();
        const stepState = (k) => (stage === 0 ? 'wait' : stage === 6 || k < stage ? 'pass' : k === stage ? 'run' : 'wait');
        const ic = (s) => (s === 'pass' ? icon('check') : s === 'run' ? '<span class="spin"></span>' : '·');
        const step = (k, title, detail) => { const s = stepState(k); return h('div', { class: 'check ' + s }, h('span', { class: 'ic', html: k === 4 && s === 'run' ? '4' : ic(s) }), h('div', { class: 'mp-ct' }, h('b', { class: 'small' }, title), detail)); };

        let readmeBlock;
        if (stage === 4) {
          const ta = h('textarea', { class: 'field-input mp-readme', 'aria-label': 'README draft', spellcheck: 'false', oninput: (e) => { st.pub.readme = e.target.value; } });
          ta.value = st.pub.readme || readmeDraft();
          readmeBlock = h('div', { class: 'stack', style: { gap: '8px' } },
            h('span', { class: 'mp-sub', html: '<span class="ai-badge">AI</span> Drafted from your code and milestone notes. Edit anything before it goes public.' }),
            ta,
            h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { st.pub.readme = ta.value; st.pub.stage = 5; fillPublish(); later(finishPublish, 1400); } }, 'Publish README and rebuild site'),
              h('button', { class: 'btn sm ghost', onclick: () => { st.pub.readme = readmeDraft(); ta.value = st.pub.readme; c.toast('Draft restored.'); } }, 'Restore AI draft')));
        } else if (stage > 4) readmeBlock = h('span', { class: 'mp-sub' }, `README.md published (${(st.pub.readme || '').split(/\s+/).filter(Boolean).length} words)`);
        else readmeBlock = h('span', { class: 'mp-sub' }, 'You check and edit the AI draft before anything goes public');

        fill(secPublish,
          h('div', { class: 'card-head' },
            h('div', {}, h('div', { class: 'eyebrow' }, 'Your own GitHub'), h('h3', {}, 'Publish to GitHub')),
            h('span', { class: 'pill ' + (stage === 6 ? 'green' : ok ? 'blue' : '') }, stage === 6 ? 'Published' : ok ? 'Ready to publish' : 'Locked')),
          h('p', { class: 'small muted', style: { marginBottom: '8px' } }, 'The project goes to the student’s own GitHub account, so employers can see the real code. The portfolio site then rebuilds itself.'),
          h('div', {},
            step(1, 'Connect the GitHub App', h('span', { class: 'mp-sub' }, `Already connected as ${gh}`)),
            step(2, 'Create the repository', h('span', { class: 'mp-mono muted' }, `github.com/${gh}/${repo}`)),
            step(3, 'Push your commits', stage >= 3
              ? h('div', { class: 'mp-commits' }, commits.slice(0, stage === 3 ? st.pub.commits : 4).map((x) => h('div', { html: `<span class="hx">${x.hash}</span> ${c.esc(x.msg)}` })),
                stage === 3 && st.pub.commits < 4 ? h('div', { class: 'dm' }, 'pushing…') : h('div', { class: 'dm' }, `4 commits pushed to main`))
              : h('span', { class: 'mp-sub' }, '4 commits from your lab work')),
            step(4, 'Review the README', readmeBlock),
            step(5, 'Rebuild the portfolio site', h('span', { class: 'mp-sub' }, stage === 6 ? `Live at https://${gh}.github.io` : stage === 5 ? 'Building the site from your repositories…' : 'Adds this project to your public portfolio'))),
          stage === 0
            ? h('div', { class: 'row', style: { marginTop: '12px' } },
              h('button', { class: 'btn primary', disabled: !ok, onclick: startPublish, html: icon('github') + '<span>Publish to GitHub</span>' }),
              !ok ? h('span', { class: 'tiny muted' }, `Unlocks when your mentor approves the Month ${MM} milestone.`) : null)
            : stage === 6
              ? h('div', { class: 'callout', style: { marginTop: '12px', borderLeftColor: 'var(--green)' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                  h('span', { class: 'small', style: { minWidth: 0 } }, h('b', {}, 'Published. '), `github.com/${gh}/${repo} is public and your portfolio shows it.`),
                  h('button', { class: 'btn sm', onclick: () => scrollTo('mp-portfolio') }, 'See portfolio')))
              : null);
      }

      // ----- 4. Certificates (from the student's profile, plus any issued live in this session) -----
      function certList() {
        const base = `${S.batch}-${S.id}`, live = liveCerts();
        const prof = (slot) => (S.certificates || []).find((x) => x.slot === slot);
        const defs = {
          F: { key: 'F', title: 'Months 1–3 completion', what: `has completed Months 1 to 3 of the Neuromind AI Creator Program: ${[1, 2, 3].map((m) => data.months[m]).join(', ')}.`, kind: 'Certificate of Completion' },
        };
        J.forEach((j, i) => { if (j.slot !== 'C4') defs[j.slot] = { key: j.slot, title: `Capstone ${i + 1}: ${j.cap.title}`, what: `has built and passed mentor review for Capstone ${i + 1}, “${j.cap.title}”, ${j.slot === 'C1' ? `for ${j.company}` : `in the ${f.name} track`}.`, kind: 'Capstone Certificate' }; });
        const out = [];
        ['F', 'C1', 'C2', 'C3'].forEach((slot) => {
          const p = prof(slot), l = live[slot];
          if (!p && !l) return;
          const j = J.find((x) => x.slot === slot);
          const score = l && l.score != null ? l.score : slot === info.slot && st.review ? st.review.total : j && j.score != null ? j.score : null;
          out.push(Object.assign({}, defs[slot], { id: `${base}-${slot}`, issued: p ? fmtDate(p.date) : l.date, score: slot === 'F' ? null : score }));
        });
        // What comes next, so the list never looks finished when it is not.
        const has = (slot) => out.some((x) => x.key === slot);
        if (info.slot !== 'C4' && !has(info.slot)) {
          out.push(Object.assign({}, defs[info.slot], { id: `${base}-${info.slot}`, locked: true, title: info.certSlot ? `Capstone ${CN} — available after approval` : `Capstone ${CN} — after the Month ${info.last.month} milestone`,
            lockText: info.certSlot ? `Unlocks when your mentor approves the Month ${MM} milestone` : `Unlocks when the final Month ${info.last.month} milestone is approved` }));
        }
        if (!has('F') && NOW <= 3) out.push(Object.assign({}, defs.F, { id: `${base}-F`, locked: true, title: 'Months 1–3 completion', lockText: 'Issued when you pass the Month 3 assessment' }));
        if (info.slot === 'C4') out.push({ key: 'C4', id: `${base}-C4`, locked: true, title: `Capstone 4 and program completion`, lockText: 'Issued after you present at Demo Day in Month 12', kind: 'Program Completion and Capstone 4' });
        return out;
      }
      function fillCerts() {
        const list = certList(), issued = list.filter((x) => !x.locked);
        fill(secCerts,
          h('div', { class: 'card-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'QR-verifiable'), h('h3', {}, 'Certificates')), h('span', { class: 'pill' }, `${issued.length} issued`)),
          h('p', { class: 'small muted', style: { marginBottom: '10px' } }, 'Every certificate has a QR code. Anyone can scan it to check it is genuine.'),
          issued.length ? null : h('div', { class: 'note', style: { marginBottom: '10px' } }, h('b', {}, 'No certificates yet. '),
            `${first}'s first certificates arrive at the end of Month 3: Capstone 1 once the mentor approves this milestone, and Months 1–3 completion after the Month 3 assessment is passed.`),
          h('div', { class: 'mp-certs' }, list.map((x) => h('button', { class: 'mp-cert', disabled: !!x.locked, onclick: () => openCert(x) },
            h('span', { class: 'ix', html: icon('trophy') }),
            h('span', { class: 'tx' }, h('b', {}, x.title), h('span', {}, x.locked ? x.lockText : `Issued ${x.issued} · ${x.id}`)),
            x.locked ? h('span', { class: 'pill' }, 'Locked') : h('span', { class: 'pill green' }, 'View')))),
          h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'Demo certificates. Not real credentials.'));
      }
      function openCert(x) {
        const url = `https://verify.neuronetwrks.com/c/${x.id}`;
        const qrBox = h('div', { class: 'mp-qr' });
        const qrNote = h('span', { class: 'tiny muted' }, '');
        const body = h('div', { class: 'm-projects mp-modal' },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', {}, 'Certificate preview'), h('span', { class: 'pill amber' }, 'Demo')),
          h('div', { class: 'mp-paper' }, h('div', { class: 'mp-paper-in' },
            h('div', { class: 'eyebrow' }, `${data.brand.org} · ${data.brand.name}`),
            h('h2', {}, x.kind),
            h('div', { class: 'small muted' }, 'This certifies that'),
            h('div', { class: 'mp-name' }, S.name),
            h('p', { class: 'small' }, x.what),
            x.score != null ? h('div', {}, h('span', { class: 'pill green' }, `Mentor score ${x.score}/100`)) : null,
            h('div', { class: 'mp-paper-foot' },
              h('div', {}, h('span', { class: 'tiny muted' }, 'Issued'), h('b', { class: 'small' }, x.issued), h('span', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Certificate ID'), h('b', { class: 'mp-mono' }, x.id)),
              h('div', { class: 'mp-qrwrap' }, qrBox, qrNote)))),
          h('div', { class: 'stack', style: { gap: '6px' } },
            h('div', { class: 'eyebrow' }, 'Verification page (what a scan opens)'),
            h('div', { class: 'mp-browser' },
              h('div', { class: 'mp-bbar' }, h('span', { class: 'mp-dots', html: '<i></i><i></i><i></i>' }), h('span', { class: 'mp-url', title: url }, url)),
              h('div', { class: 'mp-vsite' },
                h('div', { class: 'mp-valid' }, h('span', { class: 'ok', html: icon('check') }),
                  h('div', { style: { minWidth: 0 } }, h('b', { style: { color: 'var(--green)' } }, 'Valid'), h('div', { class: 'small' }, `Issued to ${S.name} · ${x.issued}`))),
                h('div', { class: 'small muted' }, `${x.kind} · ${x.title.replace(' — available after approval', '')}`),
                h('div', { class: 'tiny muted' }, `Issued by ${data.brand.org} · ID ${x.id}`),
                h('div', { class: 'note tiny' }, 'Demo page. No real certificate or student exists.')))),
          h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
            h('button', { class: 'btn', onclick: () => m.close() }, 'Close'),
            h('button', { class: 'btn primary', onclick: () => { m.close(); state.verifyCertificate = x.id; c.emit('certificate:verified', { id: x.id }); c.go('achievements'); }, html: icon('shield') + '<span>Verify this certificate</span>' })));
        const m = c.modal(body);
        drawQR(qrBox, url, qrNote);
      }

      // ----- 5. Portfolio preview (the student's finished projects) -----
      function fillPortfolio() {
        const approved = st.phase === 'approved', published = st.pub.stage === 6;
        const skills = [];
        J.filter((j) => j.before || j.current).forEach((j) => j.cap.stack.forEach((t) => { const s = cleanTech(t); if (s && !skills.includes(s)) skills.push(s); }));
        const certs = certList().filter((x) => !x.locked);
        const card = (j) => {
          let status, cls, link = null, dim = false, flash = false;
          const n = j.slot.slice(1);
          if (j.before) { status = `Approved · ${j.score}/100`; cls = 'green'; link = `github.com/${gh}/${kebab(j.cap.title)}`; }
          else if (j.current) {
            if (published) { status = 'Approved'; cls = 'green'; link = `github.com/${gh}/${repo}`; flash = st.flash; }
            else if (approved) { status = 'Approved · publishing soon'; cls = 'blue'; }
            else { status = 'In progress'; cls = 'amber'; }
          } else { status = `Coming in Month ${j.months[0]}`; cls = ''; dim = true; }
          return h('div', { class: 'mp-pcard' + (dim ? ' dim' : '') + (flash ? ' flash' : '') },
            h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '8px' } }, h('span', { class: 'mp-slot' }, `Capstone ${n}`), h('span', { class: 'pill ' + cls }, status)),
            h('b', {}, j.cap.title),
            h('span', { class: 'mp-sub' }, firstSentence(j.cap.build)),
            h('div', { class: 'mp-tags', style: { marginTop: '2px' } }, j.cap.stack.slice(0, 3).map((t) => h('span', { class: 'mp-tag' }, cleanTech(t)))),
            link ? h('button', { class: 'mp-repo lnk', onclick: () => repoToast(link) }, link) : null);
        };
        const shownCaps = J.filter((j, i) => j.before || j.current || i === info.idx + 1);
        const minisDone = COMMON_MINI.concat(f.standalone || []).filter((x) => x.month < NOW);
        const lastIssued = certs.length ? certs[certs.length - 1].issued : 'last week';
        const role = NOW <= 3 ? `Common foundation · ${f.name} from Month 4` : `${f.name} · AI-assisted builder`;
        st.flash = false;
        fill(secPortfolio,
          h('div', { class: 'card-head' },
            h('div', {}, h('div', { class: 'eyebrow' }, 'Built automatically'), h('h3', {}, 'Portfolio site preview')),
            h('span', { class: 'pill ' + (published ? 'green' : '') }, published ? 'Rebuilt just now' : `Last built ${lastIssued}`)),
          h('p', { class: 'small muted', style: { marginBottom: '12px' } }, 'Every approved project lands on the student’s public portfolio. No web skills needed; it rebuilds whenever they publish.'),
          h('div', { class: 'mp-browser' },
            h('div', { class: 'mp-bbar' }, h('span', { class: 'mp-dots', html: '<i></i><i></i><i></i>' }), h('span', { class: 'mp-url' }, `https://${gh}.github.io`)),
            h('div', { class: 'mp-site' },
              h('div', { class: 'mp-hero' }, h('span', { class: 'mp-av' }, S.initials || S.name.split(' ').map((s) => s[0]).join('')),
                h('div', {}, h('h2', {}, S.name), h('b', { class: 'small', style: { color: 'var(--brand)' } }, role),
                  h('p', { class: 'small muted' }, `${S.education ? S.education + '. ' : ''}Student in the Neuromind AI Creator Program, Batch ${S.batch}. I build working tools for ${info.company}, a fictional company used in the course, and every project here was reviewed by a mentor.`),
                  h('div', { class: 'row tiny', style: { gap: '14px', marginTop: '4px' } }, h('button', { class: 'mp-repo lnk', onclick: () => repoToast(`github.com/${gh}`) }, `github.com/${gh}`), h('button', { class: 'lnk muted', onclick: () => c.go('achievements') }, certs.length ? `${certs.length} verified certificate${certs.length === 1 ? '' : 's'}` : 'Badges and progress')))),
              skills.length ? h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', {}, 'Skills'), h('div', { class: 'mp-tags' }, skills.slice(0, 14).map((t) => h('span', { class: 'mp-tag' }, t)))) : null,
              h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', {}, 'Capstone projects'), h('div', { class: 'mp-pgrid' }, shownCaps.map(card))),
              minisDone.length ? h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', {}, 'Monthly projects'),
                h('div', { class: 'mp-tags' }, minisDone.map((x) => h('button', { class: 'mp-chip done', onclick: () => repoToast(`github.com/${gh}/${kebab(x.title)}`), html: icon('check') + `<b>M${x.month}</b><span>${c.esc(x.title)}</span>` })))) : null,
              h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', {}, 'Certificates'),
                certs.length ? h('div', { class: 'mp-tags' }, certs.map((x) => h('span', { class: 'pill green', title: x.id }, x.key === 'F' ? 'Months 1–3' : `Capstone ${x.key.slice(1)}`)))
                  : h('span', { class: 'small muted' }, 'The first certificates appear here at the end of Month 3.')),
              h('div', { class: 'tiny muted' }, 'Rebuilt automatically from GitHub · Demo data'))));
      }

      // ----- 6. Demo Day booking (Capstone 4 students, Month 12) -----
      const DEMO_SLOTS = [
        ['Sat 22 Jan 2028', '10:00'], ['Sat 22 Jan 2028', '10:20'], ['Sat 22 Jan 2028', '10:40'], ['Sat 22 Jan 2028', '11:00'],
        ['Sun 23 Jan 2028', '10:00'], ['Sun 23 Jan 2028', '10:20'], ['Sun 23 Jan 2028', '14:00'], ['Sun 23 Jan 2028', '14:20'],
      ].map(([day, time], i) => ({ id: 'd' + i, day, time, taken: [0, 2, 5, 6].includes(i) }));
      function fillDemo() {
        if (!secDemo) return;
        const d = st.demo, booked = DEMO_SLOTS.find((x) => x.id === d.booked), picked = DEMO_SLOTS.find((x) => x.id === d.picked);
        const finalMs = cap.milestones[cap.milestones.length - 1];
        const days = [...new Set(DEMO_SLOTS.map((x) => x.day))];
        const grid = h('div', { class: 'mp-dslots' }, days.map((day) => h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, day),
          h('div', { class: 'mp-dgrid' }, DEMO_SLOTS.filter((x) => x.day === day).map((x) => {
            const mine = booked && booked.id === x.id, sel = d.picked === x.id;
            return h('button', { class: 'mp-dslot' + (sel ? ' sel' : '') + (mine ? ' mine' : ''), disabled: x.taken && !mine, 'aria-pressed': sel ? 'true' : 'false',
              'aria-label': `${x.day}, ${x.time} IST${x.taken ? ', taken' : mine ? ', your slot' : ''}`, onclick: () => { d.picked = x.id; fillDemo(); } },
              h('b', { class: 'num' }, x.time), h('span', { class: 'tiny' }, x.taken ? 'Taken' : mine ? 'Your slot' : 'Free'));
          })))));
        const book = () => {
          if (!picked) return;
          const was = booked;
          d.booked = picked.id; d.picked = null;
          fillDemo();
          c.toast(was ? `Demo Day slot changed to ${picked.day}, ${picked.time}.` : `Demo Day slot booked: ${picked.day}, ${picked.time}.`, 'green');
          if (c.notify) c.notify(was ? 'Demo Day slot changed' : 'Demo Day slot booked', `${picked.day} at ${picked.time} IST. You present "${cap.title}" for 10 minutes, then 5 minutes of questions from mentors and guests.`, 'projects');
          c.emit('demoday:booked', { student: S.id, day: picked.day, time: picked.time, capstone: cap.id });
        };
        fill(secDemo,
          h('div', { class: 'card-head' },
            h('div', { style: { minWidth: 0, flex: '1 1 260px' } }, h('div', { class: 'eyebrow' }, 'Next step · Month 12'), h('h3', {}, 'Book your Demo Day slot'),
              h('p', { class: 'small muted', style: { marginTop: '4px' } }, `Capstone 4 ends at Demo Day. ${first} presents "${cap.title}" live: 10 minutes of demo and 5 minutes of questions from mentors and invited guests. The Month ${finalMs.month} milestone is graded there.`)),
            h('span', { class: 'pill ' + (booked ? 'green' : 'amber') }, booked ? 'Booked' : 'Not booked yet')),
          booked
            ? h('div', { class: 'callout', style: { borderLeftColor: 'var(--green)', marginBottom: '12px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                h('span', { class: 'small', style: { minWidth: 0 } }, h('b', {}, `Booked: ${booked.day}, ${booked.time} IST. `), 'Online stage in the lab, with a tech check 30 minutes before.'),
                h('button', { class: 'btn sm', onclick: () => c.toast(`Added to your lab calendar: Demo Day, ${booked.day} at ${booked.time} IST.`, 'green') }, 'Add to calendar')))
            : null,
          grid,
          h('div', { class: 'row', style: { marginTop: '12px', gap: '10px' } },
            h('button', { class: 'btn primary', disabled: !picked || (booked && picked.id === booked.id), onclick: book }, booked ? 'Move to this slot' : 'Book this slot'),
            h('span', { class: 'tiny muted' }, picked ? `Selected: ${picked.day}, ${picked.time} IST` : booked ? 'You can change the slot until a week before Demo Day.' : 'Pick a free slot. Times are in IST.')));
      }

      function repoToast(link) { c.toast(`On the live site this opens ${link} on GitHub. The demo stays offline, so it does not leave this page.`); }
      function refreshAll() { fillTimeline(); fillMilestone(); fillDemo(); fillPublish(); fillCerts(); fillPortfolio(); }

      // Mentor decisions (from this screen or the mentor console): the store was already updated by the module-level listener.
      const off = c.on('milestone:reviewed', () => {
        const cur = store[f.id];
        if (!cur || cur !== st) return;
        refreshAll();
        if (st.phase === 'approved' && !st.xpGiven) { st.xpGiven = true; c.addXP(120, `Capstone ${CN} milestone approved`); }
        else if (st.phase === 'changes') c.toast('Your mentor asked for changes.', 'amber');
      });

      live = {
        cleanup() {
          off(); clearTimers();
          // Finish anything mid-animation so a re-render shows a sensible end state.
          if (st.phase === 'testing') finishTestsQuiet();
          if (st.pub.stage >= 1 && st.pub.stage <= 3) { st.pub.stage = 4; st.pub.commits = 4; if (st.pub.readme == null) st.pub.readme = readmeDraft(); }
          if (st.pub.stage === 5) { st.pub.stage = 6; state.progress.portfolioPublished = true; pubNotify(); c.emit('portfolio:published', { repo: `${gh}/${repo}`, url: `https://github.com/${gh}/${repo}`, site: `https://${gh}.github.io`, capstone: cap.id, field: f.id, student: S.id }); }
          st.reviewing = false;
          live = null;
        },
      };
      function finishTestsQuiet() {
        st.testsDone = m8.tests.length; st.phase = 'review'; state.progress.milestoneStatus = 'submitted';
        c.emit('milestone:submitted', { capstone: cap.id, title: cap.title, slot: info.slot, month: MM, field: f.id, student: S.id, tests: { passed: m8.tests.length, total: m8.tests.length } });
      }

      refreshAll();
    },

    destroy() { if (live) live.cleanup(); },
  });
})();
