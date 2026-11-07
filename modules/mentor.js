/* Mentor console: the teacher's view of Batch NM-2027-A (24 fictional students).
   Summary row, "needs attention" callout, and four tabs: Students, Review queue, Exam flags, Lab usage.
   The active demo student (one of 4 in the batch, picked at login) updates live from student-side events.
   The batch is shown as at the active student's point in the year (month, week, capstone milestone, exam).
   Event-driven state lives in the module-level STORE so it survives navigation and field switches. */
(function () {
  const CAP = 12; // lab hours a week
  const ME = () => window.NM_DATA.demo_student;         // active demo student profile
  const SID = () => ME().id;
  const PRON = { S1001: ['he', 'his', 'him'], S1002: ['she', 'her', 'her'], S1003: ['he', 'his', 'him'], S1004: ['she', 'her', 'her'] };
  const pr = (id, k) => (PRON[id] || ['they', 'their', 'them'])[k];
  const profileOf = (id) => (window.NM_DATA.demo_students || []).find((p) => p.id === id) || null;

  const STORE = {
    ui: { tab: 'students', status: 'all', field: 'all', q: '', sort: 'status', dir: 1, page: 0, actAll: false },
    aarav: { lecturesDone: 0, practicals: {}, practicalSubs: 0, exam: null, milestone: null, portfolio: null, lastTs: 0, activity: [] },
    bonus: {},   // student id -> extra lab hours granted this week
    vivas: {},   // student id -> true
    reviews: {}, // review queue key -> { decision, score }
    exam: {},    // student id -> 'accepted' | 'viva' | 'retest'
  };
  const A = STORE.aarav;
  let live = null; // { rerender } while the console is on screen

  /* ---------- helpers ---------- */
  function rng(seed) {
    let a = 0; for (const ch of String(seed)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) | 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  function pct(v) { v = Number(v); if (!isFinite(v)) return null; if (v > 0 && v <= 1) v *= 100; return Math.round(clamp(v, 0, 100)); }
  function rel(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 90) return 'Just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; return `${Math.round(s / 3600)} h ago`;
  }
  const dayLabel = (d) => (d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`);
  const first = (name) => String(name).split(' ')[0];
  const D = () => window.NM_DATA;
  const fieldById = (id) => D().fields.find((f) => f.id === id) || D().fields[0];
  function lectureOf(l) {
    const L = D().lectures;
    if (l && typeof l === 'object') return L.find((x) => x.id === l.id) || { id: l.id || '?', topic: l.topic || 'Lecture', practical: l.practical || 'Practical' };
    return L.find((x) => x.id === Number(l)) || L.find((x) => x.id === D().demo_student.lecture);
  }
  function parseFlags(f) {
    const out = { tab: 0, fs: 0, paste: 0 };
    if (f == null) return out;
    if (typeof f === 'number') { out.tab = f; return out; }
    const bucket = (key, n) => { const k = String(key).toLowerCase(); if (/paste|copy|clip/.test(k)) out.paste += n; else if (/full|fs/.test(k)) out.fs += n; else out.tab += n; };
    if (Array.isArray(f)) { f.forEach((x) => bucket(typeof x === 'string' ? x : (x && (x.type || x.kind || x.event || x.name)) || 'tab', 1)); return out; }
    if (typeof f === 'object') {
      for (const [k, v] of Object.entries(f)) {
        const n = typeof v === 'number' ? v : Array.isArray(v) ? v.length : v ? 1 : 0;
        if (/paste|copy|clip|full|fs|tab|blur|focus|switch|visib|leave/i.test(k)) bucket(k, n);
      }
    }
    return out;
  }

  /* ---------- live events from the student view (subscribed once, kept for the whole session) ---------- */
  function logA(text) { A.lastTs = Date.now(); A.activity.unshift({ t: A.lastTs, text }); A.activity.length = Math.min(A.activity.length, 12); if (live) live.rerender(); }
  if (window.NM && NM.on) {
    NM.on('lecture:completed', (p) => { A.lecturesDone += 1; const l = lectureOf(p && p.lecture); logA(`Finished Lecture ${l.id}: ${l.topic}`); });
    NM.on('practical:submitted', (p) => {
      const score = pct(p && p.score); const l = lectureOf(p && p.lecture);
      const key = String(l.id); A.practicals[key] = Math.max(A.practicals[key] || 0, score == null ? 0 : score); A.practicalSubs += 1;
      logA(`Submitted practical "${l.practical}"${score == null ? '' : `: ${score}% of checks passed`}`);
    });
    NM.on('exam:submitted', (p) => {
      A.exam = { score: pct(p && p.score), flags: parseFlags(p && p.flags), ts: Date.now() }; delete STORE.exam[SID()];
      const fl = A.exam.flags, n = fl.tab + fl.fs + fl.paste;
      const exTitle = (p && p.title) || (p && p.month ? `Month ${p.month} assessment` : ME().next_exam.title);
      logA(`Submitted the ${exTitle}${A.exam.score == null ? '' : `: ${A.exam.score}%`}${n ? `, ${n} integrity flag${n > 1 ? 's' : ''}` : ', no integrity flags'}`);
    });
    NM.on('milestone:submitted', (p) => {
      const cap = p && p.capstone; const slotM = /C[1-4]/.exec(typeof cap === 'object' && cap ? (cap.slot || cap.id || '') : String(cap || '')) || /C[1-4]/.exec(String((p && p.slot) || ''));
      A.milestone = { slot: slotM ? slotM[0] : ME().capstone, month: Number(p && p.month) || ME().capstone_month, ts: Date.now() }; delete STORE.reviews[SID()];
      logA(`Submitted capstone ${A.milestone.slot} Month ${A.milestone.month} for mentor review`);
    });
    NM.on('milestone:reviewed', (p) => { if (p && p.student === SID() && !STORE.reviews[SID()]) { STORE.reviews[SID()] = { decision: p.decision, score: p.score }; if (live) live.rerender(); } });
    NM.on('portfolio:published', (p) => { A.portfolio = (p && p.repo) || 'portfolio'; logA(`Published the portfolio site${p && p.repo ? ` (${p.repo})` : ''}`); });
  }

  /* ---------- derived student rows ---------- */
  const STATUS = { on_track: ['On track', 'green', 2], watch: ['Watch', 'amber', 1], at_risk: ['At risk', 'red', 0] };
  const MS_LABEL = { approved: 'Approved', changes_requested: 'Changes requested', submitted: 'Waiting for review', in_progress: 'In progress' };
  // Capstone 1 is the common capstone (data.common); C2 to C4 come from the career field.
  function capFor(fieldId, slot) {
    if (slot === 'C1') return D().common.capstone;
    const f = fieldById(fieldId); return f.capstones.find((x) => x.slot === slot) || f.capstones[0];
  }
  const capCompany = (fieldId, slot) => (slot === 'C1' ? D().common.company : fieldById(fieldId).company);
  const capArea = (fieldId, slot) => (slot === 'C1' ? 'Common foundation (Months 1 to 3)' : fieldById(fieldId).name);
  // The batch is shown at the active student's point in the year.
  const batchNow = () => { const P = ME(); return { month: P.month, week: P.week, lecture: P.lecture, slot: P.capstone, msMonth: P.capstone_month }; };
  function prevMilestoneMonth(slot, month) {
    const cap = capFor(D().fields[0].id, slot);
    const ms = cap.milestones.map((m) => m.month).filter((m) => m < month);
    return ms.length ? Math.max(...ms) : month;
  }
  // Other students' milestones waiting for review, at the batch's current capstone milestone.
  function sampleQueue() {
    const B = batchNow(), prev = prevMilestoneMonth(B.slot, B.msMonth);
    return [
      { sid: 'S1009', slot: B.slot, month: B.msMonth, when: '2 hours ago' },
      { sid: 'S1020', slot: B.slot, month: B.msMonth, when: 'Yesterday' },
      { sid: 'S1023', slot: B.slot, month: B.msMonth, when: 'Yesterday' },
      { sid: 'S1012', slot: B.slot, month: prev, when: '3 days ago', resub: true },
    ];
  }

  function hydrateFromProgress(c) { // pick up anything other modules recorded before this file subscribed
    const sp = c.state.progress || {};
    if (sp.examScore != null && !A.exam) A.exam = { score: pct(sp.examScore), flags: parseFlags(null), ts: Date.now() };
    if (sp.milestoneStatus === 'submitted' && !A.milestone) A.milestone = { slot: ME().capstone, month: ME().capstone_month, ts: Date.now() };
  }

  function milestoneFor(base, sid, c) {
    let ms; const B = batchNow(); const P = profileOf(sid);
    if (sid === SID()) {
      if (A.milestone) ms = { slot: A.milestone.slot, month: A.milestone.month, status: 'submitted', current: true };
      else {
        const st = c && c.state.progress && c.state.progress.milestoneStatus;
        ms = { slot: ME().capstone, month: ME().capstone_month, status: MS_LABEL[st] && st !== 'submitted' ? st : 'in_progress', current: true };
      }
    } else if (P) ms = { slot: P.capstone, month: P.capstone_month, status: P.milestone_status || 'in_progress', current: true };
    else {
      const q = sampleQueue().find((x) => x.sid === sid);
      if (q) ms = { slot: q.slot, month: q.month, status: 'submitted', resub: q.resub };
      else ms = { slot: B.slot, month: base === 'submitted' ? B.msMonth : prevMilestoneMonth(B.slot, B.msMonth), status: base };
    }
    const r = STORE.reviews[sid];
    if (r && ms.status === 'submitted') ms = Object.assign({}, ms, { status: r.decision, score: r.score });
    return ms;
  }

  function activeRow(c) {
    const P = ME(); const base = c.data.students.find((s) => s.id === P.id) || c.data.students[0]; const sp = c.state.progress || {};
    const L0 = P.lecturesWatched;
    const lect = Math.max(L0 + A.lecturesDone, sp.lecturesWatched || L0), extra = lect - L0;
    const attended = Math.round(P.attendance / 100 * L0) + extra;
    const prs = Object.values(A.practicals), prDone = P.practicals_done + prs.length, prPassed = P.practicals_passed + prs.filter((x) => x >= 60).length;
    const quiz = A.exam && A.exam.score != null ? Math.round((P.quiz_avg * 14 + A.exam.score) / 15) : P.quiz_avg;
    const lab = Math.round((base.lab_hours_week + 0.3 * A.practicalSubs + (A.milestone ? 1.2 : 0)) * 10) / 10;
    const row = Object.assign({}, base, {
      name: P.name, field: c.field.id, attendance: Math.round(attended / Math.max(1, lect) * 100), practicals_passed: Math.round(prPassed / Math.max(1, prDone) * 100),
      prPassed, prDone, lectures: lect, quiz_avg: quiz, lab_hours_week: lab, days_inactive: A.lastTs ? 0 : base.days_inactive, xp: c.state.xp, demo: true, month: P.month, active: true,
    });
    row.status = row.days_inactive >= 7 || row.quiz_avg < 50 ? 'at_risk' : row.attendance < 70 || row.quiz_avg < 60 || row.practicals_passed < 55 ? 'watch' : 'on_track';
    return row;
  }
  function demoRow(s) { // another demo student, at their own point in the year
    const P = profileOf(s.id);
    return Object.assign({}, s, P ? { prPassed: P.practicals_passed, prDone: P.practicals_done, lectures: P.lecturesWatched, month: P.month } : {});
  }

  function allStudents(c) {
    return c.data.students.map((s) => {
      const row = s.id === SID() ? activeRow(c) : s.demo ? demoRow(s) : Object.assign({}, s);
      row.ms = milestoneFor(s.milestone, s.id, c);
      row.cap = CAP + (STORE.bonus[s.id] || 0);
      return row;
    });
  }

  function reasons(s) {
    const r = [];
    if (s.days_inactive >= 5) r.push(`Inactive ${s.days_inactive} days`);
    if (s.quiz_avg < 55) r.push(`Quiz average ${s.quiz_avg}%`);
    if (s.attendance < 70) r.push(`Attendance ${s.attendance}%`);
    if (s.practicals_passed < 60) r.push(`Practicals passed ${s.practicals_passed}%`);
    if (s.ms.status === 'in_progress' && !s.ms.current) r.push(`Capstone ${s.ms.slot} Month ${s.ms.month} not submitted`);
    return r;
  }

  function queueItems() {
    const items = [];
    if (A.milestone) items.push({ key: SID(), sid: SID(), slot: A.milestone.slot, month: A.milestone.month, when: rel(A.milestone.ts), live: true });
    else items.push({ key: SID(), sid: SID(), slot: ME().capstone, month: ME().capstone_month, placeholder: true });
    sampleQueue().forEach((q) => items.push(Object.assign({ key: q.sid }, q)));
    return items;
  }

  function examRows(c, studs) {
    const fixed = { S1013: [6, 2, 3], S1005: [4, 1, 0], S1020: [2, 0, 2], S1017: [3, 1, 0], S1007: [2, 0, 0] };
    // Other demo students are at a different point of the year, so they are not in this exam.
    return studs.filter((s) => s.id === SID() || !s.demo).map((s) => {
      if (s.id === SID()) {
        if (!A.exam) return { s, pending: true };
        return { s, score: A.exam.score, tab: A.exam.flags.tab, fs: A.exam.flags.fs, paste: A.exam.flags.paste, minutes: null, live: true };
      }
      const r = rng(s.id + 'exam' + ME().next_exam.month);
      const score = clamp(Math.round(s.quiz_avg + (r() - 0.5) * 16), 35, 99);
      const [tab, fs, paste] = fixed[s.id] || [r() < 0.75 ? 0 : 1, 0, 0];
      return { s, score, tab, fs, paste, minutes: 38 + Math.floor(r() * 22) };
    });
  }
  const flagWeight = (x) => x.tab + 2 * x.fs + 2 * x.paste;

  const weekOf = (s) => { const P = profileOf(s.id); return P ? P.week : batchNow().week; };
  function weeklyScores(s) {
    const r = rng(s.id + 'weeks'); const vals = [];
    for (let i = 0; i < 12; i++) {
      let v = s.quiz_avg + (r() - 0.5) * 20 + (i - 6) * 0.6;
      if (s.status === 'at_risk' && i > 8) v -= (i - 8) * 9;
      vals.push(Math.round(clamp(v, 25, 100)));
    }
    if (s.id === SID() && A.exam && A.exam.score != null) vals[11] = A.exam.score;
    return vals;
  }

  function activityFor(s, c) {
    const out = [];
    if (s.id === SID()) A.activity.forEach((a) => out.push({ when: rel(a.t), text: a.text, live: true }));
    const P = profileOf(s.id), B = batchNow();
    const curLec = P ? P.lecture : B.lecture, month = P ? P.month : B.month;
    const r = rng(s.id + 'act'), d0 = s.days_inactive;
    const lastLec = c.data.lectures.find((l) => l.id === Math.max(2, curLec - 1 - Math.floor(d0 / 3.5))) || c.data.lectures[1];
    const prevLec = c.data.lectures.find((l) => l.id === lastLec.id - 1);
    out.push(
      { when: dayLabel(d0), text: `Watched Lecture ${lastLec.id}: ${lastLec.topic}` },
      { when: dayLabel(d0), text: `Practical "${lastLec.practical}": ${r() < s.practicals_passed / 100 ? 'all checks passed' : '1 check failed, retried later'}` },
      { when: dayLabel(d0 + 1), text: `Asked the AI tutor ${1 + Math.floor(r() * 4)} questions` },
      { when: dayLabel(d0 + 2), text: month <= 3 ? `Practised in the in-browser Python lab for ${(0.8 + r() * 2).toFixed(1)} h` : `Used the cloud workspace for ${(0.8 + r() * 2).toFixed(1)} h` },
      { when: dayLabel(d0 + 3), text: `Watched Lecture ${prevLec.id}: ${prevLec.topic}` });
    return out.slice(0, 7);
  }
  /* ---------- styles ---------- */
  function injectStyles() {
    if (document.getElementById('m-mentor')) return;
    const css = `
.m-mentor { display: grid; gap: 24px; min-width: 0 }
.m-mentor .purpose { display: flex; justify-content: space-between; align-items: center; gap: 12px 16px; flex-wrap: wrap }
.m-mentor .purpose p { color: var(--muted); font-size: 15px; margin: 0; min-width: 0; flex: 1 1 360px; line-height: 1.5 }
.m-mentor .purpose .demo { font-size: 12.5px; color: var(--faint); white-space: nowrap }
.m-mentor .linkbtn { background: none; border: 0; padding: 0; color: var(--brand); font-weight: 700; cursor: pointer; font-size: 13.5px; display: inline-flex; gap: 6px; align-items: center; font-family: inherit }
.m-mentor .linkbtn svg { width: 15px; height: 15px }
.m-mentor .linkbtn:hover { text-decoration: underline }
.m-mentor .sum { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px }
.m-mentor .sum .tile { padding: 18px 20px; text-align: left; cursor: pointer; font: inherit; color: var(--fg); width: 100% }
.m-mentor .sum .tile:hover { border-color: var(--brand) }
.m-mentor .sum .stat b { font-size: 26px }
.m-mentor .sum .tile.alert b { color: var(--red) }
.m-mentor .top2 { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 20px; align-items: start }
.m-mentor .top2 > .card { padding: 20px 22px; display: grid; gap: 10px; align-content: start }
.m-mentor .top2 .card-head { margin-bottom: 0 }
.m-mentor .attn-item { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--line) }
.m-mentor .card-head + .attn-item { border-top: 0; padding-top: 4px }
.m-mentor .attn-item > div { min-width: 0 }
.m-mentor .attn-item .sub { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px }
.m-mentor .attn-item .sub.risk { color: var(--red) }
.m-mentor .attn-item .acts { align-items: center; gap: 12px; flex-wrap: nowrap }
.m-mentor .kind { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand) }
.m-mentor .kind.risk { background: var(--red-soft); color: var(--red) }
.m-mentor .kind svg { width: 16px; height: 16px }
.m-mentor .feed { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px }
.m-mentor .feed li { display: flex; gap: 8px; font-size: 13.5px; min-width: 0 }
.m-mentor .feed li span:last-child { min-width: 0 }
.m-mentor .feed .t { color: var(--muted); flex: none; min-width: 72px }
.m-mentor .livepill .dot { animation: m-mentor-pulse 1.6s ease-in-out infinite }
.m-mentor .facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 13.5px }
.m-mentor .facts li { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 10px; min-width: 0 }
.m-mentor .facts li span:first-child { color: var(--muted); font-size: 12.5px; padding-top: 1px }
.m-mentor .facts li span:last-child { min-width: 0; overflow-wrap: anywhere }
.m-mentor .dfacts { display: grid; gap: 8px; background: var(--surface-2); border-radius: var(--radius-sm); padding: 12px 14px }
.m-mentor .others { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; border-top: 1px solid var(--line); padding-top: 12px; margin-top: 2px }
.m-mentor .tabcard { padding-top: 8px }
.m-mentor .tab .ct { font-size: 12px; font-weight: 700; color: var(--faint); margin-left: 6px }
.m-mentor .tab[aria-selected="true"] .ct { color: var(--brand) }
.m-mentor .pager { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap }
.m-mentor .pager:empty { display: none }
.m-mentor .actlist { list-style: none; margin: 0; padding: 0; display: grid }
.m-mentor .actlist li { display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); font-size: 13.5px }
.m-mentor .actlist li:first-child { border-top: 0 }
.m-mentor .actlist .t { color: var(--muted); font-size: 12.5px }
.m-mentor .actlist .tx { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-mentor.drawer { gap: 18px }
.m-mentor .dsec { display: grid; gap: 10px; padding-top: 16px; border-top: 1px solid var(--line) }
.m-mentor .dsec h4 { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted) }
.m-mentor .dsec .dfacts { background: none; padding: 0 }
@keyframes m-mentor-pulse { 50% { opacity: .35 } }
.m-mentor .panel { display: grid; gap: 14px; min-width: 0; padding-top: 4px }
.m-mentor .filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center }
.m-mentor .filters .field-input { width: auto; flex: 1 1 200px; min-width: 0 }
.m-mentor .filters select.field-input { flex: 0 1 200px }
.m-mentor .seg { display: inline-flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; background: var(--surface); flex-wrap: wrap }
.m-mentor .seg button { border: 0; background: none; padding: 8px 12px; font-weight: 700; font-size: 13px; color: var(--muted); cursor: pointer; border-right: 1px solid var(--line) }
.m-mentor .seg button:last-child { border-right: 0 }
.m-mentor .seg button[aria-pressed="true"] { background: var(--brand-soft); color: var(--brand) }
.m-mentor th .sort { background: none; border: 0; padding: 0; font: inherit; color: inherit; letter-spacing: inherit; text-transform: inherit; cursor: pointer; display: inline-flex; gap: 4px; align-items: center }
.m-mentor th .sort:hover { color: var(--fg) }
.m-mentor th .sort i { font-style: normal; color: var(--brand); width: 8px }
.m-mentor td .nm b { display: block; white-space: nowrap }
.m-mentor td .nm .tiny { white-space: nowrap }
.m-mentor td .stk { display: flex; flex-direction: column; align-items: flex-start; gap: 4px }
.m-mentor .table-wrap td, .m-mentor .table-wrap th { padding-left: 10px; padding-right: 10px }
.m-mentor td .nm { display: flex; gap: 8px; align-items: center; min-width: 0 }
.m-mentor td.n { font-variant-numeric: tabular-nums; white-space: nowrap }
.m-mentor td .lo { color: var(--red); font-weight: 700 }
.m-mentor td .mid { color: var(--amber); font-weight: 700 }
.m-mentor tr.is-live td { background: color-mix(in srgb, var(--green-soft) 55%, transparent) }
.m-mentor .bar { height: 6px; width: 44px; background: var(--surface-2); border-radius: 99px; overflow: hidden; display: inline-block; vertical-align: middle; margin-left: 8px }
.m-mentor .bar > i { display: block; height: 100%; background: var(--brand); border-radius: inherit }
.m-mentor .ms { white-space: nowrap; font-size: 13px }
.m-mentor .ms small { display: block; color: var(--muted); font-size: 12px }
.m-mentor .qitem { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 14px 0; border-top: 1px solid var(--line) }
.m-mentor .qitem:first-child { border-top: 0 }
.m-mentor .qitem > div { min-width: 0 }
.m-mentor .qitem .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 4px }
.m-mentor .acts { display: flex; gap: 6px; flex-wrap: wrap }
.m-mentor td .acts { flex-wrap: nowrap; align-items: center }
.m-mentor .lab-list { display: grid; gap: 10px }
.m-mentor .lab-row { display: grid; grid-template-columns: minmax(0, 170px) minmax(0, 1fr) 92px; gap: 12px; align-items: center; font-size: 13px }
.m-mentor .lab-row.clickable { cursor: pointer; border-radius: var(--radius-sm); padding: 4px 6px; margin: -4px -6px }
.m-mentor .lab-row.clickable:hover { background: var(--surface-2) }
.m-mentor .lab-row.clickable:hover > span:first-child { color: var(--brand) }
.m-mentor .lnk { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: var(--fg); cursor: pointer; text-align: left }
.m-mentor .lnk:hover { color: var(--brand); text-decoration: underline }
.m-mentor .lab-row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-mentor .lab-track { position: relative; height: 12px; background: var(--surface-2); border-radius: 99px }
.m-mentor .lab-track > i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--brand); border-radius: 99px; transition: width .5s ease }
.m-mentor .lab-track > i.warn { background: var(--amber) }
.m-mentor .lab-track > b { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--muted); border-radius: 2px }
.m-mentor .lab-track > b.bonus { background: var(--green) }
.m-mentor .lab-scale { display: grid; grid-template-columns: minmax(0, 170px) minmax(0, 1fr) 92px; gap: 12px; font-size: 11.5px; color: var(--muted) }
.m-mentor .lab-scale div { position: relative; height: 14px }
.m-mentor .lab-scale div span { position: absolute; transform: translateX(-50%) }
.m-mentor .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted) }
.m-mentor .legend i { display: inline-block; width: 12px; height: 8px; border-radius: 4px; margin-right: 6px; vertical-align: middle; background: var(--brand) }
.m-mentor .legend i.warn { background: var(--amber) } .m-mentor .legend i.cap { width: 2px; height: 12px; background: var(--muted) }
/* modal contents */
.m-mentor.sheet { gap: 14px }
.m-mentor .sheet-head { display: flex; justify-content: space-between; gap: 12px; align-items: start }
.m-mentor .sheet-head > div { min-width: 0 }
.m-mentor .x { background: none; border: 1px solid var(--line); border-radius: 8px; width: 32px; height: 32px; cursor: pointer; color: var(--muted); flex: none; font-size: 18px; line-height: 1 }
.m-mentor .x:hover { color: var(--fg); border-color: var(--brand) }
.m-mentor .kv { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px }
.m-mentor .kv > div { background: var(--surface-2); border-radius: var(--radius-sm); padding: 10px 12px; min-width: 0 }
.m-mentor .kv b { display: block; font-family: var(--display); font-size: 18px; font-variant-numeric: tabular-nums }
.m-mentor .kv span { font-size: 12px; color: var(--muted) }
.m-mentor .spark svg { width: 100%; height: auto; display: block }
.m-mentor .spark .ax { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted) }
.m-mentor .check .ic svg { width: 12px; height: 12px }
.m-mentor .crit { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 200px); gap: 6px 14px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line) }
.m-mentor .crit:first-child { border-top: 0 }
.m-mentor .crit > div { min-width: 0 }
.m-mentor .crit .ctl { display: flex; align-items: center; gap: 10px }
.m-mentor .crit input[type=range] { flex: 1; min-width: 0; accent-color: var(--brand) }
.m-mentor .crit output { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 52px; text-align: right; font-size: 13px }
.m-mentor .total { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: var(--surface-2); border-radius: var(--radius-sm); padding: 12px 14px; flex-wrap: wrap }
.m-mentor .total b { font-family: var(--display); font-size: 24px; font-variant-numeric: tabular-nums }
.m-mentor textarea.field-input { min-height: 132px; resize: vertical; line-height: 1.5 }
.m-mentor .sheet-foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap }
.m-mentor ul.plain { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 13px }
@media (max-width: 1100px) { .m-mentor .top2 { grid-template-columns: minmax(0, 1fr) } }
@media (max-width: 640px) {
  .m-mentor .sum { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .m-mentor .kv { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .m-mentor .actlist li { grid-template-columns: minmax(0, 1fr) auto }
  .m-mentor .actlist .t { grid-column: 1 / -1 }
  .m-mentor .actlist .tx { white-space: normal }
  .m-mentor .attn-item .sub { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical }
  .m-mentor .sum .tile { padding: 14px 16px }
  .m-mentor .facts li { grid-template-columns: minmax(0, 1fr); gap: 0 }
  .m-mentor .lab-row { grid-template-columns: minmax(0, 1fr) 84px }
  .m-mentor .lab-row .lab-track { grid-column: 1 / -1; grid-row: 2 }
  .m-mentor .lab-scale { display: none }
  .m-mentor .crit { grid-template-columns: minmax(0, 1fr) }
  .m-mentor .qitem { grid-template-columns: minmax(0, 1fr) }
  .m-mentor .attn-item { grid-template-columns: 30px minmax(0, 1fr); }
  .m-mentor .attn-item .acts { grid-column: 2 }
}
@media (prefers-reduced-motion: reduce) { .m-mentor .livepill .dot { animation: none } .m-mentor .lab-track > i { transition: none } }
`;
    document.head.append(Object.assign(document.createElement('style'), { id: 'm-mentor', textContent: css }));
  }

  /* ---------- module ---------- */
  NM.register('mentor', {
    label: 'Mentor console', title: 'Mentor console · Batch NM-2027-A', icon: 'mentor', group: 'Mentor', order: 60,

    render(root, c) {
      injectStyles();
      if (this._tick) { clearInterval(this._tick); this._tick = null; }
      hydrateFromProgress(c);
      const { h, esc, icon } = c;
      const ui = STORE.ui;
      const wrap = h('div', { class: 'm-mentor' });
      root.append(wrap);

      const statusPill = (st) => { const [t, k] = STATUS[st] || STATUS.watch; return h('span', { class: 'pill ' + k }, h('span', { class: 'dot' }), t); };
      const livePill = (ts) => h('span', { class: 'pill green livepill', 'data-ts': ts }, h('span', { class: 'dot' }), rel(ts));
      const fieldShort = (id) => fieldById(id).short;
      const msText = (ms) => `${ms.slot} · Month ${ms.month}`;
      const msStatus = (ms) => (ms.resub && ms.status === 'submitted' ? 'Resubmitted, waiting' : MS_LABEL[ms.status] || ms.status) + (ms.score != null ? ` · ${ms.score}/100` : '');
      const tone = (v, lo, mid) => (v < lo ? 'lo' : v < mid ? 'mid' : '');

      function draw() {
        wrap.textContent = '';
        const studs = allStudents(c);
        const queue = queueItems(c);
        const pendingQ = queue.filter((q) => !q.placeholder && !STORE.reviews[q.key]);
        const pending = pendingQ.length;
        const atRisk = studs.filter((s) => s.status === 'at_risk');
        const P = ME(), B = batchNow(), me = studs.find((s) => s.id === P.id) || studs[0];
        const his = pr(P.id, 1);

        /* purpose line */
        wrap.append(h('div', { class: 'purpose' },
          h('p', {}, `See who needs help, review capstones and follow one student live. Batch ${P.batch}, as at Month ${B.month}, Week ${B.week}. `, h('span', { class: 'demo' }, 'Demo data · fictional students')),
          h('button', { class: 'linkbtn', onclick: () => c.go('admin'), html: icon('settings') + '<span>Admin console</span>' })));

        /* summary: 4 tiles */
        const stat = (val, label, cls, go) => h('button', { class: 'card tile ' + (cls || ''), type: 'button', onclick: go }, h('div', { class: 'stat' }, h('b', { class: 'num' }, val), h('span', {}, label)));
        wrap.append(h('div', { class: 'sum' },
          stat(String(studs.length), 'students in the batch', '', () => { ui.tab = 'students'; ui.status = 'all'; draw(); scrollTabs(); }),
          stat(`${Math.round(avg(studs.map((s) => s.attendance)))}%`, 'average attendance', '', () => { ui.tab = 'students'; ui.sort = 'attendance'; ui.dir = 1; draw(); scrollTabs(); }),
          stat(String(atRisk.length), 'students at risk', atRisk.length ? 'alert' : '', () => { ui.tab = 'students'; ui.status = 'at_risk'; ui.page = 0; draw(); scrollTabs(); }),
          stat(String(pending), 'capstone reviews waiting', '', () => { ui.tab = 'queue'; draw(); scrollTabs(); })));

        /* needs your attention: review queue first, then at-risk students (max 5) */
        const items = pendingQ.map((q) => ({ kind: 'review', q, s: studs.find((x) => x.id === q.sid) }))
          .concat(atRisk.map((s) => ({ kind: 'risk', s })));
        const attn = h('section', { class: 'card attn' },
          h('div', { class: 'card-head' }, h('h3', {}, 'Needs your attention'),
            items.length ? h('button', { class: 'linkbtn', onclick: () => { ui.tab = pending ? 'queue' : 'students'; if (!pending) { ui.status = 'at_risk'; ui.page = 0; } draw(); scrollTabs(); } }, `Show all (${items.length})`) : null));
        if (!items.length) attn.append(h('p', { class: 'small muted' }, 'Nothing waiting. No reviews are due and no student is at risk this week.'));
        items.slice(0, window.innerWidth <= 640 ? 3 : 5).forEach((it) => {
          const s = it.s;
          if (it.kind === 'review') {
            const cap = capFor(s.field, it.q.slot);
            attn.append(h('div', { class: 'attn-item' },
              h('span', { class: 'kind review', 'aria-hidden': 'true', html: icon('project') }),
              h('div', {}, h('button', { class: 'lnk', onclick: () => openStudent(s.id) }, s.name),
                h('div', { class: 'sub' }, `Capstone ${it.q.slot} Month ${it.q.month}${it.q.resub ? ' (resubmitted)' : ''} · ${it.q.live ? rel(A.milestone.ts).toLowerCase() : it.q.when.toLowerCase()} · ${cap.title}`)),
              h('div', { class: 'acts' }, h('button', { class: 'btn sm', onclick: () => openReview(it.q, s, cap) }, 'Review'))));
          } else {
            attn.append(h('div', { class: 'attn-item' },
              h('span', { class: 'kind risk', 'aria-hidden': 'true', html: icon('bell') }),
              h('div', {}, h('button', { class: 'lnk', onclick: () => openStudent(s.id) }, s.name),
                h('div', { class: 'sub risk' }, `At risk · ${reasons(s).join(' · ') || 'Several warning signs'}`)),
              h('div', { class: 'acts' },
                h('button', { class: 'linkbtn', onclick: () => c.toast(`Check-in message sent to ${first(s.name)}.`, 'green') }, 'Check in'),
                h('button', { class: 'btn sm', onclick: () => openStudent(s.id) }, 'Open'))));
          }
        });

        /* watch a student live */
        const lec = lectureOf(P.lecture);
        const myCap = capFor(me.field, me.ms.slot);
        const others = (c.students || []).filter((x) => x.id !== P.id);
        const liveBox = h('section', { class: 'card livebox' });
        const actions = h('div', { class: 'row', style: { gap: '8px' } },
          h('button', { class: 'btn sm primary', onclick: () => c.go('practical') }, `Go to ${his} practical`),
          h('button', { class: 'btn sm', onclick: () => openStudent(P.id) }, `Open ${his} record`));
        const otherList = others.length ? h('div', { class: 'others' },
          h('span', { class: 'tiny muted' }, 'Follow another demo student:'),
          others.map((o) => h('button', { class: 'linkbtn', type: 'button', title: `Month ${o.month} · ${fieldShort(o.field)}. The page reloads and the demo follows ${first(o.name)}.`, onclick: () => c.setStudent(o.id, 'mentor') }, `${first(o.name)} (M${o.month})`))) : null;
        if (A.activity.length) {
          liveBox.append(h('div', { class: 'card-head' }, h('h3', {}, `Live: ${P.name}`), livePill(A.lastTs)),
            h('ul', { class: 'feed' }, A.activity.slice(0, 3).map((a) => h('li', {}, h('span', { class: 't', 'data-ts': a.t }, rel(a.t)), h('span', {}, a.text)))),
            actions, otherList || '');
        } else {
          liveBox.append(
            h('div', { class: 'card-head' }, h('h3', {}, 'Watch a student live'), h('span', { class: 'pill blue' }, `Month ${P.month} · Week ${P.week}`)),
            h('p', { class: 'small' }, h('b', {}, P.name), ` · ${P.age} · ${fieldShort(me.field)}${P.month <= 3 ? ' (from Month 4)' : ''}`),
            h('ul', { class: 'facts' },
              h('li', {}, h('span', {}, 'Lecture'), h('span', {}, `L${lec.id}: ${lec.topic}`)),
              h('li', {}, h('span', {}, 'Practical'), h('span', {}, `"${lec.practical}" for ${P.practical_company === 'common' ? c.data.common.company : c.field.company}`)),
              h('li', {}, h('span', {}, 'Capstone'), h('span', {}, `${me.ms.slot} Month ${me.ms.month}: ${myCap.title} · ${msStatus(me.ms)}`))),
            h('p', { class: 'tiny muted' }, `Do something as ${first(P.name)} in the Student view, then come back: ${his} row updates here straight away.`),
            actions, otherList || '');
        }
        wrap.append(h('div', { class: 'top2' }, attn, liveBox));

        /* tabs: everything else, one click away */
        const flaggedCount = examRows(c, studs).filter((x) => !x.pending && flagWeight(x) >= 3).length;
        const tabs = [['students', 'All students', studs.length], ['queue', 'Review queue', pending], ['exam', 'Exam flags', flaggedCount], ['lab', 'Lab usage', null], ['activity', 'Activity', A.activity.length || null]];
        const panel = h('div', { class: 'panel', role: 'tabpanel' });
        const tabBar = h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, label, n]) =>
          h('button', { class: 'tab', role: 'tab', 'aria-selected': String(ui.tab === id), onclick: () => { ui.tab = id; draw(); } }, label, n != null ? h('span', { class: 'ct num' }, String(n)) : null)));
        wrap.append(h('section', { class: 'card tabcard' }, tabBar, panel));
        ({ students: drawStudents, queue: drawQueue, exam: drawExam, lab: drawLab, activity: drawActivity })[ui.tab](panel, studs, queue);
      }
      function scrollTabs() { const el = wrap.querySelector('.tabcard'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }

      /* ----- Activity tab: what the batch did lately ----- */
      function drawActivity(panel, studs) {
        const rows = [];
        A.activity.forEach((a) => rows.push({ s: studs.find((x) => x.id === SID()), when: rel(a.t), text: a.text, live: true, d: -1 }));
        studs.filter((s) => !(s.id === SID() && A.activity.length)).forEach((s) => { const a = activityFor(s, c).find((x) => !x.live); if (a) rows.push({ s, when: a.when, text: a.text, d: s.days_inactive }); });
        rows.sort((a, b) => a.d - b.d);
        const show = STORE.ui.actAll ? rows : rows.slice(0, 8);
        panel.append(h('p', { class: 'small muted' }, `The latest thing each student did. ${first(ME().name)}'s actions in the Student view appear here live.`),
          h('ul', { class: 'actlist' }, show.map((r) => h('li', {},
            h('span', { class: 't' }, r.when),
            h('span', { class: 'tx' }, h('button', { class: 'lnk', onclick: () => openStudent(r.s.id) }, r.s.name), ` · ${r.text}`),
            r.live ? h('span', { class: 'pill green' }, 'Live') : null))),
          rows.length > show.length ? h('button', { class: 'linkbtn', onclick: () => { STORE.ui.actAll = true; draw(); } }, `Show all (${rows.length})`) : '');
      }

      /* ----- Students tab ----- */
      function drawStudents(panel, studs) {
        const count = h('span', { class: 'small muted' });
        const tbody = h('tbody');
        const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Filter by status' });
        [['all', 'All'], ['on_track', 'On track'], ['watch', 'Watch'], ['at_risk', 'At risk']].forEach(([id, t]) =>
          seg.append(h('button', { 'aria-pressed': String(ui.status === id), onclick: (e) => { ui.status = id; ui.page = 0; seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); fill(); } }, t)));
        const fsel = h('select', { class: 'field-input', 'aria-label': 'Filter by career field', onchange: (e) => { ui.field = e.target.value; ui.page = 0; fill(); } },
          h('option', { value: 'all' }, 'All fields'), c.data.fields.map((f) => h('option', { value: f.id }, f.short)));
        fsel.value = ui.field;
        const search = h('input', { class: 'field-input', type: 'search', placeholder: 'Search by name', 'aria-label': 'Search students by name', value: ui.q, oninput: (e) => { ui.q = e.target.value; ui.page = 0; fill(); } });

        const cols = [['name', 'Student'], ['status', 'Status'], ['attendance', 'Attendance'], ['practicals_passed', 'Practicals'], ['quiz_avg', 'Quiz avg'], ['lab_hours_week', 'Lab / week'], ['days_inactive', 'Inactive'], ['milestone', 'Milestone']];
        const thead = h('thead', {}, h('tr', {}, cols.map(([k, t]) => h('th', { 'aria-sort': ui.sort === k ? (ui.dir > 0 ? 'ascending' : 'descending') : null },
          h('button', { class: 'sort', onclick: () => { if (ui.sort === k) ui.dir *= -1; else { ui.sort = k; ui.dir = ['name', 'field', 'status', 'milestone'].includes(k) ? 1 : -1; } fill(); markSort(); } }, t, h('i', { 'aria-hidden': 'true' }))))));
        function markSort() {
          thead.querySelectorAll('th').forEach((th, i) => { const on = cols[i][0] === ui.sort; th.setAttribute('aria-sort', on ? (ui.dir > 0 ? 'ascending' : 'descending') : 'none'); th.querySelector('i').textContent = on ? (ui.dir > 0 ? '↑' : '↓') : ''; });
        }
        const msRank = { in_progress: 0, changes_requested: 1, submitted: 2, approved: 3 };
        function sortVal(s, k) {
          if (k === 'status') return STATUS[s.status][2] * 1000 - s.days_inactive;
          if (k === 'field') return fieldShort(s.field);
          if (k === 'milestone') return msRank[s.ms.status] ?? 9;
          return s[k];
        }
        const pager = h('div', { class: 'pager' });
        const PER = 10;
        function fill() {
          const q = ui.q.trim().toLowerCase();
          const rows = studs.filter((s) => (ui.status === 'all' || s.status === ui.status) && (ui.field === 'all' || s.field === ui.field) && (!q || s.name.toLowerCase().includes(q)));
          rows.sort((a, b) => { const x = sortVal(a, ui.sort), y = sortVal(b, ui.sort); const r = typeof x === 'string' ? x.localeCompare(y) : x - y; return (r || a.name.localeCompare(b.name)) * ui.dir; });
          const pages = Math.max(1, Math.ceil(rows.length / PER));
          ui.page = clamp(ui.page || 0, 0, pages - 1);
          const slice = rows.slice(ui.page * PER, ui.page * PER + PER);
          tbody.textContent = '';
          count.textContent = `${rows.length} of ${studs.length} students`;
          if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: String(cols.length) }, h('div', { class: 'empty' }, 'No students match these filters.'))));
          slice.forEach((s) => {
            const isLive = s.id === SID() && A.lastTs && Date.now() - A.lastTs < 30 * 60 * 1000;
            const tr = h('tr', { class: 'clickable' + (isLive || s.active ? ' is-live' : ''), tabindex: '0', 'aria-label': `Open ${s.name}`, onclick: () => openStudent(s.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStudent(s.id); } } },
              h('td', {}, h('div', { class: 'nm' }, h('div', {}, h('b', {}, s.name), h('span', { class: 'tiny muted' }, `${fieldShort(s.field)}${s.active ? ' · following' + (isLive ? ', live now' : '') : s.demo ? ` · demo, Month ${s.month}` : ''}`)))),
              h('td', {}, statusPill(s.status)),
              h('td', { class: 'n' }, h('span', { class: tone(s.attendance, 70, 75) }, `${s.attendance}%`)),
              h('td', { class: 'n' }, h('span', { class: tone(s.practicals_passed, 55, 60) }, `${s.practicals_passed}%`)),
              h('td', { class: 'n' }, h('span', { class: tone(s.quiz_avg, 55, 60) }, `${s.quiz_avg}%`)),
              h('td', { class: 'n' }, `${s.lab_hours_week.toFixed(1)} h`, STORE.bonus[s.id] ? h('span', { class: 'tiny muted' }, ` (cap ${s.cap} h)`) : null),
              h('td', { class: 'n' }, h('span', { class: s.days_inactive >= 5 ? 'lo' : '' }, s.days_inactive === 1 ? '1 day' : `${s.days_inactive} days`)),
              h('td', {}, h('div', { class: 'ms' }, msText(s.ms), h('small', {}, msStatus(s.ms)))));
            tbody.append(tr);
          });
          pager.textContent = '';
          if (pages > 1) pager.append(
            h('span', { class: 'small muted' }, `Showing ${ui.page * PER + 1} to ${ui.page * PER + slice.length} of ${rows.length}`),
            h('div', { class: 'row', style: { gap: '6px' } },
              h('button', { class: 'btn sm', disabled: ui.page === 0 || null, onclick: () => { ui.page -= 1; fill(); } }, 'Previous'),
              h('span', { class: 'small num' }, `Page ${ui.page + 1} of ${pages}`),
              h('button', { class: 'btn sm', disabled: ui.page >= pages - 1 || null, onclick: () => { ui.page += 1; fill(); } }, 'Next')));
        }
        panel.append(h('div', { class: 'filters' }, search, seg, fsel, count),
          h('div', { class: 'table-wrap' }, h('table', {}, thead, tbody)), pager,
          h('p', { class: 'tiny muted' }, `Batch averages: practicals passed ${Math.round(avg(studs.map((s) => s.practicals_passed)))}%, quiz ${Math.round(avg(studs.map((s) => s.quiz_avg)))}%. Click a student for weekly scores, activity and actions. Amber and red numbers are below the warning lines. The batch is shown as at ${first(ME().name)}'s Month ${batchNow().month}.`));
        fill(); markSort();
      }

      /* ----- Student detail ----- */
      // Where a demo student really is: month, lecture, capstone, exams, certificates, consent.
      function demoFacts(s, p) {
        const lec = lectureOf(p.lecture);
        const cap = capFor(s.field, s.ms.slot);
        const live = s.id === SID();
        const exams = [];
        if (live && A.exam && A.exam.score != null) exams.push(`${p.next_exam.title}: ${A.exam.score}%, just submitted`);
        else {
          if (p.last_exam && p.last_exam.score != null) exams.push(`Last: ${p.last_exam.title}, ${p.last_exam.score}%`);
          exams.push(`Next: ${p.next_exam.title}, due ${p.next_exam.due}`);
        }
        const certN = live ? Math.max(p.certificates.length, (c.state.progress && c.state.progress.certificates) || 0) : p.certificates.length;
        const consent = p.consent
          ? `On file: ${p.consent.relation.toLowerCase()} ${p.consent.parent}, recorded ${p.consent.recorded} · ref ${p.consent.ref}`
          : p.age < 18 ? 'Needed before lab access' : `Not needed: ${p.age}, adult student`;
        const li = (k, v) => h('li', {}, h('span', {}, k), h('span', {}, v));
        return h('div', { class: 'dfacts' },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'small' }, 'Where this student is'), h('span', { class: 'tiny muted' }, p.tagline)),
          h('ul', { class: 'facts' },
            li('In the year', `Month ${p.month}, Week ${p.week} · ${c.data.months[p.month]}`),
            li('Lecture', `L${lec.id}: ${lec.topic} · practical "${lec.practical}"`),
            li('Capstone', `${s.ms.slot} Month ${s.ms.month}: ${cap.title} (${capCompany(s.field, s.ms.slot)})`),
            li('Exams', exams.join(' · ')),
            li('Certificates', certN ? p.certificates.map((x) => `${x.slot === 'F' ? 'Foundation' : x.title} (${x.date})`).join(', ') + (certN > p.certificates.length ? ' + 1 new' : '') : 'None yet. The first one comes at the end of Month 3.'),
            li('Parent consent', consent),
            li('Background', `${p.age} · ${p.education}`)));
      }

      function openStudent(id) {
        const s = allStudents(c).find((x) => x.id === id); if (!s) return;
        const vals = weeklyScores(s);
        const wk = weekOf(s), wk0 = Math.max(1, wk - 11);
        const prof = profileOf(s.id);
        const W = 320, H = 70, P = 6, lo = Math.min(30, ...vals), hi = 100;
        const X = (i) => P + i * (W - 2 * P) / (vals.length - 1), Y = (v) => H - P - (v - lo) / (hi - lo) * (H - 2 * P);
        const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
        const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly scores, weeks ${wk0} to ${wk}: ${vals.join(', ')}">
          <line x1="${P}" x2="${W - P}" y1="${Y(60).toFixed(1)}" y2="${Y(60).toFixed(1)}" style="stroke:var(--line);stroke-width:1;stroke-dasharray:4 4"/>
          <polygon points="${P},${H - P} ${pts} ${W - P},${H - P}" style="fill:var(--brand-soft)"/>
          <polyline points="${pts}" style="fill:none;stroke:var(--brand);stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>
          ${vals.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === vals.length - 1 ? 3.5 : 2}" style="fill:${i === vals.length - 1 ? 'var(--brand)' : 'var(--surface)'};stroke:var(--brand);stroke-width:1.5"/>`).join('')}
        </svg>`;
        const granted = !!STORE.bonus[s.id];
        const grantBtn = h('button', { class: 'btn', disabled: granted || null, onclick: () => {
          STORE.bonus[s.id] = 2; grantBtn.disabled = true; grantBtn.textContent = '2 extra hours granted';
          c.toast(`${first(s.name)} can now use the lab for up to ${CAP + 2} hours this week.`, 'green'); m.close(); draw();
        } }, granted ? '2 extra hours granted' : 'Grant 2 extra lab hours');
        const vivaBtn = h('button', { class: 'btn', onclick: () => { STORE.vivas[s.id] = true; vivaBtn.textContent = 'Viva requested'; c.toast(`Viva request sent to ${first(s.name)} for Thursday, 4:00 pm.`, 'green'); } }, STORE.vivas[s.id] ? 'Viva requested' : 'Schedule a viva');
        const acts = activityFor(s, c);
        const rs = reasons(s);
        const sec = (title, ...kids) => h('section', { class: 'dsec' }, h('h4', {}, title), ...kids);
        const content = h('div', { class: 'm-mentor sheet drawer' },
          h('div', { class: 'sheet-head' },
            h('div', {}, h('div', { class: 'eyebrow' }, `${s.id} · ${fieldById(s.field).name}`), h('h3', {}, s.name),
              h('div', { class: 'row', style: { marginTop: '6px', gap: '8px' } }, statusPill(s.status),
                h('span', { class: 'tiny muted' }, s.id === SID() ? (A.lastTs ? `Following · active ${rel(A.lastTs).toLowerCase()}` : 'The demo follows this student') : s.demo ? 'Demo student' : `Batch ${ME().batch}`))),
            h('button', { class: 'x', 'aria-label': 'Close', onclick: () => m.close() }, '×')),
          rs.length ? h('div', { class: 'note', style: { color: s.status === 'at_risk' ? 'var(--red)' : 'var(--muted)' } }, rs.join(' · ')) : null,
          sec('This week',
            h('div', { class: 'kv' },
              h('div', {}, h('b', {}, `${s.attendance}%`), h('span', {}, 'attendance')),
              h('div', {}, h('b', {}, `${s.practicals_passed}%`), h('span', {}, s.prDone ? `practicals passed (${s.prPassed} of ${s.prDone})` : 'practicals passed')),
              h('div', {}, h('b', {}, `${s.quiz_avg}%`), h('span', {}, 'quiz average')),
              h('div', {}, h('b', {}, `${s.lab_hours_week.toFixed(1)} h`), h('span', {}, `lab this week, cap ${s.cap} h`)),
              h('div', {}, h('b', {}, String(s.days_inactive)), h('span', {}, 'days inactive')),
              h('div', {}, h('b', { style: { fontSize: '15px' } }, msText(s.ms)), h('span', {}, msStatus(s.ms))))),
          prof ? sec('Where this student is', demoFacts(s, prof)) : null,
          sec('Weekly scores', h('div', { class: 'spark' }, h('div', { class: 'row small', style: { justifyContent: 'flex-end', marginBottom: '4px' } }, h('span', { class: 'muted tiny' }, 'Dashed line: 60% pass mark')),
            h('div', { html: svg }), h('div', { class: 'ax' }, h('span', {}, `Week ${wk0}`), h('span', {}, `Week ${wk}: ${vals[vals.length - 1]}%`)))),
          sec('Recent activity',
            h('ul', { class: 'feed' }, acts.map((a) => h('li', {}, h('span', { class: 't' }, a.when), h('span', { style: a.live ? { color: 'var(--green)', fontWeight: '700' } : null }, a.text))))),
          prof ? h('div', { class: 'row', style: { gap: '16px' } },
            s.id !== SID() ? h('button', { class: 'linkbtn', title: 'The page reloads and the whole demo follows this student', onclick: () => { m.close(); c.setStudent(s.id, 'mentor'); } }, `Follow ${first(s.name)} in the demo`) : null,
            s.id === SID() ? h('button', { class: 'linkbtn', onclick: () => { m.close(); c.go('practical'); } }, `Open ${pr(s.id, 1)} practical`) : null) : null,
          h('div', { class: 'sheet-foot' },
            grantBtn, vivaBtn,
            h('button', { class: 'btn primary', onclick: () => c.toast(`Message sent to ${first(s.name)}. It appears in their lab inbox.`, 'green') }, 'Message student')));
        const m = c.modal(content);
        // Show the record as a side drawer on the right.
        Object.assign(m.box.style, { maxWidth: '560px', height: '100%', maxHeight: '100%', borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)', alignContent: 'start' });
        const back = m.box.parentElement; if (back) Object.assign(back.style, { placeItems: 'stretch end', padding: '0' });
      }

      /* ----- Review queue ----- */
      function drawQueue(panel, studs, queue) {
        panel.append(h('p', { class: 'small muted' }, 'Capstone milestones submitted by students. Automatic tests have already passed; you grade what a script cannot judge, using the field rubric.'));
        const list = h('div', {});
        queue.forEach((q) => {
          const s = studs.find((x) => x.id === q.sid); const cap = capFor(s.field, q.slot); const rv = STORE.reviews[q.key];
          if (q.placeholder) {
            list.append(h('div', { class: 'qitem' },
              h('div', {}, h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'lnk', onclick: () => openStudent(s.id) }, s.name), h('span', { class: 'tiny muted' }, 'demo student')),
                h('div', { class: 'small' }, `${cap.slot} · Month ${q.month}: ${cap.title}`),
                h('div', { class: 'meta' }, h('span', { class: 'pill amber' }, 'Not submitted yet'), h('span', { class: 'tiny muted' }, `${q.slot === 'C1' ? 'Common capstone' : fieldShort(s.field)} · rubric: ${cap.rubric.length} criteria`))),
              h('div', {}, h('button', { class: 'btn sm', onclick: () => c.go('projects') }, `Go to ${pr(s.id, 1)} capstone`))));
            return;
          }
          list.append(h('div', { class: 'qitem' },
            h('div', {}, h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'lnk', onclick: () => openStudent(s.id) }, s.name), q.live ? livePill(A.milestone.ts) : null),
              h('div', { class: 'small' }, `${cap.slot} · Month ${q.month}: ${cap.title}`),
              h('div', { class: 'meta' }, h('span', { class: 'tiny muted' }, `${q.slot === 'C1' ? 'Common capstone' : fieldShort(s.field)} · submitted ${q.live ? rel(A.milestone.ts).toLowerCase() : q.when.toLowerCase()}${q.resub ? ' · resubmission' : ''}`),
                rv ? h('span', { class: 'pill ' + (rv.decision === 'approved' ? 'green' : 'amber') }, `${rv.decision === 'approved' ? 'Approved' : 'Changes requested'} · ${rv.score}/100`) : h('span', { class: 'pill blue' }, 'Waiting for review'))),
            h('div', {}, h('button', { class: 'btn sm' + (rv ? '' : ' primary'), onclick: () => openReview(q, s, cap) }, rv ? 'Review again' : 'Open review'))));
        });
        panel.append(list);
        if (!A.milestone) panel.append(h('p', { class: 'note' }, `When ${ME().name} submits ${pr(SID(), 1)} ${ME().capstone} Month ${ME().capstone_month} milestone in the Student view, it moves to the top of this queue, ready to review against the ${ME().capstone === 'C1' ? 'common' : 'field'} rubric.`));
      }

      function openReview(q, s, cap) {
        const ms = cap.milestones.find((x) => x.month === q.month) || cap.milestones[1];
        const r = rng(q.key + cap.id);
        const prev = STORE.reviews[q.key];
        const scores = cap.rubric.map((cr) => Math.round(cr.weight * (0.7 + r() * 0.24)));
        if (prev && prev.scores && prev.scores.length === scores.length) prev.scores.forEach((v, i) => { scores[i] = v; });
        const totalEl = h('b', {}, '');
        const bandEl = h('span', { class: 'pill' });
        const ta = h('textarea', { class: 'field-input', 'aria-label': 'Feedback to the student', oninput: () => { edited = true; } });
        let edited = !!(prev && prev.comment);
        const total = () => scores.reduce((a, b) => a + b, 0);
        function draft() {
          const ratio = scores.map((v, i) => v / cap.rubric[i].weight);
          const best = ratio.indexOf(Math.max(...ratio)), worst = ratio.indexOf(Math.min(...ratio));
          const B = cap.rubric[best], Wc = cap.rubric[worst];
          return `Hi ${first(s.name)}, thanks for submitting ${cap.slot} Month ${q.month} of "${cap.title}". All ${ms.tests.length} acceptance tests pass.\n\n`
            + `Strongest area: ${B.criterion} (${scores[best]}/${B.weight}). Good work here.\n\n`
            + `To improve: ${Wc.criterion} (${scores[worst]}/${Wc.weight}). To reach "excellent": ${Wc.excellent}.\n\n`
            + (total() >= 60 ? 'Next step: publish this milestone to your GitHub portfolio and start the next one.' : 'Next step: fix the points above and resubmit. The automatic checks run again when you push.');
        }
        function update() {
          totalEl.textContent = `${total()} / 100`;
          const ok = total() >= 60; bandEl.className = 'pill ' + (total() >= 85 ? 'green' : ok ? 'blue' : 'amber'); bandEl.textContent = total() >= 85 ? 'Excellent' : ok ? 'Pass' : 'Below pass mark';
          if (!edited) ta.value = draft();
        }
        ta.value = prev && prev.comment ? prev.comment : '';
        const crits = cap.rubric.map((cr, i) => {
          const out = h('output', {}, `${scores[i]} / ${cr.weight}`);
          const inp = h('input', { type: 'range', min: '0', max: String(cr.weight), step: '1', value: String(scores[i]), 'aria-label': `${cr.criterion}, score out of ${cr.weight}`,
            oninput: (e) => { scores[i] = Number(e.target.value); out.textContent = `${scores[i]} / ${cr.weight}`; update(); } });
          return h('div', { class: 'crit' },
            h('div', {}, h('b', { class: 'small' }, cr.criterion), h('span', { class: 'tiny muted' }, ` · weight ${cr.weight}`), h('div', { class: 'tiny muted' }, `Excellent: ${cr.excellent}`)),
            h('div', { class: 'ctl' }, inp, out));
        });
        function decide(decision) {
          const sc = total();
          STORE.reviews[q.key] = { decision, score: sc, scores: scores.slice(), comment: ta.value };
          if (q.sid === SID()) {
            c.state.progress.milestoneStatus = decision;
            c.emit('milestone:reviewed', { capstone: cap.id, slot: q.slot, month: q.month, decision, score: sc, scores: scores.slice(), comment: ta.value, mentor: 'Kavita Rao', student: SID() });
            A.activity.unshift({ t: Date.now(), text: `Mentor ${decision === 'approved' ? 'approved' : 'requested changes on'} ${cap.slot} Month ${q.month} (${sc}/100)` });
          }
          c.toast(decision === 'approved' ? `Approved with ${sc}/100. ${first(s.name)} gets your feedback now.` : `Changes requested. ${first(s.name)} sees your feedback and can resubmit.`, decision === 'approved' ? 'green' : 'amber');
          m.close(); draw();
        }
        const content = h('div', { class: 'm-mentor sheet' },
          h('div', { class: 'sheet-head' },
            h('div', {}, h('div', { class: 'eyebrow' }, `Capstone review · ${cap.slot} Month ${q.month} · ${ms.type === 'merged' ? 'in-class milestone' : 'homework milestone'}`),
              h('h3', {}, `${s.name}: ${cap.title}`), h('div', { class: 'small muted' }, `${capArea(s.field, q.slot)} · ${capCompany(s.field, q.slot)} (fictional)`)),
            h('button', { class: 'x', 'aria-label': 'Close', onclick: () => m.close() }, '×')),
          h('div', {}, h('b', { class: 'small' }, 'What was submitted'), h('ul', { class: 'plain', style: { marginTop: '6px' } }, ms.deliverables.map((d) => h('li', {}, d)))),
          h('div', {}, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'small' }, 'Acceptance tests'), h('span', { class: 'pill green' }, `${ms.tests.length} of ${ms.tests.length} passed`)),
            h('div', { style: { marginTop: '4px' } }, ms.tests.map((t) => h('div', { class: 'check pass' }, h('span', { class: 'ic', html: icon('check') }), h('span', { class: 'small' }, t))))),
          h('div', {}, h('b', { class: 'small' }, 'Rubric'), h('div', {}, crits)),
          h('div', { class: 'total' }, h('div', {}, h('div', { class: 'tiny muted' }, 'Total score'), totalEl), h('div', { class: 'row', style: { gap: '8px' } }, bandEl, h('span', { class: 'tiny muted' }, 'Pass mark 60'))),
          h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'row', style: { gap: '8px' } }, h('b', { class: 'small' }, 'Feedback to student'), h('span', { class: 'ai-badge' }, 'AI draft')),
            ta, h('span', { class: 'tiny muted' }, 'The AI drafts from your scores. Edit it before you send; the student sees only what you send.')),
          h('div', { class: 'sheet-foot' },
            h('button', { class: 'btn', onclick: () => decide('changes_requested') }, 'Request changes'),
            h('button', { class: 'btn primary', onclick: () => decide('approved') }, 'Approve')));
        update();
        const m = c.modal(content); m.box.style.maxWidth = '760px';
      }

      /* ----- Exam flags ----- */
      function drawExam(panel, studs) {
        const rows = examRows(c, studs).sort((a, b) => (a.pending ? -1 : 0) - (b.pending ? -1 : 0) || (b.live ? 1 : 0) - (a.live ? 1 : 0) || flagWeight(b) - flagWeight(a) || a.s.name.localeCompare(b.s.name));
        panel.append(
          h('div', { class: 'callout' }, h('b', { class: 'small' }, 'Nothing is failed automatically. '),
            h('span', { class: 'small muted' }, 'The lockdown browser only records what happened: tab switches, leaving full screen, paste attempts. A mentor reads the summary and decides.')),
          h('div', { class: 'row small muted' }, h('span', {}, `${ME().next_exam.title} · due ${ME().next_exam.due} · 30 minutes · lockdown mode · answers saved every 20 seconds`)));
        const DEC = { accepted: ['Accepted', 'green'], viva: ['Viva requested', 'violet'], retest: ['Re-test booked', 'amber'] };
        const tbody = h('tbody');
        rows.forEach((x) => {
          const s = x.s;
          const nameCell = h('td', {}, h('div', { class: 'nm' }, h('div', {}, h('b', {}, s.name), h('span', { class: 'tiny muted' }, fieldShort(s.field))), x.live ? livePill(A.exam.ts) : null));
          if (x.pending) {
            tbody.append(h('tr', { class: 'clickable', tabindex: '0', 'aria-label': `Open ${s.name}`, onclick: () => openStudent(s.id), onkeydown: rowKey(() => openStudent(s.id)) }, nameCell, h('td', { colspan: '5', class: 'small muted' }, `Not submitted yet. ${pr(s.id, 1).replace(/^./, (x) => x.toUpperCase())} result appears here when ${pr(s.id, 0)} submits the ${ME().next_exam.title} in the Student view.`), h('td', {}, h('button', { class: 'btn sm', onclick: (e) => { e.stopPropagation(); c.go('exam'); } }, `Go to ${pr(s.id, 1)} exam`))));
            return;
          }
          const w = flagWeight(x);
          const summary = w === 0 ? h('span', { class: 'pill green' }, 'No flags') : w < 3 ? h('span', { class: 'pill blue' }, 'Minor') : h('span', { class: 'pill amber' }, 'Worth a look');
          const dec = STORE.exam[s.id];
          const actCell = h('td', { onclick: (e) => e.stopPropagation() });
          if (dec) actCell.append(h('div', { class: 'acts' }, h('span', { class: 'pill ' + DEC[dec][1] }, DEC[dec][0]), h('button', { class: 'btn sm ghost', onclick: () => { delete STORE.exam[s.id]; draw(); } }, 'Change')));
          else actCell.append(h('div', { class: 'acts' },
            h('button', { class: 'btn sm', onclick: () => { STORE.exam[s.id] = 'accepted'; c.toast(`Result accepted for ${s.name}: ${x.score}%.`, 'green'); draw(); } }, 'Accept'),
            h('button', { class: 'btn sm', onclick: () => { STORE.exam[s.id] = 'viva'; c.toast(`${first(s.name)} is asked to a 10-minute viva to talk through the answers.`, 'green'); draw(); } }, 'Ask for a viva'),
            h('button', { class: 'btn sm', onclick: () => { STORE.exam[s.id] = 'retest'; c.toast(`Re-test booked for ${first(s.name)} with a fresh set of questions.`, 'amber'); draw(); } }, 'Re-test')));
          const n = (v) => h('td', { class: 'n' }, h('span', { class: v >= 3 ? 'mid' : '' }, String(v)));
          tbody.append(h('tr', { class: 'clickable' + (x.live ? ' is-live' : ''), tabindex: '0', 'aria-label': `See ${s.name}'s exam attempt`, onclick: () => openAttempt(x), onkeydown: rowKey(() => openAttempt(x)) }, nameCell, h('td', { class: 'n' }, x.score == null ? 'n/a' : `${x.score}%`), n(x.tab), n(x.fs), n(x.paste), h('td', {}, summary), actCell));
        });
        panel.append(h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Student', 'Score', 'Tab switches', 'Full-screen exits', 'Paste attempts', 'Summary', 'Mentor decision'].map((t) => h('th', {}, t)))), tbody)),
          h('p', { class: 'tiny muted' }, 'Flags are signals, not proof. A student might leave full screen to plug in a charger. That is why a person decides.'));
      }

      function rowKey(fn) { return (e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; }

      /* ----- One exam attempt: flag timeline and decision ----- */
      function openAttempt(x) {
        const s = x.s, r = rng(s.id + 'attempt'), mins = x.minutes || 30;
        const ev = [];
        const at = () => `${String(Math.floor(r() * Math.max(1, mins - 4)) + 2).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
        for (let i = 0; i < x.tab; i++) ev.push([at(), 'Switched to another tab', `Back after ${3 + Math.floor(r() * 40)} seconds`]);
        for (let i = 0; i < x.fs; i++) ev.push([at(), 'Left full screen', 'Returned to full screen when prompted']);
        for (let i = 0; i < x.paste; i++) ev.push([at(), 'Tried to paste text', 'Blocked by the lockdown browser. Nothing was pasted']);
        ev.sort((a, b) => a[0].localeCompare(b[0]));
        const DEC = { accepted: 'Accepted', viva: 'Viva requested', retest: 'Re-test booked' };
        const dec = STORE.exam[s.id];
        const decide = (d, msg, kind) => { STORE.exam[s.id] = d; c.toast(msg, kind); m.close(); draw(); };
        const content = h('div', { class: 'm-mentor sheet' },
          h('div', { class: 'sheet-head' },
            h('div', {}, h('div', { class: 'eyebrow' }, `${ME().next_exam.title} · ${fieldShort(s.field)}`), h('h3', {}, `${s.name}: exam attempt`),
              h('div', { class: 'small muted' }, `Score ${x.score == null ? 'n/a' : x.score + '%'}${x.minutes ? ` · finished in ${x.minutes} of 30 minutes` : ''} · answers autosaved every 20 seconds`)),
            h('button', { class: 'x', 'aria-label': 'Close', onclick: () => m.close() }, '×')),
          h('div', {}, h('b', { class: 'small' }, 'What the lockdown browser recorded'),
            ev.length ? h('div', { style: { marginTop: '4px' } }, ev.map(([t, a, b]) => h('div', { class: 'check wait' }, h('span', { class: 'ic' }, '!'), h('div', { class: 'small' }, h('b', {}, `${t} · ${a}`), h('div', { class: 'tiny muted' }, b)))))
              : h('p', { class: 'note', style: { marginTop: '6px' } }, 'No tab switches, no full-screen exits and no paste attempts. A clean attempt.')),
          h('p', { class: 'tiny muted' }, 'Times are minutes into the exam. Flags are signals, not proof; you decide.'),
          dec ? h('div', { class: 'note' }, `Your decision: ${DEC[dec]}.`) : null,
          h('div', { class: 'sheet-foot' },
            h('button', { class: 'btn ghost', onclick: () => { m.close(); openStudent(s.id); } }, 'Open student record'),
            h('button', { class: 'btn', onclick: () => decide('retest', `Re-test booked for ${first(s.name)} with a fresh set of questions.`, 'amber') }, 'Re-test'),
            h('button', { class: 'btn', onclick: () => decide('viva', `${first(s.name)} is asked to a 10-minute viva to talk through the answers.`, 'green') }, 'Ask for a viva'),
            h('button', { class: 'btn primary', onclick: () => decide('accepted', `Result accepted for ${s.name}: ${x.score}%.`, 'green') }, 'Accept')));
        const m = c.modal(content); m.box.style.maxWidth = '600px';
      }

      /* ----- Lab usage ----- */
      function drawLab(panel, studs) {
        const rows = studs.slice().sort((a, b) => b.lab_hours_week - a.lab_hours_week);
        const total = rows.reduce((a, s) => a + s.lab_hours_week, 0);
        const avail = rows.reduce((a, s) => a + s.cap, 0);
        const near = rows.filter((s) => s.lab_hours_week >= s.cap * 0.9).length;
        const scaleMax = 14;
        panel.append(h('div', { class: 'grid-4' },
          h('div', { class: 'stat' }, h('b', { class: 'num' }, `${total.toFixed(1)} h`), h('span', {}, 'batch total this week')),
          h('div', { class: 'stat' }, h('b', { class: 'num' }, `${(total / rows.length).toFixed(1)} h`), h('span', {}, 'average per student')),
          h('div', { class: 'stat' }, h('b', { class: 'num' }, `${Math.round(total / avail * 100)}%`), h('span', {}, `of ${avail} h available used`)),
          h('div', { class: 'stat' }, h('b', { class: 'num' }, String(near)), h('span', {}, 'students close to their cap'))),
          h('div', { class: 'legend' }, h('span', {}, h('i'), 'Hours used'), h('span', {}, h('i', { class: 'warn' }), '90% of cap or more'), h('span', {}, h('i', { class: 'cap' }), `${CAP}-hour weekly cap`)));
        const list = h('div', { class: 'lab-list' });
        list.append(h('div', { class: 'lab-scale', 'aria-hidden': 'true' }, h('span'), h('div', {}, [0, 4, 8, 12].map((v) => h('span', { style: { left: `${v / scaleMax * 100}%` } }, `${v} h`))), h('span')));
        rows.forEach((s) => {
          const warn = s.lab_hours_week >= s.cap * 0.9;
          list.append(h('div', { class: 'lab-row clickable', role: 'button', tabindex: '0', 'aria-label': `Open ${s.name}`, onclick: () => openStudent(s.id), onkeydown: rowKey(() => openStudent(s.id)) },
            h('span', { title: s.name }, s.name, s.demo ? h('span', { class: 'tiny muted' }, ' (demo)') : null),
            h('div', { class: 'lab-track', role: 'img', 'aria-label': `${s.name}: ${s.lab_hours_week.toFixed(1)} of ${s.cap} hours` },
              h('i', { class: warn ? 'warn' : '', style: { width: `${Math.min(100, s.lab_hours_week / scaleMax * 100)}%` } }),
              h('b', { class: s.cap > CAP ? 'bonus' : '', style: { left: `calc(${s.cap / scaleMax * 100}% - 1px)` } })),
            h('span', { class: 'num', style: { textAlign: 'right' } }, `${s.lab_hours_week.toFixed(1)} / ${s.cap} h`)));
        });
        panel.append(list,
          h('p', { class: 'note' }, `Click a name to open the student record. ${batchNow().month <= 3 ? `In Months 1 to 3 practicals run as Python in the browser; the cloud workspace opens in Month 4. Lab time is still capped at ${CAP} hours a week.` : `Each student gets a cloud workspace for up to ${CAP} hours a week.`} It shuts down by itself when idle, so unused time costs nothing. Planned cost at full scale: about ₹${c.data.lab_costs.per_student_month_inr} per student per month.`));
      }

      draw();
      live = { rerender: draw };
      const pend = c.state.openStudent; c.state.openStudent = null;
      if (pend && c.data.students.some((x) => x.id === pend)) setTimeout(() => openStudent(pend), 0);
      if (this._off) this._off();
      this._off = c.on('student:open', (p) => { const id = p && (p.student && p.student.id ? p.student.id : p.student); if (id && c.state.route === 'mentor') openStudent(id); });
      const tick = setInterval(() => { document.querySelectorAll('.m-mentor [data-ts]').forEach((el) => { const t = Number(el.getAttribute('data-ts')); const label = rel(t); if (el.classList.contains('pill')) { el.lastChild.textContent = label; } else el.textContent = label; }); }, 30000);
      this._tick = tick;
    },

    destroy() { live = null; if (this._off) { this._off(); this._off = null; } if (this._tick) clearInterval(this._tick); this._tick = null; },
  });
})();
