/* My lab: the student's cloud workspace, lab AI key, AI playground, tokenizer, practice server (VPS)
   and a month-by-month guide to which lab tool is used when. Everything is scripted mock data.
   Demo state lives in module-level variables so it survives navigation and field switches. */
(function () {
  const WEEK_CAP = 720;            // 12 hours a week, in minutes
  const MIN_PER_TICK_MS = 3000;    // demo clock: 1 workspace minute every 3 real seconds
  const BUDGET = 120;              // monthly AI key budget in rupees
  const ALERT_AT = 0.8;

  const S = {
    tab: 'ws',
    ws: { status: 'stopped', size: 'small', pending: null, usedMin: 220, last: 0, step: -1, openAfter: false, limitNotified: false, sessions: 0 },
    extraFiles: {},                // field id -> [{ path, body }]
    key: { used: 62, suffix: '7Q2F', reveal: false, confirm: false, alerted: false, playground: 0 },
    play: { prompts: {}, models: ['oss', 'haiku'], temp: 0.4, results: {} },
    tok: { mode: 'en', text: {} },
    vps: { status: 'running', rules: { 22: true, 80: true, 443: true }, confirm: false, step: -1, resets: 0, bootedAt: Date.now() - 3 * 86400000 - 5 * 3600000 },
    month: 8,
  };
  let live = null; // { root, c, timers: Set, intervals: Set, refs }

  /* ---------- helpers ---------- */
  function hash(s) { let a = 2166136261; for (const ch of String(s)) { a ^= ch.charCodeAt(0); a = Math.imul(a, 16777619); } return a >>> 0; }
  const fmtH = (min) => { min = Math.floor(min); const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${m} m` : `${h} h`; };
  const rupee = (v, d) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 2 : d });
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function later(fn, ms) { if (!live) { fn(); return; } const id = setTimeout(() => { live && live.timers.delete(id); fn(); }, ms); live.timers.add(id); return id; }
  function every(fn, ms) { if (!live) return null; const id = setInterval(fn, ms); live.intervals.add(id); return id; }
  function stopEvery(id) { if (id == null) return; clearInterval(id); live && live.intervals.delete(id); }
  function D() { return window.NM_DATA; }
  function lectureById(id) { return D().lectures.find((l) => l.id === id); }

  function openLecture(c, id) {
    const l = lectureById(id);
    try { NM.state.lectureRequest = id; } catch (e) {}
    if (l) c.toast(`Opening Lecture ${l.id}: ${l.topic}`);
    c.go('lecture');
  }

  async function copyText(c, text, label) {
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
        document.body.append(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (e) { ok = false; }
    }
    c.toast(ok ? `${label} copied to the clipboard` : 'The browser blocked copying. Select the text and copy it by hand.', ok ? 'green' : 'amber');
  }

  function hookOf(field) { const m = (field.practicals['65'] && field.practicals['65'].task || '').match(/\/hooks\/([a-z0-9-]+)/); return m ? m[1] : 'events'; }

  /* ---------- workspace files (per field, from the practical starter files) ---------- */
  function filesFor(field) {
    const out = [{ path: 'README.md' }, { path: '.env' }];
    [['65', 'lecture-65'], ['57', 'lecture-57']].forEach(([k, dir]) => {
      const p = field.practicals[k]; if (!p) return;
      (p.starter || []).forEach((s) => {
        if (!s.path || s.path.endsWith('/')) return;
        const clean = s.path.replace(/^p\d+\//, '');
        out.push({ path: `${dir}/${clean}`, desc: s.desc || '' });
      });
    });
    (S.extraFiles[field.id] || []).forEach((f) => out.push(f));
    const seen = new Set();
    return out.filter((f) => (seen.has(f.path) ? false : seen.add(f.path))).map((f, i) => {
      const hsh = hash(field.id + f.path);
      const kb = f.body ? Math.max(1, Math.round(f.body.length / 100) / 10) : (0.4 + (hsh % 180) / 10);
      const when = f.body ? 'Just now' : f.path.startsWith('lecture-65') ? `Today ${9 + (hsh % 3)}:${String(10 + (hsh % 49)).padStart(2, '0')}` : f.path.startsWith('lecture-57') ? 'Last week' : 'Yesterday';
      return Object.assign({ size: kb >= 10 ? `${Math.round(kb)} KB` : `${kb.toFixed(1)} KB`, when, i }, f);
    });
  }

  function fileBody(path, field) {
    const hook = hookOf(field), base = path.split('/').pop(), ext = base.includes('.') ? base.split('.').pop().toLowerCase() : base;
    const extra = (S.extraFiles[field.id] || []).find((f) => f.path === path);
    if (extra) return extra.body;
    const co = field.company;
    if (base === 'README.md') return `# ${co} lab workspace\n\nOwner: ${D().demo_student.name} (${D().demo_student.id})\nField: ${field.name}\n\n## This week\n- Lecture 65: Webhooks, catch and respond\n- Practical: make /hooks/${hook} answer its caller\n\n## Run\n  make up        # start the lab services\n  make check     # run the same checks as the auto-grader`;
    if (base === '.env' || base === '.env.example') return `# Filled in by the lab. Do not share.\nLAB_TOKEN=lab_${hash(field.id).toString(16).slice(0, 8)}\nNM_AI_KEY=nmk_••••••••${S.key.suffix}\nNM_AI_GATEWAY=https://gateway.lab.internal/mumbai\nHOOK_${hook.toUpperCase().replace(/-/g, '_')}=http://localhost:8088/hooks/${hook}`;
    if (base === 'Caddyfile') return `:8088 {\n  handle /hooks/${hook} {\n    # TODO: answer 401 when the token header is missing or wrong\n    @bad not header X-Lab-Token {env.LAB_TOKEN}\n    respond @bad 401\n    reverse_proxy activepieces:80\n  }\n}`;
    if (ext === 'py') return `# ${co} · ${path}\nimport json\nfrom pathlib import Path\n\nDATA = Path(__file__).parent / "data"\n\ndef handle(event: dict) -> dict:\n    # TODO: validate the event before saving it\n    if not event.get("id"):\n        return {"status": 400, "error": "id is required"}\n    return {"status": 202, "received": event["id"]}\n\nif __name__ == "__main__":\n    print(handle({"id": "evt_1042"}))`;
    if (ext === 'ts') return `// ${co} · ${base}\n// Code step inside the Activepieces flow\nexport const code = async (inputs: { body: Record<string, unknown> }) => {\n  const missing = ["id"].filter((k) => !(k in inputs.body));\n  // TODO: return a clear error for each missing field\n  return { ok: missing.length === 0, missing };\n};`;
    if (ext === 'sh') return `#!/usr/bin/env bash\n# Posts each sample event to the local webhook\nwhile read -r line; do\n  curl -s -o /dev/null -w "%{http_code}\\n" \\\n    -H "X-Lab-Token: $LAB_TOKEN" \\\n    -d "$line" http://localhost:8088/hooks/${hook}\ndone < samples.jsonl  # TODO: point at your sample file`;
    if (ext === 'json') return `{\n  "name": "${hook}",\n  "trigger": { "type": "catch_webhook" },\n  "steps": [\n    { "type": "router", "if": "body.id is not empty" },\n    { "type": "return_response", "status": 202 },\n    { "type": "return_response", "status": 400 }\n  ]\n}`;
    if (ext === 'jsonl') return `{"id": "evt_1041", "source": "${co}"}\n{"id": "evt_1042", "source": "${co}"}\n{"id": "evt_1042", "source": "${co}"}\n{"source": "${co}"}`;
    if (ext === 'csv') return `id,name,region,updated\n1,${co.split(' ')[0]} Pune,West,2026-10-28\n2,${co.split(' ')[0]} Nashik,West,2026-10-29\n3,${co.split(' ')[0]} Indore,Central,2026-11-02`;
    if (ext === 'yaml' || ext === 'yml') return `# ${co} reference data\nversion: 2026.11\nitems:\n  - id: A1\n    label: Standard\n  - id: A2\n    label: Priority`;
    if (ext === 'http') return `### Valid call\nPOST http://localhost:8088/hooks/${hook}\nX-Lab-Token: {{LAB_TOKEN}}\nContent-Type: application/json\n\n{ "id": "evt_1042" }`;
    return `# ${path}\n# Demo file from ${co}`;
  }

  function codeHTML(text, esc) {
    return text.split('\n').map((ln) => {
      const t = ln.trim();
      if (t.startsWith('#') || t.startsWith('//')) return `<span class="c">${esc(ln)}</span>`;
      return esc(ln).replace(/(&quot;[^&]*?&quot;|"[^"]*")/g, '<span class="s">$1</span>').replace(/\b(\d{2,})\b/g, '<span class="n">$1</span>')
        .replace(/^(\s*)(def|import|from|return|if|export|const|async|while|do|done|handle|respond)\b/, '$1<span class="k">$2</span>');
    }).join('\n');
  }

  /* ---------- tokenizer (deterministic teaching rule) ---------- */
  const DICT = new Set(('the a an and or but to of in on at for with from by is are was were be been it its this that these those i you he she we they me my your our their please send report before after meeting hello hi thanks thank can could would will should may might do does did not no yes have has had what when where why how which who about into over under more most less very just also only than then there here today tomorrow monday friday sales store order orders data team share update customer customers price new time day week month year good great need want make get go see know think use work file files app model models token tokens cost costs same message reply write points simple three short tips could explain help people every each using intern company daily first after next save saves').split(' '));
  function tokenize(text) {
    const out = []; const re = /(\s*)([A-Za-z]+|[0-9]+|[ऀ-ॿ]+|[^\sA-Za-z0-9ऀ-ॿ])/g; let m;
    while ((m = re.exec(text))) {
      const ws = m[1] || ''; const w = m[2]; const nl = ws.includes('\n'); const sp = ws && !nl ? ' ' : '';
      let parts;
      if (/^[A-Za-z]+$/.test(w) && w.length > 4 && !DICT.has(w.toLowerCase())) { parts = []; for (let i = 0; i < w.length; i += 4) parts.push(w.slice(i, i + 4)); }
      else if (/^[ऀ-ॿ]+$/.test(w)) { parts = []; for (let i = 0; i < w.length; i += 2) parts.push(w.slice(i, i + 2)); }
      else if (/^[0-9]+$/.test(w) && w.length > 3) { parts = []; for (let i = 0; i < w.length; i += 3) parts.push(w.slice(i, i + 3)); }
      else parts = [w];
      parts.forEach((p, i) => out.push({ t: (i === 0 ? sp : '') + p, nl: i === 0 && nl }));
    }
    return out;
  }
  const tokCount = (s) => tokenize(s).length;
  function samples(field) {
    const co = field.company;
    return {
      en: `Hello, please send the ${co} sales report before Friday's team meeting. Thank you!`,
      hi: `Namaste, kripya ${co} ki sales report Friday ki team meeting se pehle bhej dijiye. Dhanyavaad!`,
    };
  }

  /* ---------- AI playground (scripted answers) ---------- */
  const MODELS = {
    oss: { id: 'oss', name: 'gpt-oss-120b', tag: 'Default', speed: 95, lat: 380, inK: 0.013, outK: 0.05, blurb: 'Open-weight model. Good for most practicals.' },
    haiku: { id: 'haiku', name: 'Claude Haiku 4.5', tag: 'Harder tasks', speed: 75, lat: 520, inK: 0.085, outK: 0.425, blurb: 'Used when a task needs careful reasoning or code review.' },
    nova: { id: 'nova', name: 'Amazon Nova Lite', tag: 'Fast and cheap', speed: 130, lat: 260, inK: 0.005, outK: 0.02, blurb: 'Quick answers for short, simple questions.' },
  };
  const STOP = new Set('explain points could would should about their there which where these those simple keep short write three using with from that this what when your into have will been them they make like give help tips ways company intern people every daily time save saves bullet bullets words'.split(' '));
  function keywords(prompt, field) {
    const words = (prompt.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).filter((w) => !STOP.has(w) && !field.company.toLowerCase().includes(w));
    const uniq = [...new Set(words)];
    const fill = ['webhook', 'report', 'workflow'];
    while (uniq.length < 3) uniq.push(fill[uniq.length]);
    return uniq.slice(0, 3);
  }
  function defaultPrompt(field) {
    return `In 3 short points, explain how ${field.company} could use a webhook to save time every day. Keep it simple for a new ${field.short} intern.`;
  }
  function answer(modelId, prompt, field, temp) {
    const [k1] = keywords(prompt, field); const co = field.company; const mi = Object.keys(MODELS).indexOf(modelId);
    const k2 = `${co.split(' ')[0]} system`; const k3 = hookOf(field).replace(/-/g, ' ');
    const band = temp < 0.34 ? 0 : temp < 0.67 ? 1 : 2;
    const open = [
      [`Here are three steps for ${co}.`, `Three points, kept simple.`, `Short answer for ${co}:`],
      [`Good question. Here is how ${co} could do it.`, `Here is a practical way to look at it.`, `Let us keep this simple for a new intern.`],
      [`Picture a doorbell for software: when something happens, ${co} gets told right away.`, `Imagine never refreshing a page to check for news again.`, `Think of it like a helpful neighbour who knocks the moment a parcel arrives.`],
    ][band];
    const b1 = [
      `1. Pick one task around the ${k1} that people repeat every day and write down its steps.`,
      `1. Start with the ${k1} task the team complains about most, and map each step on paper.`,
      `1. Hunt for the ${k1} chore everyone quietly dreads, the one done by hand every morning.`,
    ][band];
    const b2 = [
      `2. Let the ${k2} send an event to a webhook, so a flow runs the moment it happens.`,
      `2. Connect the ${k2} to a webhook. The flow starts on its own instead of someone checking.`,
      `2. Wire the ${k2} to a webhook so the work kicks off by itself, like a domino push.`,
    ][band];
    const b3 = [
      `3. Reply with a clear status (202 when accepted, 400 when data is missing) and log each ${k3}.`,
      `3. Answer the caller quickly with a status code, and keep a short log of every ${k3} for checking later.`,
      `3. Send back a quick "got it" and keep a diary of each ${k3}, so nothing slips through the cracks.`,
    ][band];
    const tail = {
      oss: band === 2 ? 'Result: fewer manual checks and faster replies.' : 'This saves time and avoids missed updates.',
      haiku: `Check: test it with one valid and one broken ${k3} before you rely on it.`,
      nova: '',
    }[modelId];
    const first = open[(hash(prompt) + mi) % open.length];
    let lines = [first, b1, b2, b3];
    if (modelId === 'nova') lines = [first, b1, b2.replace(/, so a flow.*$|\. The flow.*$|, like.*$/, '.'), b3.replace(/,? and (log|keep).*$/, '.')];
    if (tail) lines.push(tail);
    return lines.join('\n');
  }

  /* ---------- months and tools ---------- */
  const TOOLS = {
    sheets: { name: 'Browser worksheets', what: 'Guided exercises that run in the browser. Nothing to install.' },
    play: { name: 'AI playground', what: 'Try prompts on lab models side by side.', tab: 'play' },
    tok: { name: 'Tokenizer', what: 'See how text becomes tokens, and what that costs.', tab: 'tok' },
    tm: { name: 'Teachable Machine', what: 'Train a small image model with a webcam, no code.' },
    py: { name: 'In-browser Python', what: 'Python runs inside the page, even on a basic laptop.' },
    key: { name: 'Lab AI key', what: 'Call AI models from your own code, inside a monthly budget.', tab: 'key' },
    web: { name: 'In-browser web editor', what: 'HTML, CSS and JavaScript with a live preview.' },
    ws: { name: 'Cloud workspace', what: 'VS Code in the browser with a terminal, up to 12 h a week.', tab: 'ws' },
    vps: { name: 'Practice server (VPS)', what: 'A real Ubuntu server to learn SSH and firewalls.', tab: 'vps' },
    docker: { name: 'Docker', what: 'Package apps in containers, inside the Large workspace.' },
    ollama: { name: 'Shared Ollama server', what: 'Small local models (qwen2.5) shared by the batch.' },
    pgv: { name: 'pgvector', what: 'A database that searches by meaning, for retrieval (RAG).' },
    mcp: { name: 'MCP Inspector', what: 'Test the tools your MCP server gives to an AI model.' },
    ap: { name: 'Activepieces', what: 'Build automations with triggers, webhooks and steps.' },
    agents: { name: 'Agent runner', what: 'Run AI agents in the workspace with the lab AI key.' },
    graf: { name: 'Prometheus and Grafana', what: 'Metrics, dashboards and alerts for your services.' },
    targets: { name: 'Authorised practice targets', what: 'Deliberately weak lab apps you are allowed to attack.' },
    port: { name: 'Portfolio site and Demo Day', what: 'Your projects on GitHub, a portfolio site and a live demo.' },
  };
  const PLAN = {
    1: ['sheets', 'play', 'tok', 'tm'], 2: ['py'], 3: ['py', 'play', 'key'], 4: ['web', 'ws'], 5: ['vps', 'docker', 'ws'], 6: ['ollama', 'pgv'],
    7: ['mcp', 'ws'], 8: ['ap', 'ws'], 9: ['agents', 'key'], 10: ['graf', 'ws'], 11: ['targets'], 12: ['port'],
  };
  const MONTH_NOTE = {
    1: 'All in the browser. Students meet AI before writing any code.', 2: 'Python without installing anything.', 3: 'Prompting and the Claude API with the lab key.',
    4: 'Start with a simple editor, then move to the full cloud workspace.', 5: 'Linux, servers and Docker on real machines. Large workspace size is switched on.',
    6: 'Local models and retrieval on shared lab servers.', 7: 'Connect tools to AI models with MCP.', 8: 'Automation with webhooks and flows.',
    9: 'Agents that plan and act, inside budget limits.', 10: 'Monitoring and alerts. Large workspace size is switched on.', 11: 'Security testing, only on lab targets.', 12: 'Capstone 4, portfolio and Demo Day.',
  };

  /* ---------- styles ---------- */
  function injectCSS() {
    if (document.getElementById('m-workspace')) return;
    const st = document.createElement('style'); st.id = 'm-workspace';
    st.textContent = `
.m-workspace { display: grid; gap: 16px; min-width: 0 }
.m-workspace .wsx-hero { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: start }
.m-workspace .wsx-hero > div { min-width: 0 }
.m-workspace .wsx-sum { display: flex; gap: 8px; flex-wrap: wrap }
.m-workspace .wsx-sum button { border: 0; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1.5 }
.m-workspace .card.stack { align-content: start }
.m-workspace .wsx-seg { justify-self: start }
.m-workspace .wsx-sum button:hover { filter: brightness(.97); text-decoration: underline }
.m-workspace .wsx-panel { display: grid; gap: 16px; min-width: 0 }
.m-workspace .wsx-panel > * { min-width: 0 }
.m-workspace .wsx-status { display: flex; align-items: center; gap: 14px }
.m-workspace .wsx-orb { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; flex: none; background: var(--surface-2); color: var(--faint) }
.m-workspace .wsx-orb svg { width: 24px; height: 24px }
.m-workspace .wsx-orb.on { background: var(--green-soft); color: var(--green) }
.m-workspace .wsx-orb.busy { background: var(--brand-soft); color: var(--brand) }
.m-workspace .wsx-orb.busy svg { animation: wsx-pulse 1.1s ease-in-out infinite }
@keyframes wsx-pulse { 50% { opacity: .35 } }
.m-workspace .wsx-big { font-family: var(--display); font-size: 22px; font-weight: 700 }
.m-workspace .wsx-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; padding: 3px; background: var(--surface-2); gap: 3px; flex-wrap: wrap; max-width: 100% }
.m-workspace .wsx-seg button { border: 0; background: transparent; border-radius: 7px; padding: 8px 14px; font-weight: 700; cursor: pointer; color: var(--muted); text-align: left; min-width: 0 }
.m-workspace .wsx-seg button[aria-pressed="true"] { background: var(--surface); color: var(--brand); box-shadow: var(--shadow) }
.m-workspace .wsx-seg button small { display: block; font-weight: 600; font-size: 11.5px; color: var(--muted) }
.m-workspace .wsx-meter { height: 12px; background: var(--surface-2); border-radius: 99px; overflow: hidden; position: relative }
.m-workspace .wsx-meter > i { display: block; height: 100%; background: var(--brand); border-radius: inherit; transition: width .6s ease }
.m-workspace .wsx-meter.warn > i { background: var(--amber) } .m-workspace .wsx-meter.full > i { background: var(--red) }
.m-workspace .wsx-meter > b { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--amber); border-radius: 2px }
.m-workspace .wsx-between { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: baseline }
.m-workspace .wsx-files { display: grid }
.m-workspace .wsx-file { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 8px; border: 0; border-top: 1px solid var(--line); background: none; text-align: left; cursor: pointer; border-radius: 6px; width: 100% }
.m-workspace .wsx-file:first-child { border-top: 0 }
.m-workspace .wsx-file:hover { background: var(--surface-2) }
.m-workspace .wsx-file svg { width: 18px; height: 18px; color: var(--muted) }
.m-workspace .wsx-file code { overflow-wrap: anywhere; font-size: 13px }
.m-workspace .wsx-file .meta { font-size: 12px; color: var(--muted); white-space: nowrap; text-align: right }
.m-workspace .wsx-key { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: var(--code-bg); color: var(--code-fg); border-radius: var(--radius-sm); padding: 10px 12px; font-family: var(--mono); font-size: 13.5px }
.m-workspace .wsx-key code { flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; color: var(--code-str) }
.m-workspace .wsx-confirm { border: 1px solid var(--line); border-left: 3px solid var(--amber); background: var(--amber-soft); border-radius: var(--radius-sm); padding: 12px 14px; display: grid; gap: 10px }
.m-workspace .wsx-confirm.red { border-left-color: var(--red); background: var(--red-soft) }
.m-workspace .wsx-model { display: grid; gap: 6px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface) }
.m-workspace .wsx-chips { display: flex; gap: 8px; flex-wrap: wrap }
.m-workspace .wsx-chip { border: 1px solid var(--line); background: var(--surface); border-radius: 99px; padding: 7px 12px; font-weight: 700; font-size: 13px; cursor: pointer; color: var(--muted); display: inline-flex; gap: 6px; align-items: center }
.m-workspace .wsx-chip[aria-pressed="true"] { border-color: var(--brand); background: var(--brand-soft); color: var(--brand) }
.m-workspace .wsx-chip .box { width: 14px; height: 14px; border-radius: 4px; border: 2px solid currentColor; display: inline-grid; place-items: center; font-size: 10px; line-height: 1 }
.m-workspace .wsx-ans { display: grid; gap: 10px; align-content: start; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); min-width: 0 }
.m-workspace .wsx-ans pre { margin: 0; white-space: pre-wrap; font-family: var(--body); font-size: 14px; line-height: 1.55; min-height: 120px; overflow-wrap: anywhere }
.m-workspace .wsx-caret { display: inline-block; width: 7px; height: 15px; background: var(--brand); vertical-align: -2px; margin-left: 2px; animation: wsx-pulse .8s steps(2) infinite }
.m-workspace .wsx-ans .stats { display: flex; gap: 6px; flex-wrap: wrap }
.m-workspace textarea.field-input { resize: vertical; min-height: 84px; line-height: 1.5 }
.m-workspace input[type=range] { width: 100%; accent-color: var(--brand) }
.m-workspace .wsx-toks { line-height: 2.1; font-family: var(--mono); font-size: 13.5px; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); min-height: 64px; overflow-wrap: anywhere; white-space: pre-wrap }
.m-workspace .wsx-toks span { border-radius: 4px; padding: 2px 1px; color: var(--fg); box-decoration-break: clone; -webkit-box-decoration-break: clone }
.m-workspace .wsx-toks .t0 { background: var(--brand-soft) } .m-workspace .wsx-toks .t1 { background: var(--green-soft) } .m-workspace .wsx-toks .t2 { background: var(--amber-soft) }
.m-workspace .wsx-toks .t3 { background: var(--violet-soft) } .m-workspace .wsx-toks .t4 { background: var(--red-soft) }
.m-workspace .wsx-bars { display: grid; gap: 10px }
.m-workspace .wsx-bar { display: grid; grid-template-columns: 90px minmax(0, 1fr) 70px; gap: 10px; align-items: center; font-size: 13px }
.m-workspace .wsx-bar .progress { height: 12px }
.m-workspace .wsx-bar.alt .progress > i { background: var(--amber) }
.m-workspace .wsx-switch { position: relative; width: 42px; height: 24px; border-radius: 99px; border: 0; background: var(--line); cursor: pointer; flex: none; transition: background .2s }
.m-workspace .wsx-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); box-shadow: var(--shadow); transition: transform .2s }
.m-workspace .wsx-switch[aria-checked="true"] { background: var(--green) }
.m-workspace .wsx-switch[aria-checked="true"]::after { transform: translateX(18px) }
.m-workspace .wsx-switch:disabled { opacity: .5; cursor: not-allowed }
.m-workspace .wsx-cmd { display: flex; gap: 8px; align-items: center; flex-wrap: wrap }
.m-workspace .wsx-cmd code { flex: 1 1 220px; min-width: 0; background: var(--code-bg); color: var(--code-fg); padding: 9px 12px; border-radius: var(--radius-sm); overflow-wrap: anywhere }
.m-workspace .wsx-kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px }
.m-workspace .wsx-kv div { display: grid; gap: 2px; min-width: 0 }
.m-workspace .wsx-kv span { font-size: 12px; color: var(--muted) }
.m-workspace .wsx-kv b { font-size: 14px; overflow-wrap: anywhere }
.m-workspace .wsx-months { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px }
.m-workspace .wsx-month { border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius-sm); padding: 10px; text-align: left; cursor: pointer; display: grid; gap: 2px; min-width: 0 }
.m-workspace .wsx-month:hover { border-color: var(--brand) }
.m-workspace .wsx-month b { font-family: var(--display); font-size: 14px }
.m-workspace .wsx-month span { font-size: 11.5px; color: var(--muted); line-height: 1.3; overflow-wrap: anywhere }
.m-workspace .wsx-month[aria-pressed="true"] { border-color: var(--brand); background: var(--brand-soft) }
.m-workspace .wsx-month[aria-pressed="true"] b { color: var(--brand) }
.m-workspace .wsx-month.now b::after { content: " · now"; font-size: 11px; color: var(--green); font-family: var(--body) }
.m-workspace .wsx-cloud { display: flex; flex-wrap: wrap; gap: 8px }
.m-workspace .wsx-tool { border: 1px solid var(--line); border-radius: 99px; padding: 6px 12px; font-size: 13px; font-weight: 600; color: var(--faint); background: var(--surface); transition: all .25s; cursor: default }
.m-workspace .wsx-tool.hi { color: var(--brand); border-color: var(--brand); background: var(--brand-soft); font-weight: 800 }
.m-workspace .wsx-toolcard { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface) }
.m-workspace .wsx-toolcard > div { min-width: 0 }
.wsx-vs { display: grid; gap: 0; min-width: 0 }
.wsx-vs .vs-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--surface-2); border-radius: 16px 16px 0 0; flex-wrap: wrap }
.wsx-vs .vs-bar .url { flex: 1 1 200px; min-width: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 99px; padding: 5px 12px; font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.wsx-vs .vs-dots { display: flex; gap: 6px } .wsx-vs .vs-dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--line); display: block }
.wsx-vs .vs-body { display: grid; grid-template-columns: 210px minmax(0, 1fr); min-height: 300px; background: var(--code-bg); color: var(--code-fg) }
.wsx-vs .vs-tree { border-right: 1px solid color-mix(in srgb, var(--code-muted) 30%, transparent); padding: 10px 6px; font-family: var(--mono); font-size: 12.5px; overflow: auto; max-height: 360px }
.wsx-vs .vs-tree .dir { color: var(--code-muted); padding: 6px 8px 2px; text-transform: uppercase; font-size: 11px; letter-spacing: .05em }
.wsx-vs .vs-tree button { display: block; width: 100%; text-align: left; background: none; border: 0; color: var(--code-fg); padding: 4px 8px 4px 14px; border-radius: 5px; cursor: pointer; font: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.wsx-vs .vs-tree button:hover { background: color-mix(in srgb, var(--code-key) 14%, transparent) }
.wsx-vs .vs-tree button[aria-current="true"] { background: color-mix(in srgb, var(--code-key) 24%, transparent); color: var(--code-key) }
.wsx-vs .vs-ed { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0 }
.wsx-vs .vs-tabname { font-family: var(--mono); font-size: 12px; padding: 7px 14px; color: var(--code-key); border-bottom: 1px solid color-mix(in srgb, var(--code-muted) 30%, transparent) }
.wsx-vs .vs-ed .code { border-radius: 0; max-height: 300px; overflow: auto; margin: 0 }
.wsx-vs .vs-term { border-top: 1px solid var(--line); padding: 12px 14px; display: grid; gap: 8px; background: var(--surface) }
.wsx-vs .vs-term .term { min-height: 90px; max-height: 170px }
.wsx-vs .vs-foot { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 12px 14px; align-items: center }
@media (max-width: 1100px) { .m-workspace .wsx-months { grid-template-columns: repeat(4, minmax(0, 1fr)) } }
@media (max-width: 640px) {
  .m-workspace .wsx-months { grid-template-columns: repeat(3, minmax(0, 1fr)) }
  .m-workspace .wsx-file { grid-template-columns: 22px minmax(0, 1fr) }
  .m-workspace .wsx-file .meta { grid-column: 2; text-align: left }
  .m-workspace .wsx-bar { grid-template-columns: 70px minmax(0, 1fr) 56px }
  .wsx-vs .vs-body { grid-template-columns: minmax(0, 1fr) }
  .wsx-vs .vs-tree { border-right: 0; max-height: 130px; border-bottom: 1px solid color-mix(in srgb, var(--code-muted) 30%, transparent) }
}
@media (prefers-reduced-motion: reduce) { .m-workspace .wsx-orb.busy svg, .m-workspace .wsx-caret { animation: none } }
`;
    document.head.append(st);
  }

  /* ---------- workspace state machine ---------- */
  function emitWS() { if (live) live.c.emit('workspace:state', { status: S.ws.status, size: S.ws.size }); else try { NM.emit('workspace:state', { status: S.ws.status, size: S.ws.size }); } catch (e) {} }
  function accrue() {
    const w = S.ws; const now = Date.now();
    if (w.status === 'running') {
      if (w.last) w.usedMin = Math.min(WEEK_CAP, w.usedMin + (now - w.last) / MIN_PER_TICK_MS);
      w.last = now;
      if (w.usedMin >= WEEK_CAP) { w.status = 'stopped'; w.last = 0; limitReached(); emitWS(); return true; }
    } else w.last = 0;
    return false;
  }
  function limitReached() {
    const c = live ? live.c : NM.ctx();
    if (S.ws.limitNotified) return; S.ws.limitNotified = true;
    c.notify('Weekly workspace limit reached', 'You have used all 12 hours this week. Your files are saved. Hours reset on Monday.', 'workspace');
    c.toast('Weekly limit reached. Workspace stopped; hours reset Monday.', 'amber');
  }
  const START_STEPS = () => [
    `Allocating a ${S.ws.size === 'large' ? 'Large 6 GB' : 'Small 2 GB'} machine in Mumbai`,
    'Mounting your files',
    'Starting VS Code in the browser',
  ];
  function startWS(c) {
    const w = S.ws;
    if (w.usedMin >= WEEK_CAP) { c.toast('Weekly limit reached. Hours reset on Monday.', 'amber'); return; }
    if (w.status !== 'stopped') return;
    if (w.pending) { w.size = w.pending; w.pending = null; }
    w.status = 'starting'; w.step = 0; emitWS(); paint();
    const stepMs = reduced() ? 250 : 1000;
    later(() => { w.step = 1; paint(); }, stepMs);
    later(() => { w.step = 2; paint(); }, stepMs * 2);
    later(() => finishStart(), stepMs * 3);
  }
  function finishStart() {
    const w = S.ws; if (w.status !== 'starting') return;
    w.status = 'running'; w.step = 3; w.last = Date.now(); w.sessions++; emitWS();
    if (live) { live.c.toast(`Workspace running (${w.size === 'large' ? 'Large 6 GB' : 'Small 2 GB'})`, 'green'); paint(); if (w.openAfter) { w.openAfter = false; openVS(live.c); } }
  }
  function stopWS(c, quiet) {
    const w = S.ws; if (w.status !== 'running') return;
    accrue(); if (w.status !== 'running') return;
    w.status = 'stopping'; paint();
    later(() => { w.status = 'stopped'; w.step = -1; w.last = 0; emitWS(); if (!quiet) c.toast('Workspace stopped. Your files are saved.'); paint(); }, reduced() ? 100 : 700);
  }
  function restartWS(c) {
    const w = S.ws; if (w.status !== 'running') return;
    accrue(); if (w.status !== 'running') return;
    w.status = 'stopping'; paint();
    later(() => { w.status = 'stopped'; w.last = 0; emitWS(); startWS(c); }, reduced() ? 100 : 700);
  }

  /* ---------- VS Code mock ---------- */
  function openVS(c, startPath) {
    const { h, esc, field } = c;
    if (S.ws.status !== 'running') {
      if (S.ws.status === 'stopped') { S.ws.openAfter = true; c.toast('Starting your workspace first. VS Code opens when it is ready.'); startWS(c); }
      else { S.ws.openAfter = true; c.toast('VS Code opens as soon as the workspace is running.'); }
      return;
    }
    const files = filesFor(field);
    let cur = startPath && files.some((f) => f.path === startPath) ? startPath : (files.find((f) => f.path.startsWith('lecture-65/')) || files[0]).path;
    const user = D().demo_student.github;
    const tree = h('div', { class: 'vs-tree', role: 'tree', 'aria-label': 'Files' });
    const tabName = h('div', { class: 'vs-tabname' });
    const code = h('pre', { class: 'code' });
    const term = h('div', { class: 'term', 'aria-live': 'polite' });
    const termLines = [`<span class="dim">${esc(user)}@workspace:~/lab$</span> <span class="ok">ready</span> · ${S.ws.size === 'large' ? 'Large 6 GB' : 'Small 2 GB'} · Mumbai`];
    function drawTerm() { term.innerHTML = termLines.slice(-9).join('\n'); term.scrollTop = term.scrollHeight; }
    function drawTree() {
      tree.textContent = '';
      const groups = {};
      filesFor(field).forEach((f) => { const dir = f.path.includes('/') ? f.path.split('/')[0] : '~/lab'; (groups[dir] = groups[dir] || []).push(f); });
      Object.keys(groups).sort((a, b) => (a === '~/lab' ? -1 : b === '~/lab' ? 1 : b.localeCompare(a))).forEach((dir) => {
        tree.append(h('div', { class: 'dir' }, dir));
        groups[dir].forEach((f) => tree.append(h('button', { type: 'button', role: 'treeitem', 'aria-current': f.path === cur ? 'true' : 'false', title: f.path, onclick: () => { cur = f.path; drawTree(); drawFile(); } }, f.path.replace(dir + '/', ''))));
      });
    }
    function drawFile() { tabName.textContent = cur; code.innerHTML = codeHTML(fileBody(cur, field), esc); }
    const hook = hookOf(field);
    const CMDS = [
      ['make check', () => [`<span class="dim">Running the same checks as the auto-grader...</span>`, `<span class="ok">PASS</span> flow answers 202 for a valid event`, `<span class="bad">FAIL</span> missing token should give 401 (got 202)`, `<span class="dim">1 of 2 checks passed. Fix the Caddyfile TODO, then run again.</span>`]],
      [`curl /hooks/${hook}`, () => [`HTTP/1.1 202 Accepted`, `{"received": true}`]],
      ['git status', () => [`On branch main`, `modified:   ${cur}`, `<span class="dim">Push with: git push origin main (goes to github.com/${esc(user)})</span>`]],
      ['touch notes.md', () => {
        const list = S.extraFiles[field.id] = S.extraFiles[field.id] || [];
        const name = list.length ? `notes-${list.length + 1}.md` : 'notes.md';
        list.push({ path: name, body: `# My notes\n\nSaved in the workspace on ${new Date().toLocaleDateString('en-IN')}.\nStays here after the workspace stops.` });
        cur = name; drawTree(); drawFile(); paint();
        return [`<span class="ok">created</span> ~/lab/${name} <span class="dim">(saved to your disk; it stays after the workspace stops)</span>`];
      }],
    ];
    const chips = h('div', { class: 'row', style: { gap: '6px' } }, CMDS.map(([label, run]) => h('button', { type: 'button', class: 'btn sm', onclick: () => { termLines.push(`<span class="dim">$</span> ${esc(label)}`); run().forEach((l) => termLines.push(l)); drawTerm(); } }, label)));
    let m;
    const content = h('div', { class: 'm-workspace wsx-vs' },
      h('div', { class: 'vs-bar' }, h('div', { class: 'vs-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', { class: 'url' }, `workspace.lab › ${user} › VS Code`), h('span', { class: 'pill green' }, h('span', { class: 'dot' }), 'Running'), h('span', { class: 'demo-tag' }, 'Demo')),
      h('div', { class: 'vs-body' }, tree, h('div', { class: 'vs-ed' }, tabName, code)),
      h('div', { class: 'vs-term' }, h('div', { class: 'wsx-between' }, h('b', { class: 'small' }, 'Terminal'), h('span', { class: 'tiny muted' }, 'Click a command to run it')), chips, term),
      h('div', { class: 'vs-foot' }, h('span', { class: 'small muted' }, `A mock of the real editor. Students get full VS Code with ${field.company} files already set up.`),
        h('div', { class: 'row', style: { gap: '8px' } }, h('button', { type: 'button', class: 'btn sm', onclick: () => { m.close(); c.go('practical'); } }, 'Open the practical'), h('button', { type: 'button', class: 'btn sm primary', onclick: () => m.close() }, 'Close'))));
    drawTree(); drawFile(); drawTerm();
    m = c.modal(content);
    m.box.style.maxWidth = '1000px'; m.box.style.padding = '0'; m.box.style.gap = '0';
    m.box.setAttribute('aria-label', 'VS Code in the browser');
  }

  /* ---------- panels ---------- */
  function panelWorkspace(c) {
    const { h, icon, field } = c; const w = S.ws;
    const busy = w.status === 'starting' || w.status === 'stopping';
    const atLimit = w.usedMin >= WEEK_CAP;
    const label = { stopped: 'Stopped', starting: 'Starting…', running: 'Running', stopping: 'Stopping…' }[w.status];
    const sizeName = (s) => (s === 'large' ? 'Large 6 GB' : 'Small 2 GB');

    const steps = START_STEPS();
    const seq = h('div', { class: 'stack', style: { gap: '0' } }, steps.map((t, i) => {
      const st = w.status === 'running' ? 'pass' : w.status === 'starting' ? (i < w.step ? 'pass' : i === w.step ? 'run' : 'wait') : 'wait';
      return h('div', { class: 'check ' + st }, h('span', { class: 'ic', html: st === 'pass' ? '✓' : st === 'run' ? '<span class="spin" style="width:10px;height:10px;border-width:2px"></span>' : String(i + 1) }), h('span', { class: st === 'wait' ? 'muted' : '' }, t));
    }));

    const statusCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } },
        h('div', { class: 'wsx-status' }, h('div', { class: 'wsx-orb ' + (w.status === 'running' ? 'on' : busy ? 'busy' : ''), html: icon('cloud') }),
          h('div', {}, h('div', { class: 'eyebrow' }, 'Cloud workspace'), h('div', { class: 'wsx-big', 'data-test': 'ws-status' }, label), h('div', { class: 'small muted' }, `${sizeName(w.size)} · Mumbai · VS Code + terminal + Docker`))),
        h('span', { class: 'pill ' + (w.status === 'running' ? 'green' : busy ? 'blue' : '') }, h('span', { class: 'dot' }), label)),
      seq,
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { type: 'button', class: 'btn primary', disabled: w.status !== 'stopped' || atLimit, onclick: () => startWS(c) }, 'Start'),
        h('button', { type: 'button', class: 'btn', disabled: w.status !== 'running', onclick: () => stopWS(c) }, 'Stop'),
        h('button', { type: 'button', class: 'btn' + (w.pending && w.status === 'running' ? ' primary' : ''), disabled: w.status !== 'running', onclick: () => restartWS(c) }, w.pending && w.status === 'running' ? `Restart as ${sizeName(w.pending).split(' ')[0]}` : 'Restart')),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { type: 'button', class: 'btn', disabled: atLimit, onclick: () => openVS(c), html: icon('code') + '<span>Open in VS Code</span>' }),
        h('button', { type: 'button', class: 'btn', onclick: () => c.go('practical'), html: icon('play') + '<span>Open the practical</span>' })),
      atLimit ? h('div', { class: 'callout', style: { borderLeftColor: 'var(--red)' } }, h('b', {}, 'Limit reached, resets Monday. '), h('span', { class: 'small muted' }, 'Your files are safe. The in-browser tools still work.')) : null);

    const sizeCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Workspace size'), w.pending ? h('span', { class: 'pill amber' }, 'Restart needed') : h('span', { class: 'pill' }, sizeName(w.size))),
      h('div', { class: 'wsx-seg', role: 'group', 'aria-label': 'Workspace size' }, ['small', 'large'].map((s) => {
        const chosen = (w.pending || w.size) === s;
        return h('button', { type: 'button', 'aria-pressed': chosen ? 'true' : 'false', disabled: busy, onclick: () => {
          if (chosen) return;
          if (w.status === 'running') { w.pending = s === w.size ? null : s; c.toast(w.pending ? `Restart the workspace to switch to ${sizeName(s)}` : `Staying on ${sizeName(s)}`, w.pending ? 'amber' : undefined); }
          else { w.size = s; w.pending = null; emitWS(); c.toast(`Size set to ${sizeName(s)}`); }
          paint();
        } }, s === 'small' ? 'Small' : 'Large', h('small', {}, s === 'small' ? '2 GB memory' : '6 GB memory'));
      })),
      h('p', { class: 'small' }, (w.pending || w.size) === 'large'
        ? 'Large is for Docker lectures (Month 5) and monitoring lectures (Month 10), where several services run at once.'
        : 'Small is enough for most practicals, including this week’s Lecture 65.'),
      w.pending && w.status === 'running' ? h('div', { class: 'note' }, `Switching size needs a restart. Your files stay where they are. Press "Restart as ${sizeName(w.pending).split(' ')[0]}".`) : h('div', { class: 'note' }, 'Switching size while it runs needs a restart. Files are kept.'));

    const pct = Math.min(100, (w.usedMin / WEEK_CAP) * 100);
    const meter = h('div', { class: 'wsx-meter ' + (pct >= 100 ? 'full' : pct >= 80 ? 'warn' : ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '720', 'aria-valuenow': String(Math.floor(w.usedMin)), 'aria-label': 'Workspace hours used this week' }, h('i', { style: { width: pct + '%' } }));
    const used = h('b', { class: 'num' }, fmtH(w.usedMin));
    const left = h('span', { class: 'small muted num' });
    function drawMeter() {
      const p = Math.min(100, (w.usedMin / WEEK_CAP) * 100);
      meter.firstChild.style.width = p + '%';
      meter.className = 'wsx-meter ' + (p >= 100 ? 'full' : p >= 80 ? 'warn' : '');
      meter.setAttribute('aria-valuenow', String(Math.floor(w.usedMin)));
      used.textContent = fmtH(w.usedMin);
      left.textContent = w.usedMin >= WEEK_CAP ? 'Limit reached, resets Monday' : `${fmtH(WEEK_CAP - w.usedMin)} left · resets Monday`;
    }
    drawMeter();
    live.refs.drawMeter = drawMeter;
    const hoursCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Hours this week'), h('span', { class: 'pill ' + (w.status === 'running' ? 'green' : '') }, w.status === 'running' ? 'Counting' : 'Paused')),
      h('div', { class: 'wsx-between' }, h('span', {}, used, h('span', { class: 'muted' }, ' of 12 h used')), left),
      meter,
      h('p', { class: 'small muted' }, 'Hours only count while the workspace runs. In this demo the clock is sped up: one minute every three seconds.'),
      h('div', { class: 'row', style: { gap: '8px' } },
        atLimit ? h('button', { type: 'button', class: 'btn sm', onclick: () => { w.usedMin = 220; w.limitNotified = false; c.toast('Demo reset to 3 h 40 m used'); paint(); } }, 'Reset the week (demo)')
          : h('button', { type: 'button', class: 'btn sm', onclick: () => {
            accrue(); w.usedMin = Math.min(WEEK_CAP, w.usedMin + 240);
            if (w.usedMin >= WEEK_CAP) {
              live.timers.forEach((id) => clearTimeout(id)); live.timers.clear(); w.openAfter = false;
              const was = w.status; w.status = 'stopped'; w.step = -1; w.last = 0; limitReached(); if (was !== 'stopped') emitWS();
            } else c.toast(`${fmtH(w.usedMin)} used this week`);
            paint();
          } }, 'Add 4 hours (demo)')));

    const idleCard = h('section', { class: 'card stack' },
      h('h3', {}, 'Idle auto-shutdown'),
      h('p', { class: 'small' }, 'If nobody types or runs anything for 20 minutes, the workspace stops by itself. That saves the student’s weekly hours and the lab’s server costs. Files are saved first.'),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { type: 'button', class: 'btn', disabled: w.status !== 'running', onclick: () => {
          if (w.status !== 'running') return;
          accrue(); if (w.status !== 'running') { paint(); return; }
          w.status = 'stopped'; w.step = -1; w.last = 0; emitWS();
          c.notify('Workspace stopped after 20 minutes idle', 'We saved your files and stopped the workspace to save your hours. Start it again any time.', 'workspace');
          c.toast('Idle for 20 minutes: workspace stopped, files saved', 'amber'); paint();
        } }, 'Simulate 20 minutes idle'),
        w.status !== 'running' ? h('span', { class: 'tiny muted' }, 'Start the workspace to try this.') : null));

    const files = filesFor(field);
    const filesCard = h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, 'Your files'), h('p', { class: 'small muted' }, `Saved between sessions. Stop or restart and they are still here. Set up for ${field.company}.`)), h('span', { class: 'pill' }, `${files.length} files`)),
      h('div', { class: 'wsx-files' }, files.map((f) => h('button', { type: 'button', class: 'wsx-file', title: f.desc || f.path, onclick: () => openVS(c, f.path), html: icon(/\.(py|ts|sh|json|http)$|Caddyfile/.test(f.path) ? 'code' : 'book') }, h('code', {}, f.path), h('span', { class: 'meta num' }, `${f.size} · ${f.when}`)))),
      h('p', { class: 'tiny muted', style: { marginTop: '8px' } }, 'Click a file to open it in VS Code.'));

    return h('div', { class: 'wsx-panel' },
      h('div', { class: 'grid-2' }, statusCard, sizeCard),
      h('div', { class: 'grid-2' }, hoursCard, idleCard),
      filesCard);
  }

  function keyString() { return `nmk_live_S1001_4f8c2a91d03e7b56${S.key.suffix}`; }
  function usageRows(c) {
    const base = [[57, 'Basic MCP server', 9.4, 41], [60, 'MCP tool with input checks', 12.6, 55], [62, 'Agent tool-calling exercise', 14.2, 63], [63, 'Activepieces AI step', 11.3, 48], [65, 'Webhook practical', 8.1, 37], [0, 'AI tutor hints', 6.4, 72]];
    const rows = base.map(([lec, name, inr, calls]) => ({ lec, name: lec ? `L${lec} · ${name}` : name, inr, calls }));
    if (S.key.playground > 0) rows.push({ lec: -1, name: 'AI playground', inr: S.key.playground, calls: Math.max(1, Math.round(S.key.playground * 20)) });
    const known = rows.reduce((a, r) => a + r.inr, 0);
    if (S.key.used - known > 0.05) rows.push({ lec: -2, name: 'Agent practice run (heavy use)', inr: S.key.used - known, calls: Math.round((S.key.used - known) * 4) });
    return rows;
  }

  function panelKey(c) {
    const { h, icon } = c; const k = S.key;
    const pct = Math.min(100, (k.used / BUDGET) * 100);
    const masked = `nmk_live_••••••••••••${k.suffix}`;
    const keyCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('div', { class: 'eyebrow' }, 'Lab AI key'), h('h3', {}, 'Your key for AI models')), h('span', { class: 'pill green' }, 'Active')),
      h('div', { class: 'wsx-key' }, h('code', { 'data-test': 'key' }, k.reveal ? keyString() : masked),
        h('button', { type: 'button', class: 'btn sm', onclick: () => { k.reveal = !k.reveal; paint(); } }, k.reveal ? 'Hide' : 'Show'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => copyText(c, keyString(), 'Key') }, 'Copy')),
      h('div', { class: 'callout' }, h('b', {}, 'No personal AI account needed. '), h('span', { class: 'small' }, 'The lab gives every student this key. It is already set in the workspace, so code just works. No card, no sign-up with an AI company.')),
      k.confirm
        ? h('div', { class: 'wsx-confirm' }, h('b', {}, 'Rotate this key?'), h('p', { class: 'small' }, 'The old key stops working right away. The workspace picks up the new key by itself. Do this if the key was shared by mistake, for example in a GitHub commit.'),
          h('div', { class: 'row', style: { gap: '8px' } },
            h('button', { type: 'button', class: 'btn primary sm', onclick: () => { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const n = hash(k.suffix + Date.now()); k.suffix = Array.from({ length: 4 }, (_, i) => chars[(n >>> (i * 5)) % chars.length]).join(''); k.confirm = false; k.reveal = false; c.toast(`New key issued, ending ${k.suffix}. The old key no longer works.`, 'green'); paint(); } }, 'Yes, rotate the key'),
            h('button', { type: 'button', class: 'btn sm', onclick: () => { k.confirm = false; paint(); } }, 'Cancel')))
        : h('div', { class: 'row', style: { gap: '8px' } }, h('button', { type: 'button', class: 'btn sm', onclick: () => { k.confirm = true; paint(); }, html: icon('key') + '<span>Rotate key</span>' }), h('span', { class: 'tiny muted' }, 'Gives you a new key and turns off the old one.')));

    const budgetCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Monthly budget'), h('span', { class: 'pill ' + (pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'blue') }, `${Math.round(pct)}% used`)),
      h('div', { class: 'wsx-between' }, h('span', { class: 'wsx-big num' }, rupee(k.used, 0), h('span', { class: 'small muted', style: { fontFamily: 'var(--body)', fontWeight: 600 } }, ` of ${rupee(BUDGET)} used this month`)), h('span', { class: 'small muted num' }, `${rupee(Math.max(0, BUDGET - k.used), 0)} left`)),
      h('div', { class: 'wsx-meter ' + (pct >= 100 ? 'full' : pct >= 80 ? 'warn' : ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(BUDGET), 'aria-valuenow': String(Math.round(k.used)), 'aria-label': 'AI budget used' }, h('i', { style: { width: pct + '%' } }), h('b', { style: { left: '80%' }, title: 'Alert at 80%' })),
      h('p', { class: 'small muted' }, 'The amber mark is the 80% alert. The budget resets on the 1st of each month.'),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { type: 'button', class: 'btn', disabled: pct >= 85, onclick: () => {
          k.used = Math.max(k.used, BUDGET * 0.85);
          if (!k.alerted) { k.alerted = true; c.notify('AI key at 85% of this month’s budget', `${rupee(Math.round(k.used))} of ${rupee(BUDGET)} used. Requests slow down near the cap. Your mentor can see this too.`, 'workspace'); }
          c.toast('Budget alert: 85% of this month’s AI budget used', 'amber'); paint();
        } }, 'Simulate heavy use'),
        h('button', { type: 'button', class: 'btn sm ghost', disabled: k.used <= 62 + k.playground + 0.01, onclick: () => { k.used = 62 + k.playground; k.alerted = false; c.toast('Demo usage reset'); paint(); } }, 'Reset demo usage')));

    const rows = usageRows(c);
    const total = rows.reduce((a, r) => a + r.inr, 0);
    const usageCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Usage by practical'), h('span', { class: 'demo-tag' }, 'Demo data')),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Where'), h('th', {}, 'AI calls'), h('th', {}, 'Cost'), h('th', {}, 'Share'))),
        h('tbody', {}, rows.map((r) => h('tr', { class: r.lec > 0 ? 'clickable' : '', title: r.lec > 0 ? `Open Lecture ${r.lec}` : null, onclick: r.lec > 0 ? () => openLecture(c, r.lec) : null },
          h('td', {}, r.name), h('td', { class: 'num' }, String(r.calls)), h('td', { class: 'num' }, rupee(r.inr, 2)),
          h('td', { style: { minWidth: '110px' } }, h('div', { class: 'progress' }, h('i', { style: { width: (r.inr / Math.max(total, 1) * 100) + '%' } })))))),
        h('tfoot', {}, h('tr', {}, h('td', {}, h('b', {}, 'Total this month')), h('td', { class: 'num' }, String(rows.reduce((a, r) => a + r.calls, 0))), h('td', { class: 'num' }, h('b', {}, rupee(total, 2))), h('td', {}))))),
      h('p', { class: 'tiny muted' }, 'Click a lecture row to open it.'));

    const modelsCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Models this key can call'), h('span', { class: 'small muted' }, 'All through the lab gateway, Amazon Bedrock in Mumbai')),
      h('div', { class: 'grid-3' }, Object.values(MODELS).map((m) => h('div', { class: 'wsx-model' },
        h('div', { class: 'wsx-between' }, h('b', {}, m.name), h('span', { class: 'pill ' + (m.id === 'oss' ? 'blue' : m.id === 'haiku' ? 'violet' : 'green') }, m.tag)),
        h('p', { class: 'small muted' }, m.blurb),
        h('span', { class: 'tiny muted num' }, `About ${rupee(m.outK, 3)} per 1,000 words out`)))),
      h('p', { class: 'small muted' }, 'Student data stays in India. Small local models (qwen2.5) also run on a shared lab server for practice that costs nothing per call.'));

    const limitsCard = h('section', { class: 'card stack' },
      h('h3', {}, 'Limits, explained simply'),
      h('div', { class: 'grid-3' },
        h('div', { class: 'stat' }, h('b', { class: 'num' }, '20 / min'), h('span', {}, 'Requests per minute. A runaway loop cannot burn the budget in seconds.')),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, rupee(BUDGET)), h('span', {}, 'Monthly cap. At the cap, calls pause until the 1st or a mentor tops up.')),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, '80%'), h('span', {}, 'Alert point. The student and their mentor get a notification.'))));

    return h('div', { class: 'wsx-panel' }, h('div', { class: 'grid-2' }, keyCard, budgetCard), usageCard, modelsCard, limitsCard);
  }

  function panelPlay(c) {
    const { h, field, esc } = c; const P = S.play;
    if (P.prompts[field.id] == null) P.prompts[field.id] = defaultPrompt(field);
    const ta = h('textarea', { class: 'field-input', rows: '3', 'aria-label': 'Prompt', oninput: (e) => { P.prompts[field.id] = e.target.value; } });
    ta.value = P.prompts[field.id];
    const tempLabel = () => (P.temp < 0.34 ? 'Precise' : P.temp < 0.67 ? 'Balanced' : 'Creative');
    const tl = h('span', { class: 'pill blue num' });
    const drawTL = () => { tl.textContent = `${P.temp.toFixed(1)} · ${tempLabel()}`; };
    drawTL();
    const slider = h('input', { type: 'range', min: '0', max: '1', step: '0.1', 'aria-label': 'Temperature', oninput: (e) => { const before = tempLabel(); P.temp = Number(e.target.value); drawTL(); if (before !== tempLabel() && P.results[field.id] && !P.running) rerunHint.hidden = false; } });
    slider.value = String(P.temp);
    const rerunHint = h('span', { class: 'tiny muted', hidden: true }, 'Wording changes with temperature. Press Run again to see it.');
    const chips = h('div', { class: 'wsx-chips', role: 'group', 'aria-label': 'Models' }, Object.values(MODELS).map((m) => {
      const on = P.models.includes(m.id);
      return h('button', { type: 'button', class: 'wsx-chip', 'aria-pressed': on ? 'true' : 'false', onclick: () => {
        if (on && P.models.length === 1) { c.toast('Pick at least one model', 'amber'); return; }
        P.models = on ? P.models.filter((x) => x !== m.id) : Object.keys(MODELS).filter((x) => x === m.id || P.models.includes(x));
        paint();
      } }, h('span', { class: 'box' }, on ? '✓' : ''), m.name);
    }));
    const out = h('div', { class: 'grid-3' });
    const runBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => run() }, 'Run');
    function card(r) {
      const m = MODELS[r.model];
      const pre = h('pre', {}); const stats = h('div', { class: 'stats' });
      const el = h('div', { class: 'wsx-ans' }, h('div', { class: 'wsx-between' }, h('b', {}, m.name), h('span', { class: 'pill' }, m.tag)), pre, stats);
      return { el, pre, stats, r };
    }
    function drawResults(animate) {
      out.textContent = '';
      const res = P.results[field.id]; if (!res) { out.append(h('div', { class: 'note', style: { gridColumn: '1 / -1' } }, 'Pick models and press Run. Answers appear side by side with their token count, time and cost.')); return; }
      out.className = res.length === 3 ? 'grid-3' : res.length === 2 ? 'grid-2' : 'stack';
      const cards = res.map(card); cards.forEach((k) => out.append(k.el));
      const fin = (k) => {
        k.pre.textContent = k.r.text;
        k.stats.textContent = '';
        k.stats.append(h('span', { class: 'pill num' }, `${k.r.tokens} tokens`), h('span', { class: 'pill num' }, `${(k.r.ms / 1000).toFixed(1)} s`), h('span', { class: 'pill green num' }, rupee(k.r.cost, 3)));
      };
      if (!animate) { cards.forEach(fin); return; }
      P.running = true; runBtn.disabled = true; runBtn.innerHTML = '<span class="spin"></span> Running';
      cards.forEach((k) => { k.toks = tokenize(k.r.text); k.i = 0; k.pre.innerHTML = '<span class="wsx-caret"></span>'; k.wait = Math.round(k.r.lat / 40); });
      const id = every(() => {
        let done = true;
        cards.forEach((k) => {
          if (k.i >= k.toks.length) return; done = false;
          if (k.wait > 0) { k.wait--; return; }
          const step = Math.max(1, Math.round(MODELS[k.r.model].speed / 40));
          k.i = Math.min(k.toks.length, k.i + step);
          k.pre.innerHTML = esc(k.toks.slice(0, k.i).map((t) => (t.nl ? '\n' : '') + t.t).join('').replace(/^ /, '')) + (k.i < k.toks.length ? '<span class="wsx-caret"></span>' : '');
          if (k.i >= k.toks.length) fin(k);
        });
        if (done) { stopEvery(id); P.running = false; live.refs.stopStream = null; runBtn.disabled = false; runBtn.textContent = 'Run again'; }
      }, 40);
      live.refs.stopStream = () => { stopEvery(id); P.running = false; };
    }
    function run() {
      const prompt = (P.prompts[field.id] || '').trim();
      if (!prompt) { c.toast('Type a prompt first', 'amber'); ta.focus(); return; }
      rerunHint.hidden = true;
      const inTok = tokCount(prompt);
      const res = P.models.map((id) => {
        const m = MODELS[id]; const text = answer(id, prompt, field, P.temp); const outTok = tokCount(text);
        const ms = m.lat + Math.round(outTok / m.speed * 1000);
        return { model: id, text, tokens: inTok + outTok, ms, lat: m.lat, cost: inTok / 1000 * m.inK + outTok / 1000 * m.outK };
      });
      P.results[field.id] = res;
      const spent = res.reduce((a, r) => a + r.cost, 0);
      S.key.playground += spent; S.key.used += spent;
      drawResults(!reduced());
      if (reduced()) runBtn.textContent = 'Run again';
    }
    drawResults(false);
    if (P.results[field.id]) runBtn.textContent = 'Run again';
    return h('div', { class: 'wsx-panel' },
      h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('h3', {}, 'AI playground'), h('p', { class: 'small muted' }, 'Compare models on the same prompt. Each run is paid from the lab AI key.')), h('span', { class: 'demo-tag' }, 'Scripted answers')),
        ta,
        h('div', {}, h('div', { class: 'eyebrow', style: { marginBottom: '6px' } }, 'Models (pick 1 to 3)'), chips),
        h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'wsx-between' }, h('span', { class: 'eyebrow' }, 'Temperature'), tl), slider, h('div', { class: 'wsx-between tiny muted' }, h('span', {}, 'Precise, same words each time'), h('span', {}, 'Creative, more varied wording'))),
        h('div', { class: 'row', style: { gap: '10px' } }, runBtn, h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { P.prompts[field.id] = defaultPrompt(field); ta.value = P.prompts[field.id]; c.toast('Prompt reset'); } }, 'Reset prompt'), rerunHint)),
      out);
  }

  function panelTok(c) {
    const { h, field, esc } = c; const T = S.tok; const sm = samples(field);
    if (T.text[field.id] == null) T.text[field.id] = sm[T.mode];
    const ta = h('textarea', { class: 'field-input', rows: '3', 'aria-label': 'Text to split into tokens' });
    ta.value = T.text[field.id];
    const view = h('div', { class: 'wsx-toks', 'aria-label': 'Tokens' });
    const count = h('b', { class: 'num' }); const chars = h('b', { class: 'num' }); const ratio = h('b', { class: 'num' });
    function draw() {
      const s = T.text[field.id]; const toks = tokenize(s);
      view.innerHTML = toks.length ? toks.map((t, i) => (t.nl ? '\n' : '') + `<span class="t${i % 5}">${esc(t.t)}</span>`).join('') : '<span class="muted" style="background:none">Type something above to see its tokens.</span>';
      count.textContent = String(toks.length); chars.textContent = String(s.length); ratio.textContent = toks.length ? (s.length / toks.length).toFixed(1) : '0';
    }
    ta.addEventListener('input', () => { T.text[field.id] = ta.value; draw(); seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', T.text[field.id] === sm[b.dataset.id] ? 'true' : 'false')); });
    draw();
    const seg = h('div', { class: 'wsx-seg', role: 'group', 'aria-label': 'Sample text' }, [['en', 'English'], ['hi', 'Hinglish']].map(([id, label]) =>
      h('button', { type: 'button', 'data-id': id, 'aria-pressed': T.mode === id && T.text[field.id] === sm[id] ? 'true' : 'false', onclick: () => { T.mode = id; T.text[field.id] = sm[id]; paint(); } }, label)));
    const ne = tokCount(sm.en), nh = tokCount(sm.hi); const more = Math.round((nh / ne - 1) * 100);
    const mx = Math.max(ne, nh);
    const compare = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Same message, two languages'), h('span', { class: 'pill amber' }, `Hinglish +${more}% tokens`)),
      h('div', { class: 'wsx-bars' },
        h('div', { class: 'wsx-bar' }, h('span', {}, 'English'), h('div', { class: 'progress' }, h('i', { style: { width: (ne / mx * 100) + '%' } })), h('span', { class: 'num' }, `${ne} tokens`)),
        h('div', { class: 'wsx-bar alt' }, h('span', {}, 'Hinglish'), h('div', { class: 'progress' }, h('i', { style: { width: (nh / mx * 100) + '%' } })), h('span', { class: 'num' }, `${nh} tokens`))),
      h('p', { class: 'small' }, `AI models charge per token. Most were trained mostly on English, so Hinglish words get cut into more pieces. The same request costs about ${more}% more. Students learn to write prompts that fit the budget.`));
    return h('div', { class: 'wsx-panel' },
      h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('h3', {}, 'Tokenizer'), h('p', { class: 'small muted' }, 'AI models read text in small pieces called tokens. Type below to see how text is cut.')), seg),
        ta, view,
        h('div', { class: 'grid-3' }, h('div', { class: 'stat' }, count, h('span', {}, 'tokens')), h('div', { class: 'stat' }, chars, h('span', {}, 'characters')), h('div', { class: 'stat' }, ratio, h('span', {}, 'characters per token'))),
        h('p', { class: 'tiny muted' }, 'Teaching version of a tokenizer: common English words stay whole, other long words are cut into 4-letter pieces, and punctuation is its own token. Real tokenizers work the same way, with a much bigger word list.')),
      compare);
  }

  function panelVPS(c) {
    const { h, icon } = c; const V = S.vps;
    const ip = '10.42.17.86'; const user = D().demo_student.name.split(' ')[0].toLowerCase();
    const ssh = `ssh ${user}@${ip}`;
    const resetting = V.status === 'resetting';
    const up = Math.max(0, Date.now() - V.bootedAt); const upTxt = up < 3600000 ? `${Math.max(1, Math.round(up / 60000))} min` : `${Math.floor(up / 86400000)} days ${Math.floor((up % 86400000) / 3600000)} h`;
    const RULES = [
      [22, 'SSH', 'Log in from your laptop', 'You can no longer SSH in from your laptop. This is the most common way people lock themselves out. The lab console can still reach the server, so you can fix it.'],
      [80, 'HTTP', 'Website, plain', 'Visitors on http:// can no longer reach the site. Most sites send these visitors to HTTPS, so they now see an error.'],
      [443, 'HTTPS', 'Website, secure', 'The secure website stops loading for everyone. The app keeps running, but nobody can reach it.'],
    ];
    const statusPill = h('span', { class: 'pill ' + (resetting ? 'blue' : 'green') }, h('span', { class: 'dot' }), resetting ? 'Resetting…' : 'Running');
    const offRules = RULES.filter(([p]) => !V.rules[p]);
    const ufw = ['<span class="dim">$ sudo ufw status</span>', 'Status: active', '', 'To            Action      From', '--            ------      ----'];
    RULES.forEach(([p, name]) => ufw.push(`${String(p).padEnd(14)}${V.rules[p] ? '<span class="ok">ALLOW IN</span>' : '<span class="bad">DENY IN </span>'}    Anywhere   <span class="dim"># ${name}</span>`));
    ufw.push('', '<span class="dim">Everything else: DENY IN (default)</span>');

    const serverCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } },
        h('div', { class: 'wsx-status' }, h('div', { class: 'wsx-orb ' + (resetting ? 'busy' : 'on'), html: icon('terminal') }), h('div', {}, h('div', { class: 'eyebrow' }, 'Practice server (VPS)'), h('div', { class: 'wsx-big' }, 'Ubuntu 24.04 LTS'), h('div', { class: 'small muted' }, 'Your own server to break and fix, from Month 5'))),
        statusPill),
      h('div', { class: 'wsx-kv' },
        h('div', {}, h('span', {}, 'IP address'), h('b', { class: 'num' }, ip)), h('div', {}, h('span', {}, 'User'), h('b', {}, `${user} (not root)`)),
        h('div', {}, h('span', {}, 'Size'), h('b', {}, '1 vCPU · 1 GB')), h('div', {}, h('span', {}, 'Up for'), h('b', { class: 'num' }, resetting ? '—' : upTxt))),
      h('div', {}, h('div', { class: 'eyebrow', style: { marginBottom: '6px' } }, 'Connect with SSH'), h('div', { class: 'wsx-cmd' }, h('code', {}, ssh), h('button', { type: 'button', class: 'btn sm', onclick: () => copyText(c, ssh, 'SSH command') }, 'Copy'))),
      h('p', { class: 'tiny muted' }, 'Login uses an SSH key set up in Lecture 41. Passwords are switched off.'),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { type: 'button', class: 'btn sm', onclick: () => openLecture(c, 38), html: icon('play') + '<span>Lecture 38: Linux essentials</span>' }),
        h('button', { type: 'button', class: 'btn sm', onclick: () => openLecture(c, 41), html: icon('play') + '<span>Lecture 41: VPS and SSH</span>' })));

    const resetSteps = ['Stopping the server', 'Restoring a clean Ubuntu 24.04 image', 'Adding your SSH key and the lab firewall rules'];
    let resetBox;
    if (resetting) resetBox = h('div', { class: 'stack', style: { gap: '0' } }, resetSteps.map((t, i) => { const st = i < V.step ? 'pass' : i === V.step ? 'run' : 'wait'; return h('div', { class: 'check ' + st }, h('span', { class: 'ic', html: st === 'pass' ? '✓' : st === 'run' ? '<span class="spin" style="width:10px;height:10px;border-width:2px"></span>' : String(i + 1) }), h('span', {}, t)); }));
    else if (V.confirm) resetBox = h('div', { class: 'wsx-confirm red' }, h('b', {}, 'Reset the server to a clean start?'), h('p', { class: 'small' }, 'Everything on the server is wiped and rebuilt in about a minute. Your workspace files are not touched. Use this when a practice goes wrong and you want a fresh start.'),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { type: 'button', class: 'btn primary sm', onclick: () => {
          V.confirm = false; V.status = 'resetting'; V.step = 0; paint();
          const ms = reduced() ? 250 : 1000;
          later(() => { V.step = 1; paint(); }, ms); later(() => { V.step = 2; paint(); }, ms * 2);
          later(() => finishReset(c), ms * 3);
        } }, 'Yes, reset it'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => { V.confirm = false; paint(); } }, 'Cancel')));
    else resetBox = h('div', { class: 'row', style: { gap: '8px' } }, h('button', { type: 'button', class: 'btn', onclick: () => { V.confirm = true; paint(); } }, 'Reset server'), h('span', { class: 'tiny muted' }, V.resets ? `Reset ${V.resets} time${V.resets > 1 ? 's' : ''} in this demo.` : 'Wipes it and starts fresh.'));

    const resetCard = h('section', { class: 'card stack' }, h('h3', {}, 'Start again'), h('p', { class: 'small muted' }, 'Broke something? That is part of learning. One click gives a clean server.'), resetBox);

    const fwCard = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('h3', {}, 'Firewall rules'), h('p', { class: 'small muted' }, 'Which doors on the server are open. Turn one off to see what happens.')), h('button', { type: 'button', class: 'btn sm', onclick: () => openLecture(c, 42) }, 'Lecture 42: firewalls')),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Port'), h('th', {}, 'Used for'), h('th', {}, 'From'), h('th', {}, 'Allow'))),
        h('tbody', {}, RULES.map(([p, name, use]) => h('tr', {},
          h('td', { class: 'num' }, h('b', {}, String(p))), h('td', {}, `${name} · `, h('span', { class: 'muted small' }, use)), h('td', { class: 'small' }, 'Anywhere'),
          h('td', {}, h('button', { type: 'button', class: 'wsx-switch', role: 'switch', disabled: resetting, 'aria-checked': V.rules[p] ? 'true' : 'false', 'aria-label': `Allow port ${p} (${name})`, onclick: () => {
            V.rules[p] = !V.rules[p];
            c.toast(V.rules[p] ? `Port ${p} (${name}) open again` : `Port ${p} (${name}) blocked`, V.rules[p] ? 'green' : (p === 22 ? 'red' : 'amber'));
            paint();
          } }))))))),
      offRules.length
        ? h('div', { class: 'stack', style: { gap: '8px' } }, offRules.map(([p, name, , effect]) => h('div', { class: 'callout', style: { borderLeftColor: p === 22 ? 'var(--red)' : 'var(--amber)' } }, h('b', {}, `Port ${p} (${name}) is blocked. `), h('span', { class: 'small' }, effect))))
        : h('div', { class: 'callout', style: { borderLeftColor: 'var(--green)' } }, h('b', {}, 'All three open. '), h('span', { class: 'small' }, 'SSH for you, HTTP and HTTPS for website visitors. Every other port stays closed, which is the safe default.')),
      h('div', { class: 'term', html: ufw.join('\n') }));

    return h('div', { class: 'wsx-panel' }, h('div', { class: 'grid-2' }, serverCard, h('div', { class: 'stack', style: { gap: '16px' } }, resetCard, h('section', { class: 'card stack' }, h('h3', {}, 'Why a real server?'), h('p', { class: 'small' }, 'Jobs ask for Linux and cloud skills. Here each student practises on an isolated server on a private lab network. Nothing they do can reach the public internet or other students.')))), fwCard);
  }
  function finishReset(c) {
    const V = S.vps; if (V.status !== 'resetting') return;
    V.status = 'running'; V.step = -1; V.rules = { 22: true, 80: true, 443: true }; V.bootedAt = Date.now(); V.resets++;
    (live ? live.c : c).toast('Server reset. Clean Ubuntu 24.04, firewall back to lab defaults.', 'green'); paint();
  }

  function panelWhen(c) {
    const { h, data } = c; const now = data.demo_student.month;
    const sel = S.month;
    const months = h('div', { class: 'wsx-months' }, Array.from({ length: 12 }, (_, i) => i + 1).map((m) =>
      h('button', { type: 'button', class: 'wsx-month' + (m === now ? ' now' : ''), 'aria-pressed': m === sel ? 'true' : 'false', onclick: () => { S.month = m; paint(); } }, h('b', {}, `Month ${m}`), h('span', {}, data.months[m]))));
    const ids = PLAN[sel];
    const cloud = h('div', { class: 'wsx-cloud', 'aria-label': 'All lab tools' }, Object.entries(TOOLS).map(([id, t]) => h('span', { class: 'wsx-tool' + (ids.includes(id) ? ' hi' : '') }, t.name)));
    const lecs = data.lectures.filter((l) => l.month === sel);
    const firstLec = lecs[0];
    const detail = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } },
        h('div', {}, h('div', { class: 'eyebrow' }, `Month ${sel} · Lectures ${lecs[0].id}–${lecs[lecs.length - 1].id}`), h('h3', {}, data.months[sel])),
        h('button', { type: 'button', class: 'btn primary sm', onclick: () => openLecture(c, sel === now ? data.demo_student.lecture : firstLec.id) }, 'Open the lecture')),
      h('p', { class: 'small muted' }, MONTH_NOTE[sel]),
      h('div', { class: 'stack', style: { gap: '8px' } }, ids.map((id) => { const t = TOOLS[id]; return h('div', { class: 'wsx-toolcard' }, h('div', {}, h('b', {}, t.name), h('p', { class: 'small muted' }, t.what)), t.tab ? h('button', { type: 'button', class: 'btn sm', onclick: () => { S.tab = t.tab; paint(true); } }, 'Open here') : h('span', { class: 'pill' }, sel < now ? 'Done' : sel === now ? 'This month' : 'Later')); })));
    return h('div', { class: 'wsx-panel' },
      h('section', { class: 'card stack' }, h('div', {}, h('h3', {}, 'Which tool when'), h('p', { class: 'small muted' }, 'The lab grows with the student. Simple browser tools first, real servers later. Click a month.')), months),
      h('div', { class: 'grid-2' }, detail, h('section', { class: 'card stack' }, h('div', { class: 'eyebrow' }, 'All lab tools'), cloud, h('p', { class: 'tiny muted' }, 'Highlighted: the tools used in the month you picked. Everything opens in a browser on a basic laptop.'))));
  }

  /* ---------- shell ---------- */
  const TABS = [['ws', 'Cloud workspace'], ['key', 'AI key'], ['play', 'AI playground'], ['tok', 'Tokenizer'], ['vps', 'Practice server'], ['when', 'Which tool when']];
  const PANELS = { ws: panelWorkspace, key: panelKey, play: panelPlay, tok: panelTok, vps: panelVPS, when: panelWhen };

  function summary(c) {
    const { h } = c; const w = S.ws; const k = S.key;
    const wsLabel = { stopped: 'Stopped', starting: 'Starting…', running: 'Running', stopping: 'Stopping…' }[w.status];
    const kp = k.used / BUDGET;
    const btn = (tab, cls, text) => h('button', { type: 'button', class: 'pill ' + cls, onclick: () => { S.tab = tab; paint(true); } }, text);
    return h('div', { class: 'wsx-sum' },
      btn('ws', w.status === 'running' ? 'green' : w.status === 'stopped' ? '' : 'blue', `Workspace: ${wsLabel}`),
      btn('ws', w.usedMin >= WEEK_CAP ? 'red' : '', `${fmtH(w.usedMin)} of 12 h`),
      btn('key', kp >= 0.8 ? 'amber' : 'blue', `AI budget: ${rupee(Math.round(k.used))} of ${rupee(BUDGET)}`),
      btn('vps', S.vps.status === 'running' ? 'green' : 'blue', `Practice server: ${S.vps.status === 'running' ? 'Running' : 'Resetting'}`));
  }

  function paint(focusTab) {
    if (!live) return;
    const { root, c } = live; const { h } = c;
    if (live.refs.stopStream) { live.refs.stopStream(); live.refs.stopStream = null; }
    const keepY = window.scrollY;
    root.textContent = '';
    const s = c.data.demo_student;
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'My lab sections' }, TABS.map(([id, label]) =>
      h('button', { type: 'button', class: 'tab', role: 'tab', id: `wsx-tab-${id}`, 'aria-selected': S.tab === id ? 'true' : 'false', 'aria-controls': 'wsx-panel', tabindex: S.tab === id ? '0' : '-1',
        onclick: () => { if (S.tab === id) return; S.tab = id; paint(true); },
        onkeydown: (e) => { const i = TABS.findIndex((t) => t[0] === S.tab); if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); S.tab = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0]; paint(true); } } }, label)));
    let panel;
    try { panel = PANELS[S.tab](c); } catch (e) { console.error(e); panel = h('div', { class: 'card' }, 'This section failed to load.'); }
    root.append(h('div', { class: 'm-workspace' },
      h('section', { class: 'card wsx-hero' },
        h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'eyebrow' }, `${s.name} · ${s.batch} · ${c.field.name}`), h('h2', {}, 'My lab'), h('p', { class: 'small muted' }, 'Everything a student needs to code, in the browser. No installs, no personal AI account, works on a basic laptop.')),
        h('div', { class: 'stack', style: { gap: '8px', justifyItems: 'start' } }, summary(c), h('span', { class: 'demo-tag' }, 'Demo data'))),
      tabs,
      h('div', { id: 'wsx-panel', role: 'tabpanel', 'aria-labelledby': `wsx-tab-${S.tab}` }, panel)));
    if (focusTab) { const t = root.querySelector(`#wsx-tab-${S.tab}`); if (t) { t.focus({ preventScroll: true }); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } }
    else window.scrollTo(0, keepY);
  }

  NM.register('workspace', {
    label: 'My lab', title: 'My lab: workspace and AI key', icon: 'cloud', group: 'Student', order: 35,
    render(root, c) {
      injectCSS();
      if (live && live.root === root && live.root.isConnected) { live.c = c; paint(); return; } // field switch: same screen, new field
      if (live) this.destroy();
      live = { root, c, timers: new Set(), intervals: new Set(), refs: {} };
      // A start sequence or reset interrupted by navigation has finished by the time the student is back.
      if (S.ws.status === 'starting') { S.ws.status = 'running'; S.ws.step = 3; S.ws.last = Date.now(); emitWS(); }
      if (S.ws.status === 'stopping') { S.ws.status = 'stopped'; S.ws.step = -1; emitWS(); }
      if (S.vps.status === 'resetting') finishReset(c);
      accrue();
      paint();
      every(() => {
        const before = S.ws.status;
        if (before !== 'running') return;
        const stopped = accrue();
        if (stopped) { paint(); return; }
        if (S.tab === 'ws' && live.refs.drawMeter) live.refs.drawMeter();
        const sum = live.root.querySelector('.wsx-sum button:nth-child(2)'); if (sum) sum.textContent = `${fmtH(S.ws.usedMin)} of 12 h`;
      }, 1000);
    },
    destroy() {
      if (!live) return;
      accrue();
      if (live.refs.stopStream) live.refs.stopStream();
      live.timers.forEach((id) => clearTimeout(id)); live.intervals.forEach((id) => clearInterval(id));
      const wasStarting = S.ws.status === 'starting';
      live = null;
      if (wasStarting) { S.ws.status = 'running'; S.ws.step = 3; S.ws.last = Date.now(); S.ws.openAfter = false; emitWS(); }
      if (S.ws.status === 'stopping') { S.ws.status = 'stopped'; S.ws.step = -1; S.ws.last = 0; emitWS(); }
      if (S.vps.status === 'resetting') { S.vps.status = 'running'; S.vps.step = -1; S.vps.rules = { 22: true, 80: true, 443: true }; S.vps.bootedAt = Date.now(); S.vps.resets++; }
    },
  });
})();
