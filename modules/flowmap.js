/* How the lab works: animated system map for investors.
   Scenario stories move a glowing packet along the links, nodes open a side panel, and a Scale panel shows
   cloud computers starting and stopping with a live monthly-cost estimate. All figures are planning estimates. */
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const VB_W = 1040, VB_H = 600, BW = 206, BH = 70;
  const SEATS = 21, CODING_SHARE = 0.3, MAX_ONLINE = 1000;

  // Persist across re-renders (field switch) and navigation.
  const keep = { tech: false, online: 600 };
  let cleanup = null;

  const ICON = {
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    mentor: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    video: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/><path d="M10.5 11v4.5l3.8-2.25z"/>',
    app: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>',
    server: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    bucket: '<path d="M4 7h16l-1.6 12.4a1 1 0 0 1-1 .6H6.6a1 1 0 0 1-1-.6z"/><ellipse cx="12" cy="7" rx="8" ry="2.5"/>',
    github: '<path d="M9 19c-4 1.2-4-2-5.5-2.5M14.5 21v-3.2a2.8 2.8 0 0 0-.8-2.2c2.6-.3 5.3-1.3 5.3-5.8a4.5 4.5 0 0 0-1.2-3.1 4.2 4.2 0 0 0-.1-3.1s-1-.3-3.2 1.2a11 11 0 0 0-5.8 0C6.5 3.3 5.5 3.6 5.5 3.6a4.2 4.2 0 0 0-.1 3.1 4.5 4.5 0 0 0-1.2 3.1c0 4.5 2.7 5.5 5.3 5.8a2.8 2.8 0 0 0-.8 2.2V21"/>',
  };

  // kind drives the icon tile colour: people (violet), web (brand), compute (green), ai (violet), data (amber), ext (muted)
  const NODES = [
    { id: 'student', x: 112, y: 170, kind: 'people', icon: 'laptop', title: "Student's laptop", sub: 'Any browser, nothing to install', tag: 'Browser only · basic laptop',
      does: 'Any ordinary laptop with internet. Students open one website to watch lectures, practise, sit exams and ask for help. Nothing to install.',
      runs: 'A modern browser (Chrome, Edge or Firefox). The laptop only draws the screen; code runs in the cloud workspace.',
      saves: 'Families do not need to buy a powerful computer. A basic laptop is enough for the whole year.' },
    { id: 'mentor', x: 112, y: 450, kind: 'people', icon: 'mentor', title: "Mentor's laptop", sub: 'Reviews work, tracks progress', tag: 'Mentor console · same web app',
      does: 'Mentors see every student’s attendance, marks and progress on one screen. They review capstone projects with rubrics and follow up on doubts.',
      runs: 'Mentor console inside the same Next.js web app. Access is controlled by role (Cognito groups).',
      saves: 'The lab flags who is falling behind, so one mentor can look after a large batch without checking everyone by hand.' },
    { id: 'cdn', x: 370, y: 62, kind: 'web', icon: 'video', title: 'Video delivery', sub: 'CloudFront, close to students', tag: 'CloudFront · encrypted HLS',
      does: 'Streams the recorded lectures quickly anywhere in India, even on slow connections. Each video carries a faint watermark with the student’s ID.',
      runs: 'Amazon CloudFront with encrypted HLS video, signed short-lived cookies and adaptive quality.',
      saves: 'A flat-rate monthly plan, so more viewers do not mean a bigger bill.' },
    { id: 'app', x: 370, y: 310, kind: 'web', icon: 'app', title: 'Lab web app & API', sub: 'The coordinator', tag: 'Next.js + FastAPI · EKS',
      does: 'The website students and mentors use, and the coordinator that tells every other part what to do: start a computer, grade a task, save a mark.',
      runs: 'Next.js front end and FastAPI back end on Amazon EKS (Graviton ARM servers), Cognito sign-in, Valkey cache.',
      saves: 'Runs on a few small, efficient ARM servers and adds capacity only at busy times, such as exam days.' },
    { id: 'ws', x: 650, y: 150, kind: 'compute', icon: 'server', title: 'Practice workspaces', sub: 'Cloud computers on demand', tag: 'Coder + Sysbox · Spot nodes',
      does: 'Cloud computers with VS Code, a terminal and Docker. One starts when a student begins a practical and shuts down when they stop.',
      runs: 'Coder workspaces with Sysbox on EKS Graviton Spot nodes. Small (2 GB) or Large (6 GB) per task. Files saved between sessions.',
      saves: 'They switch off when idle, each student is capped at 12 hours a week, and they run on spare cloud capacity sold at a discount (Spot).' },
    { id: 'grader', x: 650, y: 310, kind: 'compute', icon: 'check', title: 'Auto-grader', sub: 'Marks work within a minute', tag: 'Grader pods · no internet',
      does: 'Checks every practical automatically within a minute, including hidden checks students cannot see. Flags copied work.',
      runs: 'Short-lived grader pods with no network access. pytest, Playwright and custom checks from each practical’s spec.',
      saves: 'Each check runs for seconds and then the grading computer is gone. Mentors spend their time on feedback, not marking.' },
    { id: 'tutor', x: 650, y: 470, kind: 'ai', icon: 'spark', title: 'AI tutor gateway', sub: 'Hints, never the answer', tag: 'LiteLLM · per-student budget',
      does: 'Gives hints step by step, never the full graded answer. Sees the task, the student’s code and the error, so the help is specific.',
      runs: 'LiteLLM gateway with a virtual key and monthly budget per student, hint-ladder prompts and logs mentors can read.',
      saves: 'Cheap model first, stronger model only when needed, and a hard monthly AI allowance per student. No personal AI subscriptions.' },
    { id: 'bedrock', x: 925, y: 470, kind: 'ai', icon: 'chip', title: 'AI models', sub: 'Amazon Bedrock', tag: 'Bedrock · 3 models',
      does: 'The AI models that write the hints and power AI exercises. Students never need their own AI account.',
      runs: 'Amazon Bedrock, called from the Mumbai region: gpt-oss-120b, Claude Haiku 4.5 and Amazon Nova.',
      saves: 'Pay only for what is used. Most questions go to the smallest model that can answer them.' },
    { id: 'db', x: 370, y: 540, kind: 'data', icon: 'db', title: 'Database', sub: 'Marks, progress, accounts', tag: 'PostgreSQL + pgvector · RDS',
      does: 'Keeps accounts, marks, progress, exam answers and certificates in one place, with backups.',
      runs: 'PostgreSQL with pgvector on Amazon RDS (Multi-AZ). pgvector also lets the tutor find the right lecture moment.',
      saves: 'One managed database does the job of several separate tools.' },
    { id: 's3', x: 925, y: 62, kind: 'data', icon: 'bucket', title: 'File storage', sub: 'Amazon S3', tag: 'S3 · lifecycle rules',
      does: 'Stores lecture videos, each student’s saved files and every project submission.',
      runs: 'Amazon S3 with versioned submissions, workspace snapshots and lifecycle rules.',
      saves: 'Older files move to cheaper storage tiers automatically.' },
    { id: 'github', x: 925, y: 330, kind: 'ext', icon: 'github', title: 'GitHub', sub: "Student's own portfolio", tag: 'GitHub App + Pages',
      does: 'Each student’s own GitHub account. Finished projects are pushed here with an automatically built portfolio website.',
      runs: 'GitHub App pushes to the student’s repositories; GitHub Actions builds the portfolio site on GitHub Pages.',
      saves: 'Free for students, and their work stays theirs after the course ends.' },
  ];
  const NODE = Object.fromEntries(NODES.map((n) => [n.id, n]));

  // Edges are drawn centre to centre, under the boxes. Curves route around the middle column.
  const EDGES = [
    ['student', 'cdn'], ['student', 'app'], ['mentor', 'app'], ['student', 'ws'],
    ['app', 'ws'], ['app', 'grader'], ['app', 'tutor'], ['tutor', 'bedrock'], ['app', 'db'],
    ['cdn', 's3'], ['ws', 's3'],
    ['app', 's3', 'M370,310 C 580,228 780,235 925,62'],
    ['app', 'github', 'M370,310 C 560,410 780,420 925,330'],
  ].map(([a, b, d]) => ({ a, b, id: a + '-' + b, d: d || `M${NODE[a].x},${NODE[a].y} L${NODE[b].x},${NODE[b].y}` }));
  const findEdge = (from, to) => EDGES.find((e) => (e.a === from && e.b === to) || (e.a === to && e.b === from));

  function scenarios(c) {
    const f = c.field, D = c.data, s = D.demo_student, first = s.name.split(' ')[0];
    const p = (f.practicals && f.practicals['65']) || { topic: 'today’s practical', starter: [] };
    const dsId = ((p.starter || []).find((x) => x.dataset) || {}).dataset;
    const ds = (f.datasets || []).find((d) => d.id === dsId) || (f.datasets || [])[0];
    const cap = f.capstones[1] || f.capstones[0];
    const capShort = cap.title.split(/[:(]/)[0].trim();
    const ms = (cap.milestones || []).find((m) => m.type === 'merged') || (cap.milestones || [])[0] || { month: s.month };
    const crit = ((cap.rubric || [])[0] || {}).criterion || 'Correctness';
    return [
      { id: 'lecture', label: 'Watch a lecture', color: 'brand', steps: [
        { hops: [['student', 'app'], ['app', 'db']], plain: `${first} opens Lecture ${s.lecture} on his laptop. The lab website checks that he is signed in and enrolled.`,
          tech: 'Next.js page; Cognito session; FastAPI checks enrolment and batch in PostgreSQL (RDS).' },
        { hops: [['app', 'student']], plain: 'The website gives his browser a short-lived pass that works for this one video only.',
          tech: 'API sets a signed CloudFront cookie that expires after the lesson; watermark carries his student ID.' },
        { hops: [['s3', 'cdn'], ['cdn', 'student']], plain: 'The video streams from a delivery network close to him, so it starts quickly even on a slow connection.',
          tech: 'Encrypted HLS segments in S3, cached at CloudFront edges in India; quality adapts from 360p to 1080p.' },
        { hops: [['student', 'app'], ['app', 'db']], plain: 'Quick questions pop up inside the video. He sees straight away if he is right, and his answers are saved.',
          tech: 'In-video MCQ events posted to FastAPI, stored in PostgreSQL; XP and leaderboard updated in Valkey.' },
        { hops: [], nodes: ['cdn', 's3'], plain: 'Video costs stay flat. The delivery plan has a fixed monthly price, so thousands of students watching do not raise the bill.',
          tech: 'CloudFront flat-rate plan instead of per-GB billing; S3 keeps one copy of each lecture.' },
      ] },
      { id: 'practical', label: 'Do a practical', color: 'green', steps: [
        { hops: [['student', 'app'], ['app', 'db']], plain: `${first} clicks Start practical: “${p.topic}”, set at ${f.company}.`,
          tech: `Practical spec for Lecture ${p.lecture || 65} (task, starter files, checks) loaded from the lab catalogue in PostgreSQL.` },
        { hops: [['app', 'ws']], plain: 'The lab switches on a cloud computer just for him. His laptop does not need to be powerful.',
          tech: 'Coder starts a workspace pod on an EKS Graviton Spot node; Sysbox lets Docker run safely inside it.' },
        { hops: [['s3', 'ws']], plain: `His saved files and the ${f.company} starter files${ds ? ` (“${ds.title}”)` : ''} are copied in.`,
          tech: `Home volume restored from S3; starter repo${ds ? ` and dataset ${ds.id}` : ''} mounted read-only.` },
        { hops: [['ws', 'student']], plain: 'He writes code in VS Code inside his browser. All the heavy work runs on the cloud computer.',
          tech: 'code-server (VS Code in the browser) over a secure WebSocket; terminal and Docker run in the pod.' },
        { hops: [['student', 'app'], ['app', 'grader']], plain: `${first} presses Submit. His code is copied into a fresh grading computer that has no internet, so nobody can cheat.`,
          tech: 'Grader pod on EKS Spot node, network disabled; pytest + hidden tests; result in under 60 s.' },
        { hops: [['grader', 'app'], ['app', 'db'], ['app', 'mentor']], plain: 'Within a minute he sees his score and which checks passed. His mentor’s dashboard updates at the same moment.',
          tech: 'Result saved in PostgreSQL; pushed to his browser and the mentor console; copy-detection fingerprint stored.' },
        { hops: [['ws', 's3']], plain: 'He closes the tab. After a short idle time the cloud computer saves his files and switches itself off, so nothing is billed while he is away.',
          tech: 'Idle timeout stops the pod; workspace volume saved to S3; 12-hour weekly cap enforced per student.' },
      ] },
      { id: 'tutor', label: 'Ask the AI tutor', color: 'violet', steps: [
        { hops: [['student', 'app'], ['app', 'tutor']], plain: `${first} is stuck on an error and clicks Ask the tutor. The lab sends the task, his code and the error along with his question.`,
          tech: 'Request carries the practical ID, his code changes and the last error output; sent to the LiteLLM gateway.' },
        { hops: [], nodes: ['tutor'], plain: 'The tutor gateway checks his monthly AI allowance and removes personal details before anything leaves the lab.',
          tech: 'LiteLLM virtual key per student with a monthly budget; personal-data redaction; rate limits.' },
        { hops: [['tutor', 'bedrock']], plain: 'Most questions go to a small, low-cost AI model. Only hard ones are passed to a stronger model.',
          tech: 'Default model on Amazon Bedrock (gpt-oss-120b or Nova); escalation to Claude Haiku 4.5 when needed.' },
        { hops: [['bedrock', 'tutor'], ['tutor', 'app'], ['app', 'student']], plain: 'He gets a hint, not the answer, plus a link to the exact moment in the lecture that explains it.',
          tech: 'Hint-ladder prompt: nudge, then pointer, then a worked example of a different problem; lecture moment found with pgvector.' },
        { hops: [['app', 'db'], ['app', 'mentor']], plain: 'If he is still stuck after three hints, the question goes to the doubt forum and a mentor follows up.',
          tech: 'Forum thread created automatically with the context attached (Discourse); it appears in the mentor queue.' },
      ] },
      { id: 'exam', label: 'Sit an exam', color: 'amber', steps: [
        { hops: [['student', 'app'], ['app', 'db']], plain: `${first} starts the Month 7 assessment. His browser switches to lockdown mode: full screen, no other tabs.`,
          tech: 'Browser lockdown using full-screen and tab-visibility checks; exam session opened in PostgreSQL.' },
        { hops: [['app', 'student']], plain: 'Each student gets a different mix of questions from a large pool, so sharing answers does not help.',
          tech: 'Per-student shuffle of questions and options from the pool; the timer is kept on the server, not the laptop.' },
        { hops: [['student', 'app'], ['app', 'db']], plain: 'Answers are saved every 20 seconds. If his Wi-Fi drops, he carries on exactly where he left off.',
          tech: 'Autosave every 20 s to FastAPI, buffered in Valkey and written to PostgreSQL; resumes on reconnect.' },
        { hops: [['student', 'app']], plain: 'If he leaves full screen or switches tabs, the lab quietly notes it instead of stopping his exam.',
          tech: 'Integrity events (tab switch, exit full screen, paste) logged with timestamps. No webcam needed.' },
        { hops: [['app', 'grader'], ['grader', 'app'], ['app', 'mentor']], plain: 'When time is up, the lab marks it and his mentor sees the score with a short integrity summary.',
          tech: 'Multiple-choice scored instantly; code questions run in the grader; the API adds servers for exam peaks.' },
      ] },
      { id: 'review', label: 'Mentor reviews a project', color: 'brand', steps: [
        { hops: [['student', 'app'], ['app', 's3']], plain: `${first} submits his Month ${ms.month} milestone for “${capShort}”, his ${cap.slot} capstone at ${f.company}.`,
          tech: 'Submission tagged in git; a snapshot of his repository stored in S3 (versioned).' },
        { hops: [['app', 'grader'], ['grader', 'app']], plain: 'Automatic acceptance tests run first, so the mentor only spends time on work that already runs.',
          tech: 'Milestone tests from the capstone spec run in an isolated grader pod; the report is attached to the submission.' },
        { hops: [['app', 'mentor']], plain: 'The project lands in his mentor’s review queue with the test report attached.',
          tech: 'Mentor console review queue, sorted by due date and at-risk flag.' },
        { hops: [['mentor', 'app'], ['app', 's3']], plain: 'The mentor opens his code and README side by side with the marking rubric.',
          tech: 'Files served from S3 through short-lived links; rubric criteria and weights come from the capstone spec.' },
        { hops: [['mentor', 'app'], ['app', 'db']], plain: `She scores each rubric line, such as “${crit}”, and writes feedback.`,
          tech: 'Weighted rubric score saved in PostgreSQL; feedback versioned with the submission.' },
        { hops: [['app', 'student']], plain: 'He is notified with his score and comments, and can improve the work and resubmit.',
          tech: 'In-app and email notification; a resubmission reopens the same review thread.' },
      ] },
      { id: 'publish', label: 'Publish to portfolio', color: 'green', steps: [
        { hops: [['student', 'app'], ['app', 'db']], plain: `${first} clicks Publish on his approved project.`,
          tech: 'Publishing is allowed only after the mentor approval flag is set in PostgreSQL.' },
        { hops: [['s3', 'app']], plain: 'The lab gathers his final code and README, and checks that no passwords or keys are inside.',
          tech: 'Repository snapshot pulled from S3; secret scan (gitleaks) before anything leaves the lab.' },
        { hops: [['app', 'github']], plain: `It pushes the project to his own GitHub account, github.com/${s.github}, so the work is his to keep.`,
          tech: 'GitHub App with permission limited to his repositories; commits authored as the student.' },
        { hops: [], nodes: ['github'], plain: 'GitHub builds his portfolio website automatically, listing every project and certificate.',
          tech: 'GitHub Actions builds a static portfolio site on GitHub Pages; certificates link to verification pages.' },
        { hops: [['app', 'db'], ['app', 'student']], plain: 'He shares one link with employers. Each certificate has a QR code anyone can scan to check it is real.',
          tech: 'Certificate check page on the lab API verifies a signed certificate ID against PostgreSQL.' },
      ] },
    ];
  }

  // Planning model, calibrated to the PRD estimate: typical month = Rs 2.32 lakh at ~1,000 online (3,000 students).
  // Split: servers 1.48 L (of which ~0.45 L always on), AI 0.69 L, test environment 0.15 L.
  function costModel(online) {
    const s = Math.max(0, Math.min(1, online / MAX_ONLINE));
    const serversBase = 0.45, serversVar = 1.48 - serversBase, ai = 0.69, test = 0.15;
    const servers = serversBase + serversVar * s, aiCost = ai * s;
    return { servers, ai: aiCost, test, total: servers + aiCost + test };
  }
  const computersFor = (online) => { const coders = Math.round(online * CODING_SHARE); return { coders, pcs: Math.ceil(coders / SEATS) }; };

  const CSS = `
.m-flowmap { display: grid; gap: 20px; min-width: 0; --fm-accent: var(--brand); --fm-soft: var(--brand-soft) }
.m-flowmap[data-sc="green"] { --fm-accent: var(--green); --fm-soft: var(--green-soft) }
.m-flowmap[data-sc="violet"] { --fm-accent: var(--violet); --fm-soft: var(--violet-soft) }
.m-flowmap[data-sc="amber"] { --fm-accent: var(--amber); --fm-soft: var(--amber-soft) }
.m-flowmap .fm-intro { display: flex; gap: 16px; justify-content: space-between; align-items: center; flex-wrap: wrap }
.m-flowmap .fm-intro > div { min-width: 0; flex: 1 1 420px }
.m-flowmap .fm-intro h2 { margin-top: 4px }
.m-flowmap .fm-intro p { margin-top: 6px; max-width: 62ch }
.m-flowmap .fm-switch { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 700; font-size: 14px; user-select: none; border: 1px solid var(--line); border-radius: 99px; padding: 6px 12px 6px 6px; background: var(--surface) }
.m-flowmap .fm-switch input { position: absolute; opacity: 0; pointer-events: none }
.m-flowmap .fm-switch .tr { width: 38px; height: 22px; border-radius: 99px; background: var(--surface-2); border: 1px solid var(--line); position: relative; transition: background .2s; flex: none }
.m-flowmap .fm-switch .tr::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--muted); transition: transform .2s, background .2s }
.m-flowmap .fm-switch input:checked + .tr { background: var(--brand-soft); border-color: var(--brand) }
.m-flowmap .fm-switch input:checked + .tr::after { transform: translateX(16px); background: var(--brand) }
.m-flowmap .fm-switch input:focus-visible + .tr { outline: 2px solid var(--brand); outline-offset: 2px }
.m-flowmap .fm-scen { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px }
.m-flowmap .fm-scen .btn[aria-pressed="true"] { border-color: var(--fm-accent); color: var(--fm-accent); background: var(--fm-soft) }
.m-flowmap .fm-scen .sw { width: 9px; height: 9px; border-radius: 50%; flex: none }
.m-flowmap .sw.brand { background: var(--brand) } .m-flowmap .sw.green { background: var(--green) } .m-flowmap .sw.violet { background: var(--violet) } .m-flowmap .sw.amber { background: var(--amber) }
.m-flowmap .fm-stage { position: relative; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-2); overflow: hidden }
.m-flowmap .fm-scroll { overflow-x: auto; overscroll-behavior-x: contain }
.m-flowmap .fm-svg { display: block; width: 100%; min-width: 680px; height: auto }
.m-flowmap .fm-grid-dot { fill: var(--line) }
.m-flowmap .fm-edge { fill: none; stroke: var(--line); stroke-width: 2; transition: stroke .3s, opacity .3s, stroke-width .3s }
.m-flowmap .fm-svg.active .fm-edge { opacity: .3 }
.m-flowmap .fm-svg.active .fm-edge.on { opacity: 1; stroke: var(--fm-accent); stroke-width: 3; stroke-dasharray: 7 7; animation: fm-dash .9s linear infinite }
.m-flowmap .fm-svg.active .fm-edge.on.rev { animation-direction: reverse }
@keyframes fm-dash { to { stroke-dashoffset: -14 } }
.m-flowmap .fm-chev { fill: var(--fm-accent); opacity: 0; transition: opacity .3s }
.m-flowmap .fm-chev.on { opacity: 1 }
.m-flowmap .fm-node { cursor: pointer; transition: opacity .3s; outline: none }
.m-flowmap .fm-node .box { fill: var(--surface); stroke: var(--line); stroke-width: 1.5; transition: stroke .25s, fill .25s }
.m-flowmap .fm-node .ghost { fill: var(--surface); stroke: var(--line); stroke-width: 1.2; transition: opacity .35s, transform .35s }
.m-flowmap .fm-node .t { fill: var(--fg); font-family: var(--display); font-weight: 600; font-size: 15px }
.m-flowmap .fm-node .s { fill: var(--muted); font-family: var(--body); font-weight: 600; font-size: 12px }
.m-flowmap .fm-svg.tech .fm-node .s { font-family: var(--mono); font-weight: 500; font-size: 11px }
.m-flowmap .fm-node .tile { fill: var(--brand-soft) } .m-flowmap .fm-node .ic { stroke: var(--brand); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round }
.m-flowmap .fm-node.k-people .tile, .m-flowmap .fm-node.k-ai .tile { fill: var(--violet-soft) } .m-flowmap .fm-node.k-people .ic, .m-flowmap .fm-node.k-ai .ic { stroke: var(--violet) }
.m-flowmap .fm-node.k-compute .tile { fill: var(--green-soft) } .m-flowmap .fm-node.k-compute .ic { stroke: var(--green) }
.m-flowmap .fm-node.k-data .tile { fill: var(--amber-soft) } .m-flowmap .fm-node.k-data .ic { stroke: var(--amber) }
.m-flowmap .fm-node.k-ext .tile { fill: var(--surface-2) } .m-flowmap .fm-node.k-ext .ic { stroke: var(--fg) }
.m-flowmap .fm-node:hover .box, .m-flowmap .fm-node:focus-visible .box { stroke: var(--brand); stroke-width: 2.5 }
.m-flowmap .fm-node.sel .box { stroke: var(--brand); stroke-width: 2.5; stroke-dasharray: 5 4 }
.m-flowmap .fm-svg.active .fm-node { opacity: .38 }
.m-flowmap .fm-svg.active .fm-node.on { opacity: 1 }
.m-flowmap .fm-svg.active .fm-node.on .box { stroke: var(--fm-accent); stroke-width: 2.5; fill: var(--fm-soft) }
.m-flowmap .fm-node .ring { fill: none; stroke: var(--fm-accent); stroke-width: 2; opacity: 0 }
.m-flowmap .fm-node.hit .ring { animation: fm-ring .7s ease-out }
@keyframes fm-ring { 0% { opacity: .9; transform: scale(1) } 100% { opacity: 0; transform: scale(1.12) } }
.m-flowmap .fm-node .ring, .m-flowmap .fm-node .ghost { transform-box: fill-box; transform-origin: center }
.m-flowmap .fm-badge rect { fill: var(--green) } .m-flowmap .fm-badge text { fill: var(--surface); font-family: var(--body); font-weight: 800; font-size: 11.5px }
.m-flowmap .fm-badge.off rect { fill: var(--faint) }
.m-flowmap .fm-pk .halo { fill: var(--fm-accent); opacity: .22 }
.m-flowmap .fm-pk .core { fill: var(--fm-accent); stroke: var(--surface); stroke-width: 2 }
.m-flowmap .fm-pk { filter: drop-shadow(0 0 6px var(--fm-accent)); transition: opacity .2s }
.m-flowmap .fm-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 10px 14px; border-top: 1px solid var(--line); background: var(--surface) }
.m-flowmap .fm-legend span { display: inline-flex; align-items: center; gap: 6px }
.m-flowmap .fm-legend .fm-swipe { display: none }
.m-flowmap .fm-legend .fm-lg { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid transparent; border-radius: 99px; padding: 2px 8px 2px 6px; margin: -2px -4px; color: inherit; font: inherit; cursor: pointer }
.m-flowmap .fm-legend .fm-lg:hover { border-color: var(--line); color: var(--fg) }
.m-flowmap .fm-legend .fm-lg[aria-pressed="true"] { border-color: var(--brand); color: var(--brand); background: var(--brand-soft) }
.m-flowmap .fm-legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block }
.m-flowmap .lg-people { background: var(--violet-soft); border: 1.5px solid var(--violet) } .m-flowmap .lg-web { background: var(--brand-soft); border: 1.5px solid var(--brand) }
.m-flowmap .lg-compute { background: var(--green-soft); border: 1.5px solid var(--green) } .m-flowmap .lg-data { background: var(--amber-soft); border: 1.5px solid var(--amber) }
.m-flowmap .fm-drawer { position: absolute; top: 12px; right: 12px; bottom: 56px; width: min(340px, calc(100% - 24px)); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; overflow-y: auto; display: grid; gap: 12px; align-content: start; transform: translateX(16px); opacity: 0; pointer-events: none; transition: transform .25s, opacity .25s }
.m-flowmap .fm-drawer.open { transform: none; opacity: 1; pointer-events: auto }
.m-flowmap .fm-drawer h3 { margin-top: 2px }
.m-flowmap .fm-drawer .sec { display: grid; gap: 4px }
.m-flowmap .fm-drawer .sec b { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted) }
.m-flowmap .fm-drawer .sec p { font-size: 14px }
.m-flowmap .fm-drawer .sec.tech p { font-family: var(--mono); font-size: 12.5px; background: var(--surface-2); border-radius: var(--radius-sm); padding: 8px 10px }
.m-flowmap .fm-drawer .sec.save { border-left: 3px solid var(--green); padding-left: 10px }
.m-flowmap .fm-drawer .x { position: absolute; top: 10px; right: 10px }
.m-flowmap .fm-cap { margin-top: 14px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px 18px; align-items: center; border: 1px solid var(--line); border-left: 3px solid var(--fm-accent); border-radius: var(--radius-sm); padding: 14px 16px; background: var(--surface) }
.m-flowmap .fm-cap .txt { min-width: 0; display: grid; gap: 6px }
.m-flowmap .fm-cap .plain { font-size: 16.5px; font-weight: 600; line-height: 1.45; min-height: 2.9em }
.m-flowmap .fm-cap .tech { font-family: var(--mono); font-size: 12.5px; color: var(--muted); background: var(--surface-2); border-radius: 6px; padding: 6px 9px }
.m-flowmap .fm-cap .ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end }
.m-flowmap .fm-dots { display: flex; gap: 5px; flex-wrap: wrap }
.m-flowmap .fm-dots button { width: 22px; height: 6px; border-radius: 99px; border: 0; padding: 0; background: var(--line); cursor: pointer }
.m-flowmap .fm-dots button.done { background: var(--fm-soft) } .m-flowmap .fm-dots button.cur { background: var(--fm-accent) }
.m-flowmap .fm-scale { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 20px }
.m-flowmap .fm-range { width: 100%; accent-color: var(--brand); margin: 10px 0 2px }
.m-flowmap .fm-ticks { display: flex; justify-content: space-between; font-size: 12px; color: var(--faint) }
.m-flowmap .fm-pcs { display: grid; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); gap: 8px; margin-top: 4px }
.m-flowmap .fm-pc { border: 1.5px solid var(--green); background: var(--green-soft); border-radius: 7px; height: 40px; padding: 5px; display: grid; align-content: end; transition: transform .35s, opacity .35s, border-color .35s, background .35s }
.m-flowmap .fm-pc i { display: block; height: 5px; border-radius: 99px; background: var(--green); transition: width .35s }
.m-flowmap .fm-pc.off { transform: scale(.8); opacity: .6; border-color: var(--faint); border-style: dashed; background: transparent }
.m-flowmap .fm-pc.off i { width: 0 !important }
.m-flowmap .fm-total { font-family: var(--display); font-size: 34px; font-weight: 700; line-height: 1.1 }
.m-flowmap .fm-bar { height: 14px; border-radius: 99px; background: var(--surface-2); position: relative; overflow: visible; display: flex }
.m-flowmap .fm-bar > i { display: block; height: 100%; transition: width .35s }
.m-flowmap .fm-bar > i:first-child { border-radius: 99px 0 0 99px }
.m-flowmap .fm-bar .b-srv { background: var(--brand) } .m-flowmap .fm-bar .b-ai { background: var(--violet) } .m-flowmap .fm-bar .b-test { background: var(--faint) }
.m-flowmap .fm-bar .b-srv.warn { background: var(--amber) }
.m-flowmap .fm-bar .mark { position: absolute; top: -5px; bottom: -5px; width: 2px; background: var(--fg); border-radius: 2px }
.m-flowmap .fm-keys { display: flex; flex-wrap: wrap; gap: 4px 14px }
.m-flowmap .fm-keys span { display: inline-flex; align-items: center; gap: 6px }
.m-flowmap .fm-keys i { width: 10px; height: 10px; border-radius: 3px; display: inline-block }
.m-flowmap .fm-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px }
@media (max-width: 1100px) { .m-flowmap .fm-scale { grid-template-columns: minmax(0, 1fr) } }
@media (max-width: 760px) {
  .m-flowmap .fm-drawer { position: relative; top: auto; right: auto; bottom: auto; width: auto; transform: none; display: none; margin: 0 10px 10px; box-shadow: none }
  .m-flowmap .fm-drawer.open { display: grid }
  .m-flowmap .fm-legend .fm-swipe { display: inline-flex }
  .m-flowmap .fm-cap { grid-template-columns: minmax(0, 1fr) }
  .m-flowmap .fm-cap .ctl { justify-content: flex-start }
  .m-flowmap .fm-cap .plain { font-size: 15.5px }
}
@media (max-width: 480px) { .m-flowmap .fm-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) } .m-flowmap .fm-total { font-size: 28px } }
@media (prefers-reduced-motion: reduce) {
  .m-flowmap .fm-svg.active .fm-edge.on { animation: none; stroke-dasharray: none }
  .m-flowmap .fm-node.hit .ring { animation: none }
  .m-flowmap .fm-pk { display: none }
}`;

  function injectCSS() {
    if (document.getElementById('m-flowmap')) return;
    const st = document.createElement('style'); st.id = 'm-flowmap'; st.textContent = CSS; document.head.append(st);
  }

  const lakh = (v) => `₹${v.toFixed(2)} lakh`;
  const svgEl = (tag, attrs) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); return el; };

  NM.register('flowmap', {
    label: 'How the lab works', title: 'How the lab works', icon: 'flow', group: 'How it works', order: 70,

    destroy() { if (cleanup) { cleanup(); cleanup = null; } },

    render(root, c) {
      if (cleanup) { cleanup(); cleanup = null; }
      injectCSS();
      const { h, esc } = c;
      const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
      const SC = scenarios(c);
      const run = { sc: null, step: 0, playing: false, timers: [], raf: 0, selNode: null };
      const offs = [];

      const wrap = h('div', { class: 'm-flowmap' });

      // ---------- Intro ----------
      const techBox = h('input', { type: 'checkbox', 'aria-label': 'Show technical detail' });
      techBox.checked = keep.tech;
      const intro = h('section', { class: 'card fm-intro' },
        h('div', {},
          h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'eyebrow' }, 'How it works'), h('span', { class: 'pill amber' }, 'Demo data · planning estimates')),
          h('h2', {}, 'One website, any laptop.'),
          h('p', { class: 'muted' }, 'Heavy work runs in the cloud and switches off when nobody is using it. Pick a story to watch it happen, or tap any box to see what it does.')),
        h('label', { class: 'fm-switch' }, techBox, h('span', { class: 'tr', 'aria-hidden': 'true' }), h('span', {}, 'Show technical detail')));

      // ---------- Map ----------
      const scenBtns = SC.map((s) => h('button', { class: 'btn sm', 'aria-pressed': 'false', 'data-sc': s.id, onclick: () => startScenario(s.id, true) },
        h('span', { class: 'sw ' + s.color, 'aria-hidden': 'true' }), s.label));
      const scenRow = h('div', { class: 'fm-scen', role: 'group', 'aria-label': 'Stories' }, scenBtns);

      const svg = svgEl('svg', { viewBox: `0 0 ${VB_W} ${VB_H}`, class: 'fm-svg', role: 'img', 'aria-label': 'System map of the Neuromind AI Lab' });
      const gBg = svgEl('g', { 'aria-hidden': 'true' });
      for (let x = 20; x < VB_W; x += 40) for (let y = 20; y < VB_H; y += 40) gBg.append(svgEl('circle', { cx: x, cy: y, r: 1.1, class: 'fm-grid-dot' }));
      const gEdges = svgEl('g', {}), gChev = svgEl('g', { 'aria-hidden': 'true' }), gPk = svgEl('g', { 'aria-hidden': 'true' }), gNodes = svgEl('g', {});
      svg.append(gBg, gEdges, gChev, gPk, gNodes);
      const edgeEls = {}, chevEls = {}, nodeEls = {};
      EDGES.forEach((e) => {
        const p = svgEl('path', { d: e.d, class: 'fm-edge' }); gEdges.append(p); edgeEls[e.id] = p;
        const ch = svgEl('path', { d: 'M-6,-6 L6,0 L-6,6 Z', class: 'fm-chev' }); gChev.append(ch); chevEls[e.id] = ch;
      });
      let wsGhosts = [], wsBadge = null, wsBadgeTxt = null, wsBadgeRect = null;
      NODES.forEach((n) => {
        const x = n.x - BW / 2, y = n.y - BH / 2;
        const g = svgEl('g', { class: `fm-node k-${n.kind}`, tabindex: '0', role: 'button', 'aria-label': `${n.title}: open details`, 'data-id': n.id });
        if (n.id === 'ws') {
          for (let i = 3; i >= 1; i--) { const gr = svgEl('rect', { x: x + i * 6, y: y + i * 6, width: BW, height: BH, rx: 12, class: 'ghost' }); g.append(gr); wsGhosts.unshift(gr); }
        }
        g.append(svgEl('rect', { x: x - 4, y: y - 4, width: BW + 8, height: BH + 8, rx: 14, class: 'ring' }));
        g.append(svgEl('rect', { x, y, width: BW, height: BH, rx: 12, class: 'box' }));
        g.append(svgEl('rect', { x: x + 11, y: y + 18, width: 32, height: 32, rx: 9, class: 'tile' }));
        const ic = svgEl('g', { class: 'ic', transform: `translate(${x + 15},${y + 22}) scale(1)` }); ic.innerHTML = ICON[n.icon]; g.append(ic);
        const t = svgEl('text', { x: x + 52, y: y + 31, class: 't' }); t.textContent = n.title; g.append(t);
        const s = svgEl('text', { x: x + 52, y: y + 50, class: 's' }); s.textContent = n.sub; g.append(s);
        if (n.id === 'ws') {
          wsBadge = svgEl('g', { class: 'fm-badge', transform: `translate(${x + BW - 30},${y - 11})` });
          wsBadgeRect = svgEl('rect', { x: -14, y: 0, width: 58, height: 22, rx: 11 });
          wsBadgeTxt = svgEl('text', { x: 15, y: 15, 'text-anchor': 'middle' });
          wsBadge.append(wsBadgeRect, wsBadgeTxt); g.append(wsBadge);
        }
        g.addEventListener('click', () => openNode(n.id));
        g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openNode(n.id); } });
        gNodes.append(g); nodeEls[n.id] = { g, sub: s, title: t };
      });
      svg.addEventListener('click', (ev) => { if (!ev.target.closest('.fm-node')) closeNode(); });
      const pk = svgEl('g', { class: 'fm-pk', opacity: '0' });
      pk.append(svgEl('circle', { r: 15, class: 'halo' }), svgEl('circle', { r: 7, class: 'core' }));
      gPk.append(pk);

      // Legend chips double as filters: tap one to light up every part of that kind.
      const LEG = [['people', 'People and AI', ['people', 'ai']], ['web', 'Website and video', ['web']], ['compute', 'Cloud computers', ['compute']], ['data', 'Storage', ['data']]];
      const legendBtns = LEG.map(([k, label]) => h('button', { class: 'fm-lg', 'aria-pressed': 'false', 'data-k': k, title: `Highlight: ${label}`, onclick: () => filterKind(k) }, h('i', { class: 'lg-' + k }), label));
      const drawer = h('aside', { class: 'fm-drawer', 'aria-label': 'Details', 'aria-hidden': 'true' });
      const stage = h('div', { class: 'fm-stage' }, h('div', { class: 'fm-scroll' }, svg), drawer,
        h('div', { class: 'fm-legend tiny muted' },
          legendBtns,
          h('span', { class: 'fm-swipe' }, 'Swipe sideways to see the whole map'), h('span', { style: { marginLeft: 'auto' } }, 'Tap a box for details')));

      // Caption panel
      const capCount = h('span', { class: 'eyebrow' }, 'Pick a story');
      const capPlain = h('p', { class: 'plain', 'aria-live': 'polite' }, 'Choose a story above, then press Play. Each step lights up the parts of the lab that are working.');
      const capTech = h('p', { class: 'tech' });
      const dots = h('div', { class: 'fm-dots', role: 'group', 'aria-label': 'Steps' });
      const bBack = h('button', { class: 'btn sm', onclick: () => stepBy(-1), 'aria-label': 'Previous step' }, 'Back');
      const bPlay = h('button', { class: 'btn sm primary', onclick: togglePlay }, 'Play');
      const bNext = h('button', { class: 'btn sm', onclick: () => stepBy(1), 'aria-label': 'Next step' }, 'Next');
      const bMore = h('button', { class: 'btn sm ghost', style: { display: 'none' } });
      const cap = h('div', { class: 'fm-cap' },
        h('div', { class: 'txt' }, h('div', { class: 'row', style: { gap: '10px', justifyContent: 'space-between' } }, capCount, dots), capPlain, capTech),
        h('div', { class: 'ctl' }, bBack, bPlay, bNext, bMore));

      const mapCard = h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'System map'), h('h3', {}, 'Follow one click through the lab')),
          h('span', { class: 'small muted' }, `${c.field.name} · ${c.field.company}`)),
        scenRow, stage, cap);

      // ---------- Scale ----------
      const range = h('input', { type: 'range', min: '0', max: String(MAX_ONLINE), step: '10', class: 'fm-range', 'aria-label': 'Students online right now' });
      range.value = String(keep.online);
      const stOnline = h('b', { class: 'num' }), stCoders = h('b', { class: 'num' }), stPcs = h('b', { class: 'num' });
      const pcSlots = Array.from({ length: Math.ceil(Math.round(MAX_ONLINE * CODING_SHARE) / SEATS) }, () => h('div', { class: 'fm-pc off', title: 'Cloud computer' }, h('i', {})));
      const pcNote = h('p', { class: 'small muted' });
      const totalEl = h('div', { class: 'fm-total num' }), perEl = h('div', { class: 'small muted num' });
      const bSrv = h('i', { class: 'b-srv' }), bAi = h('i', { class: 'b-ai' }), bTest = h('i', { class: 'b-test' });
      const BAR_MAX = 3.0;
      const srvBar = h('div', { class: 'progress' }, h('i', {}));
      const srvTxt = h('div', { class: 'row small', style: { justifyContent: 'space-between' } });
      const scaleCard = h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Scale'), h('h3', {}, 'What happens when more students log in')),
          h('span', { class: 'pill amber' }, 'Planning estimates')),
        h('div', { class: 'fm-scale' },
          h('div', { class: 'stack', style: { minWidth: 0 } },
            h('label', { class: 'small', style: { fontWeight: 700 } }, 'Students online right now', range),
            h('div', { class: 'fm-ticks num' }, h('span', {}, '0'), h('span', {}, '250'), h('span', {}, '500'), h('span', {}, '750'), h('span', {}, '1,000')),
            h('div', { class: 'fm-stats' },
              h('div', { class: 'stat' }, stOnline, h('span', {}, 'students online')),
              h('div', { class: 'stat' }, stCoders, h('span', {}, 'writing code (about 30%)')),
              h('div', { class: 'stat' }, stPcs, h('span', {}, 'cloud computers running'))),
            h('div', { class: 'fm-pcs', 'aria-hidden': 'true' }, pcSlots),
            pcNote),
          h('div', { class: 'stack', style: { minWidth: 0, alignContent: 'start' } },
            h('div', {}, h('div', { class: 'eyebrow' }, 'Monthly bill if every day looks like this'), totalEl, perEl),
            h('div', { class: 'fm-bar', role: 'img', 'aria-label': 'Monthly cost split' }, bSrv, bAi, bTest),
            h('div', { class: 'fm-keys tiny muted' },
              h('span', {}, h('i', { style: { background: 'var(--brand)' } }), 'Servers and video'),
              h('span', {}, h('i', { style: { background: 'var(--violet)' } }), 'AI tutor and models'),
              h('span', {}, h('i', { style: { background: 'var(--faint)' } }), 'Test environment')),
            h('div', { class: 'stack', style: { gap: '6px' } }, srvTxt, srvBar),
            h('p', { class: 'note' }, 'Planning estimates, not quotes. Calibrated to a typical month of ₹2.32 lakh for 3,000 students (about ₹77 per student), with about 1,000 online at the busiest time. Server costs are planned to stay under ₹2 lakh a month. Excludes GST.'))));

      wrap.append(intro, mapCard, scaleCard);
      root.append(wrap);

      // ---------- Behaviour ----------
      function clearTimers() { run.timers.forEach(clearTimeout); run.timers = []; if (run.raf) cancelAnimationFrame(run.raf); run.raf = 0; }
      const later = (fn, ms) => { const t = setTimeout(fn, ms); run.timers.push(t); return t; };

      function fitText() {
        Object.values(nodeEls).forEach(({ sub, title }) => {
          [title, sub].forEach((t) => { t.removeAttribute('textLength'); t.removeAttribute('lengthAdjust');
            try { if (t.getComputedTextLength() > BW - 62) { t.setAttribute('textLength', String(BW - 62)); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } } catch (e) {} });
        });
      }
      function applyTech() {
        keep.tech = techBox.checked;
        svg.classList.toggle('tech', keep.tech);
        NODES.forEach((n) => { nodeEls[n.id].sub.textContent = keep.tech ? n.tag : n.sub; });
        capTech.style.display = keep.tech && run.sc ? '' : 'none';
        fitText();
      }
      techBox.addEventListener('change', applyTech);

      const curSc = () => SC.find((s) => s.id === run.sc);

      function filterKind(k) {
        const on = run.kind === k ? null : k;
        clearTimers(); pk.setAttribute('opacity', '0');
        run.kind = on;
        legendBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === on)));
        if (!on) { if (curSc()) setActive(curSc().steps[run.step]); else { svg.classList.remove('active'); NODES.forEach((n) => nodeEls[n.id].g.classList.remove('on')); } return; }
        run.playing = false; bPlay.textContent = 'Play';
        const kinds = LEG.find((x) => x[0] === on)[2];
        const ids = NODES.filter((n) => kinds.includes(n.kind)).map((n) => n.id);
        svg.classList.add('active');
        NODES.forEach((n) => nodeEls[n.id].g.classList.toggle('on', ids.includes(n.id)));
        EDGES.forEach((e) => { edgeEls[e.id].classList.remove('on'); chevEls[e.id].classList.remove('on'); });
        capCount.textContent = LEG.find((x) => x[0] === on)[1];
        capPlain.textContent = `${ids.length} part${ids.length > 1 ? 's' : ''} of the lab: ${ids.map((id) => NODE[id].title).join(', ')}. Tap one to see what it does, or tap the legend again to clear.`;
        capTech.style.display = 'none';
      }

      function startScenario(id, autoplay) {
        closeNode();
        if (run.kind) { run.kind = null; legendBtns.forEach((b) => b.setAttribute('aria-pressed', 'false')); }
        const s = SC.find((x) => x.id === id); if (!s) return;
        run.sc = id; wrap.dataset.sc = s.color;
        scenBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.sc === id ? 'true' : 'false'));
        dots.textContent = '';
        s.steps.forEach((_, i) => dots.append(h('button', { 'aria-label': `Step ${i + 1}`, onclick: () => { run.playing = false; showStep(i); } })));
        run.playing = !!autoplay;
        showStep(0);
      }

      function setActive(step) {
        const on = new Set(step.nodes || []);
        const dir = {};
        step.hops.forEach(([a, b]) => { on.add(a); on.add(b); const e = findEdge(a, b); if (e) dir[e.id] = e.a === a ? 1 : -1; });
        svg.classList.add('active');
        NODES.forEach((n) => nodeEls[n.id].g.classList.toggle('on', on.has(n.id)));
        EDGES.forEach((e) => {
          const el = edgeEls[e.id], ch = chevEls[e.id];
          const isOn = e.id in dir;
          el.classList.toggle('on', isOn); el.classList.toggle('rev', dir[e.id] === -1);
          ch.classList.toggle('on', isOn);
          if (isOn) {
            const L = el.getTotalLength(), mid = L / 2;
            const p1 = el.getPointAtLength(mid - 2), p2 = el.getPointAtLength(mid + 2);
            let ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI; if (dir[e.id] === -1) ang += 180;
            const pm = el.getPointAtLength(mid);
            ch.setAttribute('transform', `translate(${pm.x.toFixed(1)},${pm.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
          }
        });
      }

      function hit(id) { const g = nodeEls[id] && nodeEls[id].g; if (!g) return; g.classList.remove('hit'); void g.getBBox(); g.classList.add('hit'); }

      function animateHops(hops, done) {
        if (reduce || !hops.length) { hops.forEach(([, b]) => hit(b)); done(); return; }
        let k = 0;
        const next = () => {
          if (k >= hops.length) { pk.setAttribute('opacity', '0'); done(); return; }
          const [a, b] = hops[k]; const e = findEdge(a, b);
          if (!e) { k++; next(); return; }
          const el = edgeEls[e.id], L = el.getTotalLength(), fwd = e.a === a, t0 = performance.now(), dur = 640 + Math.min(260, L * 0.35);
          pk.setAttribute('opacity', '1');
          const frame = (now) => {
            const p = Math.min(1, (now - t0) / dur), ez = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            const pt = el.getPointAtLength((fwd ? ez : 1 - ez) * L);
            pk.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
            if (p < 1) run.raf = requestAnimationFrame(frame);
            else { run.raf = 0; hit(b); k++; later(next, 140); }
          };
          run.raf = requestAnimationFrame(frame);
        };
        next();
      }

      function showStep(i) {
        const s = curSc(); if (!s) return;
        clearTimers();
        run.step = Math.max(0, Math.min(s.steps.length - 1, i));
        const st = s.steps[run.step];
        setActive(st);
        capCount.textContent = `${s.label} · Step ${run.step + 1} of ${s.steps.length}`;
        capPlain.textContent = st.plain;
        capTech.textContent = st.tech;
        capTech.style.display = keep.tech ? '' : 'none';
        [...dots.children].forEach((d, j) => { d.className = j === run.step ? 'cur' : j < run.step ? 'done' : ''; d.setAttribute('aria-current', j === run.step ? 'step' : 'false'); });
        bBack.disabled = run.step === 0;
        bNext.disabled = run.step === s.steps.length - 1;
        bMore.style.display = 'none';
        bPlay.textContent = run.playing ? 'Pause' : (run.step === s.steps.length - 1 ? 'Replay' : 'Play');
        const read = Math.min(7500, 2000 + st.plain.length * 32 + (keep.tech ? 1500 : 0));
        animateHops(st.hops, () => {
          if (!run.playing) return;
          if (run.step < s.steps.length - 1) later(() => showStep(run.step + 1), read);
          else later(finish, read * 0.4);
        });
      }

      function finish() {
        run.playing = false;
        const s = curSc(); if (!s) return;
        bPlay.textContent = 'Replay';
        const idx = SC.indexOf(s), nx = SC[(idx + 1) % SC.length];
        bMore.textContent = `Next story: ${nx.label}`;
        bMore.onclick = () => startScenario(nx.id, true);
        bMore.style.display = '';
      }

      function togglePlay() {
        const s = curSc();
        if (!s) { startScenario(SC[0].id, true); return; }
        if (run.playing) { run.playing = false; clearTimers(); pk.setAttribute('opacity', '0'); bPlay.textContent = 'Play'; return; }
        run.playing = true;
        if (run.step >= s.steps.length - 1) showStep(0); else showStep(run.step + 1);
      }

      function stepBy(d) {
        const s = curSc();
        if (!s) { startScenario(SC[0].id, false); return; }
        run.playing = false; showStep(run.step + d);
      }

      function openNode(id) {
        const n = NODE[id]; if (!n) return;
        run.selNode = id;
        NODES.forEach((x) => nodeEls[x.id].g.classList.toggle('sel', x.id === id));
        const used = SC.filter((s) => s.steps.some((st) => (st.nodes || []).includes(id) || st.hops.some(([a, b]) => a === id || b === id)));
        drawer.textContent = '';
        drawer.append(
          h('button', { class: 'btn sm ghost x', 'aria-label': 'Close details', onclick: closeNode }, 'Close'),
          h('div', {}, h('div', { class: 'eyebrow' }, { people: 'People', web: 'Website and video', compute: 'Cloud computers', ai: 'AI', data: 'Storage', ext: 'Outside the lab' }[n.kind]), h('h3', {}, n.title)),
          h('div', { class: 'sec' }, h('b', {}, 'What it does'), h('p', {}, n.does)),
          h('div', { class: 'sec tech' }, h('b', {}, 'What it runs on'), h('p', {}, n.runs)),
          n.saves ? h('div', { class: 'sec save' }, h('b', {}, 'Why it keeps costs low'), h('p', {}, n.saves)) : null,
          id === 'ws' ? h('p', { class: 'note' }, `Right now in the Scale panel: ${computersFor(keep.online).pcs} cloud computers for ${keep.online.toLocaleString('en-IN')} students online.`) : null,
          used.length ? h('div', { class: 'sec' }, h('b', {}, 'See it in a story'),
            h('div', { class: 'row', style: { gap: '6px' } }, used.map((s) => h('button', { class: 'btn sm', onclick: () => startScenario(s.id, true) }, h('span', { class: 'sw ' + s.color }), s.label)))) : null);
        drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
        if (window.matchMedia && window.matchMedia('(max-width: 760px)').matches) { try { drawer.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) {} }
      }
      function closeNode() {
        if (!run.selNode) return;
        const prev = run.selNode; run.selNode = null;
        NODES.forEach((x) => nodeEls[x.id].g.classList.remove('sel'));
        drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
        try { nodeEls[prev].g.focus({ preventScroll: true }); } catch (e) {}
      }
      const onKey = (ev) => { if (ev.key === 'Escape' && run.selNode && !document.querySelector('.modal-back')) closeNode(); };
      document.addEventListener('keydown', onKey);

      function updateScale() {
        keep.online = +range.value;
        const { coders, pcs } = computersFor(keep.online);
        const cm = costModel(keep.online);
        stOnline.textContent = keep.online.toLocaleString('en-IN');
        stCoders.textContent = coders.toLocaleString('en-IN');
        stPcs.textContent = String(pcs);
        let left = coders;
        pcSlots.forEach((el, i) => {
          const live = i < pcs; const used = live ? Math.min(SEATS, Math.ceil(left / Math.max(1, pcs - i))) : 0; if (live) left -= used;
          el.classList.toggle('off', !live); el.firstChild.style.width = `${(used / SEATS) * 100}%`;
          el.title = live ? `Cloud computer ${i + 1}: ${used} of ${SEATS} students` : 'Switched off';
        });
        pcNote.textContent = pcs === 0
          ? 'Nobody is coding, so no practice computers are running and none are being paid for.'
          : `Each cloud computer is shared by up to ${SEATS} students coding at once. When they log off, the computers shut down within minutes.`;
        totalEl.textContent = lakh(cm.total) + ' / month';
        perEl.textContent = `About ₹${Math.round(cm.total * 1e5 / 3000)} per student per month, for 3,000 enrolled students`;
        bSrv.style.width = `${(cm.servers / BAR_MAX) * 100}%`; bAi.style.width = `${(cm.ai / BAR_MAX) * 100}%`; bTest.style.width = `${(cm.test / BAR_MAX) * 100}%`;
        const pct = cm.servers / 2.0;
        srvTxt.textContent = '';
        srvTxt.append(h('span', {}, 'Servers vs ₹2 lakh budget'), h('span', { class: 'num' }, `${lakh(cm.servers)} · ${Math.round(pct * 100)}%`));
        srvBar.className = 'progress' + (pct < 0.9 ? ' green' : '');
        srvBar.firstChild.style.width = `${Math.min(100, pct * 100)}%`;
        // Map: the workspaces node multiplies or empties with the slider.
        wsGhosts.forEach((g, i) => { const show = pcs > i + 1; g.style.opacity = show ? '1' : '0'; g.style.transform = show ? 'none' : 'translate(-6px,-6px)'; });
        wsBadge.classList.toggle('off', pcs === 0);
        wsBadgeTxt.textContent = pcs === 0 ? 'all off' : `${pcs} on`;
      }
      range.addEventListener('input', updateScale);

      offs.push(() => document.removeEventListener('keydown', onKey));
      cleanup = () => { clearTimers(); offs.forEach((f) => f()); };

      applyTech();
      updateScale();
      bBack.disabled = true;
      // Fonts may load after first paint; re-fit labels once they do.
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (svg.isConnected) fitText(); }).catch(() => {});
    },
  });
})();
