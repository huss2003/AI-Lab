/* Exams: assessment list, browser-lockdown exam (full screen, timer, autosave, navigator, integrity log), results and mentor-view integrity summary.
   Everything is scripted demo data. Real browser events (tab switch, focus loss, full-screen exit, copy/paste/right-click) are recorded locally only. */
(function () {
  const ID = 'exam';
  const EXAM_MIN = 30;
  const SAVE_EVERY = 20; // seconds

  // Field-specific names used in questions (taken from each field's Month 7 / Month 8 practicals in data.js).
  const FX = {
    fullstack_software: { tool: 'search_tickets', flow: 'advisory-intake', key: 'event_id', api: 'partner API' },
    web_dev: { tool: 'check_alt_text', flow: 'draft-submitted', key: 'slug', api: 'CMS API' },
    data_analytics: { tool: 'profile_file', flow: 'data-request', key: 'request_text', api: 'POS API' },
    business_analysis: { tool: 'get_test_case', flow: 'uat-intake', key: 'tc_id', api: 'Shipper Portal API' },
    cloud: { tool: 'estimate_monthly_cost', flow: 'resource-created', key: 'resource_id', api: 'billing API' },
    cybersecurity: { tool: 'get_attack_technique', flow: 'ioc-submit', key: 'indicator', api: 'threat-intel API' },
    data_science: { tool: 'list_metrics', flow: 'batch-landed', key: 'batch_date', api: 'trips API' },
    devops: { tool: 'list_deployments', flow: 'ci-failure', key: 'run_id', api: 'GitHub API' },
    ai_ml: { tool: 'lookup_policy', flow: 'labelloop-batch', key: 'batch_id', api: 'claims API' },
  };
  const fx = (f) => FX[f.id] || { tool: 'lookup_record', flow: 'record-intake', key: 'record_id', api: 'partner API' };

  // ---------- Question pool ----------
  function pool(f) {
    const x = fx(f), co = f.company;
    const m7 = [
      { id: 'm7-arch', fixed: false, topic: 'MCP architecture · Lecture 55', q: 'In an MCP set-up, which part actually runs your Python function?',
        opts: ['The MCP server', 'The MCP client (for example Claude Code)', 'The language model itself', 'The transport (stdio)'] },
      { id: 'm7-valid', fixed: true, topic: 'Input validation · Lecture 60', q: `At ${co}, the ${x.tool} tool has a Pydantic input schema. Claude sends the word "ten" where the schema expects a number. What should happen?`,
        opts: ['The tool refuses the call with a clear error that names the bad field, and runs nothing', 'The tool guesses 10 and carries on', 'The server crashes and restarts', 'The tool returns an empty result with no message'] },
      { id: 'm7-config', fixed: false, topic: 'Portable configs · Lecture 61', q: 'You share your MCP client config with a teammate. Where should the API key go?',
        opts: ['In an environment variable that the config refers to', 'Pasted straight into the config file', 'Inside the tool description', 'In the project README'] },
      { id: 'm7-desc', fixed: false, topic: 'Tool definitions · Lecture 56', q: 'Why does every MCP tool need a clear description?',
        opts: ['The model reads it to decide when to call the tool and what to send', 'It makes the server run faster', 'It is only shown to human users in a menu', 'It replaces the input schema'] },
      { id: 'm7-down', fixed: false, topic: 'Reliability testing · Lecture 62', q: `${co}'s ${x.tool} server is switched off when Claude Code calls it. What does a passing reliability test expect?`,
        opts: ['A clear "tool unavailable" error, and no made-up result', 'Claude invents a likely answer', 'The client waits forever for the server', 'The test is skipped automatically'] },
    ];
    const m8 = [
      { id: 'm8-400', fixed: true, topic: 'Webhooks · Lecture 65', q: `${co}'s ${x.flow} webhook receives a POST with no ${x.key}. What should the Return Response step send back?`,
        opts: [`400, with an error that names the missing ${x.key}`, '200 with {received: true}', '500 Internal Server Error', 'Nothing, so the caller tries again'] },
      { id: 'm8-router', fixed: false, topic: 'Router branches · Lecture 67', q: 'A Router\'s first branch checks that is_valid equals true, yet every run goes to the fallback branch. What is the most likely cause?',
        opts: ['The Code step returns the text "true", not a true/false value', 'The webhook URL has changed', 'Routers only use the fallback in test mode', 'The flow has not been published'] },
      { id: 'm8-retry', fixed: false, topic: 'Retries and run history · Lecture 70', q: `A flow step calls ${co}'s ${x.api} and gets a 503 error at 2 a.m. What is the best set-up?`,
        opts: ['Retry a few times with growing waits, then take an error branch and log it in the run summary', 'Retry every second until it works', 'Stop the flow and delete the run', 'Mark the run as successful anyway'] },
      { id: 'm8-202', fixed: false, topic: 'Webhooks · Lecture 65', q: 'Why does a webhook flow answer the caller with 202 straight away?',
        opts: ['It tells the caller the request arrived, while the flow finishes the work', '202 means all the work is complete', 'It hides errors from the caller', 'MCP requires it'] },
    ];
    const multi = { id: 'm8-secrets', type: 'multi', topic: 'Connections for secrets · Lecture 68', q: 'Which of these belong in an Activepieces connection, not typed into a flow step? Select all that apply.',
      opts: [[`${co}'s ${x.api} key`, true], ['The webhook shared secret', true], ['A database password', true], ["The flow's name", false], ['The 202 status code', false]] };
    const code = { id: 'code', type: 'code', topic: 'Coding · Lectures 65 and 66', q: `Finish check_payload(payload) for the ${x.flow} webhook. Return (400, {"error": "${x.key} is required"}) when ${x.key} is missing or empty. Otherwise return (202, {"accepted": True, "${x.key}": <value>}).` };
    return { m7, m8, multi, code, x };
  }

  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Draw 3 Month 7 and 3 Month 8 MCQs (always including the two company questions), shuffle options, add the multi-select and the coding question.
  function drawPaper(f) {
    const P = pool(f);
    const pick = (list) => { const fixed = list.filter((q) => q.fixed); const rest = shuffle(list.filter((q) => !q.fixed)).slice(0, 3 - fixed.length); return shuffle(fixed.concat(rest)); };
    const mcqs = pick(P.m7).concat(pick(P.m8)).map((q) => ({ id: q.id, type: 'mcq', topic: q.topic, q: q.q, opts: shuffle(q.opts.map((t, i) => ({ t, ok: i === 0 }))) }));
    const multi = { id: P.multi.id, type: 'multi', topic: P.multi.topic, q: P.multi.q, opts: shuffle(P.multi.opts.map(([t, ok]) => ({ t, ok }))) };
    const qs = mcqs.concat([multi, { id: 'code', type: 'code', topic: P.code.topic, q: P.code.q }]);
    return { questions: qs, x: P.x, code: 'NM7-' + String(1000 + Math.floor(Math.random() * 9000)) + '-' + 'ABCDEFGH'[Math.floor(Math.random() * 8)] };
  }

  const starter = () => 'def check_payload(payload):\n    # payload is the JSON body the webhook received (a dict)\n    # TODO: return (status_code, body)\n    pass\n';
  const modelAnswer = (key) => `def check_payload(payload):\n    value = payload.get("${key}")\n    if not value or not str(value).strip():\n        return 400, {"error": "${key} is required"}\n    return 202, {"accepted": True, "${key}": value}\n`;

  // Scripted checks: read the student's code for the patterns each test needs.
  function sampleTests(src, key) {
    const code = src.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    const r202 = /return[^\n]*202/.test(code), r400 = /return[^\n]*400/.test(code);
    const usesKey = code.includes(`"${key}"`) || code.includes(`'${key}'`);
    const reads = /\.get\(|\bin\s+payload|payload\[/.test(code);
    const empty = /\bnot\b/.test(code) || /==\s*(""|'')/.test(code) || code.includes('strip(') || /len\(/.test(code);
    const t1 = r202 && usesKey, t2 = r400 && usesKey && reads, t3 = t2 && empty;
    return {
      tests: [
        { name: `valid body with ${key}`, exp: '202', ok: t1 },
        { name: `body without ${key}`, exp: '400', ok: t2 },
        { name: `${key} sent as an empty string`, exp: '400', ok: t3 },
      ],
      hidden: [t1, t2, t3, t3 && (code.includes('strip(')), /isinstance\(/.test(code)],
    };
  }

  // ---------- Module state (per field) ----------
  const S = {}; // fieldId -> { status: 'idle'|'running'|'done', sess }
  const st = (f) => (S[f.id] = S[f.id] || { status: 'idle', sess: null });
  let C = null, ROOT = null, LIVE = null; // latest ctx, current root, running exam controller

  const pad = (n) => String(n).padStart(2, '0');
  const mmss = (sec) => `${pad(Math.floor(Math.max(0, sec) / 60))}:${pad(Math.floor(Math.max(0, sec) % 60))}`;
  const clock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

  function injectCSS() {
    if (document.getElementById('m-exam')) return;
    const css = `
.m-exam { display: grid; gap: 20px; min-width: 0 }
.m-exam .ex-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 16px; align-items: start }
.m-exam .alist { list-style: none; margin: 0; padding: 0 }
.m-exam .alist li { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line) }
.m-exam .alist li:first-child { border-top: 0 }
.m-exam .alist .ix { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; background: var(--surface-2); color: var(--muted) }
.m-exam .alist .ix svg { width: 18px; height: 18px }
.m-exam .alist li.due .ix { background: var(--brand-soft); color: var(--brand) }
.m-exam .alist li.due { background: color-mix(in srgb, var(--brand-soft) 45%, transparent); border-radius: var(--radius-sm); padding-inline: 8px; margin-inline: -8px }
.m-exam .alist b { display: block; font-size: 14px }
.m-exam .alist .meta { font-size: 12.5px; color: var(--muted) }
.m-exam .alist .tx { min-width: 0 }
.m-exam .rules { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px }
.m-exam .rules li { display: flex; gap: 10px; align-items: start; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); min-width: 0; font-size: 13.5px }
.m-exam .rules li svg { width: 18px; height: 18px; flex: none; color: var(--brand); margin-top: 1px }
.m-exam .rules li.off svg { color: var(--amber) }
.m-exam .rules li span { min-width: 0 }
.m-exam .rules li b { display: block; font-size: 13.5px }
.m-exam .rules li small { color: var(--muted); font-size: 12.5px }
.m-exam .startbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding-top: 4px }

/* Lockdown layer */
.m-exam.layer { position: fixed; inset: 0; z-index: 45; background: var(--bg); display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 0; overflow: hidden }
.m-exam .xh { background: var(--surface); border-bottom: 1px solid var(--line); display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto auto; gap: 16px; align-items: center;
  padding: 10px max(20px, env(safe-area-inset-right, 0px)) 10px max(20px, env(safe-area-inset-left, 0px)); padding-top: max(10px, env(safe-area-inset-top, 0px)) }
.m-exam .xh .ttl { min-width: 0 }
.m-exam .xh .ttl b { font-family: var(--display); font-size: 15px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-exam .xh .ttl small { color: var(--muted); font-size: 12px }
.m-exam .lockpill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--red); }
.m-exam .lockpill i { width: 7px; height: 7px; border-radius: 50%; background: var(--red) }
.m-exam .timer { display: grid; justify-items: center; line-height: 1.1 }
.m-exam .timer b { font-family: var(--mono); font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0 }
.m-exam .timer small { font-size: 11px; color: var(--muted) }
.m-exam .timer.low b { color: var(--amber) }
.m-exam .timer.crit b { color: var(--red) }
.m-exam .saver { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); white-space: nowrap; min-width: 150px }
.m-exam .saver i { width: 9px; height: 9px; border-radius: 50%; background: var(--green); flex: none }
.m-exam .saver.saving i { background: var(--amber) }
.m-exam .xbanner { display: none; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px max(20px, env(safe-area-inset-left, 0px)); background: var(--amber-soft); color: var(--fg); border-bottom: 1px solid var(--line); font-size: 14px }
.m-exam .xbanner.show { display: flex }
.m-exam .xbanner.red { background: var(--red-soft) }
.m-exam .xbanner b { color: var(--amber) }
.m-exam .xbanner.red b { color: var(--red) }
.m-exam .xbanner span { flex: 1; min-width: 200px }
.m-exam .xbody { overflow: auto; display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 20px; align-content: start; padding: 20px max(20px, env(safe-area-inset-right, 0px)) 40px max(20px, env(safe-area-inset-left, 0px)); max-width: 1180px; width: 100%; margin: 0 auto }
.m-exam .xside { display: grid; gap: 14px; align-content: start; min-width: 0 }
.m-exam .qnav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px }
.m-exam .qnav button { position: relative; height: 42px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface); font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums; color: var(--muted) }
.m-exam .qnav button:hover { border-color: var(--brand) }
.m-exam .qnav button.ans { background: var(--brand-soft); color: var(--brand); border-color: color-mix(in srgb, var(--brand) 40%, var(--line)) }
.m-exam .qnav button.cur { outline: 2px solid var(--brand); outline-offset: 1px; color: var(--fg) }
.m-exam .qnav button.flag::after { content: ""; position: absolute; top: 5px; right: 5px; width: 8px; height: 8px; border-radius: 50%; background: var(--amber) }
.m-exam .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted) }
.m-exam .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; border: 1px solid var(--line); background: var(--surface) }
.m-exam .legend i.a { background: var(--brand-soft); border-color: var(--brand) }
.m-exam .legend i.f { background: var(--amber); border-color: var(--amber); border-radius: 50% }
.m-exam .ilog-mini { display: grid; gap: 6px; font-size: 13px }
.m-exam .ilog-mini .r { display: flex; justify-content: space-between; gap: 8px }
.m-exam .qcard { display: grid; gap: 16px }
.m-exam .qhead { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center }
.m-exam .qtext { font-size: 17px; font-weight: 600; line-height: 1.45; font-family: var(--body) }
.m-exam .qtext code, .m-exam .rv code { background: var(--surface-2); padding: 1px 5px; border-radius: 5px }
.m-exam .opts { display: grid; gap: 8px }
.m-exam .opt { display: flex; gap: 12px; align-items: start; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; font-size: 14.5px }
.m-exam .opt:hover { border-color: var(--brand) }
.m-exam .opt.sel { border-color: var(--brand); background: var(--brand-soft) }
.m-exam .opt input { margin: 3px 0 0; accent-color: var(--brand); flex: none; width: 16px; height: 16px }
.m-exam .opt .ol { font-weight: 800; color: var(--muted); width: 18px; flex: none }
.m-exam .opt span:last-child { min-width: 0 }
.m-exam .codebox { width: 100%; min-height: 190px; resize: vertical; background: var(--code-bg); color: var(--code-fg); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; font-family: var(--mono); font-size: 13px; line-height: 1.6; tab-size: 4; white-space: pre; overflow: auto }
.m-exam .codebox:focus { outline: 2px solid var(--brand); outline-offset: 0 }
.m-exam .codehead { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted) }
.m-exam .term { min-height: 90px }
.m-exam .qfoot { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; border-top: 1px solid var(--line); padding-top: 14px }
.m-exam .qfoot .row { gap: 8px }
.m-exam .demo-btn { border-style: dashed }
.m-exam .confirm { display: grid; gap: 14px; max-width: 620px }
.m-exam .confirm .grid-3 .stat b { font-size: 22px }

/* Results */
.m-exam .score-big { font-family: var(--display); font-size: 44px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--brand) }
.m-exam .res-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 20px; align-items: center }
.m-exam .ring { width: 96px; height: 96px; flex: none }
.m-exam .ring circle { fill: none; stroke-width: 9 }
.m-exam .ring .bg { stroke: var(--surface-2) }
.m-exam .ring .fg { stroke: var(--brand); stroke-linecap: round; transition: stroke-dashoffset .8s ease }
.m-exam .ring text { fill: var(--fg); font-family: var(--display); font-weight: 700; font-size: 22px }
.m-exam .rv { list-style: none; margin: 0; padding: 0 }
.m-exam .rv li { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 10px 0; border-top: 1px solid var(--line); font-size: 14px }
.m-exam .rv li:first-child { border-top: 0 }
.m-exam .rv .n { font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums }
.m-exam .rv .tx { min-width: 0 }
.m-exam .rv .tx small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px }
.m-exam .res-grid { align-items: start }
.m-exam .mentor-view { align-content: start; border: 1px solid var(--line); border-left: 3px solid var(--violet); border-radius: var(--radius); background: var(--surface); padding: 18px; display: grid; gap: 14px; min-width: 0 }
.m-exam .ig { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 10px }
.m-exam .ig > div { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px; display: grid; gap: 2px; min-width: 0 }
.m-exam .ig b { font-family: var(--display); font-size: 22px; font-variant-numeric: tabular-nums }
.m-exam .ig span { font-size: 12.5px; color: var(--muted) }
.m-exam .ig .warn b { color: var(--amber) }
.m-exam .tl { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; max-height: 260px; overflow: auto; border: 1px solid var(--line); border-radius: var(--radius-sm) }
.m-exam .tl li { display: grid; grid-template-columns: 74px 58px minmax(0, 1fr); gap: 10px; padding: 8px 12px; border-top: 1px solid var(--line); font-size: 13px; align-items: start }
.m-exam .tl li:first-child { border-top: 0 }
.m-exam .tl .t { font-family: var(--mono); font-size: 12px; color: var(--muted) }
.m-exam .tl .k { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--muted) }
.m-exam .tl li.flagged .k { color: var(--amber) }
.m-exam .tl li span:last-child { min-width: 0 }

@media (prefers-reduced-motion: no-preference) {
  .m-exam .saver.saving i { animation: m-exam-pulse .9s ease-in-out infinite }
  .m-exam .xbanner.show { animation: m-exam-drop .25s ease }
}
@keyframes m-exam-pulse { 50% { opacity: .3 } }
@keyframes m-exam-drop { from { transform: translateY(-6px); opacity: 0 } }

@media (max-width: 1100px) { .m-exam .ex-top { grid-template-columns: minmax(0, 1fr) } .m-exam .rulescard { order: -1 } .m-exam .res-grid { grid-template-columns: minmax(0, 1fr) } }
@media (max-width: 900px) {
  .m-exam .xbody { grid-template-columns: minmax(0, 1fr); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)) }
  .m-exam .qnav { grid-template-columns: repeat(8, minmax(0, 1fr)) }
  .m-exam .xside { display: contents }
  .m-exam .xside > .navcard { order: 0 }
  .m-exam .xmain { order: 1 }
  .m-exam .xside > .card:not(.navcard) { order: 2 }
  .m-exam .xbody { gap: 14px }
  .m-exam .xh { grid-template-columns: minmax(0, 1fr) auto auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)) }
  .m-exam .xh .saver { grid-column: 1 / 2; grid-row: 2; min-width: 0 }
  .m-exam .xh .offpills { grid-column: 2 / -1; grid-row: 2; justify-self: end }
}
@media (max-width: 640px) {
  .m-exam .rules { grid-template-columns: minmax(0, 1fr) }
  .m-exam .qnav { grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 5px }
  .m-exam .qnav button { height: 36px }
  .m-exam .legend { display: none }
  .m-exam .xh { grid-template-columns: minmax(0, 1fr) auto; gap: 10px }
  .m-exam .xh .timer { grid-row: 1; grid-column: 2 }
  .m-exam .xh .subbtn { grid-row: 3; grid-column: 1 / -1 }
  .m-exam .xh .offpills { display: none }
  .m-exam .xh .saver { grid-column: 1 / -1 }
  .m-exam .res-head { grid-template-columns: minmax(0, 1fr) }
  .m-exam .tl li { grid-template-columns: 66px minmax(0, 1fr) }
  .m-exam .tl li .k { grid-column: 2 }
  .m-exam .tl li span:last-child { grid-column: 1 / -1 }
  .m-exam .qtext { font-size: 16px }
}`;
    document.head.append(Object.assign(document.createElement('style'), { id: 'm-exam', textContent: css }));
  }

  // ---------- Landing ----------
  function drawLanding(root, c) {
    const { h, icon, field } = c;
    const s = st(field);
    const submitted = s.status === 'done' && s.sess && s.sess.result;
    const done = submitted && s.sess.result.final != null;
    const running = s.status === 'running';
    const items = [
      { ok: 1, t: 'Weekly quiz · Week 29', m: 'MCP architecture and tool definitions', r: h('span', { class: 'pill green' }, '9/10') },
      { ok: 1, t: 'Weekly quiz · Week 30', m: 'Multi-tool servers and validation', r: h('span', { class: 'pill green' }, '8/10') },
      { ok: 1, t: 'Weekly quiz · Week 31', m: 'Scoped permissions and reliability tests', r: h('span', { class: 'pill green' }, '10/10') },
      { ok: 1, t: 'Weekly quiz · Week 32', m: 'Activepieces triggers and flow steps', r: h('span', { class: 'pill green' }, '9/10') },
      { ok: 1, t: 'Month 6 assessment', m: 'Local models and retrieval (RAG)', r: h('span', { class: 'pill green' }, '81%') },
      { t: 'Month 7 assessment', m: '30 minutes · 8 questions · lockdown mode', due: true,
        r: done ? h('span', { class: 'pill blue' }, `Submitted · ${s.sess.result.final}%`) : submitted ? h('span', { class: 'pill blue' }, 'Submitted · grading') : running ? h('span', { class: 'pill amber' }, 'In progress') : h('span', { class: 'pill amber' }, 'Due now') },
      { t: 'Final exam', m: 'Month 12 · covers the whole year', r: h('span', { class: 'pill' }, 'Later') },
    ];
    const list = h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Assessments'), h('h2', {}, 'Your tests this term')), h('span', { class: 'pill' }, 'Demo data')),
      h('ul', { class: 'alist' }, items.map((it) => h('li', { class: it.due ? 'due' : '' },
        h('span', { class: 'ix', html: icon(it.ok || (it.due && submitted) ? 'check' : 'exam') }),
        h('span', { class: 'tx' }, h('b', {}, it.t), h('span', { class: 'meta' }, it.m)), it.r))),
      h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'Weekly quizzes take 10 minutes and run inside the lecture player. Monthly assessments run in lockdown mode.'));

    const rule = (ic, b, sm, off) => h('li', { class: off ? 'off' : '' }, h('span', { html: icon(ic) }), h('span', {}, h('b', {}, b), h('small', {}, sm)));
    const timeLeft = running ? Math.max(0, EXAM_MIN * 60 - (Date.now() - s.sess.startedAt) / 1000) : 0;
    const startBtn = submitted
      ? null
      : h('button', { class: 'btn primary', onclick: () => startExam(c), html: icon('exam') + `<span>${running ? 'Resume exam' : 'Start exam'}</span>` });
    const rules = h('section', { class: 'card stack rulescard' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Due now · Month 7'), h('h2', {}, 'Month 7 assessment'),
          h('p', { class: 'small muted', style: { marginTop: '4px' } }, `MCP tool integrations, plus Activepieces flows and webhooks from Month 8. Questions use ${field.company}.`)),
        h('span', { class: 'pill violet' }, field.short)),
      h('ul', { class: 'rules' },
        rule('exam', '30 minutes', 'The timer starts when you press Start.'),
        rule('spark', '8 questions from a question pool', 'Every student gets a different paper.'),
        rule('check', 'Answers save every 20 seconds', 'And each time you answer.'),
        rule('flow', 'Full screen is required', 'Leaving full screen is recorded.'),
        rule('play', 'Switching tabs is recorded', 'Your mentor sees each switch.', true),
        rule('code', 'Copy and paste are turned off', 'Attempts are recorded.', true),
        rule('forum', 'AI tutor and forum are off', 'They come back after you submit.', true),
        rule('mentor', 'Nothing fails you automatically', 'Your mentor reviews anything recorded.')),
      running ? h('div', { class: 'callout small' }, `Your exam is still open with ${mmss(timeLeft)} left. Your answers were saved.`) : null,
      h('div', { class: 'startbar' },
        h('span', { class: 'small muted' }, submitted ? 'Submitted. Your results and the integrity report are above.' : 'Works in any browser on a basic laptop.'),
        h('div', { class: 'row', style: { gap: '8px' } },
          done ? h('button', { class: 'btn', onclick: () => { S[field.id] = { status: 'idle', sess: null }; c.toast('Demo reset: you can take the exam again.'); refresh(); } }, 'Reset demo') : null,
          startBtn)));

    const wrap = h('div', { class: 'm-exam' });
    if (submitted) wrap.append(drawResults(c, s.sess));
    wrap.append(h('div', { class: 'ex-top' }, list, rules));
    root.append(wrap);
  }

  // ---------- Exam (lockdown) ----------
  function startExam(c) {
    const field = c.field;
    const s = st(field);
    // Request full screen inside the click handler (browsers only allow it from a user gesture).
    let fsPromise = null;
    try { const el = document.documentElement; if (el.requestFullscreen) fsPromise = el.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { fsPromise = null; }
    if (s.status !== 'running') {
      const paper = drawPaper(field);
      s.sess = { field: field.id, company: field.company, startedAt: Date.now(), paper, answers: {}, flags: {}, cur: 0, log: [], lastSaved: Date.now(), codeRun: null, result: null };
      s.sess.answers.code = starter();
      s.status = 'running';
      logEvt(s.sess, 'info', `Exam started. Paper ${paper.code}.`);
    } else {
      logEvt(s.sess, 'info', 'Exam resumed. Saved answers restored.');
    }
    openLayer(c, s, fsPromise);
  }

  function logEvt(sess, type, text) {
    const e = { type, text, at: Date.now(), t: Math.round((Date.now() - sess.startedAt) / 1000) };
    sess.log.push(e); return e;
  }

  function openLayer(c, s, fsPromise) {
    closeLayer(false);
    const { h, icon } = c;
    const sess = s.sess, qs = sess.paper.questions, x = sess.paper.x;
    const L = { s, sess, timers: [], offs: [], fsOn: false, exiting: false, blurT: null, bannerT: null, saveT: null, hiddenEvt: null, confirming: false };
    LIVE = L;
    const add = (target, evt, fn, opts) => { target.addEventListener(evt, fn, opts); L.offs.push(() => target.removeEventListener(evt, fn, opts)); };

    // Header
    const timerB = h('b', {}, '30:00');
    const timer = h('div', { class: 'timer', role: 'timer', 'aria-label': 'Time left' }, timerB, h('small', {}, 'time left'));
    const saverTx = h('span', {}, 'Saved just now');
    const saver = h('div', { class: 'saver', 'aria-live': 'polite' }, h('i'), saverTx);
    const subBtn = h('button', { class: 'btn primary subbtn', onclick: () => showConfirm() }, 'Review and submit');
    const header = h('header', { class: 'xh' },
      h('div', { class: 'ttl' }, h('span', { class: 'lockpill' }, h('i'), 'Lockdown mode'), h('b', {}, 'Month 7 assessment'), h('small', {}, `Paper ${sess.paper.code} · ${c.data.demo_student.name}`)),
      timer, saver,
      h('div', { class: 'row offpills', style: { gap: '6px' } }, h('span', { class: 'pill amber' }, 'AI tutor off'), h('span', { class: 'pill amber' }, 'Forum off')),
      subBtn);

    const bannerTx = h('span');
    const bannerAct = h('div', { class: 'row', style: { gap: '8px' } });
    const banner = h('div', { class: 'xbanner', role: 'status', 'aria-live': 'assertive' }, bannerTx, bannerAct);

    // Side: navigator + integrity
    const qnav = h('div', { class: 'qnav', role: 'navigation', 'aria-label': 'Questions' });
    const counts = h('div', { class: 'ilog-mini' });
    const side = h('aside', { class: 'xside' },
      h('div', { class: 'card stack navcard' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'small' }, 'Questions'), h('span', { class: 'tiny muted num', id: 'm-exam-anscount' }, '')),
        qnav, h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'a' }), 'Answered'), h('span', {}, h('i', { class: 'f' }), 'Flagged'), h('span', {}, h('i'), 'Not answered'))),
      h('div', { class: 'card stack' }, h('b', { class: 'small' }, 'Recorded for your mentor'), counts,
        h('p', { class: 'tiny muted' }, 'Nothing here fails you. Your mentor reviews it.')),
      h('div', { class: 'card stack' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'small' }, 'For investors'), h('span', { class: 'demo-tag' }, 'Demo')),
        h('button', { class: 'btn sm demo-btn', onclick: () => tabSwitch(true) }, 'Demo: simulate a tab switch'),
        h('button', { class: 'btn sm demo-btn', onclick: () => fillRest() }, 'Demo: fill remaining answers')));

    const main = h('section', { class: 'xmain', style: { minWidth: 0 } });
    const body = h('div', { class: 'xbody' }, side, main);
    const layer = h('div', { class: 'm-exam layer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Month 7 assessment, lockdown mode' }, header, banner, body);
    L.layer = layer;
    document.body.append(layer);
    L.prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    // Full-screen result
    const markFs = () => { L.fsOn = !!document.fullscreenElement; };
    if (fsPromise && fsPromise.then) {
      fsPromise.then(() => { markFs(); logEvt(sess, 'info', 'Full screen on.'); paintCounts(); })
        .catch(() => { logEvt(sess, 'info', 'Full screen blocked by this browser window. Lockdown view used instead.'); showBanner('Full screen is not available in this window, so the exam runs in lockdown view. Everything is still recorded.', 'amber', null, 7000); paintCounts(); });
    } else {
      logEvt(sess, 'info', 'Full screen not supported. Lockdown view used instead.');
      showBanner('Full screen is not available in this browser, so the exam runs in lockdown view.', 'amber', null, 7000);
    }

    // ---- Integrity listeners (real browser events) ----
    add(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') { clearTimeout(L.blurT); L.hiddenEvt = logEvt(sess, 'tab', 'Left the exam tab'); L.hiddenAt = Date.now(); paintCounts(); }
      else if (L.hiddenEvt) { L.hiddenEvt.text += ` · back after ${Math.max(1, Math.round((Date.now() - L.hiddenAt) / 1000))} s`; L.hiddenEvt = null; showBanner('Tab switch recorded. Your mentor will see this.', 'amber'); paintCounts(); }
    });
    add(window, 'blur', () => {
      clearTimeout(L.blurT);
      L.blurT = setTimeout(() => {
        if (document.visibilityState === 'visible' && !L.exiting) { L.blurEvt = logEvt(sess, 'tab', 'Exam window lost focus (another app or window)'); L.blurAt = Date.now(); paintCounts(); }
      }, 400);
    });
    add(window, 'focus', () => {
      clearTimeout(L.blurT);
      if (L.blurEvt) { L.blurEvt.text += ` · back after ${Math.max(1, Math.round((Date.now() - L.blurAt) / 1000))} s`; L.blurEvt = null; showBanner('Tab switch recorded. Your mentor will see this.', 'amber'); paintCounts(); }
    });
    add(document, 'fullscreenchange', () => {
      const was = L.fsOn; markFs();
      if (was && !L.fsOn && !L.exiting) {
        logEvt(sess, 'fullscreen', 'Left full screen'); paintCounts();
        showBanner('Full-screen exit recorded. Your mentor will see this.', 'red', h('button', { class: 'btn sm primary', onclick: () => { try { document.documentElement.requestFullscreen().then(() => { markFs(); logEvt(sess, 'info', 'Full screen on again.'); paintCounts(); hideBanner(); }).catch(() => {}); } catch (e) {} } }, 'Return to full screen'), 0);
      }
    });
    const block = (kind, label) => (e) => {
      e.preventDefault();
      logEvt(sess, kind, label); paintCounts();
      showBanner(kind === 'paste' ? 'Paste is turned off during the exam. This attempt is recorded.' : kind === 'menu' ? 'Right-click is turned off during the exam. This attempt is recorded.' : 'Copy is turned off during the exam. This attempt is recorded.', 'amber', null, 4000);
    };
    add(layer, 'copy', block('copy', 'Tried to copy text'));
    add(layer, 'cut', block('copy', 'Tried to cut text'));
    add(layer, 'paste', block('paste', 'Tried to paste text'));
    add(layer, 'contextmenu', block('menu', 'Tried to open the right-click menu'));
    add(layer, 'dragstart', (e) => e.preventDefault());
    add(layer, 'drop', block('paste', 'Tried to drop text into an answer'));

    function tabSwitch(demo) {
      const e = logEvt(sess, 'tab', demo ? 'Left the exam tab (simulated for the demo)' : 'Left the exam tab');
      e.text += ' · back after 6 s';
      paintCounts();
      showBanner('Tab switch recorded. Your mentor will see this.', 'amber');
    }

    // ---- Banner ----
    function showBanner(msg, kind, action, ms) {
      clearTimeout(L.bannerT);
      banner.className = 'xbanner show' + (kind === 'red' ? ' red' : '');
      bannerTx.innerHTML = `<b>${/recorded\. Your mentor|attempt is recorded/.test(msg) ? 'Recorded.' : 'Note.'}</b> ${c.esc(msg)}`;
      bannerAct.textContent = '';
      if (action) bannerAct.append(action);
      bannerAct.append(h('button', { class: 'btn sm ghost', onclick: hideBanner }, 'Dismiss'));
      if (ms !== 0) L.bannerT = setTimeout(hideBanner, ms || 8000);
    }
    function hideBanner() { banner.className = 'xbanner'; }

    // ---- Counts ----
    function tally() {
      const n = (t) => sess.log.filter((e) => e.type === t).length;
      return { tab: n('tab'), fs: n('fullscreen'), paste: n('paste') + n('copy'), copy: n('menu') };
    }
    function paintCounts() {
      const t = tally();
      counts.textContent = '';
      [['Tab switches', t.tab], ['Full-screen exits', t.fs], ['Copy or paste attempts', t.paste], ['Right-click attempts', t.copy]].forEach(([k, v]) =>
        counts.append(h('div', { class: 'r' }, h('span', { class: 'muted' }, k), h('b', { class: 'num', style: { color: v ? 'var(--amber)' : 'var(--fg)' } }, String(v)))));
    }

    // ---- Autosave ----
    function save() {
      saver.className = 'saver saving'; saverTx.textContent = 'Saving…';
      clearTimeout(L.saveT);
      L.saveT = setTimeout(() => { sess.lastSaved = Date.now(); saver.className = 'saver'; paintSaver(); }, 800);
    }
    function paintSaver() {
      if (saver.classList.contains('saving')) return;
      const ago = Math.round((Date.now() - sess.lastSaved) / 1000);
      saverTx.textContent = ago < 2 ? 'Saved just now' : `Saved ${ago} s ago`;
    }
    let answerSaveT = null;
    function answered() { clearTimeout(answerSaveT); answerSaveT = setTimeout(save, 350); paintNav(); }
    L.timers.push(setInterval(save, SAVE_EVERY * 1000));

    // ---- Timer ----
    function tick() {
      const left = EXAM_MIN * 60 - (Date.now() - sess.startedAt) / 1000;
      timerB.textContent = mmss(Math.ceil(left));
      timer.className = 'timer' + (left <= 60 ? ' crit' : left <= 300 ? ' low' : '');
      paintSaver();
      if (left <= 0) { logEvt(sess, 'info', 'Time up. Exam submitted automatically.'); finish(c, s); }
    }
    L.timers.push(setInterval(tick, 1000));
    tick();

    // ---- Questions ----
    const isAnswered = (q) => {
      const a = sess.answers[q.id];
      if (q.type === 'mcq') return a != null;
      if (q.type === 'multi') return Array.isArray(a) && a.length > 0;
      return typeof a === 'string' && a.trim() !== starter().trim() && a.trim() !== '';
    };
    L.isAnswered = isAnswered;
    function paintNav() {
      qnav.textContent = '';
      qs.forEach((q, i) => qnav.append(h('button', {
        class: [isAnswered(q) ? 'ans' : '', sess.flags[q.id] ? 'flag' : '', i === sess.cur && !L.confirming ? 'cur' : ''].join(' ').trim(),
        'aria-label': `Question ${i + 1}${isAnswered(q) ? ', answered' : ''}${sess.flags[q.id] ? ', flagged' : ''}`,
        'aria-current': i === sess.cur ? 'step' : null,
        onclick: () => { L.confirming = false; sess.cur = i; paintQ(); },
      }, String(i + 1))));
      const ac = layer.querySelector('#m-exam-anscount'); if (ac) ac.textContent = `${qs.filter(isAnswered).length} of ${qs.length} answered`;
    }

    function paintQ() {
      main.textContent = '';
      const q = qs[sess.cur], i = sess.cur;
      const flagBtn = h('button', { class: 'btn sm', 'aria-pressed': sess.flags[q.id] ? 'true' : 'false', onclick: () => { sess.flags[q.id] = !sess.flags[q.id]; paintQ(); answered(); } },
        sess.flags[q.id] ? 'Flagged for review' : 'Flag for review');
      if (sess.flags[q.id]) { flagBtn.style.borderColor = 'var(--amber)'; flagBtn.style.color = 'var(--amber)'; }
      const head = h('div', { class: 'qhead' },
        h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'eyebrow' }, `Question ${i + 1} of ${qs.length}`), h('span', { class: 'pill' }, q.topic),
          q.type === 'multi' ? h('span', { class: 'pill violet' }, 'Select all that apply') : null, q.type === 'code' ? h('span', { class: 'pill violet' }, 'Code · 30 marks') : h('span', { class: 'pill' }, '10 marks')),
        flagBtn);
      const card = h('div', { class: 'card qcard' }, head, h('p', { class: 'qtext' }, q.q));

      if (q.type === 'mcq' || q.type === 'multi') {
        const multi = q.type === 'multi';
        const opts = h('div', { class: 'opts', role: multi ? 'group' : 'radiogroup', 'aria-label': 'Answer options' });
        q.opts.forEach((o, j) => {
          const cur = sess.answers[q.id];
          const sel = multi ? (cur || []).includes(j) : cur === j;
          const inp = h('input', { type: multi ? 'checkbox' : 'radio', name: 'm-exam-' + q.id, checked: sel ? true : null });
          const lab = h('label', { class: 'opt' + (sel ? ' sel' : '') }, inp, h('span', { class: 'ol' }, 'ABCDE'[j]), h('span', {}, o.t));
          inp.addEventListener('change', () => {
            if (multi) { const a = new Set(sess.answers[q.id] || []); if (inp.checked) a.add(j); else a.delete(j); sess.answers[q.id] = [...a].sort(); }
            else sess.answers[q.id] = j;
            paintQ(); answered();
          });
          opts.append(lab);
        });
        card.append(opts);
      } else {
        const ta = h('textarea', { class: 'codebox', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Code answer' });
        ta.value = sess.answers.code;
        ta.addEventListener('input', () => { sess.answers.code = ta.value; answered(); });
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const p = ta.selectionStart; ta.value = ta.value.slice(0, p) + '    ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = p + 4; sess.answers.code = ta.value; answered(); }
        });
        const term = h('div', { class: 'term', 'aria-live': 'polite' });
        const paintRun = () => {
          term.textContent = '';
          if (!sess.codeRun) { term.append(h('span', { class: 'dim' }, 'Press "Run sample test" to check your code on 3 sample webhook bodies.\nThe full test set runs on the server after you submit.')); return; }
          if (sess.codeRun === 'running') { term.append(h('span', { class: 'dim' }, '$ python -m pytest sample_tests.py\nRunning 3 sample tests…')); return; }
          const r = sess.codeRun;
          term.append(h('span', { class: 'dim' }, '$ python -m pytest sample_tests.py\n'));
          r.tests.forEach((t) => term.append(h('span', { class: t.ok ? 'ok' : 'bad' }, t.ok ? 'PASS ' : 'FAIL '), `${t.name}  `, h('span', { class: 'dim' }, t.ok ? `→ ${t.exp}\n` : `expected ${t.exp}\n`)));
          const n = r.tests.filter((t) => t.ok).length;
          term.append(h('span', { class: n === 3 ? 'ok' : 'bad' }, `\n${n} of 3 sample tests passed.`), h('span', { class: 'dim' }, ' Hidden tests run after you submit.'));
        };
        const runBtn = h('button', { class: 'btn sm primary', html: c.icon('play') + '<span>Run sample test</span>', onclick: () => {
          sess.codeRun = 'running'; paintRun(); runBtn.disabled = true;
          const t = setTimeout(() => { sess.codeRun = sampleTests(sess.answers.code, x.key); runBtn.disabled = false; paintRun(); }, 900);
          L.timers.push(t);
        } });
        card.append(
          h('div', { class: 'codehead' }, h('span', {}, 'check_payload.py · Python'),
            h('button', { class: 'btn sm demo-btn', onclick: () => { sess.answers.code = modelAnswer(x.key); ta.value = sess.answers.code; answered(); c.toast('Demo: a sample answer was typed in for you.'); } }, 'Demo: type a sample answer')),
          ta, h('div', { class: 'row' }, runBtn, h('span', { class: 'tiny muted' }, 'Paste is turned off. Tab inserts 4 spaces.')), term);
        paintRun();
      }

      const prev = h('button', { class: 'btn', disabled: i === 0 ? true : null, onclick: () => { sess.cur = Math.max(0, i - 1); paintQ(); } }, 'Previous');
      const next = i < qs.length - 1
        ? h('button', { class: 'btn primary', onclick: () => { sess.cur = i + 1; paintQ(); } }, 'Next question')
        : h('button', { class: 'btn primary', onclick: () => showConfirm() }, 'Review and submit');
      card.append(h('div', { class: 'qfoot' }, prev, h('div', { class: 'row' }, next)));
      main.append(card);
      paintNav();
      body.scrollTop = 0;
    }

    function showConfirm() {
      L.confirming = true; paintNav();
      main.textContent = '';
      const ans = qs.filter(isAnswered).length, fl = qs.filter((q) => sess.flags[q.id]).length;
      const t = tally();
      const left = EXAM_MIN * 60 - (Date.now() - sess.startedAt) / 1000;
      const unanswered = qs.map((q, i) => (!isAnswered(q) ? i + 1 : null)).filter(Boolean);
      const flagged = qs.map((q, i) => (sess.flags[q.id] ? i + 1 : null)).filter(Boolean);
      main.append(h('div', { class: 'card confirm' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Before you submit'), h('h2', {}, 'Submit your Month 7 assessment?')),
        h('div', { class: 'grid-3' },
          h('div', { class: 'stat' }, h('b', { class: 'num' }, `${ans}/${qs.length}`), h('span', {}, 'questions answered')),
          h('div', { class: 'stat' }, h('b', { class: 'num' }, String(fl)), h('span', {}, 'flagged for review')),
          h('div', { class: 'stat' }, h('b', { class: 'num' }, mmss(left)), h('span', {}, 'time left'))),
        unanswered.length ? h('div', { class: 'note' }, `Not answered: question ${unanswered.join(', ')}. Unanswered questions score zero.`) : null,
        flagged.length ? h('div', { class: 'note' }, `Flagged: question ${flagged.join(', ')}. Use the numbers on the left to look again.`) : null,
        h('p', { class: 'small muted' }, `Once you submit, you cannot change your answers. Multiple-choice questions are marked straight away. The code question is marked on the server within 2 minutes. ${t.tab + t.fs + t.paste + t.copy} integrity events were recorded for your mentor.`),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => { L.confirming = false; paintQ(); } }, 'Go back to my answers'),
          h('button', { class: 'btn primary', onclick: () => finish(c, s) }, 'Submit exam'))));
    }

    function fillRest() {
      const wrongAt = qs.findIndex((q) => q.type === 'mcq' && !isAnswered(q));
      qs.forEach((q, i) => {
        if (isAnswered(q)) return;
        if (q.type === 'mcq') { const ok = q.opts.findIndex((o) => o.ok); sess.answers[q.id] = i === wrongAt && wrongAt !== -1 && qs.filter((z) => z.type === 'mcq' && !isAnswered(z)).length > 2 ? (ok + 1) % q.opts.length : ok; }
        else if (q.type === 'multi') sess.answers[q.id] = q.opts.map((o, j) => (o.ok ? j : -1)).filter((j) => j >= 0).slice(0, 2);
        else sess.answers.code = modelAnswer(x.key);
      });
      c.toast('Demo: remaining answers filled in. Review and submit when ready.');
      L.confirming ? showConfirm() : paintQ(); answered();
    }

    paintCounts();
    paintQ();
    save();
  }

  // Tear down the lockdown layer: listeners, timers, full screen, page scroll lock.
  function closeLayer(exitFs) {
    const L = LIVE; if (!L) return;
    L.exiting = true;
    L.timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
    [L.blurT, L.bannerT, L.saveT].forEach((t) => clearTimeout(t));
    L.offs.forEach((off) => off());
    if (L.layer) L.layer.remove();
    document.documentElement.style.overflow = L.prevOverflow || '';
    if (exitFs !== false && document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen().catch(() => {}); } catch (e) {} }
    LIVE = null;
  }

  // ---------- Submit and grade ----------
  let gradeT = null, gradeFor = null;
  function finish(c, s) {
    const sess = s.sess; if (!sess || s.status !== 'running') return;
    const qs = sess.paper.questions;
    logEvt(sess, 'info', 'Answers submitted.');
    closeLayer(true);
    let mcq = 0;
    const per = qs.map((q) => {
      const a = sess.answers[q.id];
      if (q.type === 'mcq') { const ok = a != null && q.opts[a] && q.opts[a].ok; if (ok) mcq += 10; return { q, got: ok ? 10 : 0, max: 10, answer: a != null ? q.opts[a].t : null, right: q.opts.find((o) => o.ok).t }; }
      if (q.type === 'multi') {
        const pick = new Set(a || []); let good = 0, bad = 0;
        q.opts.forEach((o, j) => { if (pick.has(j)) { if (o.ok) good++; else bad++; } });
        const total = q.opts.filter((o) => o.ok).length;
        const got = Math.max(0, Math.round(((good - bad) / total) * 10));
        mcq += got;
        return { q, got, max: 10, answer: pick.size ? `${good} of ${total} right options picked${bad ? `, ${bad} wrong` : ''}` : null, right: q.opts.filter((o) => o.ok).map((o) => o.t).join('; ') };
      }
      return { q, got: null, max: 30 };
    });
    const used = Math.min(EXAM_MIN * 60, Math.round((Date.now() - sess.startedAt) / 1000));
    sess.result = { mcq, mcqMax: 70, code: null, codeMax: 30, final: null, used, per, submittedAt: Date.now() };
    s.status = 'done';
    c.toast('Exam submitted. Multiple-choice marks are ready.', 'green');
    // Coding question: graded on the server (scripted wait).
    gradeFor = { c, s };
    gradeT = setTimeout(() => grade(c, s), 3600);
    if (c.state.route === ID) refresh(); else c.go(ID);
    try { window.scrollTo(0, 0); const v = document.getElementById('view'); if (v) v.scrollTop = 0; } catch (e) {}
  }

  function grade(c, s) {
    gradeT = null; gradeFor = null;
    const sess = s.sess; if (!sess || !sess.result || sess.result.final != null) return;
    const r = sampleTests(sess.answers.code || '', sess.paper.x.key);
    const passed = r.hidden.filter(Boolean).length;
    const code = Math.round((passed / 5) * 30);
    const misses = ['a valid body', 'a missing field', 'an empty string', 'a value that is only spaces', 'a body sent as a list instead of an object'];
    sess.result.code = code; sess.result.codePassed = passed;
    sess.result.codeMissed = r.hidden.map((ok, i) => (ok ? null : misses[i])).filter(Boolean);
    sess.result.final = Math.round(((sess.result.mcq + code) / 100) * 100);
    const flags = flagSummary(sess);
    c.state.progress.examScore = sess.result.final;
    c.state.progress.examFlags = flags;
    c.emit('exam:submitted', { score: sess.result.final, flags });
    c.addXP(150, 'Month 7 assessment submitted');
    refresh();
  }

  function flagSummary(sess) {
    const n = (t) => sess.log.filter((e) => e.type === t).length;
    const f = { tabSwitches: n('tab'), fullscreenExits: n('fullscreen'), pasteAttempts: n('paste'), copyAttempts: n('copy'), rightClicks: n('menu'), autoFailed: false };
    f.total = f.tabSwitches + f.fullscreenExits + f.pasteAttempts + f.copyAttempts + f.rightClicks;
    f.log = sess.log.map((e) => ({ type: e.type, text: e.text, at: e.at, t: e.t }));
    return f;
  }

  // ---------- Results ----------
  function drawResults(c, sess) {
    const { h, icon } = c;
    const r = sess.result; if (!r) return h('div');
    const pending = r.final == null;
    const shown = pending ? Math.round((r.mcq / r.mcqMax) * 100) : r.final;
    const C2 = 2 * Math.PI * 40;
    const ring = h('div', { html: `<svg class="ring" viewBox="0 0 96 96" role="img" aria-label="${pending ? 'Score pending' : 'Overall score ' + r.final + ' percent'}"><circle class="bg" cx="48" cy="48" r="40"/><circle class="fg" cx="48" cy="48" r="40" stroke-dasharray="${C2.toFixed(1)}" stroke-dashoffset="${(C2 * (1 - (pending ? r.mcq / 100 : r.final / 100))).toFixed(1)}" transform="rotate(-90 48 48)"/><text x="48" y="56" text-anchor="middle">${pending ? '…' : r.final + '%'}</text></svg>` });

    const head = h('section', { class: 'card stack' },
      h('div', { class: 'res-head' }, ring,
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'eyebrow' }, `Results · Paper ${sess.paper.code}`),
          h('h2', {}, pending ? 'Multiple-choice marked. Code is being marked.' : `Month 7 assessment: ${r.final}%`),
          h('p', { class: 'small muted', style: { marginTop: '4px' } }, pending ? 'The code question is graded on the server within 2 minutes. You can leave this page; the score will appear here.' : `Submitted at ${clock(r.submittedAt)}. Your mentor has the full report.`)),
        h('div', { class: 'row', style: { gap: '8px' } },
          h('button', { class: 'btn primary', onclick: () => c.go('mentor'), html: icon('mentor') + '<span>View it in the mentor console</span>' }))),
      h('div', { class: 'grid-4' },
        h('div', { class: 'stat' }, h('b', { class: 'num' }, pending ? '…' : `${r.final}%`), h('span', {}, 'overall score')),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, `${r.mcq}/${r.mcqMax}`), h('span', {}, 'multiple-choice, marked instantly')),
        h('div', { class: 'stat' }, pending ? h('b', { class: 'row', style: { gap: '8px', color: 'var(--brand)' } }, h('span', { class: 'spin' }), h('span', { style: { fontSize: '16px' } }, 'Grading…')) : h('b', { class: 'num' }, `${r.code}/${r.codeMax}`),
          h('span', {}, pending ? 'code question, on the server' : `code question · ${r.codePassed} of 5 server tests passed`)),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, mmss(r.used)), h('span', {}, 'time used of 30:00'))));

    const rv = h('ul', { class: 'rv' }, r.per.map((p, i) => {
      let pill, sub;
      if (p.q.type === 'code') {
        pill = pending ? h('span', { class: 'pill blue' }, h('span', { class: 'spin' }), 'Grading') : h('span', { class: 'pill ' + (r.code >= 24 ? 'green' : r.code >= 12 ? 'amber' : 'red') }, `${r.code}/30`);
        sub = pending ? 'Running 5 hidden tests on the server.' : r.codeMissed.length ? `Missed: ${r.codeMissed.join(', ')}.` : 'All server tests passed.';
      } else {
        pill = h('span', { class: 'pill ' + (p.got === p.max ? 'green' : p.got > 0 ? 'amber' : 'red') }, `${p.got}/${p.max}`);
        sub = p.got === p.max ? `Correct: ${p.right}` : `${p.answer ? 'Your answer: ' + p.answer + '. ' : 'Not answered. '}Correct: ${p.right}`;
      }
      return h('li', {}, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'tx' }, p.q.q, h('small', {}, sub)), pill);
    }));
    const review = h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Question by question'), h('span', { class: 'small muted' }, `${sess.company} · demo data`)), rv);

    // Integrity summary, exactly as the mentor console shows it.
    const f = flagSummary(sess);
    const cell = (v, k) => h('div', { class: v ? 'warn' : '' }, h('b', {}, String(v)), h('span', {}, k));
    const tl = h('ul', { class: 'tl' }, sess.log.map((e) => h('li', { class: e.type === 'info' ? '' : 'flagged' },
      h('span', { class: 't' }, clock(e.at)), h('span', { class: 'k' }, { tab: 'Tab', fullscreen: 'Screen', paste: 'Paste', copy: 'Copy', menu: 'Click', info: 'Info' }[e.type] || 'Info'),
      h('span', {}, `${e.text} `, h('span', { class: 'tiny muted num' }, `(at ${mmss(e.t)})`)))));
    const verdict = f.total === 0 ? 'No integrity events. Nothing for the mentor to review.' : `${f.total} event${f.total === 1 ? '' : 's'} recorded. Nothing was failed automatically. The mentor decides if anything needs a conversation.`;
    const integ = h('section', { class: 'mentor-view' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } },
        h('div', {}, h('div', { class: 'eyebrow' }, 'What your mentor sees'), h('h3', {}, `Integrity report · ${c.data.demo_student.name} · Month 7 assessment`)),
        h('span', { class: 'pill ' + (f.total ? 'amber' : 'green') }, f.total ? 'Review suggested' : 'Clean')),
      h('div', { class: 'ig' }, cell(f.tabSwitches, 'tab switches'), cell(f.fullscreenExits, 'full-screen exits'), cell(f.pasteAttempts + f.copyAttempts, 'copy or paste attempts'), h('div', {}, h('b', { style: { color: 'var(--green)' } }, 'No'), h('span', {}, 'auto-failed'))),
      h('div', { class: 'callout small' }, h('b', {}, 'Auto-failed: no. '), verdict),
      h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, 'Timeline'), tl),
      h('p', { class: 'tiny muted' }, 'Recorded in the browser during the exam: tab switches, focus loss, full-screen exits, copy, paste and right-click attempts. Times are shown as clock time and as time into the exam.'));

    return h('div', { class: 'm-exam' }, head, h('div', { class: 'grid-2 res-grid' }, integ, review));
  }

  function refresh() {
    if (!ROOT || !ROOT.isConnected || !C) return;
    C = Object.assign({}, C, { field: NM.field() });
    ROOT.textContent = '';
    drawLanding(ROOT, C);
  }

  NM.register(ID, {
    label: 'Exams', title: 'Exams', icon: 'exam', group: 'Student', order: 40,
    render(root, ctx) {
      injectCSS();
      C = ctx; ROOT = root;
      drawLanding(root, ctx);
    },
    destroy() {
      // Leaving the Exams screen mid-exam: keep the saved answers, stop the lockdown, and note it for the mentor.
      if (LIVE && LIVE.sess && LIVE.s.status === 'running') logEvt(LIVE.sess, 'info', 'Left the exam screen. Answers saved; timer keeps running.');
      closeLayer(true);
      if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen().catch(() => {}); } catch (e) {} }
      ROOT = null;
      if (gradeT) { clearTimeout(gradeT); const g = gradeFor; gradeT = null; if (g) grade(g.c, g.s); }
    },
  });
})();
