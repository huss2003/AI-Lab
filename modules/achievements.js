/* Leaderboard, badges and certificates.
   Students earn XP for learning, badges that unlock from events anywhere in the lab, and QR-verifiable certificates.
   The Verify tab shows the public page an employer sees after scanning a certificate. All people and numbers are demo data. */
(function () {
  const ID = 'achievements';
  const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  const D = window.NM_DATA;
  const S = D.demo_student;
  const BASE_XP = S.xp;
  const VERIFY_HOST = 'verify.neuronetwrks.com';
  const PROGRAM = 'Neuromind AI Creator Program';
  const MENTOR = 'Kavita Rao';
  const NOW_MONTH = S.month;

  // Demo state that survives navigation and field switches.
  const ui = { tab: 'board', scope: 'batch', period: 'week', hidden: false, badgeFilter: 'all', verifyInput: '', verifyId: null };
  const perField = {};             // per field id: { extras: generated same-field rows, lastRank: {scopeKey: rank} }
  const verifiedOnce = new Set();  // certificate ids already announced to the active student
  let live = null;                 // the mounted screen (refs + cleanup)

  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  // ---------- deterministic helpers ----------
  function hashStr(s) { let x = 2166136261; for (const ch of String(s)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return x >>> 0; }
  function rng(seed) { let a = hashStr(seed) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const frac = (seed, lo, hi) => lo + (hi - lo) * rng(seed)();
  const initials = (n) => String(n).split(/\s+/).map((s) => s[0] || '').join('').slice(0, 2).toUpperCase();
  const slug = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const kebab = (title) => { let t = String(title || '').replace(/\([^)]*\)/g, ' '); if (t.includes(':')) t = t.split(':')[0]; return slug(t) || 'project'; };
  const fieldById = (id) => D.fields.find((f) => f.id === id) || D.fields[0];
  const firstSentence = (s) => { const m = String(s || '').match(/^(.+?[.!?])(\s|$)/); return m ? m[1] : String(s || ''); };
  function skillsOf(stacks, max) {
    const out = [];
    stacks.forEach((t) => {
      const s = String(t).replace(/\([^)]*\)/g, ' ').split(/\s\+\s|,|\sor\s|\svia\s|\son\s|\sfor\s/)[0].replace(/\s+/g, ' ').trim();
      if (s && s.split(' ').length <= 3 && !out.includes(s)) out.push(s);
    });
    return out.slice(0, max || 6);
  }

  // ---------- people and XP ----------
  const FIRST = ['Aanya', 'Vivaan', 'Ira', 'Kiaan', 'Myra', 'Arnav', 'Sara', 'Dhruv', 'Anvi', 'Shaurya', 'Kiara', 'Atharv', 'Navya', 'Rudra', 'Prisha', 'Krish', 'Aadhya', 'Ayaan', 'Mahi', 'Ishaan', 'Tara', 'Parth', 'Ritika', 'Neel', 'Sanika', 'Varun', 'Gauri', 'Om', 'Janhavi', 'Laksh', 'Mira', 'Samar'];
  const LAST = ['Deshmukh', 'Bhosale', 'Iyer', 'Reddy', 'Shinde', 'Chavan', 'Naik', 'Menon', 'Rao', 'Banerjee', 'Desai', 'Khan', 'Sawant', 'Pillai', 'Agarwal', 'Jadhav', 'Thakur', 'Bose', 'Hegde', 'Dutta', 'Gokhale', 'Kamat'];
  const OTHER_BATCHES = ['NM-2027-B', 'NM-2027-C', 'NM-2027-D'];
  let pool = null;
  const usedNames = new Set();
  function genPeople(seed, count, fieldId, idBase) {
    const r = rng(seed), out = [];
    let guard = 0;
    while (out.length < count && guard++ < 2000) {
      const n = FIRST[Math.floor(r() * FIRST.length)] + ' ' + LAST[Math.floor(r() * LAST.length)];
      if (usedNames.has(n)) continue;
      usedNames.add(n);
      const k = out.length;
      out.push({ id: 'S' + (idBase + k * 7), name: n, field: fieldId || D.fields[Math.floor(r() * D.fields.length)].id, batch: OTHER_BATCHES[Math.floor(r() * OTHER_BATCHES.length)], all: Math.round(2100 + r() * 5400) });
    }
    return out;
  }
  function getPool() {
    if (pool) return pool;
    D.students.forEach((x) => usedNames.add(x.name));
    const batch = D.students.filter((x) => x.id !== S.id).map((x) => ({ id: x.id, name: x.name, field: x.field, batch: S.batch, all: x.xp }));
    const others = genPeople('nm-all-batches', 40, null, 2101);
    // The demo students (the active one and the 3 classmates who are also demo students) sit at their profile ranks this week
    // (as on the home screen) and one place lower this month, so new XP moves the active student up live.
    const at = (arr, rank) => (rank <= 1 ? arr[0] + Math.max(40, Math.round(arr[0] * 0.08)) : rank > arr.length ? Math.max(1, arr[arr.length - 1] - 20) : Math.round((arr[rank - 2] + arr[rank - 1]) / 2));
    const demoIds = new Set((D.demo_students || []).map((x) => x.id));
    const demos = (D.demo_students || []).filter((x) => x.rank).slice().sort((a, b) => a.rank - b.rank);
    const meBase = {};
    ['week', 'month'].forEach((period) => {
      const vals = batch.filter((p) => !demoIds.has(p.id)).map((p) => periodXP(p, period)).sort((a, b) => b - a);
      demos.forEach((d) => {
        const rk = Math.max(1, Math.min(vals.length + 1, period === 'week' || d.rank === 1 ? d.rank : d.rank + 1));
        const v = at(vals, rk);
        vals.push(v); vals.sort((a, b) => b - a);
        if (d.id === S.id) meBase[period] = v;
        else { const row = batch.find((p) => p.id === d.id); if (row) (row.fixed = row.fixed || {})[period] = v; }
      });
      if (meBase[period] == null) { const wk = vals; meBase[period] = at(wk, Math.max(1, Math.min(wk.length + 1, S.rank || 3))); }
    });
    pool = { batch, others, meBase };
    return pool;
  }
  function fieldState(f) {
    if (!perField[f.id]) perField[f.id] = { extras: null, lastRank: {} };
    const st = perField[f.id];
    if (!st.extras) { getPool(); st.extras = genPeople('nm-field-' + f.id, 9, f.id, 3001 + D.fields.indexOf(f) * 100); }
    return st;
  }
  function periodXP(p, period) {
    if (period === 'all') return p.all;
    if (p.fixed && p.fixed[period] != null) return p.fixed[period];
    const [lo, hi] = period === 'month' ? [0.2, 0.45] : [0.07, 0.18];
    return Math.round(p.all * frac(p.id + ':' + period, lo, hi));
  }
  function meXP(period) {
    const st = NM.state;
    if (period === 'all') return st.xp;
    return getPool().meBase[period] + (st.xp - BASE_XP);
  }
  const SCOPES = { batch: 'Batch', field: 'My field', all: 'All batches' };
  const PERIODS = { week: 'This week', month: 'This month', all: 'All time' };
  function board(scope, period, f) {
    const P = getPool();
    let list;
    if (scope === 'batch') list = P.batch.slice();
    else if (scope === 'field') list = P.batch.filter((p) => p.field === f.id).concat(fieldState(f).extras);
    else list = P.batch.concat(P.others);
    list = list.map((p) => Object.assign({}, p, { xp: periodXP(p, period) }));
    const me = { id: S.id, name: S.name, field: f.id, batch: S.batch, all: NM.state.xp, xp: meXP(period), me: true };
    const myRank = list.filter((p) => p.xp > me.xp).length + 1;
    if (!ui.hidden) list.push(me);
    list.sort((a, b) => b.xp - a.xp || (a.me ? -1 : b.me ? 1 : a.name.localeCompare(b.name)));
    list.forEach((p, i) => { p.rank = i + 1; });
    me.rank = myRank;
    return { list, me, myRank, total: list.length + (ui.hidden ? 1 : 0) };
  }
  function trendOf(p, period) {
    if (period === 'all') return 0;
    return Math.floor(frac(p.id + ':trend:' + period, 0, 7)) - 3;
  }
  const demoOf = (id) => (NM.students || D.demo_students || []).find((x) => x.id === id && x.id !== S.id);
  // Finished (and current) projects of a demo student, for the portfolio preview.
  function projectsOf(who, fx, me) {
    const out = [], have = new Set((who.certificates || []).map((x) => x.slot));
    if (me) Object.keys(NM.state.liveCerts || {}).forEach((k) => have.add(k));
    ['C1', 'C2', 'C3'].forEach((slot) => { if (have.has(slot)) { const cap = capFor(fx, slot); out.push({ t: cap.title, co: slot === 'C1' ? D.common.company : fx.company, st: skillsOf(cap.stack, 3), tag: `Capstone ${slot.slice(1)}` }); } });
    const cur = who.capstone && !have.has(who.capstone) ? capFor(fx, who.capstone) : null;
    if (cur) out.push({ t: cur.title, co: who.capstone === 'C1' ? D.common.company : fx.company, st: skillsOf(cur.stack, 3), tag: `Capstone ${who.capstone.slice(1)}`, wip: true });
    FOUNDATION_REPOS.forEach((r, i) => { if (i + 1 < (who.month || 1)) out.push({ t: r.title, co: D.common.company, st: [`Month ${i + 1}`], tag: 'Monthly project' }); });
    (fx.standalone || []).filter((x) => x.month < (who.month || 1)).forEach((x) => out.push({ t: x.title, co: fx.company, st: [`Month ${x.month}`], tag: 'Monthly project' }));
    return out;
  }
  function profileOf(p) {
    if (p.me) return { streak: S.streak, badges: earnedCount(), handle: S.github, certs: myCerts(fieldById(p.field)).length };
    const dm = demoOf(p.id);
    if (dm) { const b = BS[dm.id]; return { streak: dm.streak, badges: b ? Object.values(b).filter((x) => x.earned).length : 5, handle: dm.github, certs: (dm.certificates || []).length }; }
    const r = rng(p.id + ':profile');
    return { streak: 2 + Math.floor(r() * 38), badges: 3 + Math.floor(r() * 10), handle: slug(p.name) + (r() > 0.5 ? '-dev' : '-builds'), certs: 2 + Math.floor(r() * 2) };
  }

  // ---------- badges ----------
  const BADGES = [
    { id: 'first-practical', name: 'First practical passed', icon: 'code', cat: 'Habits', goal: 1, what: 'Passed every hidden check in a practical for the first time.', how: 'Finish a 20-minute practical and get all automatic checks green.', route: 'practical' },
    { id: 'streak-7', name: '7-day streak', icon: 'spark', cat: 'Habits', goal: 7, what: 'Learned something in the lab seven days in a row.', how: 'Watch a lecture, answer a question or run a practical on seven days in a row.', route: 'lecture' },
    { id: 'streak-30', name: '30-day streak', icon: 'star', cat: 'Habits', goal: 30, unit: 'days', what: 'A full month of daily learning without a gap.', how: 'Keep your daily streak going for 30 days. Any lecture question or practical run counts.', route: 'lecture' },
    { id: 'sharp', name: 'Sharp listener', icon: 'play', cat: 'Habits', goal: 50, unit: 'correct answers', what: 'Answered 50 of the questions inside lectures correctly.', how: 'Answer the quick questions that pause each lecture video. Every right answer counts.', route: 'lecture' },
    { id: 'bug-hunter', name: 'Bug hunter', icon: 'search', cat: 'Skills', goal: 10, unit: 'submissions', what: 'Kept fixing code until the checks passed, ten times over.', how: 'Submit practicals, read what failed, fix it and submit again. Each submission counts.', route: 'practical' },
    { id: 'docker', name: 'Docker captain', icon: 'cloud', cat: 'Skills', goal: 5, opens: 5, unit: 'practicals', what: 'Shipped five practicals that run inside Docker containers.', how: 'Submit practicals from Month 5 onwards, where your code runs in a container.', route: 'practical' },
    { id: 'rag', name: 'RAG builder', icon: 'book', cat: 'Skills', goal: 1, opens: 6, what: 'Built an assistant that answers from documents and shows its sources.', how: 'Pass the Month 6 retrieval project with cited answers.', route: 'projects' },
    { id: 'mcp', name: 'MCP maker', icon: 'key', cat: 'Skills', goal: 1, opens: 9, what: 'Published a working MCP server that gives an AI assistant safe tools.', how: 'Build and test the MCP tools project. It opens in Month 9 for your field.', route: 'projects' },
    { id: 'automation', name: 'Automation pro', icon: 'flow', cat: 'Skills', goal: 3, opens: 8, unit: 'workflows', what: 'Built three automated workflows that run without anyone clicking.', how: 'Finish the Month 8 automation practicals. Each working workflow counts.', route: 'practical' },
    { id: 'security', name: 'Security minded', icon: 'shield', cat: 'Skills', goal: 5, opens: 3, unit: 'practicals', what: 'Passed the secrets and input-safety checks in five practicals.', how: 'Keep keys out of code and check user input. The grader tests both.', route: 'practical' },
    { id: 'curious', name: 'Curious mind', icon: 'forum', cat: 'Community', goal: 1, unit: 'question', what: 'Asked a first question in the doubt forum.', how: 'Ask anything in the doubt forum. The AI answers first and a mentor confirms.', route: 'forum' },
    { id: 'forum-helper', name: 'Forum helper', icon: 'users', cat: 'Community', goal: 5, unit: 'answers', what: 'Five of your answers to classmates were confirmed by a mentor.', how: 'Answer doubts in the forum. Answers count once a mentor confirms them.', route: 'forum' },
    { id: 'portfolio', name: 'Portfolio live', icon: 'github', cat: 'Community', goal: 1, what: 'Published a capstone to your own GitHub and your portfolio site went live.', how: 'Publish an approved capstone from the Projects screen.', route: 'projects' },
    { id: 'cap1', name: 'Capstone 1', icon: 'project', cat: 'Capstones', goal: 1, what: 'Built the common Capstone 1 and passed mentor review.', how: 'Pass mentor review for Capstone 1 in Month 3.', route: 'projects' },
    { id: 'cap2', name: 'Capstone 2', icon: 'project', cat: 'Capstones', goal: 1, opens: 4, what: 'Built the first field capstone and passed mentor review.', how: 'Pass mentor review for Capstone 2 in Month 6.', route: 'projects' },
    { id: 'cap3', name: 'Capstone 3', icon: 'project', cat: 'Capstones', goal: 2, opens: 7, unit: 'milestones', what: 'Built the second field capstone and passed mentor review.', how: 'Get both Capstone 3 milestones approved by your mentor (Months 7 and 8).', route: 'projects' },
    { id: 'cap4', name: 'Capstone 4', icon: 'project', cat: 'Capstones', goal: 3, unit: 'milestones', opens: 10, what: 'Built the final capstone, the biggest project of the year.', how: 'Get all three Capstone 4 milestones approved: Months 10 and 11, then Month 12 at Demo Day.', route: 'projects' },
    { id: 'perfect-exam', name: 'Perfect exam', icon: 'exam', cat: 'Skills', goal: 90, unit: 'best score', what: 'Scored 90 or more in a monthly assessment.', how: 'Take the monthly assessment in lockdown mode and score 90 or more.', route: 'exam' },
    { id: 'demo-day', name: 'Demo Day speaker', icon: 'mentor', cat: 'Community', goal: 1, opens: 12, what: 'Presented a capstone live to mentors and guests at Demo Day.', how: 'Demo Day is in Month 12.', route: 'projects' },
  ];
  // Badge progress for each demo student, matching how far into the year they are (demo data).
  const E = (earned, progress) => ({ progress: progress == null ? 1 : progress, earned });
  const BS = {
    S1002: { // Ishita, Month 3: a few habit badges so far
      'first-practical': E('9 Feb 2027'), 'streak-7': E('21 Apr 2027', 7), 'streak-30': { progress: S.streak }, sharp: { progress: 31 }, 'bug-hunter': { progress: 6 },
      docker: { progress: 0 }, rag: { progress: 0 }, mcp: { progress: 0 }, automation: { progress: 0 }, security: { progress: 2 }, curious: E('3 Mar 2027'),
      'forum-helper': { progress: 1 }, portfolio: { progress: 0 }, cap1: { progress: 0 }, cap2: { progress: 0 }, cap3: { progress: 0 }, cap4: { progress: 0 },
      'perfect-exam': { progress: 78 }, 'demo-day': { progress: 0 } },
    S1003: { // Kabir, Month 5
      'first-practical': E('12 Feb 2027'), 'streak-7': E('8 May 2027', 7), 'streak-30': { progress: S.streak }, sharp: { progress: 44 }, 'bug-hunter': { progress: 8 },
      docker: { progress: 2 }, rag: { progress: 0 }, mcp: { progress: 0 }, automation: { progress: 0 }, security: E('6 Jun 2027', 5), curious: { progress: 0 },
      'forum-helper': { progress: 4 }, portfolio: E('30 Apr 2027'), cap1: E('30 Apr 2027'), cap2: { progress: 0 }, cap3: { progress: 0 }, cap4: { progress: 0 },
      'perfect-exam': { progress: 88 }, 'demo-day': { progress: 0 } },
    S1001: { // Aarav, Month 8 (the original demo)
      'first-practical': E('19 Jan 2027'), 'streak-7': E('2 Aug 2027', 7), 'streak-30': { progress: S.streak }, sharp: { progress: 46 }, 'bug-hunter': { progress: 7 },
      docker: { progress: 4 }, rag: E('22 Jun 2027'), mcp: { progress: 0 }, automation: { progress: 2 }, security: E('30 Jun 2027', 5), curious: { progress: 0 },
      'forum-helper': { progress: 3 }, portfolio: { progress: 0 }, cap1: E('30 Apr 2027'), cap2: E('31 Jul 2027'), cap3: { progress: 1 }, cap4: { progress: 0 },
      'perfect-exam': { progress: 84 }, 'demo-day': { progress: 0 } },
    S1004: { // Sneha, Month 11: nearly everything
      'first-practical': E('8 Feb 2027'), 'streak-7': E('20 Feb 2027', 7), 'streak-30': E('29 Nov 2027', 30), sharp: E('4 Jun 2027', 50), 'bug-hunter': E('12 May 2027', 10),
      docker: E('24 Jun 2027', 5), rag: E('27 Jul 2027'), mcp: E('6 Oct 2027'), automation: E('30 Sep 2027', 3), security: E('18 Jun 2027', 5), curious: E('20 Feb 2027'),
      'forum-helper': E('14 Nov 2027', 5), portfolio: E('31 Jul 2027'), cap1: E('30 Apr 2027'), cap2: E('31 Jul 2027'), cap3: E('31 Oct 2027', 2), cap4: { progress: 1 },
      'perfect-exam': E('30 Sep 2027', 92), 'demo-day': { progress: 0 } },
  };
  const bs = BS[S.id] || BS.S1001;
  BADGES.forEach((b) => { if (!bs[b.id]) bs[b.id] = { progress: 0 }; });
  // What the current milestone's approval does to badges, per student.
  const ON_APPROVE = { S1002: ['cap1'], S1003: ['docker'], S1001: ['cap3', 'automation'], S1004: ['cap4'] };
  const badgeById = (id) => BADGES.find((b) => b.id === id);
  const statusOf = (b) => (bs[b.id].earned ? 'earned' : b.opens && b.opens > NOW_MONTH ? 'locked' : 'progress');
  const earnedCount = () => BADGES.filter((b) => bs[b.id].earned).length;

  function earn(id) {
    const b = badgeById(id), st = bs[id];
    if (!b || st.earned) return;
    st.progress = b.goal; st.earned = 'Today'; st.fresh = true;
    NM.toast(`Badge unlocked: ${b.name}`, 'green');
    NM.notify(`Badge unlocked: ${b.name}`, b.what + ((id === 'cap3' && S.id === 'S1001') || (id === 'cap1' && S.id === 'S1002') ? ` Your Capstone ${id.slice(3)} certificate is ready to share.` : ''), ID);
  }
  function bump(id, n) {
    const b = badgeById(id), st = bs[id];
    if (!b || st.earned || statusOf(b) === 'locked') return;
    st.progress = Math.min(b.goal, st.progress + (n || 1));
    if (st.progress >= b.goal) earn(id);
  }
  const refresh = () => { if (live) live.refresh(); };
  const isMe = (p) => { const w = p && (p.student || p.studentId); const k = w && typeof w === 'object' ? w.id || w.name : w; return !k || k === S.id || k === S.name; };

  // Module-level listeners: badges unlock from any screen, not only while this one is open.
  NM.on('practical:submitted', (p) => {
    p = p || {};
    if (p.score === 100) earn('first-practical');
    bump('bug-hunter');
    if (p.score >= 60) bump('docker');
    if (p.score === 100) bump('security');
    refresh();
  });
  NM.on('lecture:mcq', (p) => { if (p && p.correct) bump('sharp'); refresh(); });
  NM.on('exam:submitted', (p) => {
    if (p && +p.month === 3 && +p.score >= 50) issueLive('F', { date: '30 Apr 2027', score: null });
    const sc = Math.round(+((p && p.score) || 0));
    const b = bs['perfect-exam'];
    if (sc >= 90) earn('perfect-exam');
    else if (!b.earned) { if (sc > b.progress) b.progress = sc; NM.toast(`Assessment score ${sc}. The Perfect exam badge needs 90 or more.`, 'amber'); }
    refresh();
  });
  NM.on('milestone:reviewed', (p) => {
    p = p || {};
    if (!isMe(p)) return;
    if (p.month != null && +p.month !== (S.capstone_month || NOW_MONTH)) return;
    if (p.decision === 'approved') {
      const slot = CERT_ON_APPROVE[S.id];
      if (slot) issueLive(slot, { date: LIVE_DATE[slot], score: p.score != null ? +p.score : null });
      if (p.score != null) lastReviewScore = +p.score;
      (ON_APPROVE[S.id] || []).forEach((id) => bump(id));
    }
    refresh();
  });
  // Shared with Home so both screens show the same live batch rank.
  NM.myRank = () => board('batch', 'week', NM.field()).myRank;
  NM.on('forum:asked', () => { bump('curious'); refresh(); });
  NM.on('forum:answered', (p) => { if (p && p.by && (String(p.by).toLowerCase().includes(S.name.split(' ')[0].toLowerCase()) || /^you$/i.test(String(p.by)))) bump('forum-helper'); refresh(); });
  NM.on('portfolio:published', () => { earn('portfolio'); refresh(); });

  // ---------- certificates and the verification records ----------
  // Certificates come from the student's profile (data.demo_student.certificates) plus any issued live in this session
  // (NM.state.liveCerts, shared with Projects and Exams).
  const CERT_ON_APPROVE = { S1001: 'C3', S1002: 'C1' };
  const LIVE_DATE = { F: '30 Apr 2027', C1: '28 Apr 2027', C3: '20 Aug 2027' };
  const SCORES = { S1001: { C1: 88, C2: 91 }, S1003: { C1: 86 }, S1004: { C1: 92, C2: 90, C3: 94 } };
  let lastReviewScore = null;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${+m[3]} ${MON[+m[2] - 1]} ${m[1]}` : String(iso || ''); };
  const liveCerts = () => (NM.state.liveCerts = NM.state.liveCerts || {});
  function issueLive(slot, info) {
    const L = liveCerts();
    if (L[slot] || (S.certificates || []).some((x) => x.slot === slot)) return;
    L[slot] = info; NM.state.progress.certificates = (S.certificates || []).length + Object.keys(L).length;
  }
  const scoreOf = (who, slot) => { const t = SCORES[who.id]; return t && t[slot] != null ? t[slot] : 80 + (hashStr(who.id + slot) % 13); };
  const capFor = (fx, slot) => (slot === 'C1' ? D.common.capstone : fx.capstones[{ C2: 0, C3: 1, C4: 2 }[slot]]);
  const FOUNDATION_REPOS = [{ name: 'ai-foundations-notes', title: 'AI foundations notes', desc: 'Weekly notes and small experiments from Month 1.', stack: ['Markdown', 'Python 3'] },
    { name: 'python-practice-set', title: 'Python practice set', desc: 'The Month 2 practicals, each with passing automatic checks.', stack: ['Python 3', 'pytest'] },
    { name: 'prompt-and-api-lab', title: 'Prompt and API lab', desc: 'Month 3 prompts and Claude API calls with saved results.', stack: ['Python 3', 'Claude Messages API'] }];
  // Build one certificate record for a student (the active one or a classmate) and a field.
  function certRecord(who, fx, slot, issued, score) {
    const base = `${who.batch || S.batch}-${who.id}`;
    if (slot === 'F') {
      return { key: 'F', id: `${base}-F`, kind: 'Certificate of Completion', title: 'Months 1–3: AI foundations', short: 'Months 1–3 completion',
        what: `Completed Months 1 to 3: ${[1, 2, 3].map((m) => D.months[m]).join(', ')}.`, issued, track: 'Common foundation (all fields)',
        skills: ['Python 3', 'Prompt writing', 'Claude API', 'Git and GitHub', 'AI coding tools'], repos: FOUNDATION_REPOS };
    }
    const cap = capFor(fx, slot), n = slot.slice(1), co = slot === 'C1' ? D.common.company : fx.company;
    return { key: slot, id: `${base}-${slot}`, kind: 'Capstone Certificate', title: `Capstone ${n}: ${cap.title}`, short: `Capstone ${n}`, score,
      what: `Built and passed mentor review for “${cap.title}” for ${co}.`, issued, track: slot === 'C1' ? 'Common foundation (all fields)' : fx.name,
      skills: skillsOf(cap.stack), repos: [{ name: kebab(cap.title), title: cap.title, desc: firstSentence(cap.build), stack: skillsOf(cap.stack, 4) }] };
  }
  function myCerts(f) {
    const L = liveCerts(), list = [];
    ['F', 'C1', 'C2', 'C3'].forEach((slot) => {
      const p = (S.certificates || []).find((x) => x.slot === slot), l = L[slot];
      if (!p && !l) return;
      const score = slot === 'F' ? null : l ? (l.score != null ? l.score : lastReviewScore) : scoreOf(S, slot);
      list.push(certRecord(S, f, slot, p ? fmtDate(p.date) : l.date, score));
    });
    list.forEach((x) => { x.name = S.name; x.gh = S.github; x.mentor = MENTOR; x.url = `https://${VERIFY_HOST}/c/${x.id}`; });
    return list;
  }
  // Classmates from the same batch who are also demo students (their own field and certificates).
  function classmates() { return (NM.students || D.demo_students || []).filter((x) => x.id !== S.id); }
  function classmateCerts(who) {
    const fx = fieldById(who.field);
    return (who.certificates || []).map((x) => Object.assign(certRecord(who, fx, x.slot, fmtDate(x.date), x.slot === 'F' ? null : scoreOf(who, x.slot)),
      { name: who.name, gh: who.github, mentor: MENTOR, batch: who.batch, status: 'valid' }));
  }
  function records(f) {
    const map = {};
    classmates().forEach((who) => classmateCerts(who).forEach((x) => { map[x.id] = x; }));
    myCerts(f).forEach((x) => { map[x.id] = Object.assign({ status: 'valid', batch: S.batch }, x); });
    const sec = fieldById('cybersecurity'), web = fieldById('web_dev');
    const saanvi = D.students.find((x) => x.id === 'S1006') || { name: 'Saanvi Pawar' };
    const sc = sec.capstones[0], wc = web.capstones[2];
    map['NM-2027-A-S1006-C2'] = { status: 'valid', id: 'NM-2027-A-S1006-C2', name: saanvi.name, batch: 'NM-2027-A', kind: 'Capstone Certificate', title: `Capstone 2: ${sc.title}`,
      track: sec.name, issued: '31 Jul 2027', mentor: 'Rahul Menon', gh: 'saanvi-pawar-sec', skills: skillsOf(sc.stack),
      repos: [{ name: kebab(sc.title), title: sc.title, desc: firstSentence(sc.build), stack: skillsOf(sc.stack, 4) }] };
    map['NM-2026-B-S0412-C4'] = { status: 'valid', id: 'NM-2026-B-S0412-C4', name: 'Nikhil Deshpande', batch: 'NM-2026-B', kind: 'Program Completion and Capstone 4', title: `Capstone 4: ${wc.title}`,
      track: web.name, issued: '18 Mar 2027', mentor: 'Farah Siddiqui', gh: 'nikhil-d-builds', skills: skillsOf(wc.stack),
      repos: [{ name: kebab(wc.title), title: wc.title, desc: firstSentence(wc.build), stack: skillsOf(wc.stack, 4) },
        { name: kebab(web.capstones[1].title), title: web.capstones[1].title, desc: firstSentence(web.capstones[1].build), stack: skillsOf(web.capstones[1].stack, 4) }] };
    map['NM-2026-X-S9999-C2'] = { status: 'revoked', id: 'NM-2026-X-S9999-C2', name: 'Name withheld', kind: 'Capstone Certificate', title: 'Capstone 2', track: 'Data Science',
      issued: '14 Nov 2026', revoked: '12 Mar 2027', reason: 'Withdrawn after an academic integrity review found that the capstone code was not the student’s own work.' };
    return map;
  }
  // The certificate the student is working towards right now (shown as a "Next" card).
  function nextCert(f) {
    const have = new Set(myCerts(f).map((x) => x.key)), slot = S.capstone || 'C3', n = slot.slice(1);
    if (slot === 'C4') return { title: `Capstone 4: ${f.capstones[2].title}`, text: 'Issued with the program completion certificate after Demo Day in Month 12.' };
    if (have.has(slot)) return null;
    const cap = capFor(f, slot), last = cap.milestones[cap.milestones.length - 1].month;
    return { title: `Capstone ${n}: ${cap.title}`, text: CERT_ON_APPROVE[S.id] === slot ? `Issued automatically when your mentor approves the Month ${S.capstone_month} milestone.` : `Issued when your mentor approves the final Month ${last} milestone.` };
  }

  // ---------- QR code (real library from cdnjs when reachable, deterministic pattern otherwise) ----------
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
    const m = 2; let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges" role="img" aria-label="${NM.esc(label)}"><path class="qd" d="${d}"/></svg>`;
  }
  function patternSvg(text) {
    const n = 25, r = rng(text);
    const finder = (y0, x0) => { for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) { const y = y0 - fr, x = x0 - fc; if (y >= 0 && y < 7 && x >= 0 && x < 7) return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4) ? 1 : 0; if (y >= -1 && y <= 7 && x >= -1 && x <= 7) return 0; } return -1; };
    const cells = [];
    for (let y = 0; y < n; y++) { cells.push([]); for (let x = 0; x < n; x++) { const fz = finder(y, x); cells[y].push(fz >= 0 ? !!fz : (y === 6 || x === 6) ? (x + y) % 2 === 0 : r() > 0.5); } }
    return matrixSvg(n, (y, x) => cells[y][x], 'QR code for ' + text);
  }
  function drawQR(box, url) {
    box.innerHTML = patternSvg(url);
    loadQR().then((qrcode) => {
      if (!box.isConnected) return;
      const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      box.innerHTML = matrixSvg(qr.getModuleCount(), (r, c) => qr.isDark(r, c), 'QR code for ' + url);
    }).catch(() => {});
  }

  function copyText(text, okMsg) {
    const done = () => NM.toast(okMsg, 'green');
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.left = '-9999px';
        document.body.append(ta); ta.select();
        const ok = document.execCommand && document.execCommand('copy');
        ta.remove();
        if (ok) done(); else NM.toast('Copying is blocked in this browser. Select the text and copy it.', 'amber');
      } catch (e) { NM.toast('Copying is blocked in this browser. Select the text and copy it.', 'amber'); }
    };
    try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fallback); return; } } catch (e) { /* use fallback */ }
    fallback();
  }

  // ---------- styles ----------
  function injectCSS() {
    if (document.getElementById('m-' + ID)) return;
    const css = `
.m-achievements{display:grid;gap:20px;min-width:0}
.m-achievements .ma-intro{display:grid;gap:16px}
.m-achievements .ma-intro-top{display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap}
.m-achievements .ma-intro-top > div{min-width:0;flex:1 1 320px}
.m-achievements .ma-intro p{max-width:68ch}
.m-achievements .ma-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.m-achievements .ma-stat{display:grid;gap:2px;text-align:left;background:var(--surface-2);border:1px solid transparent;border-radius:var(--radius-sm);padding:12px 14px;cursor:pointer;color:var(--fg);min-width:0}
.m-achievements .ma-stat:hover{border-color:var(--brand)}
.m-achievements .ma-stat b{font-family:var(--display);font-size:22px;font-variant-numeric:tabular-nums;line-height:1.2}
.m-achievements .ma-stat span{font-size:12.5px;color:var(--muted)}
.m-achievements .ma-stat.bump b{animation:ma-pulse .9s ease}
.m-achievements .tabs .tab{display:inline-flex;align-items:center;gap:7px}
.m-achievements .tabs .tab svg{width:16px;height:16px;flex:none}
.m-achievements .ma-panel{display:grid;gap:16px;min-width:0}
.m-achievements .ma-board{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(0,1fr);gap:16px;align-items:start}
.m-achievements .ma-side{display:grid;gap:16px;min-width:0}
.m-achievements .ma-controls{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;margin-bottom:14px}
.m-achievements .ma-seg{display:inline-flex;flex-wrap:wrap;gap:2px;background:var(--surface-2);border-radius:12px;padding:3px;max-width:100%}
.m-achievements .ma-seg button{border:0;background:none;border-radius:9px;padding:6px 11px;font-weight:700;font-size:13px;color:var(--muted);cursor:pointer;white-space:nowrap}
.m-achievements .ma-seg button:hover{color:var(--fg)}
.m-achievements .ma-seg button[aria-pressed="true"]{background:var(--surface);color:var(--brand);box-shadow:var(--shadow)}
.m-achievements .ma-podium{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:end;margin:4px 0 14px}
.m-achievements .ma-pod{display:grid;justify-items:center;gap:6px;background:none;border:0;padding:0;cursor:pointer;color:var(--fg);min-width:0;text-align:center}
.m-achievements .ma-pod .nm{font-weight:700;font-size:13px;overflow-wrap:anywhere;line-height:1.25}
.m-achievements .ma-pod .xp{font-size:12px;color:var(--muted)}
.m-achievements .ma-pod .base{width:100%;border-radius:10px 10px 0 0;display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:22px}
.m-achievements .ma-pod.p1 .base{height:84px;background:var(--amber-soft);color:var(--amber)}
.m-achievements .ma-pod.p2 .base{height:62px;background:var(--surface-2);color:var(--muted)}
.m-achievements .ma-pod.p3 .base{height:48px;background:var(--violet-soft);color:var(--violet)}
.m-achievements .ma-pod:hover .nm{color:var(--brand)}
.m-achievements .ma-pod.me .ma-av{box-shadow:0 0 0 3px var(--brand)}
.m-achievements .ma-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:12.5px;background:var(--surface-2);color:var(--muted);flex:none}
.m-achievements .ma-av.lg{width:48px;height:48px;font-size:15px}
.m-achievements .ma-av.xl{width:60px;height:60px;font-size:19px}
.m-achievements .ma-av.c0{background:var(--brand-soft);color:var(--brand)} .m-achievements .ma-av.c1{background:var(--green-soft);color:var(--green)}
.m-achievements .ma-av.c2{background:var(--violet-soft);color:var(--violet)} .m-achievements .ma-av.c3{background:var(--amber-soft);color:var(--amber)}
.m-achievements .ma-av.me{background:var(--brand);color:var(--on-brand)}
.m-achievements .ma-next{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13.5px;margin-bottom:12px}
.m-achievements .ma-next .moved{animation:ma-pop .6s ease}
.m-achievements .ma-list{max-height:520px;overflow-y:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);overscroll-behavior:contain}
.m-achievements .ma-row{display:grid;grid-template-columns:40px 34px minmax(0,1fr) 48px auto;gap:10px;align-items:center;width:100%;padding:9px 12px;border:0;border-top:1px solid var(--line);background:var(--surface);text-align:left;cursor:pointer;color:var(--fg)}
.m-achievements .ma-row:first-child{border-top:0}
.m-achievements .ma-row:hover{background:var(--surface-2)}
.m-achievements .ma-row .rk{font-family:var(--display);font-weight:700;font-variant-numeric:tabular-nums;color:var(--muted)}
.m-achievements .ma-row .rk.t1{color:var(--amber)} .m-achievements .ma-row .rk.t2{color:var(--fg)} .m-achievements .ma-row .rk.t3{color:var(--violet)}
.m-achievements .ma-row .ma-who{display:grid;min-width:0}
.m-achievements .ma-row .ma-who b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-achievements .ma-row .ma-who span{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-achievements .ma-row .xp{font-weight:800;font-variant-numeric:tabular-nums;font-size:14px;text-align:right;white-space:nowrap}
.m-achievements .ma-row.me{background:var(--brand-soft);box-shadow:inset 3px 0 0 var(--brand)}
.m-achievements .ma-row.me .ma-who b{color:var(--brand)}
.m-achievements .ma-row.flash{animation:ma-flash 1.6s ease}
.m-achievements .ma-trend{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.m-achievements .ma-trend.up{color:var(--green)} .m-achievements .ma-trend.down{color:var(--red)} .m-achievements .ma-trend.same{color:var(--faint)}
.m-achievements .ma-private{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border:1px dashed var(--brand);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:12px;background:var(--brand-soft)}
.m-achievements .ma-private > div{flex:1 1 220px;min-width:0}
.m-achievements .ma-private.flash{animation:ma-pop .6s ease}
.m-achievements .ma-earn{display:grid;gap:0;margin-top:4px}
.m-achievements .ma-earn li{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line);font-size:13.5px}
.m-achievements .ma-earn li:first-child{border-top:0}
.m-achievements .ma-earn ul{list-style:none;margin:0;padding:0}
.m-achievements .ma-earn .ix{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand)}
.m-achievements .ma-earn .ix svg{width:15px;height:15px}
.m-achievements .ma-earn .pts{font-weight:800;color:var(--green);font-variant-numeric:tabular-nums;white-space:nowrap}
.m-achievements .ma-switch-row{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--line);border-radius:var(--radius-sm);margin:10px 0;cursor:pointer;background:var(--surface);width:100%;text-align:left;color:var(--fg)}
.m-achievements .ma-switch-row:hover{border-color:var(--brand)}
.m-achievements .ma-switch{width:42px;height:24px;border-radius:99px;background:var(--line);position:relative;flex:none;transition:background .2s}
.m-achievements .ma-switch::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--surface);box-shadow:var(--shadow);transition:transform .2s}
.m-achievements [aria-checked="true"] .ma-switch{background:var(--brand)}
.m-achievements [aria-checked="true"] .ma-switch::after{transform:translateX(18px)}
.m-achievements .ma-bhead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.m-achievements .ma-badges{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(158px,100%),1fr));gap:12px}
.m-achievements .ma-badge{display:grid;justify-items:center;align-content:start;text-align:center;gap:8px;padding:16px 12px 14px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);cursor:pointer;color:var(--fg);min-width:0;position:relative}
.m-achievements .ma-badge:hover{border-color:var(--brand)}
.m-achievements .ma-badge .nm{font-weight:800;font-size:13.5px;line-height:1.25;overflow-wrap:anywhere}
.m-achievements .ma-badge .st{font-size:12px;color:var(--muted)}
.m-achievements .ma-badge .progress{width:100%;height:6px}
.m-achievements .ma-badge .cat{position:absolute;top:8px;left:10px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.m-achievements .ma-badge.locked .nm{color:var(--muted)}
.m-achievements .ma-badge.fresh{animation:ma-glow 1.4s ease 2}
.m-achievements .ma-medal{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;position:relative;flex:none;margin-top:6px}
.m-achievements .ma-medal svg{width:26px;height:26px}
.m-achievements .ma-medal.lg{width:84px;height:84px} .m-achievements .ma-medal.lg svg{width:38px;height:38px}
.m-achievements .ma-medal.earned{background:var(--green-soft);color:var(--green);box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--green)}
.m-achievements .ma-medal.inprog{background:var(--brand-soft);color:var(--brand)}
.m-achievements .ma-medal.locked{background:var(--surface-2);color:var(--faint)}
.m-achievements .ma-medal .lk{position:absolute;right:-3px;bottom:-3px;width:22px;height:22px;border-radius:50%;background:var(--surface);border:1px solid var(--line);display:grid;place-items:center;color:var(--muted)}
.m-achievements .ma-medal .lk svg{width:12px;height:12px}
.m-achievements .ma-certs{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:16px}
.m-achievements .ma-cert{display:grid;gap:12px;align-content:start;min-width:0}
.m-achievements .ma-paper{position:relative;border:1px solid var(--line);border-radius:var(--radius);background:linear-gradient(135deg,var(--brand-soft),var(--surface) 55%);padding:20px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start;min-width:0}
.m-achievements .ma-paper::before{content:'';position:absolute;inset:6px;border:1px dashed var(--line);border-radius:9px;pointer-events:none}
.m-achievements .ma-paper > *{position:relative;min-width:0}
.m-achievements .ma-paper .kind{font-family:var(--display);font-weight:700;font-size:15px;margin-top:4px}
.m-achievements .ma-paper .to{font-size:12px;color:var(--muted);margin-top:10px}
.m-achievements .ma-paper .nm{font-family:var(--display);font-weight:700;font-size:21px;color:var(--brand);line-height:1.2}
.m-achievements .ma-paper .ttl{font-size:13.5px;margin-top:6px;overflow-wrap:anywhere}
.m-achievements .ma-paper .meta{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--muted)}
.m-achievements .ma-paper .meta b{display:block;color:var(--fg);font-size:12.5px}
.m-achievements .ma-mono{font-family:var(--mono);font-size:12px;overflow-wrap:anywhere}
.m-achievements .ma-qrcol{display:grid;justify-items:center;gap:4px}
.m-achievements .ma-qr{width:92px;height:92px;background:var(--code-fg);border-radius:8px;padding:3px;flex:none}
.m-achievements .ma-qr svg{width:100%;height:100%;display:block}
.m-achievements .ma-qr .qd{fill:var(--code-bg)}
.m-achievements .ma-qr.lg{width:140px;height:140px}
.m-achievements .ma-actions{display:flex;flex-wrap:wrap;gap:8px}
.m-achievements .ma-lockcert{border:1px dashed var(--line);border-radius:var(--radius);padding:20px;display:grid;gap:10px;align-content:center;justify-items:start;background:var(--surface);min-height:180px}
.m-achievements .ma-browser{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface);min-width:0}
.m-achievements .ma-bbar{display:flex;gap:10px;align-items:center;padding:8px 12px;background:var(--surface-2);border-bottom:1px solid var(--line);min-width:0}
.m-achievements .ma-dots{display:inline-flex;gap:5px;flex:none}
.m-achievements .ma-dots i{width:9px;height:9px;border-radius:50%;background:var(--line);display:block}
.m-achievements .ma-url{flex:1;min-width:0;font-family:var(--mono);font-size:12px;background:var(--surface);border:1px solid var(--line);border-radius:99px;padding:4px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}
.m-achievements .ma-url svg{width:12px;height:12px;vertical-align:-2px;margin-right:4px;color:var(--green)}
.m-achievements .ma-vsite{padding:22px;display:grid;gap:16px;min-width:0}
.m-achievements .ma-vbrand{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.m-achievements .ma-vbrand .mk{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,var(--brand),var(--green));display:grid;place-items:center;color:var(--on-brand);flex:none}
.m-achievements .ma-vbrand .mk svg{width:20px;height:20px}
.m-achievements .ma-vform{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px}
.m-achievements .ma-vform .field-input{font-family:var(--mono);font-size:14px;text-transform:uppercase}
.m-achievements .ma-vform .field-input::placeholder{text-transform:none;font-family:var(--body)}
.m-achievements .ma-try{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.m-achievements .ma-chip{border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:99px;padding:4px 10px;font-size:12.5px;font-weight:600;cursor:pointer}
.m-achievements .ma-chip:hover{border-color:var(--brand);color:var(--brand)}
.m-achievements .ma-res{border:1px solid var(--line);border-radius:var(--radius);padding:18px;display:grid;gap:14px;min-width:0;animation:nm-in .25s ease}
.m-achievements .ma-res.ok{border-color:var(--green);background:linear-gradient(180deg,var(--green-soft),var(--surface) 110px)}
.m-achievements .ma-res.bad{border-color:var(--red);background:linear-gradient(180deg,var(--red-soft),var(--surface) 110px)}
.m-achievements .ma-res.rev{border-color:var(--amber);background:linear-gradient(180deg,var(--amber-soft),var(--surface) 110px)}
.m-achievements .ma-res-head{display:flex;gap:12px;align-items:center}
.m-achievements .ma-res-head .ic{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;flex:none}
.m-achievements .ma-res-head .ic svg{width:22px;height:22px}
.m-achievements .ma-res.ok .ic{background:var(--green);color:var(--on-brand)} .m-achievements .ma-res.bad .ic{background:var(--red);color:var(--on-brand)} .m-achievements .ma-res.rev .ic{background:var(--amber);color:var(--on-brand)}
.m-achievements .ma-res-head h2{font-size:22px}
.m-achievements .ma-res.ok h2{color:var(--green)} .m-achievements .ma-res.bad h2{color:var(--red)} .m-achievements .ma-res.rev h2{color:var(--amber)}
.m-achievements .ma-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px;margin:0}
.m-achievements .ma-dl div{min-width:0}
.m-achievements .ma-dl dt{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.m-achievements .ma-dl dd{margin:2px 0 0;font-weight:700;font-size:14px;overflow-wrap:anywhere}
.m-achievements .ma-tags{display:flex;flex-wrap:wrap;gap:6px}
.m-achievements .ma-tag{font-size:12px;font-weight:600;background:var(--surface-2);color:var(--fg);border-radius:6px;padding:3px 8px}
.m-achievements .ma-repos{display:grid;gap:8px}
.m-achievements .ma-repo{display:flex;gap:10px;align-items:center;text-align:left;width:100%;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:var(--radius-sm);padding:10px 12px;cursor:pointer;min-width:0}
.m-achievements .ma-repo:hover{border-color:var(--brand)}
.m-achievements .ma-repo svg{width:18px;height:18px;flex:none;color:var(--muted)}
.m-achievements .ma-repo .tx{display:grid;min-width:0;flex:1}
.m-achievements .ma-repo .tx b{font-family:var(--mono);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--brand)}
.m-achievements .ma-repo .tx span{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-achievements .ma-guide{margin:0;padding-left:18px;display:grid;gap:4px;font-size:13.5px}
.m-achievements .ma-vf{position:relative;width:100%;max-width:230px;aspect-ratio:1;margin:0 auto;background:var(--code-bg);border-radius:16px;display:grid;place-items:center;overflow:hidden}
.m-achievements .ma-vf .cn{position:absolute;width:26px;height:26px;border:3px solid var(--green)}
.m-achievements .ma-vf .cn.a{top:12px;left:12px;border-right:0;border-bottom:0;border-radius:6px 0 0 0}
.m-achievements .ma-vf .cn.b{top:12px;right:12px;border-left:0;border-bottom:0;border-radius:0 6px 0 0}
.m-achievements .ma-vf .cn.c{bottom:12px;left:12px;border-right:0;border-top:0;border-radius:0 0 0 6px}
.m-achievements .ma-vf .cn.d{bottom:12px;right:12px;border-left:0;border-top:0;border-radius:0 0 6px 0}
.m-achievements .ma-vf .line{position:absolute;left:10%;right:10%;height:2px;background:var(--green);box-shadow:0 0 12px var(--green);top:14%;animation:ma-scan 1.3s ease-in-out infinite}
.m-achievements .ma-vf .ma-qr{width:58%;height:58%;transition:opacity .3s}
.m-achievements .ma-vf .hint{color:var(--code-muted);font-size:12.5px;text-align:center;padding:0 24px}
.m-achievements .ma-scanpick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.m-achievements .ma-scanpick button{display:grid;gap:6px;justify-items:center;text-align:center;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:var(--radius-sm);padding:10px 6px;cursor:pointer;font-size:12px;font-weight:700;min-width:0}
.m-achievements .ma-scanpick button:hover{border-color:var(--brand)}
.m-achievements .ma-scanpick button[aria-pressed="true"]{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.m-achievements .ma-scanpick .ma-qr{width:52px;height:52px}
.m-achievements .ma-scanpick span{overflow-wrap:anywhere}
.m-achievements .ma-prof-head{display:flex;gap:14px;align-items:center}
.m-achievements .ma-prof-head > div{min-width:0}
.m-achievements .ma-pstats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.m-achievements .ma-pstats div{background:var(--surface-2);border-radius:var(--radius-sm);padding:10px 12px;display:grid}
.m-achievements .ma-pstats b{font-family:var(--display);font-size:19px;font-variant-numeric:tabular-nums}
.m-achievements .ma-pstats span{font-size:12px;color:var(--muted)}
.m-achievements .ma-site{padding:18px;display:grid;gap:14px}
.m-achievements .ma-site-hero{display:flex;gap:12px;align-items:center;padding:14px;border-radius:var(--radius-sm);background:linear-gradient(135deg,var(--brand-soft),var(--surface-2))}
.m-achievements .ma-site-hero > div{min-width:0}
.m-achievements .ma-site-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(190px,100%),1fr));gap:10px}
.m-achievements .ma-site-card{border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px;display:grid;gap:6px;align-content:start;min-width:0}
.m-achievements .ma-site-card b{font-size:13px;line-height:1.3;overflow-wrap:anywhere}
.m-achievements .ma-modal{display:grid;gap:14px;min-width:0}
.m-achievements .ma-modal-head{display:flex;justify-content:space-between;align-items:start;gap:10px}
.m-achievements .ma-modal-head > div{min-width:0}
.m-achievements .ma-post{width:100%;min-height:200px;resize:vertical;line-height:1.5;font-size:14px}
.m-achievements .ma-badge-detail{display:grid;justify-items:center;text-align:center;gap:8px}
@keyframes ma-flash{0%,100%{}25%{background:color-mix(in srgb,var(--brand) 26%,var(--surface))}}
@keyframes ma-pop{0%{transform:scale(.92);opacity:.4}60%{transform:scale(1.04)}100%{transform:none;opacity:1}}
@keyframes ma-pulse{0%,100%{}40%{color:var(--green)}}
@keyframes ma-glow{0%,100%{box-shadow:none}50%{box-shadow:0 0 0 4px var(--green-soft),0 0 0 5px var(--green)}}
@keyframes ma-scan{0%,100%{top:14%}50%{top:84%}}
@media (max-width:1100px){.m-achievements .ma-board{grid-template-columns:minmax(0,1fr)}.m-achievements .ma-side{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){.m-achievements .ma-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.m-achievements .ma-side{grid-template-columns:minmax(0,1fr)}}
@media (max-width:560px){
 .m-achievements .ma-row{grid-template-columns:30px 30px minmax(0,1fr) auto;gap:8px;padding:9px 10px}
 .m-achievements .ma-row .ma-av{width:30px;height:30px;font-size:11px}
 .m-achievements .ma-row .ma-trend{display:none}
 .m-achievements .ma-vform{grid-template-columns:1fr 1fr}
 .m-achievements .ma-vform .field-input{grid-column:1/-1}
 .m-achievements .ma-dl{grid-template-columns:minmax(0,1fr)}
 .m-achievements .ma-paper{grid-template-columns:minmax(0,1fr)}
 .m-achievements .ma-qrcol{justify-items:start;grid-auto-flow:column;align-items:center;justify-content:start;gap:10px}
 .m-achievements .ma-vsite{padding:16px}
 .m-achievements .ma-stat b{font-size:19px}
}
@media (prefers-reduced-motion:reduce){.m-achievements *{animation:none!important;transition:none!important}}
`;
    document.head.append(Object.assign(document.createElement('style'), { id: 'm-' + ID, textContent: css }));
  }

  // ---------- screen ----------
  function cleanup() {
    if (!live) return;
    live.offs.forEach((off) => { try { off(); } catch (e) { /* ignore */ } });
    live.timers.forEach(clearTimeout);
    live.rafs.forEach((r) => cancelAnimationFrame(r));
    live = null;
  }

  NM.register(ID, {
    label: 'Leaderboard & certificates', title: 'Leaderboard, badges and certificates', icon: 'trophy', group: 'Community', order: 56,
    destroy() { cleanup(); },
    render(root, c) {
      cleanup();
      injectCSS();
      const { h, icon, esc } = c;
      const f = c.field;
      const L = { c, offs: [], timers: new Set(), rafs: new Set(), panelFns: {} };
      live = L;
      const later = (fn, ms) => { const t = setTimeout(() => { L.timers.delete(t); if (live === L) fn(); }, reduced() ? Math.min(ms, 80) : ms); L.timers.add(t); return t; };
      const avClass = (p) => (p.me ? 'me' : 'c' + (hashStr(p.id) % 4));
      const av = (p, size) => h('span', { class: `ma-av ${size || ''} ${avClass(p)}` }, initials(p.name));
      const closeBtn = (m) => h('button', { class: 'btn sm ghost', 'aria-label': 'Close', onclick: () => m.close() }, 'Close');

      const wrap = h('div', { class: 'm-' + ID });
      root.append(wrap);

      // ----- intro + stats -----
      const statXP = h('b', { class: 'num' }), statRank = h('b', { class: 'num' }), statBadges = h('b', { class: 'num' }), statCerts = h('b', { class: 'num' });
      const statRankLbl = h('span', {}, '');
      const stats = h('div', { class: 'ma-stats' },
        h('button', { class: 'ma-stat', 'data-k': 'xp', onclick: () => setTab('board') }, statXP, h('span', {}, 'XP earned so far')),
        h('button', { class: 'ma-stat', 'data-k': 'rank', onclick: () => { ui.scope = 'batch'; ui.period = 'week'; setTab('board'); } }, statRank, statRankLbl),
        h('button', { class: 'ma-stat', 'data-k': 'badges', onclick: () => setTab('badges') }, statBadges, h('span', {}, 'badges earned')),
        h('button', { class: 'ma-stat', 'data-k': 'certs', onclick: () => setTab('certs') }, statCerts, h('span', {}, 'certificates issued')));
      function paintStats() {
        statXP.textContent = fmt(NM.state.xp);
        const r = board('batch', 'week', f).myRank;
        statRank.textContent = '#' + r;
        statRankLbl.textContent = ui.hidden ? 'batch rank this week (only you see it)' : 'in the batch this week';
        statBadges.textContent = `${earnedCount()} of ${BADGES.length}`;
        statCerts.textContent = String(myCerts(f).length);
      }
      wrap.append(h('section', { class: 'card ma-intro' },
        h('div', { class: 'ma-intro-top' },
          h('div', { class: 'stack', style: { gap: '6px' } },
            h('div', { class: 'eyebrow' }, `${S.name} · ${S.batch} · ${f.name}`),
            h('h2', {}, 'Progress you can see. Proof you can share.'),
            h('p', { class: 'small muted' }, 'Students earn XP for learning, badges for milestones and certificates that any employer can check with one scan.')),
          h('span', { class: 'pill amber' }, 'Demo data')),
        stats));

      // ----- tabs -----
      const TABS = [['board', 'Leaderboard', 'trophy'], ['badges', 'Badges', 'star'], ['certs', 'Certificates', 'cert'], ['verify', 'Verify a certificate', 'shield']];
      const tabBar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Achievements' });
      TABS.forEach(([id, label, ic]) => tabBar.append(h('button', { class: 'tab', role: 'tab', id: 'ma-tab-' + id, 'aria-controls': 'ma-panel', 'data-tab': id, html: icon(ic) + `<span>${esc(label)}</span>`, onclick: () => setTab(id) })));
      const panel = h('div', { class: 'ma-panel', id: 'ma-panel', role: 'tabpanel' });
      wrap.append(tabBar, panel);

      function setTab(id) {
        ui.tab = id;
        tabBar.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
        panel.setAttribute('aria-labelledby', 'ma-tab-' + id);
        panel.textContent = '';
        L.panelFns = {};
        ({ board: renderBoard, badges: renderBadges, certs: renderCerts, verify: renderVerify })[id]();
      }

      // ================= 1. Leaderboard =================
      function renderBoard() {
        const scopeSeg = h('div', { class: 'ma-seg', role: 'group', 'aria-label': 'Who to compare with' });
        const periodSeg = h('div', { class: 'ma-seg', role: 'group', 'aria-label': 'Time period' });
        const subtitle = h('span', { class: 'small muted' });
        const podium = h('div', { class: 'ma-podium' });
        const next = h('div', { class: 'ma-next' });
        const privateBox = h('div');
        const list = h('div', { class: 'ma-list', role: 'list', 'aria-label': 'Leaderboard' });
        const jumpBtn = h('button', { class: 'btn sm', onclick: jumpToMe, html: icon('search') + '<span>Jump to me</span>' });

        Object.entries(SCOPES).forEach(([k, label]) => scopeSeg.append(h('button', { 'data-scope': k, onclick: () => { ui.scope = k; paint(); } }, k === 'field' ? `My field: ${f.short}` : k === 'batch' ? `Batch ${S.batch}` : label)));
        Object.entries(PERIODS).forEach(([k, label]) => periodSeg.append(h('button', { 'data-period': k, onclick: () => { ui.period = k; paint(); } }, label)));

        const main = h('section', { class: 'card' },
          h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, 'Leaderboard'), subtitle), jumpBtn),
          h('div', { class: 'ma-controls' }, scopeSeg, periodSeg),
          podium, next, privateBox, list,
          h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'Click any student to see their profile and portfolio. Fictional students and numbers.'));

        // How XP is earned
        const EARN = [
          ['play', 'Answer a question inside a lecture correctly', '+10'],
          ['code', 'Pass a practical with every check green', '+60'],
          ['code', 'Submit a practical that passes some checks', '+40'],
          ['exam', 'Submit the monthly assessment', '+150'],
          ['project', 'Capstone milestone approved by a mentor', '+120'],
          ['github', 'Publish a capstone to your GitHub', '+60'],
          ['forum', 'Help a classmate in the forum (mentor confirmed)', '+25'],
        ];
        const earnCard = h('section', { class: 'card ma-earn' },
          h('h3', {}, 'How XP is earned'),
          h('p', { class: 'small muted', style: { margin: '4px 0 6px' } }, 'The same points in every field, so batches compare fairly.'),
          h('ul', {}, EARN.map(([ic, t, pts]) => h('li', {}, h('span', { class: 'ix', html: icon(ic) }), h('span', {}, t), h('span', { class: 'pts' }, pts)))),
          h('div', { class: 'row', style: { marginTop: '10px', gap: '8px' } },
            h('button', { class: 'btn sm', onclick: () => c.go('lecture') }, 'Earn XP in a lecture'),
            h('button', { class: 'btn sm', onclick: () => c.go('practical') }, 'Try a practical')));

        // Privacy
        const sw = h('button', { class: 'ma-switch-row', role: 'switch', 'aria-checked': String(ui.hidden), onclick: () => {
          ui.hidden = !ui.hidden; sw.setAttribute('aria-checked', String(ui.hidden));
          c.toast(ui.hidden ? 'You are hidden from the leaderboard. Your XP still counts.' : 'You are back on the leaderboard.', ui.hidden ? 'amber' : 'green');
          paint(); paintStats();
        } }, h('span', {}, h('b', { class: 'small', style: { display: 'block' } }, 'Hide me from the leaderboard'), h('span', { class: 'tiny muted' }, 'Classmates will not see your name or XP')), h('span', { class: 'ma-switch', 'aria-hidden': 'true' }));
        const privacy = h('section', { class: 'card' },
          h('h3', {}, 'Privacy comes first'),
          sw,
          h('p', { class: 'small muted' }, 'Leaderboards are optional. Students who prefer privacy can hide themselves at any time. Their XP, badges and certificates still count, and only they and their mentor see their rank.'));

        panel.append(h('div', { class: 'ma-board' }, main, h('div', { class: 'ma-side' }, earnCard, privacy)));

        function rowEl(p, period) {
          const t = p.me ? meTrend(period) : trendOf(p, period);
          const fx = fieldById(p.field);
          return h('button', { class: 'ma-row' + (p.me ? ' me' : ''), role: 'listitem', 'data-id': p.id, 'aria-label': `Rank ${p.rank}, ${p.name}, ${fmt(p.xp)} XP`, onclick: () => openProfile(p) },
            h('span', { class: 'rk' + (p.rank <= 3 ? ' t' + p.rank : '') }, '#' + p.rank),
            av(p),
            h('span', { class: 'ma-who' }, h('b', {}, p.me ? `${p.name} (you)` : p.name), h('span', {}, `${fx.short} · ${p.batch}`)),
            h('span', { class: 'ma-trend ' + (t > 0 ? 'up' : t < 0 ? 'down' : 'same'), title: t ? `${Math.abs(t)} places ${t > 0 ? 'up' : 'down'} since last ${period}` : 'No change' }, t > 0 ? `+${t}` : t < 0 ? `${t}` : '='),
            h('span', { class: 'xp num' }, `${fmt(p.xp)} XP`));
        }
        function meTrend(period) {
          if (period === 'all') return 0;
          const k = `${ui.scope}:${period}`, st = fieldState(f);
          return st.moved && st.moved[k] ? st.moved[k] + (period === 'week' ? 1 : 0) : period === 'week' ? 1 : 2;
        }

        let lastMe = null;
        function paint(opt) {
          opt = opt || {};
          scopeSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scope === ui.scope)));
          periodSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.period === ui.period)));
          const B = board(ui.scope, ui.period, f);
          subtitle.textContent = `${ui.scope === 'batch' ? `Batch ${S.batch}` : ui.scope === 'field' ? `${f.name} students in all batches` : 'Every batch running this year'} · ${B.total} students · ${PERIODS[ui.period].toLowerCase()}`;

          // podium (2nd, 1st, 3rd)
          podium.textContent = '';
          [1, 0, 2].forEach((i) => { const p = B.list[i]; if (!p) return;
            podium.append(h('button', { class: `ma-pod p${i + 1}${p.me ? ' me' : ''}`, onclick: () => openProfile(p), 'aria-label': `Place ${i + 1}: ${p.name}` },
              av(p, 'lg'), h('span', { class: 'nm' }, p.me ? 'You' : p.name), h('span', { class: 'xp num' }, `${fmt(p.xp)} XP`), h('span', { class: 'base' }, String(i + 1))));
          });

          // next target line
          next.textContent = '';
          const ahead = B.list.filter((p) => !p.me && p.xp > B.me.xp).sort((a, b) => a.xp - b.xp)[0];
          next.append(h('span', { class: 'pill blue' }, `You are #${B.myRank} of ${B.total}`));
          if (opt.moved) next.append(h('span', { class: 'pill green moved' }, `Up ${opt.moved} place${opt.moved > 1 ? 's' : ''}`));
          next.append(h('span', { class: 'muted' }, ahead ? `${fmt(ahead.xp - B.me.xp + 1)} XP more passes ${ahead.name}.` : 'You lead this leaderboard.'));

          // private card when hidden
          privateBox.textContent = '';
          if (ui.hidden) {
            privateBox.append(h('div', { class: 'ma-private', id: 'ma-private' },
              h('span', { class: 'ma-av me' }, initials(S.name)),
              h('div', {}, h('b', { class: 'small' }, `You are hidden. Your private rank: #${B.myRank} with ${fmt(B.me.xp)} XP`), h('div', { class: 'tiny muted' }, 'Only you and your mentor see this. Classmates see the list without you.')),
              h('button', { class: 'btn sm', onclick: () => openProfile(B.me) }, 'My profile')));
          }

          // rows
          const st = list.scrollTop;
          list.textContent = '';
          B.list.forEach((p) => list.append(rowEl(p, ui.period)));
          list.scrollTop = st;
          lastMe = B.me;
          return B;
        }

        function jumpToMe() {
          const target = ui.hidden ? privateBox.querySelector('.ma-private') : list.querySelector('.ma-row.me');
          if (!target) return;
          if (!ui.hidden) { const top = target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2; list.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' }); }
          target.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
          target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
          try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
        }

        paint();

        // live XP: update Aarav's XP and rank with a small animation
        L.panelFns.onXP = (gained) => {
          const before = lastMe ? lastMe.rank : null, oldXP = lastMe ? lastMe.xp : 0;
          const B = board(ui.scope, ui.period, f);
          const moved = before && B.myRank < before ? before - B.myRank : 0;
          if (moved) { const st = fieldState(f); st.moved = st.moved || {}; const k = `${ui.scope}:${ui.period}`; st.moved[k] = (st.moved[k] || 0) + moved; }
          paint({ moved });
          const row = list.querySelector('.ma-row.me');
          if (row) {
            row.classList.add('flash');
            const xpEl = row.querySelector('.xp');
            if (xpEl && !reduced() && gained > 0) {
              const to = B.me.xp, from = Math.max(0, oldXP), t0 = performance.now();
              const step = (now) => { const k = Math.min(1, (now - t0) / 700); xpEl.textContent = `${fmt(Math.round(from + (to - from) * k))} XP`; if (k < 1 && xpEl.isConnected) { const r = requestAnimationFrame(step); L.rafs.add(r); } };
              const r = requestAnimationFrame(step); L.rafs.add(r);
            }
          }
          if (moved) c.toast(`You moved up to #${B.myRank} on the ${SCOPES[ui.scope].toLowerCase()} leaderboard`, 'green');
        };
        L.panelFns.refresh = () => paint();
      }

      // ----- profile modal + portfolio preview -----
      function openProfile(p) {
        const pf = profileOf(p), fx = p.me ? f : fieldById(p.field);
        const content = h('div', { class: 'm-' + ID + ' ma-modal' });
        const m = c.modal(content);
        const showProfile = () => {
          content.textContent = '';
          const scopeRank = p.me ? board(ui.scope, ui.period, f).myRank : p.rank;
          const earnedNames = p.me ? BADGES.filter((b) => bs[b.id].earned).map((b) => b.name) : BADGES.filter((b, i) => (hashStr(p.id) >> i) & 1).slice(0, 3).map((b) => b.name);
          content.append(
            h('div', { class: 'ma-modal-head' },
              h('div', { class: 'ma-prof-head' }, av(p, 'xl'), h('div', {}, h('h2', {}, p.name), h('div', { class: 'small muted' }, `${fx.name} · ${p.batch}`))),
              closeBtn(m)),
            p.me && ui.hidden ? h('div', { class: 'note' }, 'You are hidden from the leaderboard. Classmates cannot open this profile from the list.') : null,
            h('div', { class: 'ma-pstats' },
              h('div', {}, h('b', {}, '#' + (scopeRank || '-')), h('span', {}, `${SCOPES[ui.scope]} · ${PERIODS[ui.period].toLowerCase()}`)),
              h('div', {}, h('b', {}, fmt(p.me ? NM.state.xp : p.all)), h('span', {}, 'XP all time')),
              h('div', {}, h('b', {}, String(pf.badges)), h('span', {}, 'badges earned')),
              h('div', {}, h('b', {}, `${pf.streak} days`), h('span', {}, 'learning streak'))),
            earnedNames.length ? h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'eyebrow' }, p.me ? 'Your badges' : 'Recent badges'), h('div', { class: 'ma-tags' }, earnedNames.slice(0, 6).map((n) => h('span', { class: 'ma-tag' }, n)))) : null,
            h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px' } },
              p.me ? h('button', { class: 'btn', onclick: () => { m.close(); setTab('badges'); } }, 'See all my badges') : null,
              h('button', { class: 'btn primary', onclick: showPortfolio, html: icon('github') + '<span>View portfolio</span>' })));
        };
        const showPortfolio = () => {
          content.textContent = '';
          const who = p.me ? S : demoOf(p.id);
          const caps = who ? projectsOf(who, fx, p.me) : [
            { t: D.common.capstone.title, co: D.common.company, st: skillsOf(D.common.capstone.stack, 3), tag: 'Capstone 1' },
            { t: fx.capstones[0].title, co: fx.company, st: skillsOf(fx.capstones[0].stack, 3), tag: 'Capstone 2' },
            fx.standalone && fx.standalone[0] ? { t: fx.standalone[0].title, co: fx.company, st: [`Month ${fx.standalone[0].month}`], tag: 'Monthly project' } : null,
          ].filter(Boolean);
          const site = `https://${pf.handle}.github.io`;
          content.append(
            h('div', { class: 'ma-modal-head' }, h('div', {}, h('h3', {}, `${p.me ? 'Your' : p.name.split(' ')[0] + '’s'} portfolio`), h('div', { class: 'tiny muted' }, 'Built automatically from their GitHub projects')), h('span', { class: 'pill amber' }, 'Demo')),
            h('div', { class: 'ma-browser' },
              h('div', { class: 'ma-bbar' }, h('span', { class: 'ma-dots', html: '<i></i><i></i><i></i>' }), h('span', { class: 'ma-url', title: site, html: icon('lock') + esc(site) })),
              h('div', { class: 'ma-site' },
                h('div', { class: 'ma-site-hero' }, av(p, 'lg'), h('div', {}, h('b', {}, p.name), h('div', { class: 'tiny muted' }, `${fx.name} · ${PROGRAM}`), h('div', { class: 'tiny muted' }, `github.com/${pf.handle} · ${pf.certs} verified certificate${pf.certs === 1 ? '' : 's'}`))),
                h('div', { class: 'eyebrow' }, 'Projects'),
                h('div', { class: 'ma-site-grid' }, caps.map((x) => h('div', { class: 'ma-site-card' },
                  h('span', { class: 'pill blue', style: { justifySelf: 'start' } }, x.tag), h('b', {}, x.t), h('span', { class: 'tiny muted' }, `For ${x.co}`),
                  h('div', { class: 'ma-tags' }, x.st.map((s) => h('span', { class: 'ma-tag' }, s))),
                  h('span', { class: 'tiny', style: { color: x.wip ? 'var(--amber)' : 'var(--green)', fontWeight: 700 } }, x.wip ? 'In progress' : 'Automatic tests passing')))))),
            h('p', { class: 'tiny muted' }, 'Demo preview. In the real lab this site is rebuilt each time the student publishes a project.'),
            h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '8px' } },
              h('button', { class: 'btn', onclick: showProfile }, 'Back to profile'),
              h('div', { class: 'row', style: { gap: '8px' } },
                p.me && myCerts(f).length ? h('button', { class: 'btn', onclick: () => { const mc = myCerts(f); m.close(); ui.verifyInput = mc[mc.length - 1].id; setTab('verify'); L.panelFns.verify && L.panelFns.verify(ui.verifyInput); } }, 'Verify my certificate') : null,
                h('button', { class: 'btn primary', onclick: () => m.close() }, 'Close'))));
        };
        showProfile();
      }

      // ================= 2. Badges =================
      function renderBadges() {
        const filterSeg = h('div', { class: 'ma-seg', role: 'group', 'aria-label': 'Filter badges' });
        const FILTERS = { all: 'All', earned: 'Earned', progress: 'In progress', locked: 'Locked' };
        Object.entries(FILTERS).forEach(([k, label]) => filterSeg.append(h('button', { 'data-filter': k, onclick: () => { ui.badgeFilter = k; paint(); } }, label)));
        const count = h('span', { class: 'small muted' });
        const bar = h('i');
        const grid = h('div', { class: 'ma-badges' });
        const empty = h('div', { class: 'empty', hidden: true }, 'No badges here yet.');
        panel.append(h('section', { class: 'card stack' },
          h('div', { class: 'ma-bhead' }, h('div', {}, h('h3', {}, 'Badges'), count), filterSeg),
          h('div', { class: 'progress green' }, bar),
          grid, empty,
          h('div', { class: 'callout small' },
            h('b', {}, 'Badges unlock by themselves. '),
            'Do something in the lab and the matching badge updates here, with a notification under the bell. Try it:',
            h('div', { class: 'row', style: { marginTop: '10px', gap: '8px' } },
              h('button', { class: 'btn sm', onclick: () => c.go('practical') }, 'Submit a practical'),
              h('button', { class: 'btn sm', onclick: () => c.go('lecture') }, 'Answer a lecture question'),
              h('button', { class: 'btn sm', onclick: () => c.go('forum') }, 'Ask in the forum'),
              h('button', { class: 'btn sm', onclick: () => c.go('exam') }, 'Take the assessment')))));

        function statusLine(b) {
          const st = bs[b.id], s = statusOf(b);
          if (s === 'earned') return h('span', { class: 'st', style: { color: 'var(--green)', fontWeight: 700 } }, st.earned === 'Today' ? 'Earned today' : `Earned ${st.earned}`);
          if (s === 'locked') return h('span', { class: 'st' }, `Opens in Month ${b.opens}`);
          return h('div', { class: 'stack', style: { gap: '4px', width: '100%' } },
            h('div', { class: 'progress' }, h('i', { style: { width: `${Math.round((st.progress / b.goal) * 100)}%` } })),
            h('span', { class: 'st' }, b.id === 'perfect-exam' ? `Best score ${st.progress} · needs 90` : `${st.progress} of ${b.goal}${b.unit ? ' ' + b.unit : ''}`));
        }
        function paint() {
          filterSeg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === ui.badgeFilter)));
          const n = earnedCount();
          count.textContent = `${n} of ${BADGES.length} earned · ${BADGES.filter((b) => statusOf(b) === 'progress').length} in progress`;
          bar.style.width = `${Math.round((n / BADGES.length) * 100)}%`;
          grid.textContent = '';
          const order = { earned: 0, progress: 1, locked: 2 };
          const items = BADGES.filter((b) => ui.badgeFilter === 'all' || statusOf(b) === ui.badgeFilter).sort((a, b) => order[statusOf(a)] - order[statusOf(b)]);
          items.forEach((b) => {
            const s = statusOf(b);
            grid.append(h('button', { class: `ma-badge ${s === 'progress' ? 'inprog' : s}${bs[b.id].fresh ? ' fresh' : ''}`, 'data-badge': b.id, 'aria-label': `${b.name}: ${s === 'earned' ? 'earned' : s === 'locked' ? 'locked' : 'in progress'}`, onclick: () => openBadge(b) },
              h('span', { class: 'cat' }, b.cat),
              medal(b, ''), h('span', { class: 'nm' }, b.name), statusLine(b)));
            bs[b.id].fresh = false;
          });
          empty.hidden = items.length > 0;
        }
        paint();
        L.panelFns.refresh = paint;
      }
      function medal(b, size) {
        const s = statusOf(b);
        const el = h('span', { class: `ma-medal ${s === 'progress' ? 'inprog' : s} ${size || ''}`, html: icon(b.icon) });
        if (s === 'locked') el.append(h('span', { class: 'lk', html: icon('lock') }));
        return el;
      }
      function openBadge(b) {
        const st = bs[b.id], s = statusOf(b);
        const content = h('div', { class: 'm-' + ID + ' ma-modal' });
        const m = c.modal(content);
        const routeLabel = { practical: 'Open practicals', lecture: 'Open the lecture', forum: 'Open the doubt forum', projects: 'Open my capstone', exam: 'Open the assessment' }[b.route];
        content.append(
          h('div', { class: 'ma-modal-head' }, h('span', { class: 'eyebrow' }, `${b.cat} badge`), closeBtn(m)),
          h('div', { class: 'ma-badge-detail' },
            medal(b, 'lg'),
            h('h2', {}, b.name),
            s === 'earned' ? h('span', { class: 'pill green' }, st.earned === 'Today' ? 'Earned today' : `Earned ${st.earned}`) : s === 'locked' ? h('span', { class: 'pill' }, `Locked · opens in Month ${b.opens}`) : h('span', { class: 'pill blue' }, 'In progress')),
          h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'eyebrow' }, 'What it means'), h('p', { class: 'small' }, b.what)),
          h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'eyebrow' }, 'How to earn it'), h('p', { class: 'small' }, b.how)),
          s === 'progress' ? h('div', { class: 'stack', style: { gap: '6px' } },
            h('div', { class: 'row small', style: { justifyContent: 'space-between' } }, h('span', { class: 'muted' }, 'Your progress'), h('b', { class: 'num' }, b.id === 'perfect-exam' ? `best ${st.progress} / 90` : `${st.progress} / ${b.goal}`)),
            h('div', { class: 'progress' }, h('i', { style: { width: `${Math.round((st.progress / b.goal) * 100)}%` } }))) : null,
          h('p', { class: 'tiny muted' }, s === 'earned' ? 'Shown on your profile and portfolio. Mentors see it in the mentor console.' : 'It unlocks automatically. You will get a notification under the bell.'),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px' } },
            s !== 'earned' && s !== 'locked' && routeLabel ? h('button', { class: 'btn', onclick: () => { m.close(); c.go(b.route); } }, routeLabel) : null,
            h('button', { class: 'btn primary', onclick: () => m.close() }, 'Done')));
      }

      // ================= 3. Certificates =================
      function paperEl(x, qrSize) {
        const qr = h('div', { class: 'ma-qr ' + (qrSize || '') });
        const el = h('div', { class: 'ma-paper' },
          h('div', {},
            h('div', { class: 'eyebrow' }, `${D.brand.org} · ${D.brand.name}`),
            h('div', { class: 'kind' }, x.kind),
            h('div', { class: 'to' }, 'Awarded to'),
            h('div', { class: 'nm' }, x.name),
            h('div', { class: 'ttl' }, x.title),
            h('div', { class: 'meta' },
              h('span', {}, 'Issued', h('b', {}, x.issued)),
              x.score != null ? h('span', {}, 'Mentor score', h('b', {}, `${x.score}/100`)) : null,
              h('span', {}, 'Certificate ID', h('b', { class: 'ma-mono' }, x.id)))),
          h('div', { class: 'ma-qrcol' }, qr, h('span', { class: 'tiny muted' }, 'Scan to verify')));
        drawQR(qr, x.url);
        return el;
      }
      function renderCerts() {
        const grid = h('div', { class: 'ma-certs' });
        panel.append(
          h('div', { class: 'callout small' }, h('b', {}, 'Every certificate can be checked. '), `Each one has a QR code and a public page on ${VERIFY_HOST}. An employer scans it and sees the record, the skills and the GitHub projects behind it.`),
          grid,
          h('p', { class: 'tiny muted' }, 'Demo certificates. Not real credentials.'));
        function paint() {
          grid.textContent = '';
          const list = myCerts(f);
          list.forEach((x) => {
            grid.append(h('article', { class: 'ma-cert', 'data-cert': x.key },
              paperEl(x),
              h('div', { class: 'ma-actions' },
                h('button', { class: 'btn sm primary', onclick: () => shareModal(x) }, 'Share on LinkedIn'),
                h('button', { class: 'btn sm', onclick: () => pdfModal(x) }, 'Download PDF'),
                h('button', { class: 'btn sm', onclick: () => copyText(x.url, 'Verification link copied') }, 'Copy verification link'),
                h('button', { class: 'btn sm ghost', onclick: () => { ui.verifyInput = x.id; setTab('verify'); L.panelFns.verify && L.panelFns.verify(x.id); } }, 'Verify'))));
          });
          if (!list.length) {
            grid.append(h('article', { class: 'ma-lockcert', 'data-cert': 'empty' },
              h('span', { class: 'pill amber' }, 'No certificates yet'),
              h('b', {}, `${S.name.split(' ')[0]}’s first certificates arrive after Month 3`),
              h('p', { class: 'small muted' }, `Months 1 to 3 are the common foundation. Passing the Month 3 assessment issues the Months 1–3 completion certificate, and the mentor’s approval of the Month 3 capstone milestone issues Capstone 1. Both get a QR code and a public verification page.`),
              h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn sm primary', onclick: () => c.go('exam') }, 'Open the Month 3 assessment'), h('button', { class: 'btn sm', onclick: () => c.go('projects') }, 'Open Capstone 1'))));
          }
          const nx = nextCert(f);
          if (nx && list.length) {
            grid.append(h('article', { class: 'ma-lockcert', 'data-cert': 'next-locked' },
              h('span', { class: 'pill' }, 'Next'),
              h('b', {}, nx.title),
              h('p', { class: 'small muted' }, nx.text),
              h('button', { class: 'btn sm', onclick: () => c.go('projects') }, 'Open my capstone')));
          }
        }
        paint();
        L.panelFns.refresh = paint;
      }
      function postText(x) {
        const repo = x.repos && x.repos[0] ? `\n\nCode: github.com/${x.gh}/${x.repos[0].name}` : '';
        return `I just earned my ${x.short} certificate in the ${PROGRAM} by ${D.brand.org}.\n\n${x.what}\n\nSkills: ${x.skills.slice(0, 5).join(', ')}.${repo}\n\nVerify it here: ${x.url}\n\n#AI #Learning #${f.short.replace(/[^A-Za-z]/g, '')}`;
      }
      function shareModal(x) {
        const ta = h('textarea', { class: 'field-input ma-post', 'aria-label': 'LinkedIn post text' });
        ta.value = postText(x);
        const content = h('div', { class: 'm-' + ID + ' ma-modal' });
        const m = c.modal(content);
        content.append(
          h('div', { class: 'ma-modal-head' }, h('div', {}, h('h3', {}, 'Share on LinkedIn'), h('div', { class: 'tiny muted' }, 'Edit the post if you like, then copy it.')), closeBtn(m)),
          ta,
          h('div', { class: 'note' }, 'In the real lab this button opens LinkedIn with the post and the certificate link filled in. The QR page shows the certificate as a preview card.'),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px' } },
            h('button', { class: 'btn', onclick: () => { ta.value = postText(x); c.toast('Post text reset', 'green'); } }, 'Reset text'),
            h('button', { class: 'btn primary', onclick: () => { copyText(ta.value, 'Post copied. Paste it into LinkedIn.'); } }, 'Copy post')));
      }
      function pdfModal(x) {
        const content = h('div', { class: 'm-' + ID + ' ma-modal' });
        const m = c.modal(content);
        const status = h('div', { class: 'small muted' }, `File: ${x.id}.pdf · A4 landscape · with QR code`);
        const dl = h('button', { class: 'btn primary', onclick: () => {
          dl.disabled = true; dl.textContent = '';
          dl.append(h('span', { class: 'spin' }), ' Preparing PDF');
          later(() => {
            dl.disabled = false; dl.textContent = 'Download again';
            status.textContent = '';
            status.append(h('b', { style: { color: 'var(--green)' } }, 'PDF ready. '), 'In the real lab your browser saves it now. The demo does not create files.');
            c.toast(`${x.id}.pdf prepared (demo)`, 'green');
          }, 900);
        } }, 'Download PDF');
        content.append(
          h('div', { class: 'ma-modal-head' }, h('div', {}, h('h3', {}, 'Download as PDF'), h('div', { class: 'tiny muted' }, 'Preview of the printed certificate')), closeBtn(m)),
          paperEl(x, 'lg'),
          h('div', { class: 'note' }, 'In the real lab this downloads a signed PDF. The QR code on the paper copy opens the same public verification page.'),
          status,
          h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px' } }, h('button', { class: 'btn', onclick: () => m.close() }, 'Close'), dl));
      }

      // ================= 4. Verify (public page) =================
      function renderVerify() {
        const url = h('span', { class: 'ma-url', html: icon('lock') + esc(`https://${VERIFY_HOST}`) });
        const input = h('input', { class: 'field-input', type: 'text', placeholder: `Certificate ID, for example ${S.batch}-${S.id}-C1`, 'aria-label': 'Certificate ID', autocomplete: 'off', spellcheck: 'false' });
        input.value = ui.verifyInput || '';
        input.addEventListener('input', () => { ui.verifyInput = input.value; });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(input.value); });
        const goBtn = h('button', { class: 'btn primary', onclick: () => run(input.value) }, 'Verify');
        const scanBtn = h('button', { class: 'btn', onclick: scanModal, html: icon('search') + '<span>Scan QR</span>' });
        const result = h('div', { 'aria-live': 'polite' });
        const mine = myCerts(f);
        const mate = classmates().filter((x) => (x.certificates || []).length).sort((a, b) => b.certificates.length - a.certificates.length)[0];
        const mateCert = mate ? mate.certificates[mate.certificates.length - 1] : null;
        const TRY = [
          mine.length ? [`${S.name.split(' ')[0]}’s latest`, mine[mine.length - 1].id] : null,
          mateCert ? [`Classmate ${mate.name.split(' ')[0]}`, `${mate.batch}-${mate.id}-${mateCert.slot}`] : null,
          ['Another student', 'NM-2027-A-S1006-C2'],
          ['A past graduate', 'NM-2026-B-S0412-C4'],
          ['A revoked certificate', 'NM-2026-X-S9999-C2'],
          ['A wrong ID', `${S.batch}-${S.id}-C9`],
        ].filter(Boolean);
        panel.append(
          h('p', { class: 'small muted' }, 'This is the public page an employer sees after scanning a certificate. No login is needed.'),
          h('div', { class: 'ma-browser' },
            h('div', { class: 'ma-bbar' }, h('span', { class: 'ma-dots', html: '<i></i><i></i><i></i>' }), url),
            h('div', { class: 'ma-vsite' },
              h('div', { class: 'ma-vbrand' }, h('span', { class: 'mk', html: icon('shield') }), h('div', {}, h('b', {}, `${D.brand.org} certificate check`), h('div', { class: 'tiny muted' }, 'Type the ID printed on the certificate, or scan its QR code.'))),
              h('div', { class: 'ma-vform' }, input, goBtn, scanBtn),
              h('div', { class: 'ma-try' }, h('span', { class: 'tiny muted' }, 'Try:'), TRY.map(([label, id]) => h('button', { class: 'ma-chip', 'data-try': id, onclick: () => { input.value = id; ui.verifyInput = id; run(id); } }, label))),
              result,
              h('div', { class: 'tiny muted' }, 'Demo page. Records are fictional.'))));

        function run(raw) {
          const id = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
          result.textContent = '';
          if (!id) { result.append(h('div', { class: 'note' }, 'Type a certificate ID first, or press Scan QR.')); input.focus(); return; }
          input.value = id; ui.verifyInput = id;
          goBtn.disabled = true; scanBtn.disabled = true;
          result.append(h('div', { class: 'row small muted' }, h('span', { class: 'spin', style: { color: 'var(--brand)' } }), 'Checking the certificate register…'));
          later(() => {
            goBtn.disabled = false; scanBtn.disabled = false;
            ui.verifyId = id;
            showResult(id);
          }, 700);
        }
        function showResult(id) {
          const rec = records(f)[id];
          result.textContent = '';
          url.innerHTML = icon('lock') + esc(`https://${VERIFY_HOST}/c/${id}`);
          if (!rec) {
            result.append(h('div', { class: 'ma-res bad' },
              h('div', { class: 'ma-res-head' }, h('span', { class: 'ic', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>' }),
                h('div', {}, h('h2', {}, 'Not found'), h('div', { class: 'small' }, h('span', { class: 'ma-mono' }, id), ' is not in the certificate register.'))),
              h('ul', { class: 'ma-guide' },
                h('li', {}, 'Check each character. IDs look like ', h('span', { class: 'ma-mono' }, `${S.batch}-${S.id}-C1`), ' (batch, student, certificate).'),
                h('li', {}, 'Scan the QR code on the certificate instead of typing. It opens the right page directly.'),
                h('li', {}, `Still not found? Treat the certificate as unverified and contact ${D.brand.org}.`)),
              h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { input.value = ''; ui.verifyInput = ''; input.focus(); result.textContent = ''; } }, 'Try another ID'), h('button', { class: 'btn sm', onclick: scanModal }, 'Scan QR instead'))));
            return;
          }
          if (rec.status === 'revoked') {
            result.append(h('div', { class: 'ma-res rev' },
              h('div', { class: 'ma-res-head' }, h('span', { class: 'ic', html: icon('lock') }),
                h('div', {}, h('h2', {}, 'Revoked'), h('div', { class: 'small' }, 'This certificate was issued but is no longer valid.'))),
              h('dl', { class: 'ma-dl' },
                dlItem('Certificate ID', h('span', { class: 'ma-mono' }, rec.id)), dlItem('Awarded to', rec.name),
                dlItem('Originally issued', rec.issued), dlItem('Revoked on', rec.revoked),
                dlItem('Certificate', `${rec.kind} · ${rec.title}`), dlItem('Issuer', D.brand.org)),
              h('div', { class: 'note' }, h('b', {}, 'Reason: '), rec.reason),
              h('p', { class: 'small' }, `Do not accept this certificate. If you think this is a mistake, contact ${D.brand.org}.`)));
            return;
          }
          result.append(h('div', { class: 'ma-res ok' },
            h('div', { class: 'ma-res-head' }, h('span', { class: 'ic', html: icon('check') }),
              h('div', {}, h('h2', {}, 'Verified'), h('div', { class: 'small' }, `This certificate is genuine. It was issued by ${D.brand.org}.`))),
            h('dl', { class: 'ma-dl' },
              dlItem('Awarded to', rec.name), dlItem('Program', `${PROGRAM} · batch ${rec.batch}`),
              dlItem('Certificate', `${rec.kind}: ${rec.title.replace(/^Capstone \d: /, '')}`), dlItem('Track', rec.track),
              dlItem('Issued', rec.issued), dlItem('Mentor who signed off', rec.mentor),
              dlItem('Issuer', D.brand.org), dlItem('Certificate ID', h('span', { class: 'ma-mono' }, rec.id))),
            h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'eyebrow' }, 'Skills shown in this work'), h('div', { class: 'ma-tags' }, rec.skills.map((s) => h('span', { class: 'ma-tag' }, s)))),
            h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'eyebrow' }, 'Linked GitHub projects'),
              h('div', { class: 'ma-repos' }, rec.repos.map((r) => h('button', { class: 'ma-repo', onclick: () => repoModal(rec, r), html: icon('github') },
                h('span', { class: 'tx' }, h('b', {}, `github.com/${rec.gh}/${r.name}`), h('span', {}, r.title)), h('span', { class: 'pill green' }, 'Tests pass'))))),
            h('div', { class: 'tiny muted' }, 'Checked just now against the live register. Records cannot be edited by students.')));
          c.emit('certificate:verified', { id: rec.id });
          if (rec.name === S.name && !verifiedOnce.has(rec.id)) {
            verifiedOnce.add(rec.id);
            c.notify('Someone checked your certificate', `Your ${rec.short || 'certificate'} certificate (${rec.id}) was verified on the public page.`, ID);
          }
        }
        function dlItem(k, v) { return h('div', {}, h('dt', {}, k), h('dd', {}, v)); }

        function scanModal() {
          const content = h('div', { class: 'm-' + ID + ' ma-modal' });
          const m = c.modal(content);
          const vf = h('div', { class: 'ma-vf' }, h('span', { class: 'cn a' }), h('span', { class: 'cn b' }), h('span', { class: 'cn c' }), h('span', { class: 'cn d' }), h('span', { class: 'hint' }, 'Camera preview. Pick a certificate below to hold up to the camera.'));
          const status = h('div', { class: 'small muted', style: { textAlign: 'center' } }, 'Waiting for a QR code…');
          const opts = [
            mine.length ? [`${S.name} · ${mine[mine.length - 1].short}`, mine[mine.length - 1].id] : mateCert ? [`${mate.name} · ${mateCert.slot === 'F' ? 'Months 1–3' : 'Capstone ' + mateCert.slot.slice(1)}`, `${mate.batch}-${mate.id}-${mateCert.slot}`] : ['Saanvi Pawar · Capstone 2', 'NM-2027-A-S1006-C2'],
            ['Saanvi Pawar · Capstone 2', 'NM-2027-A-S1006-C2'],
            ['Revoked example', 'NM-2026-X-S9999-C2'],
          ];
          const pick = h('div', { class: 'ma-scanpick' });
          let busy = false;
          opts.forEach(([label, id]) => {
            const q = h('div', { class: 'ma-qr' });
            const b = h('button', { 'aria-pressed': 'false', onclick: () => {
              if (busy) return; busy = true;
              pick.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
              vf.querySelectorAll('.hint,.ma-qr,.line').forEach((x) => x.remove());
              const big = h('div', { class: 'ma-qr' }); vf.append(big, h('span', { class: 'line' }));
              drawQR(big, `https://${VERIFY_HOST}/c/${id}`);
              status.textContent = 'Reading the code…';
              later(() => {
                status.textContent = '';
                status.append(h('b', { style: { color: 'var(--green)' } }, 'Found: '), h('span', { class: 'ma-mono' }, id));
                const ln = vf.querySelector('.line'); if (ln) ln.remove();
                later(() => { m.close(); input.value = id; ui.verifyInput = id; run(id); }, 600);
              }, 1300);
            } }, q, h('span', {}, label));
            drawQR(q, `https://${VERIFY_HOST}/c/${id}`);
            pick.append(b);
          });
          content.append(
            h('div', { class: 'ma-modal-head' }, h('div', {}, h('h3', {}, 'Scan a certificate QR'), h('div', { class: 'tiny muted' }, 'On a phone this uses the camera. Here it is simulated.')), closeBtn(m)),
            vf, status, pick);
        }

        L.panelFns.verify = (id) => { input.value = id; run(id); };
        L.panelFns.refresh = () => {};
        if (ui.verifyId && ui.verifyId === ui.verifyInput) showResult(ui.verifyId);
      }

      function repoModal(rec, r) {
        const content = h('div', { class: 'm-' + ID + ' ma-modal' });
        const m = c.modal(content);
        const u = `https://github.com/${rec.gh}/${r.name}`;
        content.append(
          h('div', { class: 'ma-modal-head' }, h('div', {}, h('h3', {}, r.title), h('div', { class: 'tiny muted' }, `Public repository of ${rec.name}`)), h('span', { class: 'pill amber' }, 'Demo')),
          h('div', { class: 'ma-browser' },
            h('div', { class: 'ma-bbar' }, h('span', { class: 'ma-dots', html: '<i></i><i></i><i></i>' }), h('span', { class: 'ma-url', title: u, html: icon('lock') + esc(u) })),
            h('div', { class: 'ma-site' },
              h('div', { class: 'eyebrow' }, 'README.md'),
              h('b', {}, r.title),
              h('p', { class: 'small' }, r.desc),
              h('div', { class: 'ma-tags' }, (r.stack || []).map((s) => h('span', { class: 'ma-tag' }, s))),
              h('div', {},
                h('div', { class: 'check pass' }, h('span', { class: 'ic' }, '✓'), h('span', {}, 'Automatic acceptance tests pass')),
                h('div', { class: 'check pass' }, h('span', { class: 'ic' }, '✓'), h('span', {}, `Reviewed and approved by mentor ${rec.mentor}`)),
                h('div', { class: 'check pass' }, h('span', { class: 'ic' }, '✓'), h('span', {}, 'Linked to a verified certificate'))))),
          h('p', { class: 'tiny muted' }, 'Demo preview. The real link opens the student’s repository on GitHub.'),
          h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn primary', onclick: () => m.close() }, 'Close')));
      }

      // ----- live updates -----
      L.refresh = () => {
        paintStats();
        if (L.panelFns.refresh) L.panelFns.refresh();
      };
      L.offs.push(c.on('xp', (p) => {
        paintStats();
        const st = stats.querySelector('[data-k="xp"]');
        if (st) { st.classList.remove('bump'); void st.offsetWidth; st.classList.add('bump'); }
        if (L.panelFns.onXP) L.panelFns.onXP((p && p.gained) || 0);
      }));

      paintStats();
      // Deep link from Projects: "Verify this certificate" opens the verify tab with that certificate checked.
      const deepCert = NM.state.verifyCertificate; NM.state.verifyCertificate = null;
      if (deepCert) { ui.tab = 'verify'; ui.verifyInput = deepCert; }
      setTab(ui.tab);
      if (deepCert && L.panelFns.verify) L.panelFns.verify(deepCert);
    },
  });
})();
