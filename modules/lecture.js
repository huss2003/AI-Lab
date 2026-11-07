/* Lecture player: a simulated 40-minute recorded lesson (animated slides, no real video) with in-video questions,
   a synced transcript, a student watermark, the practical unlock at 60% and "watched" at 90%. Owned by the lecture builder.
   Time model: 1 real second = 20 lecture seconds at 1x, so the full lecture plays in about 2 minutes. */
(function () {
  const TOTAL = 2400, RATE = 20, TICK = 100, BUCKET = 20, NB = TOTAL / BUCKET;
  const UNLOCK = 0.6, DONE = 0.9;
  const BOUNDS = [0, 150, 480, 1000, 1450, 1900, 2250, 2400];
  const CUES = [420, 960, 1640, 2100];
  const INSTRUCTOR = { name: 'Ananya Rao', initials: 'AR' };

  // Per-lecture viewing state survives re-renders (field switch) and navigation. Keyed by lecture id: viewing is per student, not per field.
  const store = { sel: null, speed: 1, cc: true, lec: {} };
  let live = null; // handles of the mounted instance (timers, listeners)

  function lecState(id, current) {
    if (!store.lec[id]) {
      const before = id < current;
      store.lec[id] = { t: 0, buckets: new Array(NB).fill(before ? 1 : 0), answered: {}, completed: before, unlocked: before, before };
    }
    return store.lec[id];
  }
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const watchedPct = (S) => S.buckets.reduce((a, b) => a + b, 0) / NB;

  // ---------- Field scenarios for Lecture 65 (matches each field's practical in data.js) ----------
  const FH = {
    fullstack_software: { path: 'advisory-events', sender: "PadosiCart's advisory service", what: 'a new product advisory event', payload: '{"event_id": "evt_1042", "type": "price_drop"}', ok: '202 Accepted', okBody: '{"received": true, "event_id": "evt_1042"}', header: 'X-Lab-Token', badCase: 'arrives without the X-Lab-Token header', badReply: '401 Unauthorized, before the flow runs' },
    web_dev: { path: 'draft-submitted', sender: "the Sahyadri Trails CMS", what: 'a trek blog draft from a writer', payload: '{"slug": "harishchandragad-night-trek", "author": "meera"}', ok: '202 Accepted', okBody: '{"accepted": true, "slug": "harishchandragad-night-trek"}', header: 'X-CMS-Token', badCase: 'has no slug', badReply: '400 Bad Request with "slug required"' },
    data_analytics: { path: 'data-request', sender: "a FreshMart store manager's request form", what: 'a new data request', payload: '{"request_id": "REQ-2207", "request_text": "Nashik weekly sales"}', ok: '202 Accepted', okBody: '{"request_id": "REQ-2207"}', badCase: 'has an empty request_text', badReply: '400 Bad Request with "request_text is required"' },
    business_analysis: { path: 'uat-intake', sender: 'a Vahan Express tester', what: 'one UAT test result', payload: '{"tc_id": "TC-118", "result": "pass", "tester_id": "T07"}', ok: '200 OK', okBody: '{"received_id": "UAT-0451"}', badCase: 'is missing tc_id', badReply: '400 Bad Request naming the missing field, tc_id' },
    cloud: { path: 'resource-created', sender: "MeghaStack's cloud platform", what: 'a new-resource event', payload: '{"resource_id": "vm-3391", "client_id": "CL-22"}', ok: '200 OK', okBody: '{"received": "vm-3391"}', badCase: 'is missing client_id', badReply: '400 Bad Request naming the missing field, client_id' },
    cybersecurity: { path: 'ioc-submit', sender: 'a KiranaKosh security analyst', what: 'an indicator from a reported phishing email', payload: '{"type": "domain", "value": "kosh-verify.example"}', ok: '202 Accepted', okBody: '{"submission_id": "SUB-310"}', header: 'X-ThreatLoop-Key', badCase: 'arrives without the X-ThreatLoop-Key header', badReply: '401 Unauthorized, before anything is stored' },
    data_science: { path: 'batch-landed', sender: "RahiRide's data pipeline", what: 'a new batch of ride data', payload: '{"batch_date": "2026-11-06", "checksum": "9f2c41"}', ok: '202 Accepted', okBody: '{"status": "accepted", "batch_date": "2026-11-06"}', badCase: 'has batch_date written as 06/11/2026', badReply: '400 Bad Request naming the bad field, batch_date' },
    devops: { path: 'ci-failure', sender: 'GitHub Actions at TiffinGrid', what: 'a failed build', payload: '{"workflow_run": {"id": 88213, "conclusion": "failure"}}', ok: '202 Accepted', okBody: '{"run_id": 88213}', badCase: 'has no workflow_run.id', badReply: '400 Bad Request with "workflow_run.id missing"' },
    ai_ml: { path: 'labelloop-batch', sender: "NSGI's labelling tool", what: 'a batch of claim messages to label', payload: '{"batch_id": "B-17", "messages": ["Bumper dented", "..."]}', ok: '202 Accepted', okBody: '{"received": 200}', badCase: 'has an empty messages list', badReply: '400 Bad Request with "messages must not be empty"' },
  };
  function fieldHook(field) {
    return FH[field.id] || { path: 'events', sender: `${field.company}'s app`, what: 'a new event', payload: '{"event_id": "evt_1"}', ok: '202 Accepted', okBody: '{"received": true}', badCase: 'is missing a required field', badReply: '400 Bad Request naming the missing field' };
  }

  // ---------- Hand-written content for other Month 8 lectures ----------
  const BANK = {
    63: { points: ['Run Activepieces on your own machine with one Docker command', 'A trigger decides when a flow starts: on a schedule, on an event or by hand', 'Your cloud workspace already has Docker ready'],
      nodes: [['Docker', 'runs Activepieces'], ['Trigger', 'schedule or event'], ['Flow', 'your steps'], ['Run history', 'what happened']],
      code: '# Start Activepieces on your machine\ndocker compose up -d\n\n# Open the editor\nhttp://localhost:8080\n\n# Trigger options\nSchedule: every day at 9:00\nWebhook:  when another app calls\nManual:   you press Test',
      pitfalls: ['Forgetting to publish, so the trigger never fires', 'Another program already uses the port', 'Testing a trigger with no sample data'] },
    64: { points: ['Every flow is a trigger followed by steps, run top to bottom', 'Each step can read what earlier steps produced', 'You pick earlier data from the data panel instead of typing it'],
      nodes: [['Trigger', 'starts the run'], ['Step 1', 'fetches data'], ['Step 2', 'uses Step 1 output'], ['Result', 'message sent']],
      code: '// Step 2 inputs, picked from the data panel\nmessage: "New order from {{trigger.body.name}}"\ntotal:   "{{step_1.output.total}}"\n\n// Activepieces fills these in on every run',
      pitfalls: ['Renaming a step breaks references to it', 'Testing a step before the step above has sample data', 'Typing values by hand instead of mapping them'],
      qs: [
        { q: 'In a flow, what runs first?', a: 'The trigger', w: ['The last step', 'All steps at the same time', 'Whichever step is fastest'], why: 'A flow always starts with its trigger. The steps then run top to bottom.' },
        { q: 'How does Step 2 use data that Step 1 produced?', a: "It picks Step 1's output from the data panel", w: ['You copy the value by hand each run', 'Steps cannot share data', 'It reads a text file Step 1 saved'], why: 'The data panel lists every earlier output, so Step 2 maps it in and gets fresh values on each run.' },
        null,
        { q: 'You renamed Step 1 and now Step 2 fails. What is the likely cause?', a: 'Step 2 still points to the old step name', w: ['The trigger was deleted', 'Flows can only have one step', 'The internet connection dropped'], why: 'References use the step name. Re-pick the value from the data panel after a rename.' },
      ] },
    66: { points: ['A Code step runs a small piece of TypeScript inside the flow', 'It takes inputs from earlier steps and returns a clean object', 'Use it when the built-in pieces cannot reshape the data'],
      nodes: [['Webhook data', 'raw input'], ['Code step', 'reshapes it'], ['Clean object', 'count, total'], ['Next step', 'uses clean data']],
      code: 'export const code = async (inputs) => {\n  const rows = inputs.rows ?? [];\n  return {\n    count: rows.length,\n    total: rows.reduce((s, r) => s + r.amount, 0),\n  };\n};',
      pitfalls: ['Returning nothing, so later steps get empty data', 'Assuming a field is always there', 'Putting a secret key inside the code'],
      qs: [
        { q: 'When should you reach for a Code step?', a: 'When the built-in pieces cannot reshape the data', w: ['For every step, always', 'Only to send emails', 'Only to start a flow'], why: 'Code steps are for the gaps. Built-in pieces are easier to read and maintain.' },
        { q: 'What must a Code step do so later steps can use its result?', a: 'Return an object', w: ['Print to the console', 'Save a file to disk', 'Restart the flow'], why: 'Whatever the step returns becomes its output in the data panel.' },
        null,
        { q: 'An input field is sometimes missing. What is the safe move?', a: 'Give it a default value before using it', w: ['Ignore it and hope', 'Delete the Code step', 'Ask the sender to stop sending'], why: 'A default such as an empty list keeps the step from crashing on odd input.' },
      ] },
    67: { points: ['A Router sends each run down one branch based on a condition', 'Each branch has its own steps', 'A fallback branch catches everything that matches nothing'],
      nodes: [['Trigger', 'new enquiry'], ['Router', 'checks urgency'], ['Branch', 'high or normal'], ['Fallback', 'everything else']],
      code: 'Router\n  Branch 1: urgency equals "high"   -> alert on-call\n  Branch 2: urgency equals "normal" -> add to queue\n  Otherwise (fallback)               -> log for review',
      pitfalls: ['Comparing the text "true" with a true/false value', 'Two branches that can both match', 'No fallback, so odd inputs vanish'],
      qs: [
        { q: 'What does a Router do?', a: 'Sends each run down one branch based on a condition', w: ['Runs every branch every time', 'Connects your laptop to the internet', 'Stores data for later'], why: 'A Router checks conditions in order and picks one branch for the run.' },
        { q: 'Why keep a fallback branch?', a: 'So inputs that match no condition are still handled', w: ['It makes the flow run faster', 'Activepieces needs it to publish', 'It deletes bad data'], why: 'Without a fallback, unexpected inputs silently do nothing.' },
        null,
        { q: 'Every run goes to the fallback branch. What is a likely cause?', a: 'The condition compares the text "true" with a true/false value', w: ['The flow has too many steps', 'The trigger is on a schedule', 'The Router is switched off'], why: 'Text "true" and the value true are not equal. Make the earlier step return a real true/false value.' },
      ] },
    68: { points: ['A flow can call any web API with an HTTP step', 'Keys and passwords live in Connections, never inside a step', "Read the API's reply and pass the useful parts on"],
      nodes: [['Flow step', 'needs data'], ['Connection', 'holds the key'], ['HTTP call', 'to the API'], ['Reply', 'parsed, passed on']],
      code: 'HTTP step\n  method:  GET\n  url:     https://api.example.com/v1/orders\n  auth:    {{connections.orders_api}}\n\n# The key lives in a Connection,\n# never typed into the step.',
      pitfalls: ['Pasting an API key into a step', 'Ignoring error replies from the API', 'Calling the API once per row when one call would do'] },
    69: { points: ['An AI step can read text and choose a label', 'Give it a fixed list of labels and a few examples', 'Check its answer before the flow acts on it'],
      nodes: [['Text in', 'a message'], ['AI step', 'picks a label'], ['Check', 'label is allowed'], ['Action', 'route by label']],
      code: 'AI step: classify\n  text:   {{trigger.body.message}}\n  labels: ["complaint", "booking", "question"]\n\n# A Router then branches on the label',
      pitfalls: ['Letting the AI invent new labels', 'Acting on a label without checking it', 'No examples, so answers drift'] },
    70: { points: ['Steps fail: networks drop and APIs time out', 'Retries and error branches keep the flow going', 'Run history shows what happened; a summary tells people'],
      nodes: [['Step fails', 'timeout'], ['Retry', 'try again'], ['Error branch', 'if still failing'], ['Summary', 'report to the team']],
      code: 'Step settings\n  retry on failure:  3 times, 30 s apart\n  on final failure:  go to error branch\n\n# Run history keeps every run for review',
      pitfalls: ['Retrying forever and flooding the API', 'Failing silently with no alert', 'No summary, so nobody knows what ran'] },
  };

  // ---------- Content builders ----------
  function mkQ(q, a, wrong, why, seed) {
    const opts = [a, ...wrong];
    const k = seed % opts.length; // deterministic rotation so the right answer is not always first
    const rot = opts.slice(k).concat(opts.slice(0, k));
    return { q, options: rot, correct: rot.indexOf(a), why };
  }
  function practicalQ(lec, field, data, seed) {
    const others = data.lectures.filter((l) => l.month === lec.month && l.id !== lec.id).map((l) => l.practical);
    const wrong = [0, 1, 2].map((i) => others[(lec.id + i * 2) % others.length]);
    return mkQ(`In this lecture's practical you work on ${field.company} data. What does it produce?`, lec.practical, wrong,
      `The practical for Lecture ${lec.id} produces: ${lec.practical}. It is checked automatically within about a minute.`, seed);
  }

  function spec65(lec, field, data) {
    const F = fieldHook(field), co = field.company;
    const slides = [
      { kind: 'title', title: 'Webhooks: catch and respond' },
      { kind: 'poll', title: 'Polling vs webhooks' },
      { kind: 'diagram', title: 'How one webhook call travels', nodes: [['Sender app', 'posts JSON'], ['Caddy gateway', 'checks the token'], ['Catch Webhook', 'receives the body'], ['Code / Router', 'checks fields'], ['Return Response', 'sends the status']], hl: 1, ret: `replies: ${F.ok}` },
      { kind: 'code', title: 'Send a test call', code: code65(F) },
      { kind: 'field65', title: `At ${co}` },
      { kind: 'pitfalls', title: 'Three things that go wrong', items: [['Duplicates', "Senders retry. Use the event's own ID to skip repeats."], ['Broken bodies', 'Check required fields. Answer 400 with the reason.'], ['Strangers', 'Accept only calls with the secret token. Others get 401.']], at: [0.25, 0.46, 0.74] },
      { kind: 'recap', title: 'Recap', items: ['The other app calls you the moment something happens', 'The gateway checks the token before the flow runs', 'Your flow always answers with a clear status code'] },
    ];
    const transcript = [
      [5, 'Welcome back. This is Lecture 65: webhooks, catch and respond.'],
      [50, 'Last time we passed data between flow steps. Today another app calls our flow directly.'],
      [105, 'By the end you will have a webhook that answers its caller in under a second.'],
      [160, 'First question: how does your flow find out that something happened?'],
      [230, 'One way is polling. Every few minutes you ask the other app: anything new?'],
      [300, 'Most of the time the answer is no. That wastes calls and adds delay.'],
      [360, 'A webhook flips it around. The other app calls your URL the moment something happens.'],
      [490, 'Here is the full path of one webhook call.'],
      [570, 'The sender posts a small JSON body to your URL.'],
      [650, 'Caddy, the gateway in front of Activepieces, checks the secret token first.'],
      [740, 'Catch Webhook receives the body and starts the flow.'],
      [830, 'A Code or Router step checks the fields and decides what to answer.'],
      [910, 'Return Response sends a status code back, so the sender knows it worked.'],
      [1010, "Now let's be the sender ourselves and send a test call with curl."],
      [1120, `We post a JSON body to /hooks/${F.path}.`],
      [1240, `If the flow is listening, we get ${F.ok} back with a short body.`],
      [1360, 'Save the webhook URL in .env so the gateway knows where to forward calls.'],
      [1460, `Let's see how this works at ${co}.`],
      [1540, `${cap(F.sender)} sends ${F.what} to /hooks/${F.path}.`],
      [1700, `A good call gets ${F.ok}. A call that ${F.badCase} gets ${F.badReply}.`],
      [1820, "That is exactly what you build in today's practical."],
      [1910, 'Three things go wrong with webhooks in real life.'],
      [1990, "First, duplicates. Senders retry, so use the event's own ID to skip repeats."],
      [2060, 'Second, broken bodies. Check the required fields and answer 400 with the reason.'],
      [2160, 'Third, strangers. Accept only calls that carry the secret token. Everyone else gets 401.'],
      [2260, 'Quick recap: the other app calls you, the gateway checks, the flow answers.'],
      [2330, 'Next, open the practical and make your own webhook answer correctly. See you there.'],
    ].map(([t, text]) => ({ t, text }));
    const cues = [
      mkQ('What is the main difference between a webhook and polling?', 'The other app sends you the event the moment it happens', ['You ask the other app for news every few minutes', 'Webhooks only work inside one computer', 'Webhooks need a database to work'], 'With polling you keep asking. With a webhook the other app calls your URL as soon as something happens.', 1),
      mkQ('Which step sends the answer back to the app that called the webhook?', 'Return Response', ['Catch Webhook', 'Router', 'Code step'], 'Catch Webhook receives the call. Return Response sends the status code and body back to the sender.', 2),
      mkQ(`At ${co}, ${F.sender} calls /hooks/${F.path}, but the call ${F.badCase}. What should your flow answer?`, cap(F.badReply), [`${F.ok}, as usual`, 'Nothing, so the sender keeps waiting', '500 Internal Server Error'], `A clear 4xx answer tells the sender what to fix, and nothing bad gets stored. Here that is ${F.badReply}.`, 3),
      mkQ('The same event arrives twice because the sender retried. What keeps your data correct?', "Use the event's own ID to spot and skip the repeat", ['Answer 500 so the sender stops', 'Turn off retries in every app', 'Store both copies and fix it later'], "Retries are normal. The event ID makes a repeat easy to recognise, so you store it once.", 0),
    ].map((q, i) => Object.assign(q, { t: CUES[i] }));
    const tutor = [
      'This lecture shows how another app can tell your flow the moment something happens, and how your flow replies. Keep one question in mind: who calls whom?',
      'Think of a parcel. Polling is you phoning the shop every five minutes to ask if it has left. A webhook is the shop phoning you when it leaves. Less waiting, fewer wasted calls.',
      'Follow the moving dot. The sender posts data to your URL. Caddy checks the token first, so strangers never reach the flow. Catch Webhook receives the body, a Code or Router step decides, and Return Response sends the status code back.',
      `curl lets you pretend to be the sender. You post a small JSON body to /hooks/${F.path}. If ${F.ok} comes back, your flow is listening. If you get nothing, check that the flow is published.`,
      `At ${co}, ${F.sender} sends ${F.what}. Your flow has to handle two cases: a good call gets ${F.ok}, and a call that ${F.badCase} gets ${F.badReply}.`,
      "Most real webhook bugs are these three. Retries create duplicates, so use the event's ID. Broken bodies need a 400 with a reason. Unknown callers need a 401.",
      'You are ready for the practical. Build and test the happy path first, then add the error answer. I can point you in the right direction, but I will not hand you the finished flow.',
    ];
    return finish({ lec, field, data, slides, transcript, cues, tutor, F });
  }

  function code65(F) {
    const e = NM.esc;
    const lines = [
      '<span class="c"># Pretend to be the sender: post one test call</span>',
      `<span class="k">curl</span> -X POST http://localhost:8088/hooks/<span class="s">${e(F.path)}</span> \\`,
      '  -H <span class="s">"Content-Type: application/json"</span> \\',
    ];
    if (F.header) lines.push(`  -H <span class="s">"${e(F.header)}: $LAB_TOKEN"</span> \\`);
    lines.push(`  -d <span class="s">'${e(F.payload)}'</span>`, '', '<span class="c"># What your flow answers</span>', `<span class="n">HTTP/1.1 ${e(F.ok)}</span>`, e(F.okBody));
    return lines.join('\n');
  }
  function plainCode(src) {
    return src.split('\n').map((l) => (/^\s*(#|\/\/)/.test(l) ? `<span class="c">${NM.esc(l)}</span>` : NM.esc(l).replace(/(&quot;[^&]*?&quot;)/g, '<span class="s">$1</span>'))).join('\n');
  }

  function specGeneric(lec, field, data) {
    const B = BANK[lec.id] || {};
    const theme = data.months[lec.month];
    const points = B.points || [`What "${lec.topic}" means, in plain words`, `How it fits the ${/^[A-Z][A-Z]/.test(theme) ? theme : theme.charAt(0).toLowerCase() + theme.slice(1)} work of Month ${lec.month}`, `What you build next: ${lec.practical}`];
    const nodes = B.nodes || [['Trigger', 'starts the run'], ['This lecture', 'the new idea'], ['Practical', 'you build it'], ['Checks', 'within a minute']];
    const code = B.code || `{\n  "displayName": "L${lec.id} practice flow",\n  "trigger": { "type": "WEBHOOK" },\n  "steps": ["${lec.practical}"]\n}`;
    const pitfalls = (B.pitfalls || ['Skipping the test run before publishing', 'Changing many things at once', 'Not reading the run history when something fails']).map((p, i) => [['First', 'Second', 'Third'][i], p]);
    const slides = [
      { kind: 'title', title: lec.topic },
      { kind: 'points', title: 'The big idea', items: points },
      { kind: 'diagram', title: 'How the pieces connect', nodes, hl: 1 },
      { kind: 'code', title: 'A small example', code: plainCode(code) },
      { kind: 'fieldGen', title: `At ${field.company}` },
      { kind: 'pitfalls', title: 'Watch out for', items: pitfalls, at: [0.2, 0.45, 0.7] },
      { kind: 'recap', title: 'Recap', items: points },
    ];
    const lineSets = [
      [`Welcome to Lecture ${lec.id}: ${lec.topic}.`, `This is part of Month ${lec.month}, ${theme}.`, `By the end you will be ready to build: ${lec.practical}.`],
      ['Here is the big idea in three parts.', ...points.map((p) => p + '.')],
      ['Here is how the pieces connect.', `It starts with ${nodes[0][0].toLowerCase()}, then ${nodes[1][0].toLowerCase()}.`, `Then ${nodes[2][0].toLowerCase()}, and finally ${nodes[3][0].toLowerCase()}.`],
      ["Let's look at a small example.", 'Read it line by line. You will write something similar in the practical.', 'Notice that nothing secret is typed in by hand.'],
      [`Now let's bring this to ${field.company}.`, `In the practical you build ${lec.practical.toLowerCase()} on the lab's ${field.company} data.`, 'The automatic checks tell you within a minute what still needs work.'],
      ['A few things often go wrong.', ...pitfalls.map(([, p]) => p + '.')],
      ['Quick recap of today.', 'Next, open the practical and try it yourself. See you there.'],
    ];
    const transcript = [];
    lineSets.forEach((ls, i) => { const a = BOUNDS[i], b = BOUNDS[i + 1]; ls.forEach((text, j) => transcript.push({ t: Math.round(a + 5 + j * (b - a - 10) / ls.length), text })); });
    const gen = [
      mkQ(`Lecture ${lec.id} belongs to Month ${lec.month}. What is that month about?`, theme, [data.months[lec.month - 1] || data.months[3], data.months[lec.month + 1] || data.months[2], data.months[3]].filter((x) => x !== theme).slice(0, 3), `Month ${lec.month} is "${theme}". Every lecture this month builds towards its project.`, lec.id),
      mkQ('You get stuck in the practical. What does the AI tutor give you?', 'A hint that points you in the right direction', ['The full graded answer', 'Nothing until a mentor logs in', 'A different, easier task'], 'The tutor gives hints and explanations, never the full graded answer, so the work stays yours.', lec.id + 1),
      null,
      mkQ('The practical is checked automatically. When do you see the result?', 'Within about a minute', ["After the mentor's weekly review", 'At the end of the month', 'Only after the final exam'], 'Practicals are auto-checked within a minute, so you can fix and retry straight away.', lec.id + 2),
    ];
    const bankQs = B.qs || [];
    const cues = CUES.map((t, i) => {
      const bq = bankQs[i];
      const q = i === 2 ? practicalQ(lec, field, data, lec.id + 3) : bq ? mkQ(bq.q, bq.a, bq.w, bq.why, lec.id + i) : gen[i];
      return Object.assign(q, { t });
    });
    const tutor = [
      `This lecture is about ${lec.topic.toLowerCase()}. Keep one question in mind while you watch: what will this let my flow do that it could not do before?`,
      `In short: ${points[0].toLowerCase()}. The other two points build on that.`,
      `Read the diagram left to right: ${nodes.map((n) => n[0]).join(', then ')}. Each box hands its result to the next one.`,
      'Do not memorise the example. Notice its shape: inputs at the top, the result at the bottom, and nothing secret typed in by hand.',
      `At ${field.company}, the practical asks you to build ${lec.practical.toLowerCase()}. Start small, test one run, then add the rest.`,
      `The most common mistake here: ${pitfalls[0][1].toLowerCase()}. Check for it first when something fails.`,
      'You are ready for the practical. I can give you hints while you work, but not the graded answer.',
    ];
    return finish({ lec, field, data, slides, transcript, cues, tutor, nodes, points });
  }

  function finish(spec) {
    spec.slides.forEach((s, i) => { s.start = BOUNDS[i]; s.end = BOUNDS[i + 1]; s.n = i + 1; });
    return spec;
  }
  const buildSpec = (lec, field, data) => (lec.id === 65 ? spec65(lec, field, data) : specGeneric(lec, field, data));

  // ---------- Slide renderers ----------
  function slideNode(spec, s, c) {
    const { h } = c, lec = spec.lec;
    const bit = (at, node) => { node.classList.add('bit'); node.dataset.at = at; return node; };
    const head = h('div', { class: 'lx-shead' }, h('span', { class: 'lx-chap' }, `Part ${s.n} of ${spec.slides.length}`), h('h3', { class: 'lx-title' }, s.title));
    const el = h('div', { class: 'lx-slide enter', 'data-kind': s.kind });
    if (s.kind === 'title') {
      el.classList.add('is-title');
      el.append(
        bit(0, h('span', { class: 'lx-chap' }, `Month ${lec.month} · ${c.data.months[lec.month]}`)),
        bit(0, h('div', { class: 'lx-lno' }, `Lecture ${lec.id}`)),
        bit(0, h('h2', { class: 'lx-hero' }, lec.topic)),
        bit(0, h('div', { class: 'lx-meta' }, h('span', {}, '40 min'), h('span', {}, '4 quick questions'), h('span', {}, `Practical: ${lec.practical}`))),
        bit(0.2, h('div', { class: 'lx-by' }, `${INSTRUCTOR.name} · Instructor (demo)`)));
      return el;
    }
    el.append(head);
    if (s.kind === 'poll') {
      const row = (t, txt, cls) => h('div', { class: 'lx-li ' + (cls || '') }, h('span', { class: 't' }, t), h('span', {}, txt));
      el.append(h('div', { class: 'lx-cols' },
        h('div', { class: 'lx-box' }, h('h4', {}, 'Polling: you keep asking'),
          bit(0.15, row('10:00', 'Anything new?  No.')), bit(0.3, row('10:05', 'Anything new?  No.')), bit(0.45, row('10:10', 'Anything new?  Yes, one order.', 'hi'))),
        h('div', { class: 'lx-box accent' }, h('h4', {}, 'Webhook: they call you'),
          bit(0.6, row('10:07', 'The app posts the order to your URL.', 'hi')), bit(0.68, row('10:07', 'Your flow answers: received.')))),
        bit(0.76, h('p', { class: 'lx-key' }, 'A webhook is a URL that another app calls the moment something happens.')));
    } else if (s.kind === 'points') {
      el.append(h('div', { class: 'lx-points' }, s.items.map((p, i) => bit(0.12 + i * 0.22, h('div', { class: 'lx-pt' }, h('span', { class: 'n' }, `0${i + 1}`), h('p', {}, p))))));
    } else if (s.kind === 'diagram') {
      el.append(h('div', { class: 'lx-dg', html: diagramSVG(s) }));
    } else if (s.kind === 'code') {
      el.append(bit(0.08, h('pre', { class: 'code lx-code', html: s.code })));
    } else if (s.kind === 'field65') {
      const F = spec.F;
      el.append(h('div', { class: 'lx-cols' },
        h('div', { class: 'lx-box' },
          bit(0.05, h('p', { class: 'lx-p' }, h('span', { class: 'lbl' }, 'Who calls'), cap(F.sender))),
          bit(0.15, h('p', { class: 'lx-p' }, h('span', { class: 'lbl' }, 'What it sends'), cap(F.what))),
          bit(0.25, h('p', { class: 'lx-p' }, h('span', { class: 'lbl' }, 'Your URL'), h('code', {}, `/hooks/${F.path}`)))),
        h('div', { class: 'lx-box' },
          bit(0.3, h('pre', { class: 'code lx-code sm', html: `<span class="c"># sample body</span>\n${NM.esc(F.payload)}` })),
          bit(0.55, h('div', { class: 'lx-out ok' }, h('b', {}, 'Good call'), h('span', {}, F.ok))),
          bit(0.62, h('div', { class: 'lx-out bad' }, h('b', {}, `Call ${F.badCase}`), h('span', {}, cap(F.badReply)))))));
    } else if (s.kind === 'fieldGen') {
      const f = spec.field;
      el.append(h('div', { class: 'lx-cols' },
        h('div', { class: 'lx-box' }, bit(0.05, h('p', { class: 'lx-p' }, h('span', { class: 'lbl' }, 'The company'), f.about.split('. ')[0].replace(/\.$/, '') + '.'))),
        h('div', { class: 'lx-box accent' },
          bit(0.3, h('p', { class: 'lx-p' }, h('span', { class: 'lbl' }, 'You build'), spec.lec.practical)),
          bit(0.5, h('p', { class: 'lx-p' }, h('span', { class: 'lbl' }, 'Checked'), 'Automatically, within a minute')))));
    } else if (s.kind === 'pitfalls') {
      el.append(h('div', { class: 'lx-points' }, s.items.map(([t, p], i) => bit(s.at[i], h('div', { class: 'lx-pt warn' }, h('span', { class: 'n' }, t), h('p', {}, p))))));
    } else if (s.kind === 'recap') {
      el.append(h('div', { class: 'lx-recap' }, s.items.map((p, i) => bit(0.08 + i * 0.16, h('div', { class: 'lx-rc' }, h('span', { class: 'ck', html: c.icon('check') }), h('span', {}, p))))),
        bit(0.6, h('div', { class: 'lx-next' }, h('span', { class: 'lbl' }, 'Up next'), h('b', {}, `Practical: ${lec.practical}`), h('span', {}, '20 minutes in your cloud workspace'))));
    }
    return el;
  }

  function diagramSVG(s) {
    const e = NM.esc, n = s.nodes.length, W = 800, pad = 20, gap = 26, w = (W - pad * 2 - gap * (n - 1)) / n, y = 50, hgt = 84;
    const cx = (i) => pad + i * (w + gap) + w / 2;
    let out = `<svg class="lx-svg" viewBox="0 0 ${W} 250" role="img" aria-label="${e(s.nodes.map((x) => x[0]).join(' to '))}"><defs><marker id="lxArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="ah" d="M0 0L10 5L0 10z"/></marker></defs>`;
    s.nodes.forEach(([a, b], i) => {
      const x = pad + i * (w + gap), at = (0.05 + i * (0.75 / n)).toFixed(2);
      out += `<g class="nd bit${i === s.hl ? ' hl' : ''}" data-at="${at}"><rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="12"/><text x="${x + w / 2}" y="${y + 36}" text-anchor="middle">${e(a)}</text><text class="sub" x="${x + w / 2}" y="${y + 58}" text-anchor="middle">${e(b)}</text></g>`;
      if (i < n - 1) out += `<line class="ln bit" data-at="${at}" x1="${x + w + 3}" y1="${y + hgt / 2}" x2="${x + w + gap - 3}" y2="${y + hgt / 2}" marker-end="url(#lxArr)"/>`;
    });
    out += `<circle class="pkt" cx="${cx(0)}" cy="${y - 14}" r="7" style="--dx:${cx(n - 1) - cx(0)}px"/>`;
    if (s.ret) out += `<g class="bit" data-at="0.86"><path class="ln ret" d="M${cx(n - 1)} ${y + hgt + 4} V${y + hgt + 46} H${cx(0)} V${y + hgt + 10}" marker-end="url(#lxArr)"/><text class="rl" x="${W / 2}" y="${y + hgt + 40}" text-anchor="middle">${e(s.ret)}</text></g>`;
    return out + '</svg>';
  }

  // ---------- Styles ----------
  function injectCSS() {
    if (document.getElementById('m-lecture')) return;
    const css = `
.m-lecture { display: grid; gap: 20px; min-width: 0 }
.m-lecture [hidden] { display: none !important }
.m-lecture .lx-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 20px; align-items: start }
.m-lecture .lx-main, .m-lecture .lx-side { display: grid; gap: 16px; min-width: 0 }
.m-lecture .lx-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px 16px; flex-wrap: wrap }
.m-lecture .lx-head > div { min-width: 0 }
.m-lecture .lx-head h2 { margin-top: 2px }
.m-lecture .lx-pills { display: flex; gap: 6px; flex-wrap: wrap }

.m-lecture .lx-player { border-radius: var(--radius); overflow: hidden; background: var(--code-bg); border: 1px solid var(--line); box-shadow: var(--shadow) }
.m-lecture .lx-stage-wrap { position: relative }
.m-lecture .lx-stage { position: relative; aspect-ratio: 16 / 9; container-type: inline-size; overflow: hidden; color: var(--code-fg); cursor: pointer; user-select: none;
  background: radial-gradient(120% 95% at 88% 0%, color-mix(in srgb, var(--code-key) 17%, var(--code-bg)) 0%, var(--code-bg) 62%) }
.m-lecture .lx-stage:focus-visible { outline: 2px solid var(--code-key); outline-offset: -4px }
.m-lecture .lx-slide { position: absolute; inset: 0; padding: 5cqw 6.5cqw 10cqw; display: flex; flex-direction: column; gap: 2.3cqw; min-width: 0 }
.m-lecture .lx-slide > .lx-shead + * { margin-top: auto }
.m-lecture .lx-slide:not(.is-title) > :last-child { margin-bottom: auto }
.m-lecture .lx-slide.enter { animation: lx-in .5s ease both }
@keyframes lx-in { from { opacity: 0; transform: translateY(1.4cqw) } }
.m-lecture .lx-shead { display: grid; gap: .6cqw }
.m-lecture .lx-chap { font-size: clamp(8px, 1.45cqw, 13px); font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--code-key) }
.m-lecture .lx-title { font-family: var(--display); font-size: clamp(12px, 3.5cqw, 34px); line-height: 1.15; color: var(--code-fg); margin: 0 }
.m-lecture .bit { opacity: 0; transform: translateY(.9cqw); transition: opacity .45s ease, transform .45s ease }
.m-lecture .bit.on { opacity: 1; transform: none }
.m-lecture svg .bit { transform: none }

.m-lecture .lx-slide.is-title { justify-content: center; gap: 1.6cqw; padding-left: 8cqw;
  background: linear-gradient(90deg, color-mix(in srgb, var(--code-key) 10%, transparent), transparent 55%) }
.m-lecture .lx-lno { font-family: var(--display); font-size: clamp(10px, 2.2cqw, 20px); font-weight: 700; color: var(--code-str) }
.m-lecture .lx-hero { font-family: var(--display); font-size: clamp(16px, 5.6cqw, 54px); line-height: 1.08; color: var(--code-fg); max-width: 80%; margin: 0 }
.m-lecture .lx-meta { display: flex; flex-wrap: wrap; gap: 1cqw }
.m-lecture .lx-meta span { font-size: clamp(8px, 1.6cqw, 14px); font-weight: 700; padding: .5cqw 1.3cqw; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--code-fg) 22%, transparent); color: var(--code-fg) }
.m-lecture .lx-by { font-size: clamp(8px, 1.6cqw, 14px); color: var(--code-muted) }

.m-lecture .lx-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2.6cqw; min-height: 0; align-items: start }
.m-lecture .lx-box { border: 1px solid color-mix(in srgb, var(--code-fg) 14%, transparent); border-radius: 1.4cqw; padding: 2.2cqw; display: grid; gap: 1.3cqw; align-content: start; min-width: 0;
  background: color-mix(in srgb, var(--code-fg) 4%, transparent) }
.m-lecture .lx-box.accent { border-color: color-mix(in srgb, var(--code-str) 45%, transparent); background: color-mix(in srgb, var(--code-str) 7%, transparent) }
.m-lecture .lx-box h4 { font-size: clamp(9px, 2cqw, 18px); color: var(--code-key); margin: 0 }
.m-lecture .lx-box.accent h4 { color: var(--code-str) }
.m-lecture .lx-li { display: flex; gap: 1.4cqw; font-size: clamp(8px, 1.85cqw, 17px); color: var(--code-fg); min-width: 0 }
.m-lecture .lx-li .t { font-family: var(--mono); color: var(--code-muted); flex: none }
.m-lecture .lx-li.hi span:last-child { color: var(--code-num); font-weight: 700 }
.m-lecture .lx-key { font-size: clamp(9px, 2.1cqw, 19px); font-weight: 700; color: var(--code-fg); border-left: .5cqw solid var(--code-str); padding-left: 1.6cqw; margin: 0 }
.m-lecture .lx-points { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2cqw; margin-top: 1cqw }
.m-lecture .lx-pt { border: 1px solid color-mix(in srgb, var(--code-fg) 14%, transparent); border-radius: 1.4cqw; padding: 2.2cqw; display: grid; gap: 1.2cqw; align-content: start; min-width: 0;
  background: color-mix(in srgb, var(--code-fg) 4%, transparent) }
.m-lecture .lx-pt .n { font-family: var(--display); font-size: clamp(10px, 2.6cqw, 24px); font-weight: 700; color: var(--code-num) }
.m-lecture .lx-pt.warn .n { color: var(--code-key); font-size: clamp(9px, 2.1cqw, 20px) }
.m-lecture .lx-pt p { font-size: clamp(8px, 1.9cqw, 18px); line-height: 1.4; color: var(--code-fg); margin: 0 }
.m-lecture .lx-dg { flex: 1; display: grid; align-items: center; min-height: 0 }
.m-lecture .lx-svg { width: 100%; height: auto; max-height: 100%; overflow: visible }
.m-lecture .lx-svg .nd rect { fill: color-mix(in srgb, var(--code-key) 13%, var(--code-bg)); stroke: var(--code-key); stroke-width: 1.5 }
.m-lecture .lx-svg .nd.hl rect { fill: color-mix(in srgb, var(--code-num) 13%, var(--code-bg)); stroke: var(--code-num) }
.m-lecture .lx-svg text { fill: var(--code-fg); font-family: var(--body); font-size: 15px; font-weight: 800 }
.m-lecture .lx-svg text.sub { fill: var(--code-muted); font-size: 12.5px; font-weight: 600 }
.m-lecture .lx-svg .ln { stroke: var(--code-muted); stroke-width: 2; fill: none }
.m-lecture .lx-svg .ret { stroke: var(--code-str); stroke-dasharray: 6 6 }
.m-lecture .lx-svg .rl { fill: var(--code-str); font-size: 14px; font-weight: 700 }
.m-lecture .lx-svg .ah { fill: var(--code-muted) }
.m-lecture .lx-svg .pkt { fill: var(--code-str); animation: lx-pkt 3.4s linear infinite }
.m-lecture .lx-stage:not(.playing) .lx-svg .pkt { animation-play-state: paused }
@keyframes lx-pkt { 0% { transform: translateX(0); opacity: 0 } 8% { opacity: 1 } 90% { opacity: 1 } 100% { transform: translateX(var(--dx)); opacity: 0 } }
.m-lecture .lx-code { font-size: clamp(7px, 1.72cqw, 16px); line-height: 1.6; padding: 2cqw 2.4cqw; border-radius: 1.2cqw; overflow: hidden; margin: 0;
  background: color-mix(in srgb, var(--code-fg) 6%, var(--code-bg)); border: 1px solid color-mix(in srgb, var(--code-fg) 12%, transparent) }
.m-lecture .lx-code.sm { font-size: clamp(7px, 1.45cqw, 14px); white-space: pre-wrap; word-break: break-word }
.m-lecture .lx-p { display: grid; gap: .3cqw; font-size: clamp(8px, 1.9cqw, 18px); color: var(--code-fg); margin: 0; line-height: 1.35 }
.m-lecture .lx-p code { font-size: inherit; color: var(--code-str) }
.m-lecture .lbl { font-size: clamp(7px, 1.3cqw, 12px); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--code-muted) }
.m-lecture .lx-out { display: grid; gap: .3cqw; font-size: clamp(8px, 1.7cqw, 16px); padding: 1.2cqw 1.6cqw; border-radius: 1cqw; color: var(--code-fg); line-height: 1.35 }
.m-lecture .lx-out b { font-size: clamp(7px, 1.35cqw, 13px); text-transform: uppercase; letter-spacing: .06em }
.m-lecture .lx-out.ok { background: color-mix(in srgb, var(--code-str) 15%, transparent) } .m-lecture .lx-out.ok b { color: var(--code-str) }
.m-lecture .lx-out.bad { background: color-mix(in srgb, var(--red) 20%, transparent) } .m-lecture .lx-out.bad b { color: var(--code-num) }
.m-lecture .lx-recap { display: grid; gap: 1.4cqw }
.m-lecture .lx-rc { display: flex; gap: 1.4cqw; align-items: center; font-size: clamp(9px, 2.1cqw, 20px); color: var(--code-fg) }
.m-lecture .lx-rc .ck { width: 3.4cqw; height: 3.4cqw; min-width: 14px; min-height: 14px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--code-str) 22%, transparent); color: var(--code-str); flex: none }
.m-lecture .lx-rc .ck svg { width: 62%; height: 62% }
.m-lecture .lx-next { display: grid; gap: .4cqw; margin-top: .8cqw; padding: 1.8cqw 2.2cqw; border-radius: 1.4cqw; max-width: 70%;
  background: color-mix(in srgb, var(--code-key) 14%, transparent); border: 1px solid color-mix(in srgb, var(--code-key) 40%, transparent) }
.m-lecture .lx-next b { font-size: clamp(10px, 2.2cqw, 20px); color: var(--code-fg) } .m-lecture .lx-next span:last-child { font-size: clamp(8px, 1.6cqw, 15px); color: var(--code-muted) }

.m-lecture .lx-wm { position: absolute; z-index: 2; font-size: clamp(8px, 1.8cqw, 16px); font-weight: 800; letter-spacing: .05em; color: var(--code-fg); opacity: .14; transform: rotate(-10deg); white-space: nowrap; pointer-events: none; transition: left 1.6s ease, top 1.6s ease }
.m-lecture .lx-cap { position: absolute; z-index: 3; left: 50%; bottom: 3.2cqw; transform: translateX(-50%); width: max-content; max-width: 76%; text-align: center; pointer-events: none;
  font-size: clamp(10px, 1.9cqw, 18px); line-height: 1.4; font-weight: 600; color: var(--code-fg); padding: .6cqw 1.4cqw; border-radius: .8cqw; background: color-mix(in srgb, var(--code-bg) 84%, transparent) }
.m-lecture .lx-cap[hidden] { display: none }
.m-lecture .lx-inst { position: absolute; z-index: 2; right: 2.4cqw; bottom: 2.4cqw; width: 6.2cqw; height: 6.2cqw; min-width: 26px; min-height: 26px; border-radius: 50%;
  display: grid; place-items: center; font-family: var(--display); font-weight: 700; font-size: clamp(9px, 2cqw, 18px); color: var(--on-brand); background: linear-gradient(135deg, var(--brand), var(--violet));
  box-shadow: 0 0 0 .35cqw color-mix(in srgb, var(--code-fg) 18%, transparent) }
.m-lecture .lx-stage.playing .lx-inst::after { content: ""; position: absolute; inset: -.7cqw; border-radius: 50%; border: .3cqw solid var(--code-str); animation: lx-pulse 1.6s ease-out infinite }
@keyframes lx-pulse { from { opacity: .9; transform: scale(.92) } to { opacity: 0; transform: scale(1.25) } }
.m-lecture .lx-big { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; pointer-events: none; transition: opacity .25s ease; background: color-mix(in srgb, var(--code-bg) 22%, transparent) }
.m-lecture .lx-big span { width: 11cqw; height: 11cqw; min-width: 46px; min-height: 46px; border-radius: 50%; display: grid; place-items: center; color: var(--on-brand); background: color-mix(in srgb, var(--brand) 90%, transparent); box-shadow: 0 8px 30px color-mix(in srgb, var(--code-bg) 60%, transparent) }
.m-lecture .lx-big svg { width: 42%; height: 42%; margin-left: 8% }
.m-lecture .lx-stage.playing .lx-big, .m-lecture .lx-stage.asking .lx-big, .m-lecture .lx-stage.mid .lx-big { opacity: 0 }

.m-lecture .lx-q { position: absolute; inset: 0; z-index: 4; display: grid; align-items: safe center; justify-items: center; padding: 10px; overflow: auto;
  background: color-mix(in srgb, var(--code-bg) 74%, transparent); backdrop-filter: blur(3px) }
.m-lecture .lx-q[hidden] { display: none }
.m-lecture .lx-qcard { background: var(--surface); color: var(--fg); border-radius: 14px; padding: 14px 16px; width: min(600px, 100%); box-shadow: var(--shadow); display: grid; gap: 9px; animation: lx-pop .28s ease both }
@keyframes lx-pop { from { opacity: 0; transform: scale(.96) } }
.m-lecture .lx-qcard h3 { font-size: 15.5px }
.m-lecture .lx-qtop { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap }
.m-lecture .lx-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px }
.m-lecture .lx-opt { display: flex; gap: 9px; align-items: flex-start; text-align: left; min-width: 0; border: 1px solid var(--line); background: var(--surface); color: var(--fg); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 13.5px; font-weight: 600; line-height: 1.35; cursor: pointer }
.m-lecture .lx-opt .lt { flex: none; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: var(--surface-2); color: var(--muted) }
.m-lecture .lx-opt:hover:not(:disabled) { border-color: var(--brand) }
.m-lecture .lx-opt:disabled { cursor: default }
.m-lecture .lx-opt.right { border-color: var(--green); background: var(--green-soft) } .m-lecture .lx-opt.right .lt { background: var(--green); color: var(--surface) }
.m-lecture .lx-opt.wrong { border-color: var(--red); background: var(--red-soft) } .m-lecture .lx-opt.wrong .lt { background: var(--red); color: var(--surface) }
.m-lecture .lx-opt.dim { opacity: .55 }
.m-lecture .lx-fb { font-size: 13.5px; padding: 7px 10px; border-radius: var(--radius-sm); display: grid; gap: 2px }
.m-lecture .lx-fb.ok { background: var(--green-soft) } .m-lecture .lx-fb.ok b { color: var(--green) }
.m-lecture .lx-fb.no { background: var(--red-soft) } .m-lecture .lx-fb.no b { color: var(--red) }
.m-lecture .lx-qfoot { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; align-items: center }
.m-lecture .lx-endstats { display: flex; gap: 18px; flex-wrap: wrap }

.m-lecture .lx-controls { display: grid; gap: 6px; padding: 6px 14px 12px; color: var(--code-fg); background: var(--code-bg); border-top: 1px solid color-mix(in srgb, var(--code-fg) 10%, transparent) }
.m-lecture .lx-scrub { position: relative; height: 26px; cursor: pointer; touch-action: none }
.m-lecture .lx-scrub:focus-visible { outline: 2px solid var(--code-key); outline-offset: 2px; border-radius: 6px }
.m-lecture .lx-track { position: absolute; left: 0; right: 0; top: 10px; height: 6px; border-radius: 99px; background: color-mix(in srgb, var(--code-fg) 14%, transparent) }
.m-lecture .lx-scrub:hover .lx-track { height: 8px; top: 9px }
.m-lecture .lx-seen { position: absolute; inset: 0; border-radius: inherit }
.m-lecture .lx-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: var(--brand) }
.m-lecture .lx-tick { position: absolute; top: -1px; bottom: -1px; width: 3px; margin-left: -1px; background: var(--code-bg) }
.m-lecture .lx-thumb { position: absolute; top: 13px; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: var(--code-fg); pointer-events: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 45%, transparent) }
.m-lecture .lx-cue { position: absolute; top: 13px; width: 14px; height: 14px; margin: -7px 0 0 -7px; padding: 0; border-radius: 50%; border: 2px solid var(--code-num); background: var(--code-bg); cursor: pointer; z-index: 2 }
.m-lecture .lx-cue::before { content: ""; position: absolute; inset: -8px }
.m-lecture .lx-cue.ok { background: var(--green); border-color: var(--green) } .m-lecture .lx-cue.bad { background: var(--red); border-color: var(--red) }
.m-lecture .lx-cue:hover { transform: scale(1.25) }
.m-lecture .lx-tip { position: absolute; bottom: 24px; transform: translateX(-50%); z-index: 3; pointer-events: none; white-space: nowrap; font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 6px; background: var(--code-fg); color: var(--code-bg) }
.m-lecture .lx-tip[hidden] { display: none }
.m-lecture .lx-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap }
.m-lecture .lx-cbtn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 6px 10px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
  color: var(--code-fg); background: color-mix(in srgb, var(--code-fg) 7%, transparent); border: 1px solid color-mix(in srgb, var(--code-fg) 15%, transparent) }
.m-lecture .lx-cbtn:hover { border-color: var(--code-key); color: var(--code-key) }
.m-lecture .lx-cbtn[aria-pressed="true"] { background: color-mix(in srgb, var(--code-key) 22%, transparent); border-color: var(--code-key) }
.m-lecture .lx-cbtn svg { width: 16px; height: 16px }
.m-lecture .lx-play { width: 40px; height: 40px; padding: 0; border-radius: 50%; background: var(--brand); border-color: var(--brand); color: var(--on-brand) }
.m-lecture .lx-play:hover { background: var(--brand-strong); color: var(--on-brand); border-color: var(--brand-strong) }
.m-lecture .lx-play svg { width: 18px; height: 18px }
.m-lecture .lx-time { font-family: var(--mono); font-size: 13px; color: var(--code-fg); white-space: nowrap }
.m-lecture .lx-time span { color: var(--code-muted) }
.m-lecture .lx-spacer { flex: 1 }
.m-lecture .lx-speed { appearance: none; -webkit-appearance: none; cursor: pointer; min-height: 34px; padding: 6px 10px; border-radius: 8px; font-size: 13px; font-weight: 700;
  color: var(--code-fg); background: color-mix(in srgb, var(--code-fg) 7%, transparent); border: 1px solid color-mix(in srgb, var(--code-fg) 15%, transparent) }
.m-lecture .lx-speed option { color: var(--fg); background: var(--surface) }
.m-lecture .lx-ask { background: color-mix(in srgb, var(--violet) 26%, transparent); border-color: color-mix(in srgb, var(--violet) 60%, transparent) }

.m-lecture .lx-prog { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px }
.m-lecture .lx-pbox { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; display: grid; gap: 8px; align-content: start; min-width: 0 }
.m-lecture .lx-pbox.open { border-color: color-mix(in srgb, var(--green) 55%, var(--line)); background: color-mix(in srgb, var(--green-soft) 50%, var(--surface)) }
.m-lecture .lx-big-n { font-family: var(--display); font-size: 22px; font-weight: 700; line-height: 1.1 }
.m-lecture .lx-bar { position: relative; height: 8px; border-radius: 99px; background: var(--surface-2); margin-top: 2px }
.m-lecture .lx-bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: var(--brand); transition: width .3s ease }
.m-lecture .lx-bar.done > i { background: var(--green) }
.m-lecture .lx-mk { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--faint); border-radius: 2px }
.m-lecture .lx-mkl { position: relative; height: 16px; font-size: 11px; color: var(--muted) }
.m-lecture .lx-mkl span { position: absolute; transform: translateX(-50%); white-space: nowrap }
.m-lecture .lx-mkl span:last-child { transform: translateX(-80%) }
.m-lecture .lx-qd { display: flex; gap: 6px }
.m-lecture .lx-qd i { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--line); display: grid; place-items: center; font-style: normal; font-size: 11px; font-weight: 800; color: var(--faint) }
.m-lecture .lx-qd i.ok { background: var(--green); border-color: var(--green); color: var(--surface) }
.m-lecture .lx-qd i.bad { background: var(--red); border-color: var(--red); color: var(--surface) }
.m-lecture .lx-lockrow { display: flex; gap: 10px; align-items: center; min-width: 0 }
.m-lecture .lx-lockrow > div { min-width: 0 }
.m-lecture .lx-lock { width: 36px; height: 36px; border-radius: 10px; flex: none; display: grid; place-items: center; background: var(--surface-2); color: var(--muted) }
.m-lecture .lx-lock svg { width: 18px; height: 18px }
.m-lecture .lx-lock.open { background: var(--green-soft); color: var(--green); animation: lx-pop .35s ease }
.m-lecture .lx-ok { color: var(--green); font-weight: 700 }

.m-lecture .lx-tx { display: grid; gap: 2px; max-height: 420px; overflow-y: auto; position: relative; margin: 0 -6px; padding: 0 2px }
.m-lecture .lx-line { display: grid; grid-template-columns: 54px minmax(0, 1fr); gap: 8px; text-align: left; background: none; border: 0; border-radius: 8px; padding: 7px 8px; cursor: pointer; font-size: 13.5px; line-height: 1.45; color: var(--muted) }
.m-lecture .lx-line .ts { font-family: var(--mono); font-size: 12px; color: var(--faint); padding-top: 1px; white-space: nowrap }
.m-lecture .lx-line:hover { background: var(--surface-2); color: var(--fg) }
.m-lecture .lx-line.on { background: var(--brand-soft); color: var(--fg); font-weight: 600 }
.m-lecture .lx-line.on .ts { color: var(--brand) }
.m-lecture .lx-line.q .ts::after { content: " ?"; color: var(--amber); font-weight: 800 }

.m-lecture .lx-list { display: grid; gap: 6px }
.m-lecture .lx-preview { display: grid; gap: 12px; border-left: 3px solid var(--brand) }
.m-lecture .lx-preview .pill svg { width: 13px; height: 13px }
.m-lecture .lx-pts { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px }
.m-lecture .lx-item { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 10px; align-items: center; width: 100%; text-align: left; border: 1px solid var(--line); background: var(--surface); color: var(--fg); border-radius: var(--radius-sm); padding: 9px 10px; cursor: pointer }
.m-lecture .lx-item:hover { border-color: var(--brand) }
.m-lecture .lx-item[aria-current="true"] { border-color: var(--brand); background: var(--brand-soft) }
.m-lecture .lx-item .no { width: 42px; height: 42px; border-radius: 9px; display: grid; place-items: center; background: var(--surface-2); color: var(--muted); font-family: var(--display); font-weight: 700; font-size: 13px }
.m-lecture .lx-item[aria-current="true"] .no { background: var(--brand); color: var(--on-brand) }
.m-lecture .lx-item .tx { min-width: 0 }
.m-lecture .lx-item b { display: block; font-size: 13.5px; line-height: 1.3 }
.m-lecture .lx-item .meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 4px; font-size: 12px; color: var(--muted); flex-wrap: wrap }
.m-lecture .lx-item .mini { height: 3px; border-radius: 99px; background: var(--surface-2); margin-top: 6px; overflow: hidden }
.m-lecture .lx-item .mini i { display: block; height: 100%; background: var(--green) }

.m-lecture-modal { display: grid; gap: 12px }
.m-lecture-modal .lx-ctxchip { display: flex; gap: 8px; flex-wrap: wrap; align-items: center }
.m-lecture-modal .lx-msg { border-radius: 12px; padding: 10px 12px; font-size: 14px; line-height: 1.5; max-width: 92% }
.m-lecture-modal .lx-msg.me { justify-self: end; background: var(--brand); color: var(--on-brand); border-bottom-right-radius: 4px }
.m-lecture-modal .lx-msg.ai { background: var(--surface-2); border-bottom-left-radius: 4px; display: grid; gap: 6px }
.m-lecture-modal .lx-thread { display: grid; gap: 10px; max-height: 46vh; overflow-y: auto }
.m-lecture-modal .lx-sugg { display: flex; gap: 6px; flex-wrap: wrap }

@media (max-width: 1100px) {
  .m-lecture .lx-grid { grid-template-columns: minmax(0, 1fr) }
  .m-lecture .lx-side { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start }
  .m-lecture .lx-tx { max-height: 360px }
}
@media (max-width: 760px) {
  .m-lecture .lx-side { grid-template-columns: minmax(0, 1fr) }
  .m-lecture .lx-prog { grid-template-columns: minmax(0, 1fr) }
}
@media (max-width: 640px) {
  .m-lecture .lx-q { position: static; background: var(--code-bg); backdrop-filter: none; padding: 10px }
  .m-lecture .lx-opts { grid-template-columns: minmax(0, 1fr) }
  .m-lecture .lx-controls { padding: 4px 10px 10px }
  .m-lecture .lx-ask .lbl-long { display: none }
}
@media (prefers-reduced-motion: reduce) {
  .m-lecture .lx-svg .pkt { display: none }
  .m-lecture .lx-stage.playing .lx-inst::after { animation: none; opacity: .6 }
  .m-lecture .bit, .m-lecture .lx-wm { transition: none }
  .m-lecture .lx-slide.enter, .m-lecture .lx-qcard { animation: none }
}`;
    document.head.append(Object.assign(document.createElement('style'), { id: 'm-lecture', textContent: css }));
  }

  const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  const UNLOCKED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.8"/></svg>';
  const REPLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/></svg>';

  function cleanup() {
    if (!live) return;
    live.timers.forEach(clearInterval);
    live.offs.forEach((f) => { try { f(); } catch (e) {} });
    live = null;
  }

  const DEF = {
    label: 'Lecture', title: 'Lecture player', icon: 'play', group: 'Student', order: 20,
    destroy() { cleanup(); },
    render(root, c) {
      cleanup();
      injectCSS();
      const { h, data, field, state } = c;
      const me = data.demo_student;
      // Deep link from search or the course map: NM.state.openLecture holds a lecture id (or {id}).
      // Admin "Preview" sets previewLecture; My lab sets lectureRequest. First non-null wins, then all three are cleared.
      const reqKey = ['openLecture', 'previewLecture', 'lectureRequest'].find((k) => state[k] != null);
      if (reqKey) {
        const v = state[reqKey];
        state.openLecture = null; state.previewLecture = null; state.lectureRequest = null;
        const want = Number(v && v.id != null ? v.id : v);
        if (data.lectures.some((l) => l.id === want)) store.sel = want;
      }
      if (!store.sel || !data.lectures.some((l) => l.id === store.sel)) store.sel = me.lecture;
      const lec = data.lectures.find((l) => l.id === store.sel);
      const monthLecs = data.lectures.filter((l) => l.month === lec.month);
      const locked = lec.month > me.month; // later months: show a preview, not the player
      const S = lecState(lec.id, me.lecture);
      const spec = buildSpec(lec, field, data);
      const L = (live = { timers: [], offs: [] });
      let playing = false, slideIdx = -1, lineIdx = -2, overlay = null, seenKey = '';

      // ----- Header -----
      const statusPill = h('span', { class: 'pill' });
      const head = h('div', { class: 'lx-head' },
        h('div', {}, h('div', { class: 'eyebrow' }, `Month ${lec.month} · Week ${lec.week} · Lecture ${lec.id} of 104`), h('h2', {}, lec.topic)),
        h('div', { class: 'lx-pills' }, h('span', { class: 'pill' }, '40 min recorded'), h('span', { class: 'pill violet' }, '4 questions inside'), statusPill));

      // ----- Stage -----
      const slideHost = h('div', { style: { position: 'absolute', inset: '0' } });
      const wm = h('div', { class: 'lx-wm', 'aria-hidden': 'true' }, `${me.name} · ${me.id}`);
      const capEl = h('div', { class: 'lx-cap', 'aria-live': 'off' });
      const bigPlay = h('div', { class: 'lx-big', 'aria-hidden': 'true' }, h('span', { html: PLAY }));
      const stage = h('div', { class: 'lx-stage', tabindex: '0', role: 'button', 'aria-label': 'Play or pause the lecture',
        onclick: () => toggle(),
        onkeydown: (e) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'k') { e.preventDefault(); toggle(); } else if (e.key === 'ArrowRight') seek(S.t + 30); else if (e.key === 'ArrowLeft') seek(S.t - 30); } },
      slideHost, wm, capEl, h('div', { class: 'lx-inst', title: `${INSTRUCTOR.name}, instructor`, 'aria-hidden': 'true' }, INSTRUCTOR.initials), bigPlay);
      const qLayer = h('div', { class: 'lx-q', hidden: true });
      const stageWrap = h('div', { class: 'lx-stage-wrap' }, stage, qLayer);

      // ----- Scrubber -----
      const seen = h('div', { class: 'lx-seen' });
      const fill = h('div', { class: 'lx-fill' });
      const track = h('div', { class: 'lx-track' }, seen, fill, BOUNDS.slice(1, -1).map((b) => h('i', { class: 'lx-tick', style: { left: `${b / TOTAL * 100}%` } })));
      const thumb = h('div', { class: 'lx-thumb' });
      const tip = h('div', { class: 'lx-tip', hidden: true });
      const cueBtns = spec.cues.map((q, i) => h('button', { class: 'lx-cue', style: { left: `${q.t / TOTAL * 100}%` }, 'aria-label': `Question ${i + 1} at ${fmt(q.t)}`,
        onpointerdown: (e) => e.stopPropagation(),
        onclick: (e) => { e.stopPropagation(); seek(q.t); openQuestion(i); } }));
      const scrub = h('div', { class: 'lx-scrub', role: 'slider', tabindex: '0', 'aria-label': 'Lecture timeline', 'aria-valuemin': '0', 'aria-valuemax': String(TOTAL) }, track, thumb, cueBtns, tip);
      const tAt = (e) => { const r = scrub.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * TOTAL; };
      let dragging = false;
      scrub.addEventListener('pointerdown', (e) => { dragging = true; try { scrub.setPointerCapture(e.pointerId); } catch (er) {} seek(tAt(e)); });
      scrub.addEventListener('pointermove', (e) => {
        const t = tAt(e); if (dragging) seek(t);
        const r = scrub.getBoundingClientRect(), x = Math.max(70, Math.min(r.width - 70, (t / TOTAL) * r.width));
        const sl = spec.slides.find((s) => t >= s.start && t < s.end) || spec.slides[spec.slides.length - 1];
        tip.textContent = `${fmt(t)} · ${sl.title}`; tip.style.left = x + 'px'; tip.hidden = false;
      });
      scrub.addEventListener('pointerup', () => { dragging = false; });
      scrub.addEventListener('pointerleave', () => { if (!dragging) tip.hidden = true; });
      scrub.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); seek(S.t + 30); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); seek(S.t - 30); }
        else if (e.key === 'Home') { e.preventDefault(); seek(0); } else if (e.key === 'End') { e.preventDefault(); seek(TOTAL); }
        else if (e.key === ' ') { e.preventDefault(); toggle(); }
      });

      // ----- Control row -----
      const playBtn = h('button', { class: 'lx-cbtn lx-play', 'aria-label': 'Play', html: PLAY, onclick: () => toggle() });
      const timeEl = h('span', { class: 'lx-time num' });
      const ccBtn = h('button', { class: 'lx-cbtn', 'aria-pressed': String(store.cc), title: 'Captions', onclick: () => { store.cc = !store.cc; ccBtn.setAttribute('aria-pressed', String(store.cc)); lineIdx = -2; update(); } }, 'CC');
      const speedSel = h('select', { class: 'lx-speed', 'aria-label': 'Playback speed', onchange: () => { store.speed = +speedSel.value; c.toast(`Speed ${speedSel.value}x`); } },
        [0.75, 1, 1.5, 2].map((v) => h('option', { value: String(v), selected: v === store.speed }, `${v}x`)));
      const askBtn = h('button', { class: 'lx-cbtn lx-ask', onclick: () => askTutor(), html: `${c.icon('spark')}<span>Ask <span class="lbl-long">about this moment</span></span>` });
      const controls = h('div', { class: 'lx-controls' }, scrub,
        h('div', { class: 'lx-row' }, playBtn, h('button', { class: 'lx-cbtn', 'aria-label': 'Back 30 seconds', title: 'Back 30 s', html: REPLAY, onclick: () => seek(S.t - 30) }), timeEl, h('span', { class: 'lx-spacer' }), askBtn, ccBtn, speedSel));
      const player = h('div', { class: 'lx-player' }, stageWrap, controls);

      // ----- Progress strip -----
      const pctEl = h('div', { class: 'lx-big-n num' });
      const barFill = h('i');
      const bar = h('div', { class: 'lx-bar' }, barFill, h('span', { class: 'lx-mk', style: { left: '60%' } }), h('span', { class: 'lx-mk', style: { left: '90%' } }));
      const watchNote = h('div', { class: 'tiny muted' });
      const qNum = h('div', { class: 'lx-big-n num' });
      const qSub = h('div', { class: 'tiny muted' });
      const qDots = h('div', { class: 'lx-qd' }, spec.cues.map((_, i) => h('i', {}, String(i + 1))));
      const lockIc = h('span', { class: 'lx-lock' });
      const lockTitle = h('b', { class: 'small', style: { display: 'block' } });
      const pracBtn = h('button', { class: 'btn primary sm', onclick: () => c.go('practical') }, 'Go to the practical');
      const pracBox = h('div', { class: 'lx-pbox' },
        h('div', { class: 'eyebrow' }, 'Practical'),
        h('div', { class: 'lx-lockrow' }, lockIc, h('div', {}, lockTitle, h('span', { class: 'tiny muted' }, `${lec.practical} · 20 min`))),
        pracBtn,
        lec.id !== me.lecture ? h('span', { class: 'tiny muted' }, `In this demo the practical workspace is set up for Lecture ${me.lecture}.`) : null);
      const prog = h('section', { class: 'card' },
        h('div', { class: 'card-head', style: { marginBottom: '10px' } }, h('h3', {}, 'Your progress in this lecture'), h('span', { class: 'tiny muted' }, 'Only the parts you play count. Skipping ahead does not.')),
        h('div', { class: 'lx-prog' },
          h('div', { class: 'lx-pbox' }, h('div', { class: 'eyebrow' }, 'Watched'), pctEl, bar,
            h('div', { class: 'tiny muted' }, 'Practical opens at 60%. Marked as watched at 90%.'), watchNote),
          h('div', { class: 'lx-pbox' }, h('div', { class: 'eyebrow' }, 'Questions in the video'), qNum, qDots, qSub),
          pracBox));

      // ----- Transcript -----
      const cueLine = (t) => spec.cues.some((q) => q.t >= t && q.t < t + 80);
      const lineEls = spec.transcript.map((ln) => h('button', { class: 'lx-line' + (cueLine(ln.t) ? ' q' : ''), onclick: () => { closeOverlay(); seek(ln.t); } }, h('span', { class: 'ts num' }, fmt(ln.t)), h('span', {}, ln.text)));
      const txList = h('div', { class: 'lx-tx', role: 'list' }, lineEls);
      const txCard = h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', {}, 'Transcript'), h('span', { class: 'tiny muted' }, 'Click a line to jump there')), txList);

      // ----- Month lecture list -----
      const listCard = h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('div', {}, h('div', { class: 'eyebrow' }, `Month ${lec.month}${lec.month === me.month ? ' · this month' : lec.month < me.month ? ' · done' : ' · later'}`), h('h3', {}, data.months[lec.month])), h('span', { class: 'tiny muted' }, `${monthLecs.length} lectures`)),
        lec.month !== me.month ? h('button', { class: 'btn sm', style: { marginBottom: '10px' }, onclick: () => openLec(me.lecture) }, `Back to this week: Lecture ${me.lecture}`) : null,
        h('div', { class: 'lx-list' }, monthLecs.map((l) => {
          const st = store.lec[l.id], pct = st ? watchedPct(st) : l.id < me.lecture ? 1 : 0;
          const done = st ? st.completed : l.id < me.lecture;
          const pill = done ? h('span', { class: 'pill green' }, 'Watched') : l.id === me.lecture ? h('span', { class: 'pill blue' }, 'Today') : pct > 0 ? h('span', { class: 'pill amber' }, 'Started') : h('span', { class: 'pill' }, 'Upcoming');
          return h('button', { class: 'lx-item', 'aria-current': l.id === lec.id ? 'true' : 'false', onclick: () => { if (l.id === store.sel) { c.toast(`Lecture ${l.id} is open above.`); return; } openLec(l.id); } },
            h('span', { class: 'no' }, `L${l.id}`),
            h('span', { class: 'tx' }, h('b', {}, l.topic), h('span', { class: 'meta' }, h('span', {}, `Practical: ${l.practical}`), pill), h('span', { class: 'mini' }, h('i', { style: { width: `${Math.round(pct * 100)}%` } }))));
        })),
        h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'Demo data. Each lecture plays the same player with its own slides and questions.'));

      // ----- Preview for a lecture in a later month -----
      let preview = null;
      if (locked) {
        const wk = lec.week - me.week;
        const pts = spec.points || [];
        preview = h('section', { class: 'card lx-preview' },
          h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'pill' }, h('span', { html: c.icon('lock') }), 'Opens later'), h('span', { class: 'pill amber' }, 'Demo data')),
          h('h3', {}, `This is Lecture ${lec.id}, in Month ${lec.month}`),
          h('p', { class: 'small muted' }, `Month ${lec.month} is "${data.months[lec.month]}". This lecture opens in Week ${lec.week}, ${wk} week${wk === 1 ? '' : 's'} after this week. Lectures open in order, so each one builds on the last.`),
          pts.length ? h('div', {}, h('b', { class: 'small' }, 'What you will learn'), h('ul', { class: 'lx-pts' }, pts.map((x) => h('li', {}, x)))) : null,
          h('div', { class: 'note' }, `Practical: ${lec.practical} · 20 minutes, auto-checked within a minute.`),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => openLec(me.lecture) }, `Go to this week's lecture (L${me.lecture})`),
            h('button', { class: 'btn', onclick: () => c.go('forum'), html: c.icon('forum') + '<span>Ask about it in the forum</span>' })));
      }

      root.append(h('div', { class: 'm-lecture' }, h('div', { class: 'lx-grid' },
        h('div', { class: 'lx-main' }, head, locked ? preview : player, locked ? null : prog),
        h('div', { class: 'lx-side' }, locked ? null : txCard, listCard))));
      if (locked) { statusPill.className = 'pill'; }

      // ----- Behaviour -----
      function clear(r) { r.textContent = ''; return r; }
      function openLec(id) {
        store.sel = id; DEF.render(clear(root), c); window.scrollTo(0, 0);
        const v = document.getElementById('view'); if (v) v.scrollTop = 0;
        root.querySelector('.lx-stage')?.focus({ preventScroll: true });
      }
      function setPlaying(v) {
        playing = v; stage.classList.toggle('playing', v);
        playBtn.innerHTML = v ? PAUSE : PLAY; playBtn.setAttribute('aria-label', v ? 'Pause' : 'Play');
      }
      function play() { if (overlay) closeOverlay(); if (S.t >= TOTAL) S.t = 0; setPlaying(true); }
      function pause() { setPlaying(false); }
      function toggle() { if (overlay && overlay.kind === 'q' && !overlay.done) return; playing ? pause() : play(); }
      function seek(t) { S.t = Math.max(0, Math.min(TOTAL, t)); if (overlay && overlay.kind === 'end' && S.t < TOTAL) closeOverlay(); update(); }

      function markWatched(a, b) {
        for (let k = Math.floor(a / BUCKET); k <= Math.min(NB - 1, Math.floor((b - 0.001) / BUCKET)); k++) S.buckets[k] = 1;
        const pct = watchedPct(S);
        if (pct >= UNLOCK && !S.unlocked) { S.unlocked = true; c.toast('Practical unlocked. You can start it any time.', 'green'); lockIc.classList.add('open'); }
        if (pct >= DONE && !S.completed) {
          S.completed = true; state.progress.lecturesWatched += 1;
          c.emit('lecture:completed', { lecture: lec.id, topic: lec.topic });
          c.toast(`Lecture ${lec.id} marked as watched`, 'green');
          if (c.notify) c.notify('Lecture completed', `Lecture ${lec.id}: ${lec.topic}. Marked as watched${S.unlocked ? '; the practical is open' : ''}.`, 'lecture');
        }
      }
      function tick() {
        if (!playing) return;
        const prev = S.t;
        let next = Math.min(TOTAL, prev + RATE * store.speed * TICK / 1000);
        const ci = spec.cues.findIndex((q, i) => !S.answered[i] && prev < q.t && next >= q.t);
        if (ci >= 0) next = spec.cues[ci].t;
        markWatched(prev, next);
        S.t = next;
        update();
        if (ci >= 0) { pause(); openQuestion(ci); }
        else if (next >= TOTAL) { pause(); showEnd(); }
      }

      function update() {
        const t = S.t, p = t / TOTAL * 100;
        timeEl.innerHTML = `${fmt(t)} <span>/ ${fmt(TOTAL)}</span>`;
        stage.classList.toggle('mid', t > 0 && t < TOTAL);
        fill.style.width = p + '%'; thumb.style.left = p + '%';
        scrub.setAttribute('aria-valuenow', String(Math.round(t))); scrub.setAttribute('aria-valuetext', `${fmt(t)} of 40:00`);
        // slide
        let si = spec.slides.findIndex((s) => t >= s.start && t < s.end); if (si < 0) si = spec.slides.length - 1;
        if (si !== slideIdx) { slideIdx = si; slideHost.textContent = ''; slideHost.append(slideNode(spec, spec.slides[si], c)); }
        const s = spec.slides[si], frac = (t - s.start) / (s.end - s.start);
        slideHost.querySelectorAll('.bit').forEach((b) => b.classList.toggle('on', frac >= +b.dataset.at));
        // transcript + captions
        let li = -1; for (let i = 0; i < spec.transcript.length; i++) if (spec.transcript[i].t <= t) li = i;
        if (li !== lineIdx) {
          lineIdx = li;
          lineEls.forEach((el, i) => el.classList.toggle('on', i === li));
          const ln = spec.transcript[li];
          capEl.textContent = ln ? ln.text : ''; capEl.hidden = !store.cc || !ln || t - ln.t > 140;
          const el = lineEls[li];
          if (el) { const top = el.offsetTop; if (top < txList.scrollTop || top > txList.scrollTop + txList.clientHeight - el.offsetHeight) txList.scrollTop = Math.max(0, top - 40); }
        }
        // seen segments on the timeline
        const key = S.buckets.join('');
        if (key !== seenKey) {
          seenKey = key;
          const stops = []; const col = 'color-mix(in srgb, var(--code-fg) 30%, transparent)';
          S.buckets.forEach((v, k) => { const a = k / NB * 100, b = (k + 1) / NB * 100, cc = v ? col : 'transparent'; stops.push(`${cc} ${a}%`, `${cc} ${b}%`); });
          seen.style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
          updateProgress();
        }
      }

      function updateProgress() {
        const pct = watchedPct(S), n = Math.round(pct * 100);
        pctEl.textContent = S.before && n === 100 ? 'Watched before' : `${n}%`;
        barFill.style.width = n + '%'; bar.classList.toggle('done', S.completed);
        watchNote.innerHTML = S.completed ? `<span class="lx-ok">Marked as watched</span>` : `${Math.max(0, 90 - n)}% more to mark it as watched`;
        const ans = Object.values(S.answered), right = ans.filter((a) => a.correct).length;
        qNum.textContent = `${ans.length} of ${spec.cues.length} answered`;
        qSub.textContent = ans.length ? `${right} correct · +${right * 10} XP` : 'Each correct answer earns 10 XP';
        [...qDots.children].forEach((d, i) => { const a = S.answered[i]; d.className = a ? (a.correct ? 'ok' : 'bad') : ''; });
        cueBtns.forEach((b, i) => { const a = S.answered[i]; b.classList.toggle('ok', !!(a && a.correct)); b.classList.toggle('bad', !!(a && !a.correct)); });
        lockIc.innerHTML = S.unlocked ? UNLOCKED : LOCK; lockIc.classList.toggle('open', S.unlocked);
        lockTitle.textContent = S.unlocked ? 'Practical unlocked' : 'Practical unlocks at 60% watched';
        pracBox.classList.toggle('open', S.unlocked);
        pracBtn.disabled = !S.unlocked;
        pracBtn.title = S.unlocked ? '' : `Watch ${Math.max(0, 60 - n)}% more to unlock`;
        statusPill.className = 'pill ' + (S.completed ? 'green' : n > 0 ? 'blue' : '');
        statusPill.textContent = S.completed ? 'Marked as watched' : n > 0 ? `${n}% watched` : 'Not started';
      }

      function closeOverlay() { overlay = null; qLayer.hidden = true; qLayer.textContent = ''; stage.classList.remove('asking'); }
      function openQuestion(i) {
        pause();
        const q = spec.cues[i], prevAns = S.answered[i];
        overlay = { kind: 'q', i, done: !!prevAns };
        stage.classList.add('asking');
        const fb = h('div', { class: 'lx-fb', hidden: true });
        const waitNote = prevAns ? null : h('span', { class: 'tiny muted' }, 'The video waits for your answer.');
        const cont = h('button', { class: 'btn primary', hidden: true, onclick: () => { closeOverlay(); play(); } }, 'Continue the lecture');
        const optEls = q.options.map((o, k) => h('button', { class: 'lx-opt', onclick: () => pick(k) }, h('span', { class: 'lt' }, 'ABCD'[k]), h('span', {}, o)));
        function show(k) {
          const ok = k === q.correct;
          optEls.forEach((b, j) => { b.disabled = true; if (j === q.correct) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); else b.classList.add('dim'); });
          fb.className = 'lx-fb ' + (ok ? 'ok' : 'no'); fb.hidden = false; fb.textContent = '';
          fb.append(h('b', {}, ok ? 'Correct. +10 XP' : 'Not quite.'), h('span', {}, q.why));
          cont.hidden = false; overlay.done = true; if (waitNote) waitNote.remove();
          setTimeout(() => cont.focus({ preventScroll: true }), 30);
        }
        function pick(k) {
          if (S.answered[i]) return;
          const ok = k === q.correct;
          S.answered[i] = { choice: k, correct: ok };
          state.progress.mcqAnswered += 1; if (ok) state.progress.mcqCorrect += 1;
          if (ok) c.addXP(10, 'Lecture question');
          c.emit('lecture:mcq', { correct: ok, lecture: lec.id, question: i + 1 });
          show(k); updateProgress();
        }
        qLayer.textContent = '';
        qLayer.append(h('div', { class: 'lx-qcard', role: 'dialog', 'aria-label': `Question ${i + 1}` },
          h('div', { class: 'lx-qtop' }, h('span', { class: 'eyebrow' }, `Quick check · Question ${i + 1} of ${spec.cues.length} · ${fmt(q.t)}`), h('span', { class: 'pill violet' }, '+10 XP if right')),
          h('h3', {}, q.q), h('div', { class: 'lx-opts' }, optEls), fb,
          h('div', { class: 'lx-qfoot' }, waitNote, cont)));
        qLayer.hidden = false;
        if (prevAns) show(prevAns.choice); else setTimeout(() => optEls[0].focus({ preventScroll: true }), 30);
      }
      function showEnd() {
        const ans = Object.values(S.answered), right = ans.filter((a) => a.correct).length, missed = spec.cues.length - ans.length;
        overlay = { kind: 'end' }; stage.classList.add('asking');
        qLayer.textContent = '';
        qLayer.append(h('div', { class: 'lx-qcard' },
          h('span', { class: 'eyebrow' }, `Lecture ${lec.id} · finished`),
          h('h3', {}, S.completed ? 'Nice work. This lecture is marked as watched.' : 'You reached the end, but skipped parts.'),
          h('div', { class: 'lx-endstats' },
            h('div', { class: 'stat' }, h('b', {}, `${Math.round(watchedPct(S) * 100)}%`), h('span', {}, 'watched')),
            h('div', { class: 'stat' }, h('b', {}, `${right}/${spec.cues.length}`), h('span', {}, 'questions right')),
            h('div', { class: 'stat' }, h('b', {}, `+${right * 10}`), h('span', {}, 'XP from questions'))),
          missed ? h('p', { class: 'small muted' }, `${missed} question${missed > 1 ? 's' : ''} skipped. Click the hollow dots on the timeline to answer.`) : null,
          S.completed ? null : h('p', { class: 'small muted' }, 'Lectures count as watched at 90%. Play the parts you skipped.'),
          h('div', { class: 'lx-qfoot' },
            h('button', { class: 'btn', onclick: () => { closeOverlay(); seek(0); play(); } }, 'Watch again'),
            h('button', { class: 'btn', onclick: () => c.go('forum') }, 'Ask a doubt'),
            h('button', { class: 'btn primary', disabled: !S.unlocked, onclick: () => c.go('practical') }, 'Go to the practical'))));
        qLayer.hidden = false;
      }

      function askTutor() {
        const was = playing; pause();
        const si = Math.max(0, slideIdx), sl = spec.slides[si];
        const F = spec.F;
        const followUps = [
          ['Give me an everyday example', lec.id === 65
            ? 'A doorbell. You do not open the door every minute to check for visitors. The visitor rings, and you answer. The bell is the webhook; opening the door is your flow’s response.'
            : `Think of ${lec.topic.toLowerCase()} like a recipe card: clear inputs, a few steps in order, and a dish at the end. The practical asks you to cook it once on real ${field.company} data.`],
          ['How does this help in the practical?', lec.id === 65
            ? `Start with the Catch Webhook trigger and send one test call to /hooks/${F.path}. Look at the body in the step output. Then add Return Response with ${F.ok}. The checks will tell you within a minute which case still fails. That is a hint, not the answer.`
            : `In the practical you build ${lec.practical.toLowerCase()}. Get one simple run working first, then add the rest step by step. The automatic checks show what is missing within a minute. I will hint, not solve it for you.`],
        ];
        const thread = h('div', { class: 'lx-thread' });
        function ask(qText, answer) {
          thread.append(h('div', { class: 'lx-msg me' }, qText));
          const ai = h('div', { class: 'lx-msg ai' }, h('span', { class: 'row small muted', style: { gap: '8px' } }, h('span', { class: 'spin' }), 'Tutor is looking at this moment...'));
          thread.append(ai); thread.scrollTop = thread.scrollHeight;
          setTimeout(() => { ai.textContent = ''; ai.append(h('span', { class: 'ai-badge', style: { justifySelf: 'start' } }, 'AI tutor'), h('span', {}, answer)); thread.scrollTop = thread.scrollHeight; }, 750);
        }
        const sugg = h('div', { class: 'lx-sugg' }, followUps.map(([q, a]) => {
          const b = h('button', { class: 'btn sm', onclick: () => { b.disabled = true; ask(q, a); } }, q); return b;
        }));
        let m;
        const node = h('div', { class: 'm-lecture-modal' },
          h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', {}, h('div', { class: 'eyebrow' }, 'Ask about this moment'), h('h3', {}, 'AI tutor')), h('span', { class: 'ai-badge' }, 'AI')),
          h('div', { class: 'lx-ctxchip' }, h('span', { class: 'pill blue' }, `Lecture ${lec.id} · ${fmt(S.t)}`), h('span', { class: 'pill' }, `Slide ${sl.n}: ${sl.title}`)),
          thread, sugg,
          h('p', { class: 'note' }, 'The tutor sees the slide you paused on. It explains and gives hints, never the full graded answer. Demo: answers are scripted.'),
          h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
            h('button', { class: 'btn ghost', onclick: () => { m.close(); c.go('forum'); }, html: c.icon('forum') + '<span>Ask in the doubt forum</span>' }),
            h('button', { class: 'btn', onclick: () => m.close() }, 'Close'),
            h('button', { class: 'btn primary', onclick: () => { m.close(); play(); } }, was ? 'Resume the lecture' : 'Play the lecture')));
        m = c.modal(node);
        ask('Can you explain this part again, more simply?', spec.tutor[si]);
      }

      // watermark drifts so a screen recording always shows who it belongs to
      const spots = [[7, 10], [52, 26], [14, 58], [56, 70], [34, 42]];
      let wi = 0; const placeWm = () => { const [x, y] = spots[wi++ % spots.length]; wm.style.left = x + '%'; wm.style.top = y + '%'; };
      placeWm();
      L.timers.push(setInterval(tick, TICK), setInterval(placeWm, 7000));
      L.offs.push(c.on('field', () => pause()));
      L.offs.push(c.on('lecture:open', (p) => { const id = Number(p && (p.lecture && p.lecture.id != null ? p.lecture.id : p.lecture)); if (data.lectures.some((l) => l.id === id) && root.isConnected) openLec(id); }));
      update(); updateProgress();
    },
  };
  NM.register('lecture', DEF);
})();
