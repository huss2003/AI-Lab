/* Admin console: the lab operator's view for NeuroNetworks AI Ed (3,000 demo students in 10 batches).
   Six tabs: Overview, Batches and students, Content, Exam builder, Cost and limits, Audit log.
   Every number is demo data. Demo state lives in the module-level S object, so it survives navigation and field switches. */
(function () {
  const D = () => window.NM_DATA;
  const ADMIN = 'Meera Iyer';
  const DAY = 864e5, MIN = 6e4;
  let C = null;           // ctx while the console is on screen
  let ROOT = null;        // .m-admin wrapper while on screen
  let ticker = null, jobTimer = null;
  const timeouts = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timeouts.delete(t); fn(); }, ms); timeouts.add(t); return t; };

  /* ---------- helpers ---------- */
  function rng(seed) {
    let a = 0; for (const ch of String(seed)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) | 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = (n) => Math.round(n).toLocaleString('en-IN');
  const lakh = (x) => `₹${x.toFixed(2)} L`;
  const two = (n) => String(n).padStart(2, '0');
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const fmtDay = (ts) => new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = (ts) => { const d = new Date(ts); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
  const fmtDT = (ts) => `${fmtDate(ts)}, ${fmtTime(ts)}`;
  function rel(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 0) { const dd = Math.max(1, Math.round(-s / 86400)); return dd === 1 ? "tomorrow" : `in ${dd} days`; }
    if (s < 90) return 'Just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`; const dd = Math.round(s / 86400); return dd === 1 ? 'Yesterday' : `${dd} days ago`;
  }
  const isoDay = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const svgEl = (markup) => { const d = document.createElement('div'); d.className = 'svgbox'; d.innerHTML = markup; return d; };

  /* ---------- demo data: batches ---------- */
  const FIELD_WEIGHT = { fullstack_software: 14, web_dev: 12, data_analytics: 13, business_analysis: 8, cloud: 10, cybersecurity: 12, data_science: 10, devops: 7, ai_ml: 14 };
  const BATCH_DEF = [
    // letter, students, course month, lead mentor, active this week %, under 18, pending consents [name, age]
    ['A', 312, 8, 'Rohan Patil', 91, 41, [['Riya Deshmukh', 16], ['Kabir Shaikh', 17]]],
    ['B', 305, 8, 'Ananya Rao', 88, 37, []],
    ['C', 298, 8, 'Vikram Joshi', 90, 44, []],
    ['D', 301, 8, 'Farah Khan', 86, 39, [['Tanvi Jadhav', 17]]],
    ['E', 296, 6, 'Sameer Gokhale', 89, 52, []],
    ['F', 310, 6, 'Pooja Nair', 87, 48, [['Omkar Shinde', 16], ['Zoya Mirza', 17]]],
    ['G', 289, 6, 'Arjun Mehta', 92, 45, []],
    ['H', 302, 3, 'Nikita Bhosale', 93, 71, [['Pranav Kale', 16], ['Sakshi More', 16], ['Aditya Chavan', 17], ['Mahi Thakur', 16], ['Yash Pawar', 17]]],
    ['I', 294, 3, 'Imran Sayyed', 90, 68, [['Neel Gaikwad', 16], ['Rutuja Salunkhe', 17], ['Faiz Ansari', 16], ['Ira Kapoor', 17]]],
    ['J', 293, 3, 'Devika Menon', 89, 66, [['Siddhi Bhat', 16], ['Varun Naik', 17], ['Aisha Qureshi', 16]]],
  ];
  function splitFields(id, total) {
    const r = rng('split' + id); const fields = D().fields;
    const w = fields.map((f) => (FIELD_WEIGHT[f.id] || 10) * (0.75 + r() * 0.5));
    const sum = w.reduce((a, b) => a + b, 0);
    const raw = w.map((x) => x / sum * total); const out = raw.map(Math.floor);
    let left = total - out.reduce((a, b) => a + b, 0);
    raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i] += 1; left -= 1; } });
    const map = {}; fields.forEach((f, i) => { map[f.id] = out[i]; }); return map;
  }
  function makeBatches() {
    return BATCH_DEF.map(([L, n, month, mentor, active, u18, pend]) => {
      const id = 'NM-2027-' + L; const r = rng('ph' + id);
      return {
        id, letter: L, students: n, month, mentor, active, u18,
        attendance: 82 + Math.round(r() * 10), practicals: 78 + Math.round(r() * 14),
        fields: splitFields(id, n),
        pending: pend.map(([name, age], i) => ({ name, age, phone: `+91 9${Math.floor(r() * 9)}•• ••• ${100 + Math.floor(r() * 899)}`, sent: i === 0 && L === 'H' ? Date.now() - 2 * DAY : null })),
      };
    });
  }

  /* ---------- demo data: audit seeds ---------- */
  function seedAudit() {
    const lec = (id) => D().lectures.find((l) => l.id === id) || { topic: 'Lecture', practical: 'Practical' };
    const now = Date.now();
    const rows = [
      [14, 'Rohan Patil', 'mentor', 'grade', 'Grade overridden', 'Capstone C3, Month 8 milestone for Sana Qureshi (NM-2027-A): 58 to 64. Reason: the test file was in the wrong folder; all tests pass after a re-check.'],
      [38, ADMIN, 'admin', 'consent', 'Consent recorded', 'Parent consent received by e-sign for Aditi Pawar (17), NM-2027-H. Lab access switched on.'],
      [65, 'Automatic', 'system', 'key', 'Lab AI keys rotated', 'Scheduled monthly rotation of 3,000 student lab keys. Old keys stopped working at 09:00. No student action needed.'],
      [112, 'Ananya Rao', 'mentor', 'exam', 'Viva requested', 'Month 7 assessment, Harsh Vora (NM-2027-B): 6 tab switches. A 10-minute viva is booked for Monday.'],
      [175, ADMIN, 'admin', 'content', 'Lecture video replaced', `Lecture 64 "${lec(64).topic}" is now version 2: audio fixed at 12:40. English and Hindi captions regenerated.`],
      [242, 'Vikram Joshi', 'mentor', 'grade', 'Grade overridden', `Practical "${lec(62).practical}" for Kunal Shah (NM-2027-C): 70 to 80. Reason: the auto-check timed out on a slow network; a re-run passes.`],
      [26 * 60, ADMIN, 'admin', 'exam', 'Exam published', 'Month 3 assessment for NM-2027-H to J (889 students): 25 questions, 30 minutes, lockdown on.'],
      [27 * 60 + 20, 'Automatic', 'system', 'limits', 'Idle shutdown applied', '214 workspaces stopped after 20 minutes idle overnight. About 160 server hours saved.'],
      [29 * 60, 'Farah Khan', 'mentor', 'consent', 'Consent recorded', 'Parent consent received for Dev Malhotra (16), NM-2027-E, after a phone call with his mother.'],
      [2 * 1440 + 30, ADMIN, 'admin', 'key', 'Mentor key rotated', 'Rotated the review key for mentor Imran Sayyed after he changed laptops.'],
      [2 * 1440 + 95, ADMIN, 'admin', 'students', 'Invites queued', '25 invites to NM-2027-J. 24 have joined so far.'],
      [3 * 1440 + 50, 'Sameer Gokhale', 'mentor', 'exam', 'Re-test booked', 'Month 5 assessment, Nisha Rane (NM-2027-E): fresh question set on Saturday after a power cut.'],
      [4 * 1440 + 15, ADMIN, 'admin', 'limits', 'Lab limits changed', 'AI budget per student raised from ₹100 to ₹120 a month after the Month 7 tutor usage review.'],
      [5 * 1440 + 10, 'Automatic', 'system', 'exam', 'Exam closed', 'Month 7 assessment closed: 1,184 of 1,216 submitted. 37 papers flagged for a mentor to look at.'],
      [6 * 1440 + 200, 'Pooja Nair', 'mentor', 'grade', 'Grade overridden', 'Month 6 project for Rehan Bhatt (NM-2027-F): 55 to 61 after the student added the missing README section.'],
      [7 * 1440 + 40, ADMIN, 'admin', 'exam', 'Exam published', 'Month 7 assessment for NM-2027-A to D (1,216 students): 25 questions, 30 minutes, lockdown on.'],
      [8 * 1440 + 300, 'Arjun Mehta', 'mentor', 'consent', 'Consent recorded', 'Parent consent received for Meher Sethi (16), NM-2027-G, from the school help desk form.'],
      [9 * 1440 + 120, ADMIN, 'admin', 'content', 'Captions corrected', `Lecture 58 Hindi captions: 6 technical terms fixed by a reviewer.`],
    ];
    return rows.map(([m, actor, role, type, action, detail], i) => ({ id: 'AUD-' + (48120 - i), ts: now - m * MIN, actor, role, type, action, detail }));
  }

  /* ---------- demo data: video library ---------- */
  const WEEK33 = new Date(2026, 10, 2).getTime(); // Monday of week 33 in the demo calendar
  const releaseTs = (l) => WEEK33 + (l.week - 33) * 7 * DAY + (l.id % 2 ? 1 : 4) * DAY + 10 * 3600e3;
  function makeVideos() {
    const V = {};
    D().lectures.forEach((l) => {
      const r = rng('v' + l.id);
      V[l.id] = { status: l.id <= 66 ? 'published' : l.id === 67 ? 'processing' : 'scheduled', version: l.id <= 66 && r() < 0.18 ? 2 : 1, mcqs: 4, mins: 36 + Math.floor(r() * 9) };
    });
    V[64].version = 2;
    return V;
  }

  /* ---------- exam question bank (3 samples per month) ---------- */
  const QB = {
    1: [['mcq', 'Which of these is an example of machine learning?', ['A spam filter that gets better from labelled emails', 'A calculator adding two numbers', 'A fixed if-else rule written by hand', 'A printed bus timetable']],
      ['mcq', 'Generative AI is best described as AI that…', ['Creates new text, images or code from patterns it learned', 'Only sorts files into folders', 'Needs no data to work', 'Always gives the same answer']],
      ['mcq', 'What does a training dataset do?', ['Gives the model examples to learn patterns from', 'Stores the answers for the exam', 'Makes the laptop faster', 'Locks the model with a password']]],
    2: [['mcq', 'What does len([3, 5, 7]) return in Python?', ['3', '15', '7', 'An error']],
      ['mcq', 'Which keyword starts a function in Python?', ['def', 'func', 'function', 'start']],
      ['code', 'Write average(nums) that returns the mean of a list of numbers, and 0 for an empty list.', 'def average(nums):\n    # your code here\n    pass']],
    3: [['mcq', 'In a chat API call, what is the system prompt for?', ["Setting the assistant's role and rules for the whole chat", "Storing the user's password", 'Choosing the internet speed', 'Counting the words']],
      ['mcq', 'Why use a low temperature when pulling data out of text?', ['Answers become more consistent', 'Answers become longer', 'The call becomes free', 'The model can read images']],
      ['code', 'Call the Claude API with a system prompt so it replies only with JSON {"name", "city"}, then parse the reply.', 'import json\n\ndef extract(client, text):\n    # build the messages and call the model\n    pass']],
    4: [['mcq', 'Which HTTP method should create a new record?', ['POST', 'GET', 'HEAD', 'OPTIONS']],
      ['mcq', 'Where should an API key live in a web app?', ['On the server, in an environment variable', "In the page's JavaScript", 'In the web address', 'In a cookie the page can read']],
      ['code', (f) => `Write a route GET /api/orders that returns ${f.company}'s orders as JSON, newest first.`, "app.get('/api/orders', async (req, res) => {\n  // your code here\n});"]],
    5: [['mcq', 'What does docker ps show?', ['Running containers', 'Every image on the internet', 'Free disk space', 'Open browser tabs']],
      ['mcq', 'Which command shows the last 20 lines of app.log?', ['tail -n 20 app.log', 'head -n 20 app.log', 'cat -20 app.log', 'ls -20 app.log']],
      ['code', 'Write a Dockerfile for a Python app: install requirements.txt, then run app.py.', 'FROM python:3.12-slim\n# your lines here']],
    6: [['mcq', 'In retrieval (RAG), what happens before the model answers?', ['Matching passages are found and added to the prompt', 'The model is retrained', 'The question is turned into code', 'The whole internet is searched']],
      ['mcq', 'Why split long documents into chunks?', ['So search finds the exact part that answers the question', 'To make files smaller on disk', 'Because models cannot read English', 'To hide data from the model']],
      ['code', (f) => `Return the 3 chunks from ${f.company}'s help articles that are most similar to the question (cosine similarity).`, 'def top_chunks(question_vec, chunks, k=3):\n    # chunks: list of (text, vector)\n    pass']],
    7: [['mcq', 'What does an MCP server give an AI assistant?', ['Tools and data it can use in a standard way', 'A faster internet connection', 'A brand-new language model', 'A login page']],
      ['mcq', 'Which part of an MCP tool helps the model decide when to use it?', ['Its description', 'Its file size', 'Its colour', 'Its version number']],
      ['code', (f) => `Define an MCP tool get_ticket(id) that returns one support ticket from ${f.company}'s data.`, '@server.tool()\ndef get_ticket(id: str) -> dict:\n    """Describe the tool here."""\n    pass']],
    8: [['mcq', 'In an automation flow, what starts a run?', ['A trigger', 'A Router', 'A Loop', 'A Delay']],
      ['mcq', 'A Router sends every item to the fallback branch. What is the likely cause?', ['The condition compares the text "true" with a true/false value', 'The flow has too many steps', 'The trigger is paused', 'The internet is slow']],
      ['code', (f) => `Write the Code step for ${f.company}: return { is_urgent: true } when a message mentions "refund" or "outage".`, 'export const code = async (inputs) => {\n  // inputs.message\n};']],
    9: [['mcq', 'What makes an agent different from a single prompt?', ['It plans, calls tools and checks results in a loop', 'It never makes mistakes', 'It works without a model', 'It only answers yes or no']],
      ['mcq', 'Why give an agent a step limit?', ['To stop runaway loops and cost', 'To make answers longer', 'To use more tools', 'To skip testing']],
      ['code', 'Finish the loop: stop when the model gives a final answer or after 5 steps.', 'for step in range(5):\n    reply = call_model(history)\n    # your code here']],
    10: [['mcq', 'What does retry with backoff do?', ['Waits a little longer before each new attempt', 'Retries instantly forever', 'Deletes failed requests', 'Turns off logging']],
      ['mcq', 'Which number shows slow responses for a few users?', ['95th percentile (p95) response time', 'Average CPU use', 'Total sign-ups', 'Days without downtime']],
      ['code', 'Add retry with exponential backoff (up to 3 tries) around call_model().', 'import time\n\ndef safe_call(prompt):\n    # your code here\n    pass']],
    11: [['mcq', 'What is prompt injection?', ["Hidden instructions in input that try to override the app's rules", 'A faster way to send prompts', 'A way to train models', 'A kind of password']],
      ['mcq', 'When should personal data be masked?', ['Before it is sent to the model', 'After the model replies', 'Never', 'Only for paid users']],
      ['code', 'Write mask(text) that hides email addresses and 10-digit phone numbers.', 'import re\n\ndef mask(text):\n    # your code here\n    pass']],
    12: [['mcq', 'What should a capstone README say first?', ['What problem it solves and how to run it', "The author's hobbies", 'The full source code', 'Every library version']],
      ['mcq', 'Which best shows a capstone is reliable?', ['Passing tests and monitoring results', 'A colourful logo', 'A long demo video', 'Many commits on the last day']],
      ['code', 'Write a /health endpoint that returns status "ok" and the app version.', '@app.get("/health")\ndef health():\n    # your code here\n    pass']],
  };
  const pool = (m) => ({ mcq: 80 + m * 10, code: m === 1 ? 0 : 8 + m * 3 });

  /* ---------- cost model (transparent, demo) ---------- */
  const COST_DEF = { hours: 12, idle: 20, ai: 120 };
  function model(o, spike) {
    const base = (idle) => 1.48 * (0.6 + 0.4 * o.hours / 12) * (0.9 + 0.1 * idle / 20) * (spike ? 1.27 : 1);
    let idle = o.idle, servers = base(idle), trimmed = false;
    if (spike && S.cost.autotrim && servers >= 0.9 * 2.0 && idle > 10) { idle = 10; servers = base(10); trimmed = true; }
    const ai = 0.69 * (0.5 + 0.5 * o.ai / 120);
    const test = 0.15;
    const total = servers + ai + test;
    return { servers, ai, test, total, perStudent: total * 1e5 / 3000, pct: servers / 2.0 * 100, idle, trimmed };
  }
  const HISTORY = [[1.32, 0.58], [1.40, 0.63], [1.45, 0.67], [1.47, 0.69], [1.46, 0.68]];

  /* ---------- module state (survives navigation) ---------- */
  const S = {
    tab: 'overview',
    live: { online: 676, workspaces: 208, checked: 4118, ai: 11842 },
    batches: null, audit: null, videos: null,
    batchUI: { inviteBatch: 'NM-2027-C', inviteText: '', checked: null },
    invites: [],
    content: { q: '', month: 'all', status: 'all', page: 0 },
    exam: {
      draft: { month: 8, n: 25, duration: 30, codePct: 20, shuffle: true, lockdown: true, date: '', time: '10:00', previewed: false },
      integrity: { tabLimit: 3, copyBlock: true, autosave: 20, fullscreen: true },
      scheduled: [],
    },
    cost: { hours: 12, idle: 20, ai: 120, saved: { hours: 12, idle: 20, ai: 120 }, autotrim: true, spike: false, alerted: false },
    auditUI: { type: 'all', role: 'all', q: '' },
  };
  const JOBS = {};
  function ensure() {
    if (S.batches) return;
    S.batches = makeBatches(); S.audit = seedAudit(); S.videos = makeVideos();
    const now = new Date(); const at10 = (d) => { const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 10, 0); return x.getTime(); };
    S.exam.scheduled = [
      { id: 'EX-3', title: 'Month 3 assessment', month: 3, batches: 'NM-2027-H to J', students: 889, n: 25, mcq: 20, code: 5, duration: 30, ts: at10(5), status: 'scheduled', shuffle: true, lockdown: true },
      { id: 'EX-2', title: 'Month 7 assessment', month: 7, batches: 'NM-2027-A to D', students: 1216, n: 25, mcq: 20, code: 5, duration: 30, ts: at10(-5), status: 'finished', submitted: 1184, shuffle: true, lockdown: true },
      { id: 'EX-1', title: 'Month 5 assessment', month: 5, batches: 'NM-2027-E to G', students: 895, n: 25, mcq: 20, code: 5, duration: 30, ts: at10(-12), status: 'finished', submitted: 871, shuffle: true, lockdown: true },
    ];
    S.exam.draft.date = isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14));
    JOBS[67] = { id: 67, stage: 1, sub: 3, slow: true, hindi: true, file: 'L67-router-branches-v1.mp4', bg: true };
  }

  function log(type, action, detail, actor, role) {
    S.audit.unshift({ id: 'AUD-' + (48121 + S.audit.length), ts: Date.now(), actor: actor || ADMIN, role: role || 'admin', type, action, detail, fresh: true });
  }

  /* ---------- events from the rest of the demo (subscribed once) ---------- */
  if (window.NM && NM.on) {
    NM.on('practical:submitted', () => { if (S.live) S.live.checked += 1; });
    NM.on('tutor:asked', () => { if (S.live) S.live.ai += 1; });
    NM.on('milestone:reviewed', (p) => {
      ensure();
      const dec = p && p.decision === 'approved' ? 'approved' : 'sent back for changes';
      log('grade', 'Capstone milestone reviewed', `Aarav Kulkarni (NM-2027-A), capstone milestone ${dec}${p && p.score != null ? ` with ${p.score} points` : ''}.`, (p && p.mentor) || 'Rohan Patil', 'mentor');
    });
  }

  /* ---------- styles ---------- */
  function css() {
    if (document.getElementById('m-admin')) return;
    const st = document.createElement('style'); st.id = 'm-admin';
    st.textContent = `
.m-admin { display: grid; gap: 18px; min-width: 0 }
.m-admin .head { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap }
.m-admin .head > div { min-width: 0 }
.m-admin .head p { margin-top: 4px }
.m-admin .panel { display: grid; gap: 16px; min-width: 0 }
.m-admin .svgbox { min-width: 0 }
.m-admin .svgbox svg { display: block; width: 100%; height: auto }
.m-admin .tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px }
.m-admin .tile { text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; display: grid; gap: 4px; cursor: pointer; color: var(--fg); min-width: 0 }
.m-admin .tile:hover { border-color: var(--brand) }
.m-admin .tile .lab { font-size: 12.5px; color: var(--muted); font-weight: 600 }
.m-admin .tile b { font-family: var(--display); font-size: 24px; font-variant-numeric: tabular-nums; line-height: 1.2 }
.m-admin .tile b small { font-size: 13px; color: var(--muted); font-weight: 600; font-family: var(--body) }
.m-admin .tile .sub { font-size: 12px; color: var(--muted); overflow-wrap: anywhere }
.m-admin .tile .progress { height: 5px; margin-top: 2px }
.m-admin .livepill .dot { animation: m-admin-pulse 1.6s ease-in-out infinite }
@keyframes m-admin-pulse { 50% { opacity: .3 } }
.m-admin .ov2 { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 16px; align-items: start }
.m-admin .act .b { fill: var(--brand); opacity: .38 }
.m-admin .act .b.now { opacity: 1 }
.m-admin .act .b.peak { opacity: .6 }
.m-admin svg .gl { stroke: var(--line); stroke-width: 1 }
.m-admin svg .ax { fill: var(--muted); font-size: 11px; font-family: var(--body) }
.m-admin svg .axb { fill: var(--fg); font-size: 12px; font-weight: 700; font-family: var(--body) }
.m-admin .svc { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12.5px; color: var(--muted) }
.m-admin .svc span { display: inline-flex; align-items: center; gap: 6px }
.m-admin .svc .dot { color: var(--green) }
.m-admin .alerts { display: grid; gap: 8px }
.m-admin .alert { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 10px; align-items: start; text-align: left; width: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px; cursor: pointer; color: var(--fg) }
.m-admin .alert:hover { border-color: var(--brand) }
.m-admin .alert > i { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; background: var(--brand) }
.m-admin .alert.red > i { background: var(--red) } .m-admin .alert.amber > i { background: var(--amber) } .m-admin .alert.green > i { background: var(--green) }
.m-admin .alert b { display: block; font-size: 14px }
.m-admin .alert span { font-size: 12.5px; color: var(--muted) }
.m-admin .alert em { font-style: normal; font-size: 12px; font-weight: 700; color: var(--brand); white-space: nowrap; margin-top: 2px }
.m-admin .fbars { display: grid; gap: 7px }
.m-admin .fbar { display: grid; grid-template-columns: minmax(0, 130px) minmax(0, 1fr) 52px; gap: 10px; align-items: center; font-size: 13px }
.m-admin .fbar > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-admin .fbar .trk { height: 12px; background: var(--surface-2); border-radius: 99px; overflow: hidden }
.m-admin .fbar .trk i { display: block; height: 100%; background: var(--faint); border-radius: inherit; opacity: .55 }
.m-admin .fbar.cur { color: var(--brand); font-weight: 700 }
.m-admin .fbar.cur .trk i { background: var(--brand); opacity: 1 }
.m-admin .fbar .num { text-align: right }
.m-admin .bt2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start }
.m-admin td b.id, .m-admin td .nw { white-space: nowrap }
.m-admin table.wide { min-width: 680px }
.m-admin .bstats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px }
@media (max-width: 640px) { .m-admin .bstats { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
.m-admin table.wide-s { min-width: 540px }
.m-admin td .sub { display: block; font-size: 12px; color: var(--muted) }
.m-admin td.n, .m-admin th.n { text-align: right; font-variant-numeric: tabular-nums }
.m-admin tfoot td { font-weight: 800; background: var(--surface-2) }
.m-admin .chev { color: var(--brand); font-weight: 700; font-size: 13px; white-space: nowrap }
.m-admin textarea.field-input { min-height: 120px; resize: vertical; font-family: var(--mono); font-size: 13px }
.m-admin .vres { display: grid; gap: 6px }
.m-admin .vres li { font-size: 13px }
.m-admin ul.plain { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px }
.m-admin details.inv { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px 12px }
.m-admin details.inv summary { cursor: pointer; font-size: 13.5px; font-weight: 700; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap }
.m-admin details.inv ul { margin: 8px 0 2px; padding-left: 18px; font-size: 13px; color: var(--muted); overflow-wrap: anywhere }
.m-admin .filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center }
.m-admin .filters .field-input { width: auto; flex: 1 1 220px; min-width: 0 }
.m-admin .filters select.field-input { flex: 0 1 190px }
.m-admin .pager { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap }
.m-admin .lt { min-width: 220px }
.m-admin .lt b { display: block; font-size: 14px }
.m-admin .acts { display: flex; gap: 6px; flex-wrap: nowrap }
.m-admin .pools { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px }
.m-admin .poolc { text-align: left; border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius-sm); padding: 8px 10px; cursor: pointer; display: grid; gap: 2px; min-width: 0; color: var(--fg) }
.m-admin .poolc:hover { border-color: var(--brand) }
.m-admin .poolc[aria-pressed="true"] { border-color: var(--brand); background: var(--brand-soft) }
.m-admin .poolc b { font-size: 13px }
.m-admin .poolc span { font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-admin .form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px }
.m-admin .fld { display: grid; gap: 6px; min-width: 0; align-content: start }
.m-admin .fld > label, .m-admin .fld > .lbl { font-size: 13px; font-weight: 700 }
.m-admin .fld .hint { font-size: 12px; color: var(--muted) }
.m-admin .rng { display: flex; align-items: center; gap: 10px }
.m-admin .rng input { flex: 1; min-width: 0; accent-color: var(--brand) }
.m-admin .rng output { font-weight: 800; font-variant-numeric: tabular-nums; min-width: 64px; text-align: right; font-size: 14px }
.m-admin .seg { display: inline-flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; background: var(--surface); flex-wrap: wrap }
.m-admin .seg button { border: 0; background: none; padding: 7px 12px; font-weight: 700; font-size: 13px; color: var(--muted); cursor: pointer; border-right: 1px solid var(--line) }
.m-admin .seg button:last-child { border-right: 0 }
.m-admin .seg button[aria-pressed="true"] { background: var(--brand-soft); color: var(--brand) }
.m-admin .sw { position: relative; display: flex; gap: 10px; align-items: flex-start; cursor: pointer; min-width: 0 }
.m-admin .sw input { position: absolute; opacity: 0; width: 1px; height: 1px }
.m-admin .sw .knob { width: 38px; height: 22px; border-radius: 99px; background: var(--line); position: relative; flex: none; transition: background .2s }
.m-admin .sw .knob::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--surface); transition: transform .2s; box-shadow: var(--shadow) }
.m-admin .sw input:checked + .knob { background: var(--green) }
.m-admin .sw input:checked + .knob::after { transform: translateX(16px) }
.m-admin .sw input:focus-visible + .knob { outline: 2px solid var(--brand); outline-offset: 2px }
.m-admin .sw .swt { display: grid; gap: 1px; min-width: 0; font-size: 14px }
.m-admin .sw .swt b { font-size: 13.5px }
.m-admin .qs { display: grid; gap: 10px }
.m-admin .q { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; display: grid; gap: 8px; min-width: 0 }
.m-admin .q ol { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 4px }
.m-admin .q ol li { font-size: 13.5px; display: flex; gap: 8px; align-items: baseline }
.m-admin .q ol li i { font-style: normal; font-weight: 800; color: var(--muted); width: 16px; flex: none }
.m-admin .q ol li.ok { color: var(--green); font-weight: 700 }
.m-admin .q ol li.ok i { color: var(--green) }
.m-admin tr.fresh td { background: var(--green-soft) }
.m-admin tr.dim td { opacity: .55 }
.m-admin .cost-top { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px }
.m-admin .cost-top .card { padding: 14px 16px }
.m-admin .c2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 16px; align-items: start }
.m-admin .donut .s1 { stroke: var(--brand) } .m-admin .donut .s2 { stroke: var(--violet) } .m-admin .donut .s3 { stroke: var(--amber) } .m-admin .donut .bg { stroke: var(--surface-2) }
.m-admin .stk .s1 { fill: var(--brand) } .m-admin .stk .s2 { fill: var(--violet) } .m-admin .stk .s3 { fill: var(--amber) }
.m-admin .stk .proj { opacity: .5 }
.m-admin .stk .projbox { fill: none; stroke: var(--fg); stroke-dasharray: 4 3; stroke-width: 1.2 }
.m-admin .stk .bud { stroke: var(--red); stroke-width: 1.5; stroke-dasharray: 6 4 }
.m-admin .stk .budt { fill: var(--red); font-size: 11px; font-weight: 700; font-family: var(--body) }
.m-admin .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12.5px; color: var(--muted) }
.m-admin .legend span { display: inline-flex; align-items: center; gap: 6px }
.m-admin .legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; background: var(--brand) }
.m-admin .legend i.v { background: var(--violet) } .m-admin .legend i.a { background: var(--amber) } .m-admin .legend i.r { background: none; border-top: 2px dashed var(--red); border-radius: 0; height: 0; width: 14px }
.m-admin .gov { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 18px; align-items: start }
.m-admin .proj { display: grid; gap: 10px; background: var(--surface-2); border-radius: var(--radius-sm); padding: 14px }
.m-admin .proj .big { font-family: var(--display); font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums }
.m-admin .proj .rowx { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px }
.m-admin .proj .rowx span:last-child { font-variant-numeric: tabular-nums; font-weight: 700 }
.m-admin .formula { white-space: pre-wrap; font-size: 12px; overflow-wrap: anywhere }
.m-admin .budbar { position: relative; height: 12px; background: var(--surface); border-radius: 99px; overflow: visible; border: 1px solid var(--line) }
.m-admin .budbar > i { display: block; height: 100%; border-radius: 99px; background: var(--green); transition: width .4s ease }
.m-admin .budbar > i.amber { background: var(--amber) } .m-admin .budbar > i.red { background: var(--red) }
.m-admin .budbar > b { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--fg); left: 90% }
.m-admin .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px }
.m-admin .steps li { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 10px; font-size: 13.5px; align-items: start }
.m-admin .steps li > span { font-weight: 800; font-size: 12px; border-radius: 99px; padding: 3px 0; text-align: center }
.m-admin .au-t { white-space: nowrap; font-variant-numeric: tabular-nums; font-size: 13px }
.m-admin .au-d { min-width: 260px; font-size: 13px; color: var(--muted) }
.m-admin .au-d b { color: var(--fg); display: block; font-size: 14px }
.m-admin .csv { font-family: var(--mono); font-size: 12px; white-space: pre; overflow: auto; min-height: 220px; resize: vertical }
.m-admin .kv { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 6px 12px; font-size: 13.5px }
.m-admin .kv dt { color: var(--muted) } .m-admin .kv dd { margin: 0; overflow-wrap: anywhere }
.m-admin .foot { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap }
.m-admin .upl-file { display: grid; gap: 8px }
.m-admin .filepick { display: flex; gap: 10px; align-items: center; text-align: left; width: 100%; border: 1px dashed var(--line); background: var(--surface); border-radius: var(--radius-sm); padding: 10px 12px; cursor: pointer; color: var(--fg) }
.m-admin .filepick:hover, .m-admin .filepick[aria-pressed="true"] { border-color: var(--brand); border-style: solid; background: var(--brand-soft) }
.m-admin .filepick svg { width: 20px; height: 20px; color: var(--brand); flex: none }
.m-admin .filepick span { min-width: 0; overflow-wrap: anywhere; font-size: 13.5px }
.m-admin .err { color: var(--red); font-size: 13px; font-weight: 600 }
.m-admin-modal { gap: 14px }
.m-admin-modal h2 { overflow-wrap: anywhere }
@media (max-width: 1100px) {
  .m-admin .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)) }
  .m-admin .ov2, .m-admin .bt2, .m-admin .c2, .m-admin .gov { grid-template-columns: minmax(0, 1fr) }
  .m-admin .cost-top { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .m-admin .pools { grid-template-columns: repeat(4, minmax(0, 1fr)) }
}
@media (max-width: 640px) {
  .m-admin .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .m-admin .form { grid-template-columns: minmax(0, 1fr) }
  .m-admin .pools { grid-template-columns: repeat(3, minmax(0, 1fr)) }
  .m-admin .fbar { grid-template-columns: minmax(0, 92px) minmax(0, 1fr) 44px }
  .m-admin .kv { grid-template-columns: minmax(0, 1fr) }
  .m-admin .kv dt { margin-top: 4px }
  .m-admin .tile b { font-size: 20px }
}
@media (prefers-reduced-motion: reduce) { .m-admin .livepill .dot { animation: none } }
`;
    document.head.append(st);
  }

  /* ---------- small UI parts ---------- */
  function sw(h, label, checked, onchange, sub) {
    const inp = h('input', { type: 'checkbox', checked: checked || null, onchange: (e) => onchange(e.target.checked) });
    return h('label', { class: 'sw' }, inp, h('span', { class: 'knob', 'aria-hidden': 'true' }), h('span', { class: 'swt' }, h('b', {}, label), sub ? h('span', { class: 'tiny muted' }, sub) : null));
  }
  function rangeField(h, label, min, max, step, val, show, onInput, hint) {
    const out = h('output', {}, show(val));
    const inp = h('input', { type: 'range', min, max, step, value: val, 'aria-label': label, oninput: (e) => { const v = Number(e.target.value); out.textContent = show(v); onInput(v); } });
    return h('div', { class: 'fld' }, h('div', { class: 'lbl' }, label), h('div', { class: 'rng' }, inp, out), hint ? h('div', { class: 'hint' }, hint) : null);
  }
  function openModal(node, width) { const m = C.modal(h0('div', { class: 'm-admin m-admin-modal' }, node)); if (width) m.box.style.maxWidth = width; return m; }
  const h0 = (...a) => NM.h(...a);

  /* ---------- totals ---------- */
  const totalPending = () => S.batches.reduce((a, b) => a + b.pending.length, 0);
  const unsentPending = () => S.batches.reduce((a, b) => a + b.pending.filter((p) => !p.sent).length, 0);
  const fieldTotals = () => { const t = {}; D().fields.forEach((f) => { t[f.id] = 0; }); S.batches.forEach((b) => Object.entries(b.fields).forEach(([k, v]) => { t[k] += v; })); return t; };
  const monthBatches = (m) => S.batches.filter((b) => b.month === m);
  function batchRange(list) { if (!list.length) return 'First batch to reach this month'; if (list.length === 1) return list[0].id; return `${list[0].id} to ${list[list.length - 1].letter}`; }
  const nextExam = () => S.exam.scheduled.filter((e) => e.status === 'scheduled' && e.ts > Date.now()).sort((a, b) => a.ts - b.ts)[0];
  const costNow = () => model(S.cost, S.cost.spike);

  /* ============================================================ */
  NM.register('admin', {
    label: 'Admin console', title: 'Admin console', icon: 'settings', group: 'Admin', order: 65,

    render(root, c) {
      stopTimers();
      css(); ensure(); C = c;
      const { h } = c;
      ROOT = h('div', { class: 'm-admin' });
      root.append(ROOT);
      draw();
      ticker = setInterval(tick, 3000);
      jobTimer = setInterval(stepJobs, 160);
    },

    destroy() {
      stopTimers();
      Object.values(JOBS).filter((j) => !j.bg).forEach((j) => finishJob(j, true));
      Object.values(JOBS).forEach((j) => { j.onUpdate = null; });
      ROOT = null;
    },
  });

  function stopTimers() {
    if (ticker) clearInterval(ticker); if (jobTimer) clearInterval(jobTimer); ticker = jobTimer = null;
    timeouts.forEach((t) => clearTimeout(t)); timeouts.clear();
  }

  /* ---------- frame ---------- */
  const TABS = [['overview', 'Overview'], ['batches', 'Batches and students'], ['content', 'Content'], ['exam', 'Exam builder'], ['cost', 'Cost and limits'], ['audit', 'Audit log']];
  let refs = {};
  function draw() {
    if (!ROOT) return;
    const { h } = C;
    ROOT.textContent = ''; refs = {};
    ROOT.append(h('div', { class: 'head' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'NeuroNetworks AI Ed · Lab operations'),
        h('h1', {}, 'Admin console'),
        h('p', { class: 'muted small' }, `Run the lab for 3,000 students in ${S.batches.length} batches: people, content, exams, money and a record of every change.`)),
      h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'pill violet' }, `Signed in: ${ADMIN}, lab admin`), h('span', { class: 'pill' }, 'Demo data'))));
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Admin sections' });
    TABS.forEach(([id, label]) => tabs.append(h('button', { class: 'tab', role: 'tab', 'aria-selected': String(S.tab === id), onclick: () => openTab(id) }, label)));
    const panel = h('div', { class: 'panel', role: 'tabpanel' });
    ROOT.append(tabs, panel);
    const selTab = tabs.querySelector('[aria-selected="true"]');
    if (selTab && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = Math.max(0, selTab.offsetLeft - tabs.offsetLeft - 24);
    refs.panel = panel;
    ({ overview: drawOverview, batches: drawBatches, content: drawContent, exam: drawExam, cost: drawCost, audit: drawAudit })[S.tab](panel);
  }
  function openTab(id, opts) {
    S.tab = id; draw();
    if (opts && opts.then) opts.then();
    try { const tb = ROOT && ROOT.querySelector('.tabs'); if (tb) tb.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) {}
  }

  /* ---------- live ticking ---------- */
  function tick() {
    const L = S.live, r = Math.random;
    L.online = clamp(L.online + Math.round((r() - 0.5) * 18), 640, 720);
    L.workspaces = clamp(L.workspaces + Math.round((r() - 0.5) * 8), 190, 230);
    L.checked += Math.floor(r() * 7); L.ai += 3 + Math.floor(r() * 13);
    if (refs.tiles) {
      refs.tiles.online.textContent = fmt(L.online); refs.tiles.onlineBar.style.width = (L.online / 3000 * 100) + '%';
      refs.tiles.ws.textContent = fmt(L.workspaces); refs.tiles.checked.textContent = fmt(L.checked); refs.tiles.ai.textContent = fmt(L.ai);
    }
    if (refs.act) refs.act.innerHTML = activitySVG();
    if (refs.alerts) fillAlerts(refs.alerts);
  }

  /* ---------- background video jobs ---------- */
  const STAGES = [['Uploading the video file', 0], ['Making 360p, 720p and 1080p versions', 8], ['English captions', 6], ['Hindi captions (automatic)', 6], ['Re-linking the 4 in-video questions', 4]];
  let jobTick = 0;
  function stepJobs() {
    jobTick += 1;
    Object.values(JOBS).forEach((j) => {
      if (j.slow && jobTick % 18) return;
      if (j.stage === 0) { j.pct = Math.min(100, (j.pct || 0) + 9); if (j.pct >= 100) { j.stage = 1; j.sub = 0; } }
      else { j.sub += 1; const need = j.stage === 3 && !j.hindi ? 1 : STAGES[j.stage][1]; if (j.sub >= need) { j.stage += 1; j.sub = 0; } }
      if (j.stage >= STAGES.length) finishJob(j);
      else { if (j.onUpdate) j.onUpdate(); updateVideoCell(j.id); }
    });
  }
  function jobPct(j) {
    if (j.stage === 0) return Math.round((j.pct || 0) * 0.35);
    const weights = STAGES.slice(1).reduce((a, s) => a + s[1], 0);
    let done = 0; for (let i = 1; i < j.stage; i++) done += STAGES[i][1];
    return Math.round(35 + (done + j.sub) / weights * 65);
  }
  function finishJob(j, silent) {
    if (!JOBS[j.id]) return;
    delete JOBS[j.id];
    const v = S.videos[j.id]; const lec = D().lectures.find((l) => l.id === j.id);
    const released = releaseTs(lec) <= Date.now() || j.id <= 66;
    if (!j.bg) v.version += 1;
    v.status = released ? 'published' : 'scheduled';
    j.done = true;
    const what = released ? 'is live for students' : `is ready and goes live on ${fmtDay(releaseTs(lec))}`;
    if (j.bg) log('content', 'Lecture video ready', `Lecture ${lec.id} "${lec.topic}" finished processing. English and Hindi captions ready.`, 'Automatic', 'system');
    else log('content', 'Lecture video replaced', `Lecture ${lec.id} "${lec.topic}" is now version ${v.version} (${j.file}). Captions: English${j.hindi ? ' and Hindi (automatic)' : ' only'}.`);
    if (C) C.notify(`Lecture ${lec.id} video ${released ? 'published' : 'ready'}`, `Version ${v.version} ${what}. Captions in English${j.hindi ? ' and Hindi' : ''}.`, 'admin');
    if (C && !silent) C.toast(`Lecture ${lec.id} ${what}.`, 'green');
    if (j.onUpdate) j.onUpdate();
    updateVideoCell(j.id);
    if (refs.alerts) fillAlerts(refs.alerts);
  }

  /* ============================================================
     1. Overview
     ============================================================ */
  const PROFILE = [120, 60, 30, 20, 18, 30, 90, 210, 320, 380, 420, 450, 470, 430, 460, 520, 610, 690, 780, 880, 960, 910, 650, 330];
  function activitySVG() {
    const vals = []; for (let i = 0; i < 24; i++) vals.push(PROFILE[(18 + i) % 24]);
    vals[23] = S.live.online;
    const W = clamp(Math.round((refs.act && refs.act.clientWidth) || 600), 300, 720), H = W < 480 ? 170 : 190, pl = 36, pr = 8, pt = 10, pb = 26, max = 1000;
    const bw = (W - pl - pr) / 24, y = (v) => pt + (H - pt - pb) * (1 - v / max);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="act" role="img" aria-label="Students online each hour over the last 24 hours. Peak about 960 last night; ${S.live.online} now.">`;
    [0, 250, 500, 750, 1000].forEach((v) => { s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
    vals.forEach((v, i) => {
      const x = pl + i * bw + 2, top = y(v), cls = i === 23 ? 'b now' : v >= 900 ? 'b peak' : 'b';
      const ago = 23 - i; const lab = ago === 0 ? 'This hour' : `${ago} h ago`;
      s += `<rect class="${cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${(H - pb - top).toFixed(1)}" rx="2"><title>${lab}: ${v} students online</title></rect>`;
    });
    (W < 480 ? [[0, '24 h ago'], [12, '12 h ago']] : [[0, '24 h ago'], [6, '18 h ago'], [12, '12 h ago'], [18, '6 h ago']]).forEach(([i, t]) => { s += `<text class="ax" x="${pl + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${t}</text>`; });
    s += `<text class="axb" x="${W - pr}" y="${H - 8}" text-anchor="end">Now</text></svg>`;
    return s;
  }
  function alertsList() {
    const out = [];
    const pend = totalPending(), uns = unsentPending();
    if (pend) {
      const by = S.batches.filter((b) => b.pending.length).map((b) => `${b.letter}: ${b.pending.length}`).join(', ');
      out.push({ k: uns ? 'amber' : 'blue', t: uns ? `${pend} parental consents pending` : `${pend} consents pending, reminders sent`, b: `Under-18 students wait for a parent to agree before the lab opens. Batches ${by}.`, go: () => openTab('batches') });
    }
    Object.values(JOBS).forEach((j) => out.push({ k: 'blue', t: `Lecture ${j.id} video is processing (${jobPct(j)}%)`, b: 'Making video sizes and captions. Students see it on the release date.', go: () => { S.content.q = String(j.id); S.content.month = 'all'; S.content.status = 'all'; S.content.page = 0; openTab('content'); } }));
    if (!S.exam.scheduled.some((e) => e.month === 8 && e.status === 'scheduled')) {
      out.push({ k: 'red', t: 'Month 8 exam is not scheduled yet', b: `${batchRange(monthBatches(8))} (${fmt(monthBatches(8).reduce((a, b) => a + b.students, 0))} students) finish Month 8 in about 3 weeks.`, go: () => { S.exam.draft.month = 8; S.exam.draft.previewed = false; openTab('exam'); } });
    }
    const m = costNow();
    out.push({ k: m.pct >= 90 ? 'red' : m.pct >= 75 ? 'amber' : 'green', t: `Servers at ${Math.round(m.pct)}% of the monthly budget`, b: `Projected ${lakh(m.servers)} of ${lakh(2)} this month.${m.trimmed ? ' Auto-trim is on.' : m.pct < 75 ? ' No action needed.' : ''}`, go: () => openTab('cost') });
    const go = S.audit.filter((a) => a.type === 'grade' && Date.now() - a.ts < DAY).length;
    if (go) out.push({ k: 'blue', t: `${go} grade override${go > 1 ? 's' : ''} today`, b: 'Mentors changed a score. Check the reasons in the audit log.', go: () => { S.auditUI = { type: 'grade', role: 'all', q: '' }; openTab('audit'); } });
    return out;
  }
  function fillAlerts(box) {
    const { h } = C; box.textContent = '';
    alertsList().forEach((a) => box.append(h('button', { class: 'alert ' + a.k, onclick: a.go }, h('i'), h('div', {}, h('b', {}, a.t), h('span', {}, a.b)), h('em', {}, 'Open'))));
  }
  function fieldBars(cur, totals, max) {
    const { h } = C;
    return h('div', { class: 'fbars' }, D().fields.map((f) => h('div', { class: 'fbar' + (f.id === cur ? ' cur' : '') },
      h('span', { title: f.name }, f.short), h('span', { class: 'trk' }, h('i', { style: { width: (totals[f.id] / max * 100) + '%' } })), h('span', { class: 'num' }, fmt(totals[f.id])))));
  }
  function drawOverview(panel) {
    const { h, field } = C; const L = S.live; const nx = nextExam();
    const tile = (lab, valEl, sub, go, extra) => h('button', { class: 'tile', onclick: go }, h('span', { class: 'lab' }, lab), valEl, extra || null, h('span', { class: 'sub' }, sub));
    const t = {
      online: h('span', {}, fmt(L.online)), onlineBar: h('i', { style: { width: (L.online / 3000 * 100) + '%' } }),
      ws: h('span', {}, fmt(L.workspaces)), checked: h('span', {}, fmt(L.checked)), ai: h('span', {}, fmt(L.ai)),
    };
    refs.tiles = t;
    panel.append(
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('span', { class: 'pill green livepill' }, h('span', { class: 'dot' }), 'Live view · updates every few seconds'),
        h('span', { class: 'tiny muted' }, 'Tap any number or alert to open the section behind it.')),
      h('div', { class: 'tiles' },
        tile('Students online now', h('b', {}, t.online, h('small', {}, ' of 3,000')), 'signed in on any device', () => openTab('batches'), h('span', { class: 'progress green', style: { display: 'block' } }, t.onlineBar)),
        tile('Workspaces running', h('b', {}, t.ws), 'cloud coding workspaces open now', () => openTab('cost')),
        tile('Practicals checked today', h('b', {}, t.checked), 'auto-checked within a minute', () => openTab('content')),
        tile('AI questions today', h('b', {}, t.ai), 'tutor hints, never full answers', () => openTab('cost')),
        tile('Exams in progress', h('b', {}, '0'), nx ? `Next: ${nx.title}, ${fmtDate(nx.ts)}` : 'None scheduled', () => openTab('exam'))));
    const act = svgEl(''); refs.act = act;
    const alerts = h('div', { class: 'alerts' }); refs.alerts = alerts; fillAlerts(alerts);
    panel.append(h('div', { class: 'ov2' },
      h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('h3', {}, 'Students online, last 24 hours'), h('p', { class: 'tiny muted' }, 'Busiest after college, 7 to 10 pm. Workspaces shut down after 20 minutes idle, so quiet hours cost little.'))),
        act,
        h('div', { class: 'svc' }, ['AI on Amazon Bedrock (Mumbai)', 'Local model server', 'Cloud workspaces', 'Auto-checker'].map((x) => h('span', {}, h('span', { class: 'dot' }), x)), h('span', {}, 'All running normally'))),
      h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Needs your attention'), h('span', { class: 'tiny muted' }, 'Clears itself when fixed')),
        alerts)));
    act.innerHTML = activitySVG();
    const tot = fieldTotals(); const max = Math.max(...Object.values(tot));
    panel.append(h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } },
        h('div', {}, h('h3', {}, 'Students by career field'), h('p', { class: 'tiny muted' }, `Highlighted: ${field.name}, the field picked in the top bar. Fields are chosen after Month 3.`)),
        h('button', { class: 'btn sm', onclick: () => openTab('batches') }, 'See batches')),
      fieldBars(field.id, tot, max)));
  }

  /* ============================================================
     2. Batches and students
     ============================================================ */
  function drawBatches(panel) {
    const { h, field } = C;
    const tbody = h('tbody');
    S.batches.forEach((b) => {
      const consentCell = b.pending.length ? h('span', { class: 'pill ' + (b.pending.every((p) => p.sent) ? 'blue' : 'amber') }, `${b.pending.length} pending`) : h('span', { class: 'pill green' }, 'All in');
      tbody.append(h('tr', { class: 'clickable', tabindex: '0', onclick: () => openBatch(b), onkeydown: (e) => { if (e.key === 'Enter') openBatch(b); } },
        h('td', {}, h('b', { class: 'id' }, b.id), h('span', { class: 'sub nw' }, `Lead mentor: ${b.mentor}`)),
        h('td', { class: 'n' }, fmt(b.students)),
        h('td', {}, h('span', { class: 'nw' }, `Month ${b.month}`), h('span', { class: 'sub' }, D().months[b.month])),
        h('td', { class: 'n' }, `${b.active}%`),
        h('td', { class: 'n' }, String(b.u18)),
        h('td', {}, consentCell),
        h('td', {}, h('span', { class: 'chev' }, 'Open'))));
    });
    const total = S.batches.reduce((a, b) => a + b.students, 0), u18 = S.batches.reduce((a, b) => a + b.u18, 0);
    const table = h('div', { class: 'table-wrap' }, h('table', { class: 'wide' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Batch'), h('th', { class: 'n' }, 'Students'), h('th', {}, 'Now in'), h('th', { class: 'n' }, 'Active this week'), h('th', { class: 'n' }, 'Under 18'), h('th', {}, 'Parent consent'), h('th', {}, ''))),
      tbody,
      h('tfoot', {}, h('tr', {}, h('td', {}, 'All batches'), h('td', { class: 'n' }, fmt(total)), h('td', {}, ''), h('td', { class: 'n' }, '89%'), h('td', { class: 'n' }, String(u18)), h('td', {}, `${totalPending()} pending`), h('td', {}, '')))));
    const pend = totalPending(), uns = unsentPending();
    panel.append(
      h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } },
          h('div', {}, h('h3', {}, 'Batches'), h('p', { class: 'tiny muted' }, 'Tap a batch to see its career fields and parent consent.')),
          uns ? h('button', { class: 'btn sm primary', onclick: () => remindAll() }, `Remind all ${uns} pending parents`) : h('span', { class: 'pill ' + (pend ? 'blue' : 'green') }, pend ? 'Reminders sent' : 'All consents in')),
        table));
    const tot = fieldTotals(); const max = Math.max(...Object.values(tot));
    panel.append(h('div', { class: 'bt2' }, inviteCard(), h('section', { class: 'card stack' },
      h('div', {}, h('h3', {}, 'All 3,000 students by career field'), h('p', { class: 'tiny muted' }, `Highlighted: ${field.short}. Change the field in the top bar to compare.`)),
      fieldBars(field.id, tot, max))));
  }
  function sendReminder(b, p, quiet) {
    p.sent = Date.now();
    log('consent', 'Consent reminder sent', `SMS and email to the parent of ${p.name} (${p.age}), ${b.id}. The link stays valid for 7 days.`);
    if (!quiet) { C.toast(`Reminder sent to ${p.name}'s parent by SMS and email.`, 'green'); C.notify('Consent reminder sent', `${p.name} (${b.id}): the parent gets a 2-minute e-sign link.`, 'admin'); }
  }
  function remindAll(onlyBatch) {
    let n = 0;
    S.batches.forEach((b) => { if (onlyBatch && b !== onlyBatch) return; b.pending.forEach((p) => { if (!p.sent) { sendReminder(b, p, true); n += 1; } }); });
    if (!n) { C.toast('Every pending parent already has a reminder.', 'amber'); return; }
    C.toast(`${n} consent reminder${n > 1 ? 's' : ''} sent by SMS and email.`, 'green');
    C.notify('Consent reminders sent', `${n} parent${n > 1 ? 's' : ''} got a 2-minute e-sign link. Lab access opens as soon as they agree.`, 'admin');
    if (S.tab === 'batches') draw();
  }
  function openBatch(b) {
    const { h, field, icon } = C;
    let m;
    const body = h('div', { class: 'stack' });
    function paint() {
      body.textContent = '';
      const consented = b.u18 - b.pending.length;
      body.append(
        h('div', { class: 'card-head', style: { marginBottom: 0 } },
          h('div', {}, h('div', { class: 'eyebrow' }, `Month ${b.month} · ${D().months[b.month]}`), h('h2', {}, b.id)),
          h('button', { class: 'btn sm ghost', onclick: () => m.close(), 'aria-label': 'Close' }, 'Close')),
        h('div', { class: 'bstats' },
          h('div', { class: 'stat' }, h('b', { class: 'num' }, fmt(b.students)), h('span', {}, 'students')),
          h('div', { class: 'stat' }, h('b', { class: 'num' }, `${b.active}%`), h('span', {}, 'active this week')),
          h('div', { class: 'stat' }, h('b', { class: 'num' }, `${b.attendance}%`), h('span', {}, 'lecture attendance')),
          h('div', { class: 'stat' }, h('b', { class: 'num' }, `${b.practicals}%`), h('span', {}, 'practicals passed'))),
        h('div', { class: 'stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', {}, 'Career fields in this batch'), h('span', { class: 'tiny muted' }, b.month <= 3 ? 'First picks, confirmed at the end of Month 3' : 'Chosen after Month 3')),
          fieldBars(field.id, b.fields, Math.max(...Object.values(b.fields))),
          h('p', { class: 'tiny muted' }, `Highlighted: ${field.short} (top-bar field), ${b.fields[field.id]} students here.`)),
        h('div', { class: 'stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', {}, 'Parental consent'), h('span', { class: 'small num' }, `${b.u18} under 18 · ${consented} consented · ${b.pending.length} pending`)),
          h('div', { class: 'progress green' }, h('i', { style: { width: (consented / b.u18 * 100) + '%' } })),
          b.pending.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'wide-s' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Student'), h('th', {}, 'Parent phone'), h('th', {}, 'Status'), h('th', {}, ''))),
            h('tbody', {}, b.pending.map((p) => h('tr', {},
              h('td', {}, h('b', { class: 'nw' }, p.name), h('span', { class: 'sub' }, `Age ${p.age}`)),
              h('td', { class: 'num small nw' }, p.phone),
              h('td', {}, p.sent ? h('span', { class: 'pill blue' }, `Reminder sent ${rel(p.sent).toLowerCase()}`) : h('span', { class: 'pill amber' }, 'Waiting for parent')),
              h('td', {}, h('div', { class: 'acts' },
                h('button', { class: 'btn sm', onclick: () => { sendReminder(b, p); paint(); refresh(); } }, p.sent ? 'Send again' : 'Send reminder'),
                h('button', { class: 'btn sm', onclick: () => recordConsent(b, p) }, 'Record consent')))))))) :
            h('div', { class: 'note' }, 'Every under-18 student in this batch has parent consent. Their lab access is on.'),
          h('p', { class: 'tiny muted' }, 'Under-18 students can watch lectures but cannot open the lab or the AI tutor until a parent agrees. Use "Record consent" when a parent agrees by phone or on paper.')),
        h('div', { class: 'foot' },
          b.id === 'NM-2027-A' ? h('button', { class: 'btn', onclick: () => { m.close(); C.go('mentor'); } }, 'Open mentor console') : null,
          b.pending.some((p) => !p.sent) ? h('button', { class: 'btn', onclick: () => { remindAll(b); paint(); } }, `Remind all ${b.pending.filter((p) => !p.sent).length}`) : null,
          h('button', { class: 'btn primary', html: icon('users') + '<span>Invite students to this batch</span>', onclick: () => { m.close(); S.batchUI.inviteBatch = b.id; S.batchUI.checked = null; openTab('batches', { then: () => { const ta = ROOT && ROOT.querySelector('#adm-invite'); if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center' }); } } }); } })));
    }
    function recordConsent(b2, p) {
      b2.pending = b2.pending.filter((x) => x !== p);
      log('consent', 'Consent recorded', `Parent consent recorded for ${p.name} (${p.age}), ${b2.id}. Lab access switched on.`);
      C.toast(`Consent recorded. ${p.name} can now use the lab.`, 'green');
      C.notify('Parental consent recorded', `${p.name} (${b2.id}) now has lab access.`, 'admin');
      paint(); refresh();
    }
    const refresh = () => { if (S.tab === 'batches') draw(); };
    paint();
    m = openModal(body, '760px');
  }

  const SAMPLE_EMAILS = ['priya.nair@mail.example.in', 'arjun.k@mail.example.in', 'sana.q@mail.example.in', 'dev.malhotra@mail.example.in', 'kavya.r@mail.example.in', 'rahul.gmail.com', 'om.patil@mail.example.in', 'fatima.s@mail.example.in', 'sana.q@mail.example.in', 'neha.d@mail.example.in', 'aarav.kulkarni@mail.example.in', 'tejas.m@mail.example.in', 'isha.b@mail.example.in', 'rohit.g@mail.example.in', 'meenal.p@mail.example.in'];
  const ENROLLED = new Set(['aarav.kulkarni@mail.example.in']);
  function checkEmails(text) {
    const parts = text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    const seen = new Set(), valid = [], bad = [], dup = [], enrolled = [];
    parts.forEach((p) => {
      const e = p.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { bad.push(p); return; }
      if (seen.has(e)) { dup.push(p); return; }
      seen.add(e);
      if (ENROLLED.has(e)) { enrolled.push(p); return; }
      valid.push(e);
    });
    return { valid, bad, dup, enrolled };
  }
  function inviteCard() {
    const { h } = C; const U = S.batchUI;
    const sel = h('select', { class: 'field-input', 'aria-label': 'Batch to invite into', onchange: (e) => { U.inviteBatch = e.target.value; } }, S.batches.map((b) => h('option', { value: b.id, selected: b.id === U.inviteBatch || null }, `${b.id} · Month ${b.month}`)));
    const ta = h('textarea', { id: 'adm-invite', class: 'field-input', placeholder: 'Paste email addresses, one per line or separated by commas', 'aria-label': 'Email addresses', oninput: (e) => { U.inviteText = e.target.value; if (U.checked) { U.checked = null; paintRes(); } } });
    ta.value = U.inviteText;
    const res = h('div', { class: 'vres' });
    function paintRes() {
      res.textContent = '';
      const r = U.checked; if (!r) return;
      const lines = [];
      if (r.bad.length) lines.push(h('li', { class: 'err' }, `${r.bad.length} not valid: ${r.bad.join(', ')} (missing @ or domain)`));
      if (r.dup.length) lines.push(h('li', { class: 'muted' }, `${r.dup.length} duplicate removed: ${r.dup.join(', ')}`));
      if (r.enrolled.length) lines.push(h('li', { class: 'muted' }, `${r.enrolled.length} already a student: ${r.enrolled.join(', ')}`));
      res.append(...[
        h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'pill ' + (r.valid.length ? 'green' : 'red') }, `${r.valid.length} ready to invite`), r.bad.length ? h('span', { class: 'pill red' }, `${r.bad.length} to fix`) : null),
        lines.length ? h('ul', { class: 'plain' }, lines) : null,
        r.valid.length ? h('button', { class: 'btn primary', onclick: queue }, `Queue ${r.valid.length} invite${r.valid.length > 1 ? 's' : ''} to ${U.inviteBatch}`) : null].filter(Boolean));
    }
    function queue() {
      const r = U.checked; if (!r || !r.valid.length) return;
      const grp = { id: 'INV' + Date.now(), batch: U.inviteBatch, emails: r.valid.slice(), ts: Date.now(), status: 'queued' };
      S.invites.unshift(grp);
      log('students', 'Invites queued', `${grp.emails.length} invites to ${grp.batch}.`);
      C.toast(`${grp.emails.length} invites queued for ${grp.batch}.`, 'green');
      C.notify('Student invites queued', `${grp.emails.length} invites to ${grp.batch}. Emails go out within 5 minutes; under-18s get a parent consent step.`, 'admin');
      U.inviteText = ''; U.checked = null;
      later(() => { grp.status = 'sent'; if (S.tab === 'batches' && ROOT) draw(); }, 2500);
      draw();
    }
    paintRes();
    const invList = S.invites.length ? h('div', { class: 'stack', style: { gap: '8px' } }, h('b', { class: 'small' }, 'Invites this session'),
      S.invites.map((g) => h('details', { class: 'inv' },
        h('summary', {}, h('span', {}, `${g.emails.length} to ${g.batch}`), h('span', { class: 'pill ' + (g.status === 'sent' ? 'green' : 'blue') }, g.status === 'sent' ? 'Emails sent' : 'Queued')),
        h('ul', {}, g.emails.map((e) => h('li', {}, e)))))) : null;
    return h('section', { class: 'card stack' },
      h('div', {}, h('h3', {}, 'Invite students'), h('p', { class: 'tiny muted' }, 'Each student gets a sign-up link. Under-18s go through parent consent first.')),
      h('div', { class: 'fld' }, h('label', {}, 'Batch'), sel),
      h('div', { class: 'fld' }, h('label', { for: 'adm-invite' }, 'Email addresses'), ta),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { class: 'btn', onclick: () => { U.inviteText = SAMPLE_EMAILS.join('\n'); ta.value = U.inviteText; U.checked = null; paintRes(); } }, 'Paste sample list'),
        h('button', { class: 'btn primary', onclick: () => { if (!ta.value.trim()) { C.toast('Paste at least one email address first.', 'amber'); ta.focus(); return; } U.checked = checkEmails(ta.value); paintRes(); } }, 'Check emails')),
      res, invList);
  }

  /* ============================================================
     3. Content
     ============================================================ */
  const PER_PAGE = 12;
  function videoCell(id) {
    const { h } = C; const v = S.videos[id]; const j = JOBS[id];
    const lec = D().lectures.find((l) => l.id === id);
    if (j) return [h('span', { class: 'pill blue' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), `Processing ${jobPct(j)}%`), h('span', { class: 'sub' }, STAGES[Math.min(j.stage, STAGES.length - 1)][0])];
    if (v.status === 'published') return [h('span', { class: 'pill green' }, 'Published'), h('span', { class: 'sub' }, `v${v.version} · ${v.mins} min`)];
    return [h('span', { class: 'pill violet' }, 'Scheduled'), h('span', { class: 'sub' }, `${fmtDay(releaseTs(lec))} · v${v.version}`)];
  }
  function capCell(id) {
    const { h } = C;
    if (JOBS[id] && JOBS[id].stage <= 3) return h('span', { class: 'small muted' }, 'Generating…');
    return h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, h('span', { class: 'pill' }, 'English'), h('span', { class: 'pill' }, 'Hindi auto'));
  }
  function updateVideoCell(id) {
    if (!ROOT || S.tab !== 'content') return;
    const row = ROOT.querySelector(`tr[data-lec="${id}"]`); if (!row) return;
    const vc = row.querySelector('.vc'), cc = row.querySelector('.cc');
    vc.textContent = ''; vc.append(...videoCell(id)); cc.textContent = ''; cc.append(capCell(id));
    const up = row.querySelector('.upbtn'); if (up) up.disabled = !!JOBS[id];
  }
  function drawContent(panel) {
    const { h } = C; const F = S.content;
    const counts = { published: 0, processing: 0, scheduled: 0 };
    D().lectures.forEach((l) => { counts[JOBS[l.id] ? 'processing' : S.videos[l.id].status] += 1; });
    panel.append(h('div', { class: 'grid-4' },
      h('div', { class: 'card stat' }, h('b', { class: 'num' }, '104'), h('span', {}, 'lectures in the library')),
      h('div', { class: 'card stat' }, h('b', { class: 'num' }, String(counts.published)), h('span', {}, 'published to students')),
      h('div', { class: 'card stat' }, h('b', { class: 'num' }, String(counts.scheduled)), h('span', {}, 'scheduled, release twice a week')),
      h('div', { class: 'card stat' }, h('b', { class: 'num' }, String(counts.processing)), h('span', {}, 'processing now'))));
    const list = h('div', { class: 'stack' });
    const search = h('input', { class: 'field-input', type: 'search', placeholder: 'Search by number, topic or practical', value: F.q, 'aria-label': 'Search lectures', oninput: (e) => { F.q = e.target.value; F.page = 0; paint(); } });
    const month = h('select', { class: 'field-input', 'aria-label': 'Filter by month', onchange: (e) => { F.month = e.target.value; F.page = 0; paint(); } },
      h('option', { value: 'all' }, 'All 12 months'), Object.entries(D().months).map(([k, v]) => h('option', { value: k, selected: F.month === k || null }, `Month ${k}: ${v}`)));
    const status = h('select', { class: 'field-input', 'aria-label': 'Filter by status', onchange: (e) => { F.status = e.target.value; F.page = 0; paint(); } },
      [['all', 'Any status'], ['published', 'Published'], ['processing', 'Processing'], ['scheduled', 'Scheduled']].map(([v, t]) => h('option', { value: v, selected: F.status === v || null }, t)));
    function rows() {
      const q = F.q.trim().toLowerCase();
      return D().lectures.filter((l) => {
        if (F.month !== 'all' && String(l.month) !== F.month) return false;
        const st = JOBS[l.id] ? 'processing' : S.videos[l.id].status;
        if (F.status !== 'all' && st !== F.status) return false;
        if (!q) return true;
        return String(l.id) === q || `lecture ${l.id}` === q || l.topic.toLowerCase().includes(q) || l.practical.toLowerCase().includes(q);
      });
    }
    function paint() {
      list.textContent = '';
      const all = rows(); const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
      F.page = clamp(F.page, 0, pages - 1);
      const slice = all.slice(F.page * PER_PAGE, F.page * PER_PAGE + PER_PAGE);
      if (!all.length) { list.append(h('div', { class: 'empty' }, 'No lectures match. Clear the search or pick another month.', h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn sm', onclick: () => { F.q = ''; F.month = 'all'; F.status = 'all'; search.value = ''; month.value = 'all'; status.value = 'all'; paint(); } }, 'Clear filters')))); return; }
      const tbody = h('tbody');
      slice.forEach((l) => {
        tbody.append(h('tr', { 'data-lec': l.id },
          h('td', { class: 'n' }, h('b', {}, String(l.id))),
          h('td', { class: 'lt' }, h('b', {}, l.topic), h('span', { class: 'sub' }, `Practical: ${l.practical}`)),
          h('td', { class: 'small' }, h('span', { class: 'nw' }, `Month ${l.month}`), h('span', { class: 'sub nw' }, `Week ${l.week}`)),
          h('td', { class: 'vc' }, videoCell(l.id)),
          h('td', { class: 'cc' }, capCell(l.id)),
          h('td', { class: 'n' }, String(S.videos[l.id].mcqs)),
          h('td', {}, h('div', { class: 'acts' },
            h('button', { class: 'btn sm', onclick: () => { C.state.previewLecture = l.id; C.toast(`Opening the student lecture player to preview Lecture ${l.id}.`); C.go('lecture'); } }, 'Preview'),
            h('button', { class: 'btn sm upbtn', disabled: !!JOBS[l.id] || null, onclick: () => uploadFlow(l) }, 'Upload new version')))));
      });
      list.append(h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { class: 'n' }, '#'), h('th', {}, 'Lecture'), h('th', {}, 'When'), h('th', {}, 'Video'), h('th', {}, 'Captions'), h('th', { class: 'n' }, 'MCQs'), h('th', {}, 'Actions'))), tbody)),
        h('div', { class: 'pager' },
          h('span', { class: 'small muted' }, `Showing ${F.page * PER_PAGE + 1} to ${F.page * PER_PAGE + slice.length} of ${all.length} lectures`),
          h('div', { class: 'row', style: { gap: '6px' } },
            h('button', { class: 'btn sm', disabled: F.page === 0 || null, onclick: () => { F.page -= 1; paint(); } }, 'Previous'),
            h('span', { class: 'small num' }, `Page ${F.page + 1} of ${pages}`),
            h('button', { class: 'btn sm', disabled: F.page >= pages - 1 || null, onclick: () => { F.page += 1; paint(); } }, 'Next'))));
    }
    panel.append(h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } },
        h('div', {}, h('h3', {}, 'Lecture library'), h('p', { class: 'tiny muted' }, 'Each lecture is a 40-minute recorded lesson with 4 questions inside the video and captions in English and Hindi.'))),
      h('div', { class: 'filters' }, search, month, status),
      list));
    paint();
  }
  function uploadFlow(l) {
    const { h, icon } = C;
    const v = S.videos[l.id];
    const slug = l.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
    const files = [
      { name: `L${l.id}-${slug}-v${v.version + 1}.mp4`, meta: `1080p · ${v.mins}:${two(12 + (l.id % 40))} · 1.2 GB` },
      { name: `L${l.id}-${slug}-v${v.version + 1}-audio-fix.mp4`, meta: `1080p · ${v.mins}:${two(5 + (l.id % 50))} · 1.1 GB` },
    ];
    const st = { file: null, hindi: true, keepQ: true };
    const body = h('div', { class: 'stack' });
    let m;
    function paintChoose() {
      body.textContent = '';
      const start = h('button', { class: 'btn primary', disabled: !st.file || null, onclick: () => {
        const j = { id: l.id, stage: 0, pct: 0, sub: 0, hindi: st.hindi, file: st.file.name };
        JOBS[l.id] = j; updateVideoCell(l.id); paintRun(j);
      } }, 'Start upload');
      body.append(
        h('div', {}, h('div', { class: 'eyebrow' }, `Lecture ${l.id} · Month ${l.month} · now version ${v.version}`), h('h2', {}, 'Upload a new version'), h('p', { class: 'small muted' }, l.topic)),
        h('div', { class: 'upl-file' }, h('b', { class: 'small' }, 'Choose the video file'),
          files.map((f) => h('button', { class: 'filepick', 'aria-pressed': String(st.file === f), onclick: () => { st.file = f; paintChoose(); }, html: icon('upload') + `<span><b>${C.esc(f.name)}</b><br><span class="tiny muted">${C.esc(f.meta)}</span></span>` })),
          h('p', { class: 'tiny muted' }, 'Demo: these are sample files. In the real lab this opens your computer\'s file picker.')),
        sw(h, 'Make Hindi captions automatically', st.hindi, (x) => { st.hindi = x; }, 'A reviewer can fix technical words later.'),
        sw(h, 'Keep the 4 in-video questions at the same moments', st.keepQ, (x) => { st.keepQ = x; }, 'Students who already answered keep their progress.'),
        h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), start));
    }
    function paintRun(j) {
      body.textContent = '';
      const bar = h('i', { style: { width: '0%', transition: 'width .15s linear' } }); const pctEl = h('span', { class: 'num small' }, '0%');
      const checks = h('div', {});
      const doneBox = h('div', {});
      const foot = h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Close: keeps working in the background'));
      body.append(
        h('div', {}, h('div', { class: 'eyebrow' }, `Lecture ${l.id}`), h('h2', {}, 'Publishing the new version'), h('p', { class: 'small muted' }, j.file)),
        h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small' }, 'Overall'), pctEl), h('div', { class: 'progress' }, bar)),
        checks, doneBox, foot);
      function upd() {
        const done = j.done; const p = done ? 100 : jobPct(j);
        bar.style.width = p + '%'; pctEl.textContent = p + '%';
        checks.textContent = '';
        STAGES.forEach(([t], i) => {
          if (i === 3 && !j.hindi) return;
          const cls = done || i < j.stage ? 'pass' : i === j.stage ? 'run' : 'wait';
          const ic = cls === 'pass' ? '✓' : cls === 'run' ? h('span', { class: 'spin', style: { width: '10px', height: '10px' } }) : '';
          checks.append(h('div', { class: 'check ' + cls }, h('span', { class: 'ic' }, ic), h('span', {}, i === 0 && j.stage === 0 ? `${t} (${j.pct || 0}%)` : t)));
        });
        const released = l.id <= 66;
        checks.append(h('div', { class: 'check ' + (done ? 'pass' : 'wait') }, h('span', { class: 'ic' }, done ? '✓' : ''), h('span', {}, released ? 'Published to students' : `Scheduled for ${fmtDay(releaseTs(l))}`)));
        if (done) {
          doneBox.textContent = '';
          doneBox.append(h('div', { class: 'callout', style: { borderLeftColor: 'var(--green)' } }, h('b', {}, `Version ${S.videos[l.id].version} is ${released ? 'live' : 'ready'}.`), h('p', { class: 'small muted' }, released ? 'Students who already watched keep their progress. Others see the new version from now on.' : 'It goes live on the release date with both caption tracks.')));
          foot.textContent = '';
          foot.append(h('button', { class: 'btn', onclick: () => { m.close(); C.state.previewLecture = l.id; C.go('lecture'); } }, 'Preview as a student'), h('button', { class: 'btn primary', onclick: () => m.close() }, 'Done'));
        }
      }
      j.onUpdate = upd; upd();
    }
    paintChoose();
    m = openModal(body, '600px');
  }

  /* ============================================================
     4. Exam builder
     ============================================================ */
  function sampleQs(d) {
    const f = C.field; const bank = QB[d.month];
    const n = d.n; const code = d.month === 1 ? 0 : Math.round(n * d.codePct / 100);
    const qs = bank.filter((q) => q[0] === 'mcq' || code > 0).slice(0, 3);
    return qs.map((q, i) => {
      const text = typeof q[1] === 'function' ? q[1](f) : q[1];
      if (q[0] === 'code') return { type: 'code', text, starter: q[2] };
      let opts = q[2].map((o, k) => ({ o, ok: k === 0 }));
      const r = rng(`${d.month}-${i}-${d.shuffle ? 's' : 'n'}`);
      // answers are stored first; always mix them for display, shuffle changes the order again
      opts = opts.map((x) => [r(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      return { type: 'mcq', text, opts };
    });
  }
  function qsNode(qs) {
    const { h } = C;
    return h('div', { class: 'qs' }, qs.map((q, i) => h('div', { class: 'q' },
      h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'pill ' + (q.type === 'code' ? 'violet' : 'blue') }, q.type === 'code' ? 'Code' : 'Multiple choice'), h('span', { class: 'tiny muted' }, `Sample ${i + 1}`)),
      h('b', { class: 'small' }, q.text),
      q.type === 'mcq' ? h('ol', {}, q.opts.map((x, k) => h('li', { class: x.ok ? 'ok' : '' }, h('i', {}, 'ABCD'[k]), h('span', {}, x.o, x.ok ? ' (answer key)' : '')))) :
        h('pre', { class: 'code', style: { margin: 0 } }, q.starter),
      q.type === 'code' ? h('span', { class: 'tiny muted' }, 'Checked automatically against hidden tests, like a practical.') : null)));
  }
  function examSummary(d) {
    const code = d.month === 1 ? 0 : Math.round(d.n * d.codePct / 100);
    return { mcq: d.n - code, code };
  }
  function drawExam(panel) {
    const { h } = C; const d = S.exam.draft;
    // pools
    const pools = h('div', { class: 'pools' });
    for (let mth = 1; mth <= 12; mth++) {
      const p = pool(mth);
      pools.append(h('button', { class: 'poolc', 'aria-pressed': String(d.month === mth), title: D().months[mth], onclick: () => { d.month = mth; if (mth === 1) d.codePct = 0; d.previewed = false; draw(); } },
        h('b', {}, `Month ${mth}`), h('span', {}, `${p.mcq} MCQ · ${p.code} code`), h('span', {}, D().months[mth])));
    }
    panel.append(h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('h3', {}, 'Question pools'), h('p', { class: 'tiny muted' }, 'Mentors write and review questions for each month. From Month 4, code questions use each field\'s company data. Tap a month to build its exam.')),
        h('span', { class: 'pill' }, `${fmt(Array.from({ length: 12 }, (_, i) => pool(i + 1)).reduce((a, p) => a + p.mcq + p.code, 0))} questions in total`)),
      pools));

    // builder
    const p = pool(d.month); const sm = examSummary(d); const mb = monthBatches(d.month);
    const err = h('div', { class: 'err', role: 'alert' });
    const invalidate = () => {
      paintSummary();
      if (d.previewed) { d.previewed = false; const pv = ROOT && ROOT.querySelector('#adm-ex-prev'); if (pv) pv.remove(); prevBtn.textContent = 'Preview exam'; }
    };
    const sumLine = h('div', { class: 'note' });
    const prevBtn = h('button', { class: 'btn primary', onclick: () => { const e = validate(); err.textContent = e; if (e) { C.toast(e, 'red'); return; } d.previewed = true; draw(); later(() => { const pv = ROOT && ROOT.querySelector('#adm-ex-prev'); if (pv) pv.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }, 30); } }, d.previewed ? 'Refresh preview' : 'Preview exam');
    function paintSummary() {
      const s = examSummary(d);
      sumLine.textContent = `${d.n} questions: ${s.mcq} multiple choice + ${s.code} code · ${d.duration} minutes · ${d.shuffle ? 'shuffled for each student' : 'same order for everyone'} · ${d.lockdown ? 'lockdown browser on' : 'lockdown off'} · ${batchRange(mb)}`;
    }
    const today = new Date(); const minDay = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
    const form = h('div', { class: 'form' },
      h('div', { class: 'fld' }, h('label', { for: 'adm-ex-m' }, 'Month'),
        h('select', { id: 'adm-ex-m', class: 'field-input', onchange: (e) => { d.month = Number(e.target.value); if (d.month === 1) d.codePct = 0; d.previewed = false; draw(); } },
          Object.entries(D().months).map(([k, v]) => h('option', { value: k, selected: Number(k) === d.month || null }, `Month ${k}: ${v}`))),
        h('div', { class: 'hint' }, mb.length ? `For ${batchRange(mb)}: ${fmt(mb.reduce((a, b) => a + b.students, 0))} students now in Month ${d.month}.` : `No batch is in Month ${d.month} yet. It opens for the first batch that gets there.`)),
      h('div', { class: 'fld' }, h('label', { for: 'adm-ex-dur' }, 'Duration'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Duration' }, [20, 30, 45, 60].map((x) => h('button', { 'aria-pressed': String(d.duration === x), onclick: (e) => { d.duration = x; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); invalidate(); } }, `${x} min`))),
        h('div', { class: 'hint' }, 'Answers save every few seconds, so a dropped connection loses nothing.')),
      rangeField(h, 'Number of questions', 10, 40, 1, d.n, (v) => `${v}`, (v) => { d.n = v; invalidate(); }, `Pool for Month ${d.month}: ${p.mcq} multiple choice, ${p.code} code.`),
      d.month === 1 ? h('div', { class: 'fld' }, h('div', { class: 'lbl' }, 'Mix of question types'), h('div', { class: 'note' }, 'Month 1 has no code questions yet: students start Python in Month 2.')) :
        rangeField(h, 'Share of code questions', 0, 50, 10, d.codePct, (v) => `${v}% code`, (v) => { d.codePct = v; invalidate(); }, 'The rest are multiple choice.'),
      h('div', { class: 'fld' }, h('div', { class: 'lbl' }, 'Exam rules'),
        sw(h, 'Shuffle questions and options', d.shuffle, (x) => { d.shuffle = x; invalidate(); }, 'Each student gets a different order.'),
        sw(h, 'Lockdown browser', d.lockdown, (x) => { d.lockdown = x; invalidate(); }, 'Full screen; tab switches and paste attempts are recorded.')),
      h('div', { class: 'fld' }, h('label', { for: 'adm-ex-date' }, 'Date and start time'),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'nowrap' } },
          h('input', { id: 'adm-ex-date', type: 'date', class: 'field-input', min: minDay, value: d.date, onchange: (e) => { d.date = e.target.value; err.textContent = ''; invalidate(); } }),
          h('select', { class: 'field-input', 'aria-label': 'Start time', style: { maxWidth: '120px' }, onchange: (e) => { d.time = e.target.value; invalidate(); } }, ['10:00', '14:00', '18:00'].map((t) => h('option', { value: t, selected: d.time === t || null }, t)))),
        h('div', { class: 'hint' }, 'Students get a reminder 2 days before. The exam stays open for 2 hours from the start time.')));
    paintSummary();
    function validate() {
      if (!d.date) return 'Pick a date for the exam.';
      const ts = new Date(`${d.date}T${d.time}:00`).getTime();
      if (!(ts > Date.now() + 6 * 3600e3)) return 'Pick a date from tomorrow onwards, so students get notice.';
      const s = examSummary(d);
      if (s.code > p.code) return `The Month ${d.month} pool has only ${p.code} code questions. Lower the share of code questions.`;
      if (s.mcq > p.mcq) return `The Month ${d.month} pool has only ${p.mcq} multiple-choice questions.`;
      return '';
    }
    const builder = h('section', { class: 'card stack' },
      h('div', {}, h('h3', {}, 'Create an exam'), h('p', { class: 'tiny muted' }, 'Pick the month and the rules, preview sample questions, then publish.')),
      form, sumLine, err,
      h('div', { class: 'foot', style: { justifyContent: 'flex-start' } },
        prevBtn));
    panel.append(builder);

    if (d.previewed) {
      const ts = new Date(`${d.date}T${d.time}:00`).getTime();
      panel.append(h('section', { class: 'card stack', id: 'adm-ex-prev', style: { borderColor: 'var(--brand)' } },
        h('div', { class: 'card-head', style: { marginBottom: 0 } },
          h('div', {}, h('div', { class: 'eyebrow' }, 'Preview · what students will see'), h('h3', {}, `Month ${d.month} assessment`), h('p', { class: 'small muted' }, `${fmtDay(ts)} at ${d.time} · ${d.duration} minutes · ${sm.mcq} multiple choice + ${sm.code} code`)),
          h('span', { class: 'pill ' + (d.lockdown ? 'green' : 'amber') }, d.lockdown ? 'Lockdown on' : 'Lockdown off')),
        qsNode(sampleQs(d)),
        h('p', { class: 'tiny muted' }, `3 of ${d.n} questions shown. Each student gets a random draw from the Month ${d.month} pool.`),
        h('div', { class: 'foot' },
          h('button', { class: 'btn', onclick: () => { d.previewed = false; draw(); } }, 'Edit settings'),
          h('button', { class: 'btn primary', onclick: () => publish(ts) }, 'Publish exam'))));
    }
    function publish(ts) {
      const e = validate(); if (e) { C.toast(e, 'red'); d.previewed = false; draw(); return; }
      const s = examSummary(d); const studs = mb.reduce((a, b) => a + b.students, 0);
      const same = S.exam.scheduled.filter((x) => x.month === d.month && x.status !== 'cancelled').length;
      const ex = { id: 'EX-' + (S.exam.scheduled.length + 1), title: `Month ${d.month} ${same ? 're-test' : 'assessment'}`, month: d.month, batches: batchRange(mb), students: studs, n: d.n, mcq: s.mcq, code: s.code, duration: d.duration, ts, status: 'scheduled', shuffle: d.shuffle, lockdown: d.lockdown, fresh: true, snapshot: Object.assign({}, d) };
      S.exam.scheduled.forEach((x) => { x.fresh = false; });
      S.exam.scheduled.unshift(ex);
      log('exam', 'Exam published', `${ex.title} for ${ex.batches}${studs ? ` (${fmt(studs)} students)` : ''}: ${ex.n} questions, ${ex.duration} minutes, lockdown ${ex.lockdown ? 'on' : 'off'}, ${fmtDT(ts)}.`);
      C.toast(`${ex.title} published for ${fmtDay(ts)}.`, 'green');
      C.notify('Exam published', `${ex.title}, ${fmtDT(ts)}. ${studs ? `${fmt(studs)} students` : 'Students'} get a reminder 2 days before.`, 'admin');
      d.previewed = false; draw();
      later(() => { const el = ROOT && ROOT.querySelector('#adm-sched'); if (el) el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }, 30);
    }

    // scheduled list
    const tbody = h('tbody');
    S.exam.scheduled.slice().sort((a, b) => (a.status === 'scheduled' ? 0 : 1) - (b.status === 'scheduled' ? 0 : 1) || (a.status === 'scheduled' ? a.ts - b.ts : b.ts - a.ts)).forEach((ex) => {
      const pillEl = ex.status === 'scheduled' ? h('span', { class: 'pill blue' }, 'Scheduled') : ex.status === 'finished' ? h('span', { class: 'pill green' }, 'Finished') : h('span', { class: 'pill' }, 'Cancelled');
      const acts = h('div', { class: 'acts' });
      if (ex.status === 'scheduled') acts.append(h('button', { class: 'btn sm', onclick: () => viewExam(ex) }, 'View'), h('button', { class: 'btn sm', onclick: () => cancelExam(ex) }, 'Cancel'));
      else if (ex.status === 'finished') { acts.append(h('button', { class: 'btn sm', onclick: () => viewExam(ex) }, 'View')); if (ex.month === 7) acts.append(h('button', { class: 'btn sm', onclick: () => C.go('mentor') }, 'Integrity flags')); }
      else acts.append(h('span', { class: 'tiny muted' }, 'Students were told'));
      tbody.append(h('tr', { class: ex.fresh ? 'fresh' : ex.status === 'cancelled' ? 'dim' : '' },
        h('td', {}, h('b', {}, ex.title), h('span', { class: 'sub' }, `${ex.n} questions · ${ex.duration} min`)),
        h('td', { class: 'small' }, ex.batches, h('span', { class: 'sub' }, ex.students ? `${fmt(ex.students)} students` : 'Opens when a batch arrives')),
        h('td', { class: 'small' }, fmtDT(ex.ts), h('span', { class: 'sub' }, rel(ex.ts))),
        h('td', {}, pillEl, ex.submitted ? h('span', { class: 'sub' }, `${fmt(ex.submitted)} submitted`) : null),
        h('td', {}, acts)));
    });
    panel.append(h('section', { class: 'card stack', id: 'adm-sched' },
      h('div', {}, h('h3', {}, 'Scheduled and past exams')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'wide' }, h('thead', {}, h('tr', {}, ['Exam', 'Batches', 'When', 'Status', ''].map((t) => h('th', {}, t)))), tbody))));

    panel.append(integrityCard());
  }
  function viewExam(ex) {
    const { h } = C;
    const d = ex.snapshot || { month: ex.month, n: ex.n, codePct: Math.round(ex.code / ex.n * 100), shuffle: ex.shuffle, duration: ex.duration };
    const I = S.exam.integrity; let m;
    m = openModal(h('div', { class: 'stack' },
      h('div', {}, h('div', { class: 'eyebrow' }, ex.status === 'finished' ? 'Finished exam' : 'Scheduled exam'), h('h2', {}, ex.title)),
      h('dl', { class: 'kv' },
        h('dt', {}, 'When'), h('dd', {}, `${fmtDT(ex.ts)} (${rel(ex.ts)})`),
        h('dt', {}, 'Batches'), h('dd', {}, `${ex.batches}${ex.students ? `, ${fmt(ex.students)} students` : ''}`),
        h('dt', {}, 'Questions'), h('dd', {}, `${ex.n}: ${ex.mcq} multiple choice + ${ex.code} code`),
        h('dt', {}, 'Rules'), h('dd', {}, `${ex.duration} minutes · ${ex.shuffle ? 'shuffled' : 'fixed order'} · lockdown ${ex.lockdown ? 'on' : 'off'} · flag after ${I.tabLimit} tab switches · autosave every ${I.autosave} s`),
        ex.submitted ? h('dt', {}, 'Submitted') : null, ex.submitted ? h('dd', {}, `${fmt(ex.submitted)} of ${fmt(ex.students)}`) : null),
      h('b', { class: 'small' }, 'Sample questions'), qsNode(sampleQs(d)),
      h('div', { class: 'foot' }, ex.status === 'finished' && ex.month === 7 ? h('button', { class: 'btn', onclick: () => { m.close(); C.go('mentor'); } }, 'See integrity flags') : null, h('button', { class: 'btn primary', onclick: () => m.close() }, 'Close'))), '640px');
  }
  function cancelExam(ex) {
    const { h } = C; let m;
    m = openModal(h('div', { class: 'stack' },
      h('h2', {}, `Cancel ${ex.title}?`),
      h('p', { class: 'small muted' }, `${ex.students ? fmt(ex.students) + ' students' : 'Students'} get a message that the ${fmtDate(ex.ts)} exam is off. You can publish a new date any time.`),
      h('div', { class: 'foot' },
        h('button', { class: 'btn', onclick: () => m.close() }, 'Keep the exam'),
        h('button', { class: 'btn primary', onclick: () => {
          ex.status = 'cancelled'; ex.fresh = false;
          log('exam', 'Exam cancelled', `${ex.title} on ${fmtDT(ex.ts)} for ${ex.batches} was cancelled. Students were told by app and email.`);
          C.toast(`${ex.title} cancelled. Students were told.`, 'amber');
          C.notify('Exam cancelled', `${ex.title} (${fmtDate(ex.ts)}) is off. Students were told.`, 'admin');
          m.close(); draw();
        } }, 'Cancel exam'))), '480px');
  }
  function integrityCard() {
    const { h } = C; const I = S.exam.integrity; const draft = Object.assign({}, I);
    const saveBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => {
      const changes = Object.keys(draft).filter((k) => draft[k] !== I[k]).map((k) => ({ tabLimit: `tab-switch limit ${I[k]} to ${draft[k]}`, copyBlock: `copy-paste block ${draft[k] ? 'on' : 'off'}`, autosave: `autosave every ${draft[k]} s`, fullscreen: `full screen ${draft[k] ? 'required' : 'optional'}` })[k]);
      Object.assign(I, draft); saveBtn.disabled = true; dirty.hidden = true;
      log('exam', 'Integrity settings changed', `For all future exams: ${changes.join(', ')}.`);
      C.toast('Integrity settings saved for all future exams.', 'green');
    } }, 'Save settings');
    const dirty = h('span', { class: 'pill amber', hidden: true }, 'Unsaved changes');
    const mark = () => { const d = Object.keys(draft).some((k) => draft[k] !== I[k]); saveBtn.disabled = !d; dirty.hidden = !d; };
    const tabOut = h('output', { class: 'num', style: { fontWeight: 800, minWidth: '28px', textAlign: 'center' } }, String(draft.tabLimit));
    const step = (dv) => { draft.tabLimit = clamp(draft.tabLimit + dv, 1, 10); tabOut.textContent = draft.tabLimit; mark(); };
    return h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('h3', {}, 'Integrity settings'), h('p', { class: 'tiny muted' }, 'Apply to every exam. Nothing fails a student automatically: a mentor looks at flagged papers.')), dirty),
      h('div', { class: 'form' },
        h('div', { class: 'fld' }, h('div', { class: 'lbl' }, 'Tab-switch limit'),
          h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn sm', 'aria-label': 'Fewer', onclick: () => step(-1) }, '−'), tabOut, h('button', { class: 'btn sm', 'aria-label': 'More', onclick: () => step(1) }, '+'), h('span', { class: 'small muted' }, 'switches, then the paper is flagged'))),
        h('div', { class: 'fld' }, h('div', { class: 'lbl' }, 'Autosave answers'),
          h('div', { class: 'seg', role: 'group', 'aria-label': 'Autosave interval' }, [10, 20, 30].map((x) => h('button', { 'aria-pressed': String(draft.autosave === x), onclick: (e) => { draft.autosave = x; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); mark(); } }, `Every ${x} s`)))),
        sw(h, 'Block copy and paste', draft.copyBlock, (x) => { draft.copyBlock = x; mark(); }, 'Paste attempts are blocked and recorded.'),
        sw(h, 'Require full screen', draft.fullscreen, (x) => { draft.fullscreen = x; mark(); }, 'Leaving full screen is recorded as a flag.')),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => draw() }, 'Discard'), saveBtn));
  }

  /* ============================================================
     5. Cost and limits
     ============================================================ */
  function donutSVG() {
    const lc = D().lab_costs; const parts = [[1.48, 's1'], [0.69, 's2'], [0.15, 's3']]; const tot = lc.monthly_total_lakh;
    const r = 58, cx = 80, cy = 80, circ = 2 * Math.PI * r; let off = 0;
    let s = `<svg viewBox="0 0 160 160" class="donut" role="img" aria-label="Typical month ₹2.32 lakh: servers ₹1.48 lakh, AI ₹0.69 lakh, test environment ₹0.15 lakh" style="max-width:220px;margin:0 auto">`;
    s += `<circle class="bg" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="22"/>`;
    parts.forEach(([v, cls]) => { const len = v / tot * circ; s += `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="22" stroke-dasharray="${(len - 2).toFixed(2)} ${(circ - len + 2).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`; off += len; });
    s += `<text class="axb" x="${cx}" y="${cy - 2}" text-anchor="middle" style="font-size:18px">₹${tot.toFixed(2)} L</text><text class="ax" x="${cx}" y="${cy + 16}" text-anchor="middle">typical month</text></svg>`;
    return s;
  }
  function stackSVG(mNow, boxW) {
    const now = new Date(); const W = clamp(Math.round(boxW || 520), 300, 640), H = W < 480 ? 210 : 230, pl = 40, pr = 10, pt = 14, pb = 28, max = 3;
    const y = (v) => pt + (H - pt - pb) * (1 - v / max);
    const cols = HISTORY.map(([sv, ai], i) => ({ sv, ai, te: 0.15, lab: new Date(now.getFullYear(), now.getMonth() - 5 + i, 1).toLocaleDateString('en-IN', { month: 'short' }) }));
    cols.push({ sv: mNow.servers, ai: mNow.ai, te: mNow.test, lab: new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-IN', { month: 'short' }) + ' (est.)', proj: true });
    const bw = (W - pl - pr) / cols.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="stk" role="img" aria-label="Monthly lab cost for the last six months, stacked by servers, AI and test environment, with this month's estimate.">`;
    [0, 1, 2, 3].forEach((v) => { s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">₹${v} L</text>`; });
    cols.forEach((c, i) => {
      const x = pl + i * bw + bw * 0.2, w = bw * 0.6; let base = 0;
      [[c.sv, 's1', 'Servers'], [c.ai, 's2', 'AI'], [c.te, 's3', 'Test environment']].forEach(([v, cls, nm]) => {
        s += `<rect class="${cls}${c.proj ? ' proj' : ''}" x="${x.toFixed(1)}" y="${y(base + v).toFixed(1)}" width="${w.toFixed(1)}" height="${(y(base) - y(base + v)).toFixed(1)}"><title>${c.lab}: ${nm} ₹${v.toFixed(2)} L</title></rect>`; base += v;
      });
      if (c.proj) s += `<rect class="projbox" x="${x.toFixed(1)}" y="${y(base).toFixed(1)}" width="${w.toFixed(1)}" height="${(y(0) - y(base)).toFixed(1)}"/>`;
      s += `<text class="${c.proj ? 'axb' : 'ax'}" x="${(x + w / 2).toFixed(1)}" y="${y(base) - 5}" text-anchor="middle" style="font-size:11px">${base.toFixed(2)}</text>`;
      s += `<text class="ax" x="${(x + w / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle">${W < 480 && c.proj ? c.lab.replace(' (est.)', '*') : c.lab}</text>`;
    });
    s += `<line class="bud" x1="${pl}" x2="${W - pr}" y1="${y(2)}" y2="${y(2)}"/></svg>`;
    return s;
  }
  function drawCost(panel) {
    const { h } = C; const lc = D().lab_costs; const K = S.cost;
    panel.append(h('div', { class: 'cost-top' },
      h('div', { class: 'card stat' }, h('b', {}, `₹${lc.monthly_total_lakh.toFixed(2)} L`), h('span', {}, 'typical month for the whole lab')),
      h('div', { class: 'card stat' }, h('b', {}, `₹${lc.per_student_month_inr}`), h('span', {}, `per student a month (${fmt(lc.students)} students)`)),
      h('div', { class: 'card stat' }, h('b', {}, '₹1.48 L'), h('span', {}, `servers, against a ₹${lc.server_budget_lakh.toFixed(2)} L budget`)),
      h('div', { class: 'card stat' }, h('b', {}, '₹0.69 L + ₹0.15 L'), h('span', {}, 'AI tutor and keys + test environment'))));

    const stackBox = svgEl(''); const sofar = h('div', { class: 'stack', style: { gap: '8px' } });
    panel.append(h('div', { class: 'c2' },
      h('section', { class: 'card stack' },
        h('div', {}, h('h3', {}, 'Where the money goes'), h('p', { class: 'tiny muted' }, 'A typical month. Demo data.')),
        svgEl(donutSVG()),
        h('div', { class: 'legend', style: { justifyContent: 'center' } }, h('span', {}, h('i'), 'Servers ₹1.48 L'), h('span', {}, h('i', { class: 'v' }), 'AI ₹0.69 L'), h('span', {}, h('i', { class: 'a' }), 'Test environment ₹0.15 L'))),
      h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('h3', {}, 'Last six months'), h('p', { class: 'tiny muted' }, 'This month is an estimate from the settings below.')), h('span', { class: 'pill amber' }, 'estimate · demo model')),
        stackBox,
        h('div', { class: 'legend' }, h('span', {}, h('i'), 'Servers'), h('span', {}, h('i', { class: 'v' }), 'AI'), h('span', {}, h('i', { class: 'a' }), 'Test environment'), h('span', {}, h('i', { class: 'r' }), 'Server budget ₹2 L (compare with the blue part)')),
        sofar)));

    // governor
    const projBox = h('div', { class: 'proj' });
    const formula = h('pre', { class: 'code formula' });
    const statusBox = h('div', {});
    const dirty = h('span', { class: 'pill amber', hidden: true }, 'Not saved');
    const saveBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => {
      const s = K.saved; const ch = [];
      if (s.hours !== K.hours) ch.push(`weekly lab hours ${s.hours} to ${K.hours}`); if (s.idle !== K.idle) ch.push(`idle shutdown ${s.idle} to ${K.idle} min`); if (s.ai !== K.ai) ch.push(`AI budget per student ₹${s.ai} to ₹${K.ai}`);
      K.saved = { hours: K.hours, idle: K.idle, ai: K.ai };
      log('limits', 'Lab limits changed', `${ch.join('; ')}. New estimate ${lakh(model(K, false).total)} a month.`);
      C.toast('New lab limits saved. They apply from Monday.', 'green');
      C.notify('Lab limits changed', `${ch.join('; ')}. Students see the new weekly hours from Monday.`, 'admin');
      upd();
    } }, 'Save limits');
    const untrimmedPct = () => 1.48 * (0.6 + 0.4 * K.hours / 12) * (0.9 + 0.1 * K.idle / 20) * 1.27 / 2 * 100;
    function upd() {
      const mm = model(K, K.spike); const base = model(K, false);
      stackBox.innerHTML = stackSVG(mm, stackBox.clientWidth);
      projBox.textContent = '';
      projBox.append(
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'eyebrow' }, 'Projected this month'), h('span', { class: 'pill amber' }, 'estimate · demo model')),
        h('div', { class: 'big' }, lakh(mm.total)),
        h('div', { class: 'small muted' }, `≈ ₹${Math.round(mm.perStudent)} per student · typical month ₹2.32 L`),
        h('div', { class: 'rowx' }, h('span', {}, 'Servers'), h('span', {}, lakh(mm.servers))),
        h('div', { class: 'rowx' }, h('span', {}, 'AI'), h('span', {}, lakh(mm.ai))),
        h('div', { class: 'rowx' }, h('span', {}, 'Test environment'), h('span', {}, lakh(mm.test))),
        h('div', { class: 'stack', style: { gap: '6px' } },
          h('div', { class: 'rowx' }, h('span', {}, 'Servers vs ₹2 L budget'), h('span', {}, `${Math.round(mm.pct)}%`)),
          h('div', { class: 'budbar', title: 'Black line: 90% of budget' }, h('i', { class: mm.pct >= 90 ? 'red' : mm.pct >= 75 ? 'amber' : '', style: { width: Math.min(100, mm.pct) + '%' } }), h('b')),
          h('span', { class: 'tiny muted' }, 'Black line: 90% of budget, where auto-trim starts.')));
      const spikeF = K.spike ? ' × 1.27 (busy week)' : '';
      formula.innerHTML = `<span class="c"># Simple, transparent demo model (₹ lakh a month)</span>\nServers = 1.48 × (0.6 + 0.4 × <span class="n">${K.hours}</span> ÷ 12) × (0.9 + 0.1 × <span class="n">${mm.idle}</span> ÷ 20)${spikeF}\n        = <span class="s">${mm.servers.toFixed(2)}</span>\nAI      = 0.69 × (0.5 + 0.5 × ₹<span class="n">${K.ai}</span> ÷ ₹120) = <span class="s">${mm.ai.toFixed(2)}</span>\nTest    = 0.15 (fixed)\nTotal   = <span class="s">${mm.total.toFixed(2)}</span>  ÷ 3,000 students = ₹<span class="s">${Math.round(mm.perStudent)}</span> each`;
      // so far this month
      const day = new Date().getDate(), days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const spent = base.total * day / days * 0.97;
      sofar.textContent = '';
      sofar.append(h('div', { class: 'rowx', style: { display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
        h('b', { class: 'small' }, `This month so far: ${lakh(spent)}`), h('span', { class: 'small muted' }, `Day ${day} of ${days} · on course for ${lakh(mm.total)}`)),
      h('div', { class: 'progress' }, h('i', { style: { width: Math.min(100, spent / mm.total * 100) + '%' } })));
      statusBox.textContent = '';
      if (K.spike) {
        statusBox.append(h('div', { class: 'callout', style: { borderLeftColor: mm.trimmed ? 'var(--amber)' : 'var(--red)' } },
          h('b', {}, mm.trimmed ? 'Busy week: auto-trim is working' : `Busy week: servers at ${Math.round(mm.pct)}% of budget`),
          h('p', { class: 'small muted' }, mm.trimmed ? `Servers would have reached ${Math.round(untrimmedPct())}%. Idle shutdown is now ${mm.idle} minutes, which brings them to ${Math.round(mm.pct)}%. Nobody loses work.` : (mm.pct >= 90 ? 'Auto-trim is off, so nothing changes by itself. Turn it on, or lower the weekly hours.' : 'Still under 90%, so nothing needs to change.'))));
        if (!K.alerted && mm.pct >= 75) { K.alerted = true; C.notify('Budget alert: servers', `A busy week pushes servers toward ${Math.round(untrimmedPct())}% of the ₹2 L budget.${mm.trimmed ? ' Auto-trim cut idle shutdown to 10 minutes.' : ''}`, 'admin'); if (mm.trimmed) log('limits', 'Auto-trim started', 'Servers passed 90% of budget in a simulated busy week. Idle shutdown cut from ' + K.idle + ' to 10 minutes.', 'Automatic', 'system'); }
      }
      const d = K.hours !== K.saved.hours || K.idle !== K.saved.idle || K.ai !== K.saved.ai;
      saveBtn.disabled = !d; dirty.hidden = !d;
    }
    const sliders = h('div', { class: 'stack', style: { gap: '16px' } },
      rangeField(h, 'Weekly lab hours per student (cap)', 8, 14, 1, K.hours, (v) => `${v} h`, (v) => { K.hours = v; upd(); }, 'Workspace time each student can use in a week. Most use 4 to 6 hours.'),
      rangeField(h, 'Idle shutdown', 10, 40, 5, K.idle, (v) => `${v} min`, (v) => { K.idle = v; upd(); }, 'A workspace with no typing or running code stops after this long. Files are kept.'),
      rangeField(h, 'AI budget per student', 60, 200, 10, K.ai, (v) => `₹${v}`, (v) => { K.ai = v; upd(); }, 'Monthly limit on each student\'s lab AI key. Most students use far less.'),
      sw(h, 'Auto-trim idle time when servers reach 90% of budget', K.autotrim, (x) => {
        K.autotrim = x; K.alerted = false;
        log('limits', `Auto-trim turned ${x ? 'on' : 'off'}`, x ? 'When servers reach 90% of the monthly budget, idle shutdown drops to 10 minutes until the month ends.' : 'Servers can pass 90% of budget without any automatic change. Admin alerts still fire.');
        C.toast(`Auto-trim ${x ? 'on' : 'off'}.`, x ? 'green' : 'amber'); upd();
      }, 'Cuts idle shutdown to 10 minutes until the month ends. Lectures, exams and saved work are never touched.'));
    panel.append(h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('h3', {}, 'Budget governor'), h('p', { class: 'tiny muted' }, 'Move the sliders: the projected monthly cost updates straight away.')), dirty),
      h('div', { class: 'gov' }, sliders, h('div', { class: 'stack' }, projBox, formula)),
      statusBox,
      h('div', { class: 'foot' },
        h('button', { class: 'btn', onclick: () => { K.spike = !K.spike; K.alerted = false; C.toast(K.spike ? 'Simulating a busy exam week: 27% more server time.' : 'Back to a normal week.', K.spike ? 'amber' : 'green'); draw(); } }, K.spike ? 'End busy-week simulation' : 'Simulate a busy exam week'),
        h('button', { class: 'btn', onclick: () => { Object.assign(K, COST_DEF); draw(); C.toast('Sliders back to the standard limits. Save to apply.'); } }, 'Reset to standard'),
        saveBtn)));

    panel.append(h('section', { class: 'card stack' },
      h('h3', {}, 'What happens near the budget'),
      h('ol', { class: 'steps' },
        h('li', {}, h('span', { class: 'pill green' }, '75%'), h('div', {}, h('b', {}, 'You get an alert. '), h('span', { class: 'muted' }, 'A notification and email to the admin team. Nothing changes for students.'))),
        h('li', {}, h('span', { class: 'pill amber' }, '90%'), h('div', {}, h('b', {}, 'Auto-trim, if it is on. '), h('span', { class: 'muted' }, 'Idle workspaces stop after 10 minutes instead of 20, and new workspaces start in Small (2 GB) unless a practical needs Large.'))),
        h('li', {}, h('span', { class: 'pill red' }, '100%'), h('div', {}, h('b', {}, 'Extra hours pause, learning does not. '), h('span', { class: 'muted' }, 'Exams and practicals already running finish normally. Lectures, the forum and each student\'s AI key keep working; extra workspace hours wait until the next week.'))),
        h('li', {}, h('span', { class: 'pill blue' }, 'AI'), h('div', {}, h('b', {}, 'AI has its own limit. '), h('span', { class: 'muted' }, 'Each student\'s lab AI key stops at the monthly budget above, so one heavy user cannot raise the bill for everyone.')))),
      h('p', { class: 'tiny muted' }, 'Every automatic step is written to the audit log.')));
    upd();
  }

  /* ============================================================
     6. Audit log
     ============================================================ */
  const TYPES = [['all', 'All actions'], ['consent', 'Consent'], ['exam', 'Exams'], ['grade', 'Grades'], ['key', 'Keys'], ['limits', 'Limits and budget'], ['content', 'Content'], ['students', 'Students'], ['export', 'Exports']];
  const ROLES = [['all', 'Everyone'], ['admin', 'Admins'], ['mentor', 'Mentors'], ['system', 'Automatic']];
  const typeLabel = (t) => (TYPES.find((x) => x[0] === t) || [, t])[1];
  function auditRows() {
    const U = S.auditUI; const q = U.q.trim().toLowerCase();
    return S.audit.filter((a) => (U.type === 'all' || a.type === U.type) && (U.role === 'all' || a.role === U.role) && (!q || `${a.action} ${a.detail} ${a.actor}`.toLowerCase().includes(q)));
  }
  function drawAudit(panel) {
    const { h } = C; const U = S.auditUI;
    const list = h('div', { class: 'stack' });
    const count = h('span', { class: 'small muted' });
    function paint() {
      list.textContent = '';
      const rows = auditRows();
      count.textContent = `${rows.length} of ${S.audit.length} records`;
      if (!rows.length) { list.append(h('div', { class: 'empty' }, 'No records match these filters.')); return; }
      const tbody = h('tbody');
      rows.forEach((a) => tbody.append(h('tr', { class: 'clickable' + (a.fresh ? ' fresh' : ''), tabindex: '0', onclick: () => openAudit(a), onkeydown: (e) => { if (e.key === 'Enter') openAudit(a); } },
        h('td', { class: 'au-t' }, fmtDT(a.ts), h('span', { class: 'sub' }, rel(a.ts))),
        h('td', { class: 'small' }, h('b', { class: 'nw' }, a.actor), h('span', { class: 'sub' }, a.role === 'system' ? 'Automatic' : a.role === 'admin' ? 'Admin' : 'Mentor')),
        h('td', {}, h('span', { class: 'pill ' + ({ consent: 'green', exam: 'blue', grade: 'amber', key: 'violet', limits: 'red', content: '', students: 'blue' }[a.type] || '') }, typeLabel(a.type))),
        h('td', { class: 'au-d' }, h('b', {}, a.action), a.detail))));
      list.append(h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Time', 'Who', 'Type', 'What happened'].map((t) => h('th', {}, t)))), tbody)));
    }
    const typeSel = h('select', { class: 'field-input', 'aria-label': 'Filter by type', onchange: (e) => { U.type = e.target.value; paint(); } }, TYPES.map(([v, t]) => h('option', { value: v, selected: U.type === v || null }, t)));
    const roleSel = h('select', { class: 'field-input', 'aria-label': 'Filter by who', onchange: (e) => { U.role = e.target.value; paint(); } }, ROLES.map(([v, t]) => h('option', { value: v, selected: U.role === v || null }, t)));
    const q = h('input', { class: 'field-input', type: 'search', placeholder: 'Search names, batches, lectures', value: U.q, 'aria-label': 'Search the audit log', oninput: (e) => { U.q = e.target.value; paint(); } });
    panel.append(h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } },
        h('div', {}, h('h3', {}, 'Audit log'), h('p', { class: 'tiny muted' }, 'Every change by an admin, a mentor or the system. Records cannot be edited or deleted.')),
        h('button', { class: 'btn', onclick: exportCSV }, 'Export CSV')),
      h('div', { class: 'filters' }, q, typeSel, roleSel,
        h('button', { class: 'btn sm ghost', onclick: () => { S.auditUI = { type: 'all', role: 'all', q: '' }; draw(); } }, 'Clear')),
      count, list));
    paint();
  }
  function openAudit(a) {
    const { h } = C; let m;
    const where = a.role === 'system' ? 'Lab scheduler (no person)' : a.role === 'admin' ? 'Pune office · Chrome on Windows · 2-step sign-in' : 'Home · Chrome on Android · 2-step sign-in';
    m = openModal(h('div', { class: 'stack' },
      h('div', {}, h('div', { class: 'eyebrow' }, `${typeLabel(a.type)} · ${a.id}`), h('h2', {}, a.action)),
      h('p', { class: 'small' }, a.detail),
      h('dl', { class: 'kv' },
        h('dt', {}, 'When'), h('dd', {}, `${fmtDT(a.ts)} (${rel(a.ts)})`),
        h('dt', {}, 'Who'), h('dd', {}, `${a.actor}${a.role === 'system' ? '' : a.role === 'admin' ? ', admin' : ', mentor'}`),
        h('dt', {}, 'Signed in from'), h('dd', {}, where),
        h('dt', {}, 'Record'), h('dd', {}, 'Locked. Changes are added as new records, never edited.')),
      h('div', { class: 'foot' },
        a.type === 'grade' ? h('button', { class: 'btn', onclick: () => { m.close(); C.go('mentor'); } }, 'Open mentor console') : null,
        a.type === 'consent' ? h('button', { class: 'btn', onclick: () => { m.close(); openTab('batches'); } }, 'Go to batches') : null,
        a.type === 'exam' ? h('button', { class: 'btn', onclick: () => { m.close(); openTab('exam'); } }, 'Go to exams') : null,
        h('button', { class: 'btn primary', onclick: () => m.close() }, 'Close'))), '560px');
  }
  function exportCSV() {
    const { h } = C;
    const rows = auditRows();
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const pad = (ts) => { const d = new Date(ts); return `${isoDay(d)} ${fmtTime(ts)}`; };
    const csv = ['record_id,time,who,role,type,action,details'].concat(rows.map((a) => [a.id, pad(a.ts), q(a.actor), a.role === 'system' ? 'automatic' : a.role, a.type, q(a.action), q(a.detail)].join(','))).join('\n');
    const ta = h('textarea', { class: 'field-input csv', readonly: true, rows: '12', wrap: 'off', 'aria-label': 'CSV preview' }); ta.value = csv;
    const fname = `audit-log-${isoDay(new Date())}.csv`;
    let m;
    const copyBtn = h('button', { class: 'btn primary', onclick: async () => {
      let ok = false;
      try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(csv); ok = true; } } catch (e) { ok = false; }
      if (!ok) { try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e) { ok = false; } }
      if (ok) { C.toast(`${rows.length} rows copied as CSV.`, 'green'); copyBtn.textContent = 'Copied'; }
      else { ta.focus(); ta.select(); C.toast('Text selected. Press Ctrl+C to copy.', 'amber'); }
    } }, 'Copy CSV');
    m = openModal(h('div', { class: 'stack' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Export'), h('h2', {}, fname), h('p', { class: 'small muted' }, `${rows.length} rows with the filters you chose. Paste into any spreadsheet.`)),
      ta,
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Close'), copyBtn)), '720px');
    log('export', 'Audit log exported', `${rows.length} rows exported as CSV by ${ADMIN}.`);
  }
})();
