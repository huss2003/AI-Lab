/* Student home: a calm dashboard. One "Today" card with the 4 steps, a small progress card,
   then "Continue where you left off" and "Coming up". The year, My lab, the leaderboard and the doubt forum sit in one tabbed "More" card.
   Every card, row and tab opens the screen it describes. */
(function () {
  // Demo progress that survives navigation (other screens emit these events while home is not on screen).
  const done = { lecture: false, practical: false, exam: false, milestone: false };
  const myDoubts = [];
  let workspace = { status: 'stopped', size: null };
  let moreTab = 'year';        // selected tab in the "More" card
  let showAllComing = false;   // "Coming up" expanded
  NM.on('lecture:completed', () => { done.lecture = true; });
  NM.on('practical:submitted', () => { done.practical = true; });
  NM.on('exam:submitted', () => { done.exam = true; });
  NM.on('milestone:submitted', () => { done.milestone = true; });
  NM.on('forum:asked', (p) => { if (p && p.title) myDoubts.unshift(p.title); });
  NM.on('workspace:state', (p) => { if (p) workspace = Object.assign({}, workspace, p); });

  // Doubt-forum examples per demo student, about what each one is studying right now.
  const FORUM = {
    S1002: [
      ['Why does my Claude call stop with stop_reason "max_tokens"?', 'The reply hit the max_tokens limit, so the JSON is cut off. Raise max_tokens or ask for a shorter answer, and check stop_reason before you parse.', 'ok', 'Confirmed by mentor'],
      ['Can I still change my field after picking Cybersecurity?', 'Yes, until the end of Month 3. After that the field locks in so your next three capstones line up.', 'pending', 'Mentor reply pending'],
    ],
    S1003: [
      ['Why does my container stop right after docker run?', 'The command in your Dockerfile finishes and the container exits. Start the server in the foreground with uvicorn and --host 0.0.0.0.', 'ok', 'Confirmed by mentor'],
      ['Should the database port be published in docker-compose?', 'No. Keep db on the internal network; only web needs a published port. The Month 5 milestone checks this.', 'pending', 'Mentor reply pending'],
    ],
    S1001: [
      ['Why does my Router send everything to the fallback branch?', 'The condition compares text "true" with a true/false value. Change the Code step to return a boolean, then retest the step with the sample data.', 'ok', 'Confirmed by mentor'],
      ['Can I use my own dataset for the Month 9 project?', 'Projects use the lab datasets so the automatic checks can grade them. You can add your own data as an extra, shown in your README.', 'pending', 'Mentor reply pending'],
    ],
    S1004: [
      ['Does an injection hidden in a retrieved document count as a finding?', 'Yes. Log it as an indirect prompt injection with the document, the payload and what the model did. Test only the authorised practice targets.', 'ok', 'Confirmed by mentor'],
      ['Can I present Capstone 4 at Demo Day with a recorded backup video?', 'Yes. Present live, and upload a 3-minute recording in case the network drops.', 'pending', 'Mentor reply pending'],
    ],
  };

  const CSS = `
.m-home { display: grid; gap: var(--section-gap); min-width: 0 }
.m-home > * { min-width: 0 }
.m-home .page-head { display: grid; gap: 14px; min-width: 0 }
.m-home .page-head .screen-intro { margin: 0 }
.m-home .hero-strip { align-items: start }
.m-home .greet { display: grid; gap: 6px; min-width: 0 }
.m-home .greet h1 { font-size: 26px; letter-spacing: -.02em }
.m-home .greet .sub { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; color: var(--muted); font-size: 14.5px }
.m-home .greet .sub .sep { width: 4px; height: 4px; border-radius: 50%; background: var(--line-strong); flex: none }
.m-home .greet .more-link { font-size: 13.5px }

/* Today */
.m-home .today { gap: 18px; align-content: start }
.m-home .today > *, .m-home .today-steps > *, .m-home .hero-strip > * { min-width: 0 }
.m-home .today-head { display: flex; justify-content: space-between; align-items: center; gap: 12px 16px; flex-wrap: wrap }
.m-home .today-head h2 { font-size: 19px }
.m-home .today-head p { color: var(--muted); font-size: 13.5px; margin-top: 2px }
.m-home .day-meter { display: grid; gap: 6px; width: 140px; flex: none }
.m-home .day-meter .small { display: flex; justify-content: space-between; gap: 8px }
.m-home .today-step { gap: 14px; padding: 13px 14px; min-height: 60px }
.m-home .today-step .tx b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14.5px }
.m-home .today-step .tx span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.m-home .today-step.is-done .ix { background: var(--green-soft); color: var(--green) }
.m-home .today-step.is-done .tx b { color: var(--muted) }
.m-home .today-step.is-next { border-color: color-mix(in srgb, var(--brand) 40%, var(--line)); background: var(--brand-softer) }
.m-home .today-step .st { flex: none }
.m-home .today-step .arrow { width: 16px; height: 16px; color: var(--faint); flex: none }

/* Progress */
.m-home .prog-card { display: grid; gap: 16px; align-content: start }
.m-home .prog-card .card-head { margin-bottom: 0; align-items: center }
.m-home .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px }
.m-home .stat-btn { display: grid; gap: 2px; text-align: left; border: 1px solid var(--line); background: var(--surface); border-radius: 11px; padding: 14px 16px; cursor: pointer; color: var(--fg); min-width: 0; transition: border-color .15s, background .15s }
.m-home .stat-btn:hover { border-color: color-mix(in srgb, var(--brand) 40%, var(--line)); background: var(--brand-softer) }
.m-home .stat-btn b { font-family: var(--display); font-size: 23px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.25 }
.m-home .stat-btn span { color: var(--muted); font-size: 13px }
.m-home .meter { display: grid; gap: 6px }
.m-home .meter .row { justify-content: space-between; gap: 8px }
.m-home .progress.amber > i { background: var(--amber) }

/* Continue / Coming up */
.m-home .duo { align-items: start }
.m-home .cont-body { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 18px; align-items: center }
.m-home .cont-thumb { position: relative; border-radius: 11px; overflow: hidden; aspect-ratio: 16 / 10; background: linear-gradient(135deg, var(--brand-soft), color-mix(in srgb, var(--brand) 22%, var(--surface))); display: grid; place-items: center; cursor: pointer; border: 1px solid var(--line); width: 100%; padding: 0 }
.m-home .cont-thumb .pl { width: 44px; height: 44px; border-radius: 50%; background: var(--surface); color: var(--brand); display: grid; place-items: center; box-shadow: var(--shadow); transition: transform .15s }
.m-home .cont-thumb:hover .pl { transform: scale(1.06) }
.m-home .cont-thumb .pl svg { width: 22px; height: 22px }
.m-home .cont-thumb .tm { position: absolute; right: 8px; bottom: 8px; font: 700 11px var(--mono); color: var(--brand-strong); background: color-mix(in srgb, var(--surface) 85%, transparent); padding: 2px 6px; border-radius: 6px }
.m-home .cont-info { display: grid; gap: 10px; min-width: 0 }
.m-home .cont-info .eyebrow { margin-bottom: -4px }
.m-home .cont-info b { font-size: 15px; line-height: 1.4 }
.m-home .card-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center }
.m-home .lrow { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; background: none; border: 0; border-top: 1px solid var(--line); padding: 11px 2px; cursor: pointer; color: var(--fg); min-width: 0; border-radius: 0; font: inherit }
.m-home .lrow:first-child { border-top: 0 }
.m-home .lrow:hover .lt b { color: var(--brand) }
.m-home .lrow .lt { flex: 1; min-width: 0; display: grid; gap: 1px }
.m-home .lrow .lt b { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-home .lrow .lt span { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-home .lrow > svg { width: 16px; height: 16px; color: var(--faint); flex: none }
.m-home .day { width: 44px; height: 44px; border-radius: 10px; background: var(--surface-2); display: grid; place-items: center; align-content: center; line-height: 1.1; flex: none }
.m-home .day b { font-family: var(--display); font-size: 13px }
.m-home .day small { font-size: 10px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em }
.m-home .day.hot { background: var(--amber-soft); color: var(--amber) }
.m-home .day.hot small { color: var(--amber) }
.m-home .day.ok { background: var(--green-soft); color: var(--green) }
.m-home .day.ok small { color: var(--green) }

/* More (tabs) */
.m-home .more-card { display: grid; gap: 18px }
.m-home .more-card .card-head { margin-bottom: 0; align-items: center }
.m-home .more-panel { min-width: 0; display: grid; gap: 16px }
.m-home .months button { cursor: pointer; height: auto; min-height: 50px; padding: 8px 4px; display: grid; gap: 1px; align-content: center; transition: box-shadow .15s }
.m-home .months button:hover { box-shadow: 0 0 0 2px var(--brand) inset }
.m-home .months button.now:hover { box-shadow: 0 0 0 2px var(--brand-strong) inset }
.m-home .months button b { font-size: 13px; font-family: var(--display) }
.m-home .months button small { font-size: 10.5px; font-weight: 600; opacity: .85 }
.m-home .legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted) }
.m-home .legend span { display: inline-flex; gap: 6px; align-items: center }
.m-home .legend i { width: 10px; height: 10px; border-radius: 3px; background: var(--surface-2); display: inline-block; box-shadow: inset 0 0 0 1px var(--line) }
.m-home .legend i.done { background: var(--green-soft); box-shadow: inset 0 0 0 1px var(--green) } .m-home .legend i.now { background: var(--brand); box-shadow: none }
.m-home .lab-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px 28px; align-items: start }
.m-home .lab-grid > * { min-width: 0 }
.m-home .lb ol { display: grid; max-width: 560px }
.m-home .lb li { padding: 0; border-top: 1px solid var(--line); display: block }
.m-home .lb li:first-child { border-top: 0 }
.m-home .lb li.gap { border-top: 1px dashed var(--line-strong) }
.m-home .lb-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 12px; align-items: center; width: 100%; text-align: left; border: 0; background: none; padding: 9px 6px; cursor: pointer; color: inherit; font: inherit; border-radius: 8px }
.m-home .lb-row:hover { background: var(--surface-2) }
.m-home .lb-row .rk { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: var(--surface-2); color: var(--muted) }
.m-home .lb li.me .lb-row { background: var(--brand-softer); color: var(--brand); font-weight: 700 }
.m-home .lb li.me .rk { background: var(--brand); color: var(--on-brand) }
.m-home .lb-row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-home .forum-item { width: 100%; text-align: left; background: none; border: 0; border-top: 1px solid var(--line); cursor: pointer; color: inherit; font: inherit; padding: 12px 2px; border-radius: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 14px; align-items: center }
.m-home .forum-item:first-child { border-top: 0 }
.m-home .forum-item:hover b { color: var(--brand) }
.m-home .forum-item b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-home .forum-item .ans { grid-column: 1; font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-home .forum-item .pill { grid-column: 2; grid-row: 1 / span 2 }

/* Modals */
.m-home-modal .mm-list { display: grid; max-height: 42vh; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0 12px }
.m-home-modal .lrow { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: none; border: 0; border-top: 1px solid var(--line); padding: 10px 0; cursor: pointer; color: var(--fg); min-width: 0; font: inherit }
.m-home-modal .lrow:first-child { border-top: 0 }
.m-home-modal .lrow:hover .lt b { color: var(--brand) }
.m-home-modal .lrow .lt { flex: 1; min-width: 0; display: grid }
.m-home-modal .lrow .lt b { font-size: 13.5px; font-weight: 700 }
.m-home-modal .lrow .lt span { font-size: 12.5px; color: var(--muted) }
.m-home-modal .wk { font: 700 11px var(--mono); color: var(--muted); background: var(--surface-2); border-radius: 6px; padding: 3px 6px; flex: none; min-width: 46px; text-align: center }
.m-home-modal .proj { display: grid; gap: 4px; border: 1px solid var(--line); border-left: 3px solid var(--green); border-radius: var(--radius-sm); padding: 10px 12px }
.m-home-modal .proj.cap { border-left-color: var(--violet) }
.m-home-modal .acts { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap }
.m-home-modal .check { align-items: center }
.m-home-modal .check .ic svg { width: 12px; height: 12px; stroke-width: 3 }

@media (max-width: 1100px) { .m-home .duo { grid-template-columns: minmax(0, 1fr) } .m-home .stats { grid-template-columns: repeat(4, minmax(0, 1fr)) } }
@media (max-width: 760px) { .m-home .stats { grid-template-columns: repeat(2, minmax(0, 1fr)) } .m-home .lab-grid { grid-template-columns: minmax(0, 1fr) } }
@media (max-width: 640px) {
  .m-home .greet h1 { font-size: 22px }
  .m-home .greet .sub { font-size: 13.5px }
  .m-home .today-head .day-meter { width: 100% }
  .m-home .today-step { padding: 11px 12px; gap: 12px }
  .m-home .today-step .ix { width: 30px; height: 30px }
  .m-home .today-step .arrow { display: none }
  .m-home .cont-body { grid-template-columns: minmax(0, 1fr) }
  .m-home .cont-thumb { aspect-ratio: 16 / 7 }
  .m-home .forum-item { grid-template-columns: minmax(0, 1fr) }
  .m-home .forum-item .pill { grid-column: 1; grid-row: auto; justify-self: start }
}
@media (max-width: 420px) { .m-home .today-step .tx span { display: none } .m-home .today-step .tx b { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 14px; line-height: 1.35 } .m-home .stat-btn { padding: 12px } .m-home .stat-btn b { font-size: 20px } }
`;

  NM.register('home', {
    label: 'Home', title: "Today's plan", icon: 'home', group: 'Student', order: 10,
    render(root, c) {
      const { h, data, state, icon, field, esc } = c;
      if (!document.getElementById('m-home')) document.head.append(h('style', { id: 'm-home' }, CSS));
      const s = data.demo_student;
      const lec = data.lectures.find((l) => l.id === s.lecture) || data.lectures[0];
      const nextLec = data.lectures.find((l) => l.id === s.lecture + 1) || lec;
      const P = state.progress;
      const capFor = (m) => (m <= 3 ? data.common.capstone : field.capstones.find((cp) => cp.milestones.some((x) => x.month === m)));
      // Everything below follows the active demo student; the field only supplies company, datasets and practicals.
      const curCap = s.capstone === 'C1' ? data.common.capstone : (field.capstones.find((cp) => cp.slot === s.capstone) || capFor(s.month));
      const capMonth = s.capstone_month || s.month;
      const capNo = curCap ? curCap.slot.slice(1) : String(s.capstone || 'C1').slice(1);
      const capShort = curCap ? curCap.title.split(':')[0] : 'Capstone';
      const commonPrac = s.practical_company === 'common';
      const pracCo = commonPrac ? data.common.company : field.company;
      const nx = s.next_exam || { month: s.month, title: `Month ${s.month} assessment`, due: 'Friday' };
      const ws = s.workspace || { env: 'Cloud workspace', hours_used_min: 0, size: 'Small 2 GB' };
      const budget = s.ai_budget || { used: 0, cap: 120 };
      const first = s.name.split(' ')[0];
      const sField = data.fields.find((f) => f.id === s.field) || field;
      const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
      const openLecture = (id) => { if (id) state.openLecture = id; c.go('lecture'); };
      const hr = new Date().getHours();
      const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
      const offs = [];

      // ---------- Purpose line + greeting ----------
      const intro = h('div', { class: 'screen-intro' },
        h('p', {}, `${first}’s day at a glance. Each step opens the screen where the work happens.`),
        h('span', { class: 'demo-flag' }, 'Demo data'));
      const fieldSel = () => { const sel = document.getElementById('fieldSel'); if (sel) { sel.focus(); try { sel.showPicker && sel.showPicker(); } catch (e) {} } };
      const greetEl = h('div', { class: 'greet' },
        h('h1', {}, `${greet}, ${first}`),
        h('div', { class: 'sub' },
          h('span', {}, `Month ${s.month} · Week ${s.week} · ${data.months[s.month]}`),
          h('span', { class: 'sep', 'aria-hidden': 'true' }),
          h('span', {}, `${s.streak}-day streak`),
          s.month <= 3 ? h('button', { class: 'more-link no-arrow', type: 'button', onclick: openFieldNote }, `Field: ${sField.short} from Month 4`) : null,
          s.consent ? h('button', { class: 'more-link no-arrow', type: 'button', onclick: openConsent }, 'Parent consent on file') : null));

      // ---------- Today ----------
      const lecDone = done.lecture || P.lecturesWatched >= lec.id;
      const pracDone = done.practical || P.practicalScore != null;
      const examDone = done.exam || P.examScore != null;
      const msDone = done.milestone || P.milestoneStatus === 'submitted' || P.milestoneStatus === 'approved';
      const steps = [
        { go: () => openLecture(lec.id), ic: 'play', t: `Watch Lecture ${lec.id}: ${lec.topic}`, sub: '40-minute lesson with quick questions inside the video', st: lecDone ? 'done' : 'next' },
        { go: () => c.go('practical'), ic: 'code', t: `Practical: ${lec.practical}`, sub: `20 minutes on ${pracCo} data, checked automatically`, st: pracDone ? 'done' : lecDone ? 'next' : 'today' },
        { go: () => c.go('exam'), ic: 'exam', t: nx.title, sub: 'Timed, in lockdown mode, answers saved as you go', st: examDone ? 'done' : 'due' },
        { go: () => c.go('projects'), ic: 'project', t: `Capstone ${capNo}: ${capShort}`, sub: `Month ${capMonth} milestone, reviewed by a mentor`, st: msDone ? 'done' : 'week' },
      ];
      let seenNext = false; // only the first unfinished step is "Up next"
      steps.forEach((x) => { if (x.st === 'next') { if (seenNext) x.st = 'today'; seenNext = true; } });
      const ST = { done: ['green', 'Done'], next: ['blue', 'Up next'], today: ['', 'Today'], due: ['amber', `Due ${String(nx.due || 'Friday')}`], week: ['', 'This week'] };
      const nDone = steps.filter((x) => x.st === 'done').length;
      const today = h('section', { class: 'card today', 'aria-labelledby': 'homeTodayH' },
        h('div', { class: 'today-head' },
          h('div', {}, h('h2', { id: 'homeTodayH' }, 'Today'),
            h('p', {}, nDone === steps.length ? 'All done for this week. Nice work.' : `${steps.length - nDone} steps left this week · about 1 h 20 min today`)),
          h('div', { class: 'day-meter' },
            h('div', { class: 'small' }, h('span', { class: 'muted' }, 'Done'), h('b', { class: 'num' }, `${nDone} of ${steps.length}`)),
            h('div', { class: 'progress green' }, h('i', { style: { width: `${(nDone / steps.length) * 100}%` } })))),
        h('div', { class: 'today-steps' }, steps.map((x) => h('button', {
          class: `today-step is-${x.st}`, type: 'button', onclick: x.go, title: x.sub,
          html: `<span class="ix">${icon(x.st === 'done' ? 'check' : x.ic)}</span><span class="tx"><b>${esc(x.t)}</b><span>${esc(x.sub)}</span></span><span class="pill ${ST[x.st][0]} st">${esc(ST[x.st][1])}</span>${chev.replace('<svg', '<svg class="arrow"')}`,
        }))));

      // ---------- Progress (max 4 numbers) ----------
      const xpStat = h('b', { class: 'num' }, Number(state.xp).toLocaleString('en-IN'));
      const statBtn = (val, label, route, aria) => h('button', { class: 'stat-btn', type: 'button', 'aria-label': aria, onclick: () => (route === 'lecture' ? openLecture(lec.id) : c.go(route)) }, val, h('span', {}, label));
      const pct = Math.round((P.lecturesWatched / 104) * 100);
      const nCert = P.certificates || 0;
      const rank = (NM.myRank && NM.myRank()) || s.rank;
      const prog = h('section', { class: 'card prog-card', 'aria-labelledby': 'homeProgH' },
        h('div', { class: 'card-head' }, h('h3', { id: 'homeProgH' }, 'Progress'), h('button', { class: 'more-link', type: 'button', onclick: () => c.go('achievements') }, 'Certificates')),
        h('div', { class: 'stats' },
          statBtn(h('b', { class: 'num' }, `${P.lecturesWatched}/104`), 'lectures done', 'lecture', `${P.lecturesWatched} of 104 lectures done. Open lectures`),
          statBtn(xpStat, 'XP earned', 'achievements', 'XP earned. Open achievements'),
          statBtn(h('b', { class: 'num' }, String(nCert)), nCert === 1 ? 'certificate' : 'certificates', 'achievements', `${nCert} certificates. Open certificates`),
          statBtn(h('b', { class: 'num' }, `#${rank}`), 'batch rank this week', 'achievements', `Rank ${rank} in the batch this week. Open the leaderboard`)),
        h('div', { class: 'meter' },
          h('div', { class: 'row small' }, h('span', { class: 'muted' }, 'Course year'), h('b', { class: 'num' }, `${pct}%`)),
          h('div', { class: 'progress green' }, h('i', { style: { width: `${pct}%` } }))));
      offs.push(c.on('xp', ({ xp }) => { xpStat.textContent = Number(xp).toLocaleString('en-IN'); }));

      // ---------- Continue where you left off ----------
      const cont = h('section', { class: 'card', 'aria-labelledby': 'homeContH' },
        h('div', { class: 'card-head' }, h('h3', { id: 'homeContH' }, 'Continue where you left off')),
        h('div', { class: 'cont-body' },
          h('button', { class: 'cont-thumb', type: 'button', 'aria-label': `Resume Lecture ${lec.id} at 18 minutes 42 seconds`, onclick: () => openLecture(lec.id),
            html: `<span class="pl">${icon('play')}</span><span class="tm">18:42 / 40:00</span>` }),
          h('div', { class: 'cont-info' },
            h('div', { class: 'eyebrow' }, `Lecture ${lec.id} · Week ${lec.week}`),
            h('b', {}, lec.topic),
            h('div', { class: 'progress' }, h('i', { style: { width: '47%' } })),
            h('div', { class: 'card-actions' },
              h('button', { class: 'btn primary sm', type: 'button', onclick: () => openLecture(lec.id), html: icon('play') + 'Resume' }),
              h('button', { class: 'btn sm', type: 'button', onclick: () => c.go('practical'), html: icon('code') + 'Open practical' })))));

      // ---------- Coming up (max 4 rows, rest behind "Show all") ----------
      const capLabel = `Capstone ${capNo}: Month ${capMonth} milestone`;
      const dueDay = String(nx.due || 'Friday').slice(0, 3);
      const deadlines = [
        ['Thu', `Practical ${lec.id}: ${lec.practical}`, `Auto-checked within a minute · ${pracCo}`, 'practical', pracDone],
        [dueDay, nx.title, 'Lockdown exam · 30 minutes', 'exam', examDone],
        ['Sun', capLabel, msDone ? 'Submitted · waiting for mentor review' : `${capShort} · submit for mentor review`, 'projects', msDone],
        ['Mon', `Lecture ${nextLec.id} unlocks`, nextLec.topic, 'lecture', false],
      ];
      if (s.month >= 11) deadlines.splice(3, 0, ['M12', 'Demo Day booking', 'Pick a 10-minute slot to present Capstone 4', 'projects', false]);
      const dlList = h('div', {});
      const dlMore = h('button', { class: 'more-link', type: 'button', onclick: () => { showAllComing = !showAllComing; paintComing(); } });
      function paintComing() {
        dlList.textContent = '';
        const rows = showAllComing ? deadlines : deadlines.slice(0, 4);
        rows.forEach(([d, t, sub, r, ok], i) => dlList.append(h('button', { class: 'lrow', type: 'button', onclick: () => (r === 'lecture' ? openLecture(nextLec.id) : c.go(r)),
          html: `<span class="day ${ok ? 'ok' : i < 2 ? 'hot' : ''}"><small>${ok ? 'Done' : r === 'lecture' || d === 'M12' ? 'Opens' : 'Due'}</small><b>${ok ? '✓' : d}</b></span><span class="lt"><b>${esc(t)}</b><span>${esc(ok ? 'Done' : sub)}</span></span>${chev}` })));
        dlMore.hidden = deadlines.length <= 4;
        dlMore.textContent = showAllComing ? 'Show fewer' : `Show all (${deadlines.length})`;
      }
      paintComing();
      const dl = h('section', { class: 'card', 'aria-labelledby': 'homeDlH' },
        h('div', { class: 'card-head' }, h('h3', { id: 'homeDlH' }, 'Coming up'), h('span', { class: 'small muted' }, 'This week')),
        dlList, h('div', { style: { marginTop: '6px' } }, dlMore));

      // ---------- More: the year, my lab, leaderboard, doubt forum (tabs) ----------
      const TABS = [['year', 'The year'], ['lab', 'My lab'], ['lb', 'Leaderboard'], ['forum', 'Doubt forum']];
      const panel = h('div', { class: 'more-panel', role: 'tabpanel', id: 'homeMorePanel' });
      const tabRow = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'More for ' + first });
      function paintTabs() {
        tabRow.textContent = '';
        TABS.forEach(([k, t]) => tabRow.append(h('button', { class: 'tab', role: 'tab', type: 'button', id: 'homeTab-' + k, 'aria-controls': 'homeMorePanel', 'aria-selected': String(moreTab === k), 'data-tab': k,
          onclick: () => { moreTab = k; paintTabs(); paintPanel(); },
          onkeydown: (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const i = TABS.findIndex((x) => x[0] === moreTab); const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length][0];
            moreTab = n; paintTabs(); paintPanel(); const b = tabRow.querySelector(`[data-tab="${n}"]`); if (b) b.focus();
          } }, t)));
        panel.setAttribute('aria-labelledby', 'homeTab-' + moreTab);
      }
      function paintPanel() {
        panel.textContent = '';
        panel.append(...({ year: yearPanel, lab: labPanel, lb: lbPanel, forum: forumPanel }[moreTab] || yearPanel)());
      }
      const more = h('section', { class: 'card more-card', 'aria-labelledby': 'homeMoreH' },
        h('div', { class: 'card-head' }, h('h3', { id: 'homeMoreH' }, 'More')), tabRow, panel);

      // The year at a glance
      const doneMonths = s.month - 1;
      function yearPanel() {
        const monthBtn = (m) => {
          const cls = m - 1 < doneMonths ? 'done' : m - 1 === doneMonths ? 'now' : '';
          return h('button', { class: cls, type: 'button', title: `Month ${m}: ${data.months[m]}`, 'aria-label': `Month ${m}: ${data.months[m]}. Open details`, onclick: () => openMonth(m) },
            h('b', {}, `M${m}`), h('small', {}, cls === 'done' ? 'Done' : cls === 'now' ? 'Now' : 'Next'));
        };
        return [
          h('p', { class: 'small muted' }, s.month <= 3
            ? `12 months, 104 lectures, 4 capstones. Months 1 to 3 are common and use ${data.common.company}. Click a month to see what it covers.`
            : `12 months, 104 lectures, 4 capstones. From Month 4 the work uses ${field.company}. Click a month to see what it covers.`),
          h('div', { class: 'months' }, Array.from({ length: 12 }, (_, i) => monthBtn(i + 1))),
          h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'done' }), `Completed (${doneMonths})`), h('span', {}, h('i', { class: 'now' }), 'This month'), h('span', {}, h('i', {}), 'Coming up')),
        ];
      }
      function openMonth(m) {
        const lecs = data.lectures.filter((l) => l.month === m);
        const status = m - 1 < doneMonths ? ['green', 'Completed'] : m - 1 === doneMonths ? ['blue', 'This month'] : ['', 'Coming up'];
        const proj = m >= 4 && (field.standalone || []).find((x) => x.month === m);
        const cap = capFor(m);
        const msIx = cap ? cap.milestones.findIndex((x) => x.month === m) : -1;
        const body = h('div', { class: 'm-home-modal stack' },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'eyebrow' }, `Month ${m} of 12`), h('span', { class: 'pill ' + status[0] }, status[1])),
          h('h2', {}, data.months[m]),
          h('p', { class: 'small muted' }, m <= 3 ? 'Common for every student, before choosing a career field.' : `${field.name} track · practicals use ${field.company} data.`),
          h('div', { class: 'eyebrow' }, `${lecs.length} lectures`),
          h('div', { class: 'mm-list' }, lecs.map((l) => {
            const st = l.id <= P.lecturesWatched ? 'Watched' : l.id === s.lecture ? 'Up next' : l.id < s.lecture ? 'Open' : 'Locked';
            return h('button', { class: 'lrow', type: 'button', onclick: () => { md.close(); openLecture(l.id); },
              html: `<span class="wk">Wk ${l.week}</span><span class="lt"><b>Lecture ${l.id}: ${esc(l.topic)}</b><span>Practical: ${esc(l.practical)}</span></span><span class="pill ${st === 'Watched' ? 'green' : st === 'Up next' ? 'blue' : ''}">${st}</span>` });
          })),
          proj ? h('div', { class: 'proj' }, h('span', { class: 'eyebrow' }, 'Monthly project'), h('b', {}, proj.title)) : null,
          cap && msIx >= 0 ? h('div', { class: 'proj cap' }, h('span', { class: 'eyebrow' }, `Capstone ${cap.slot.slice(1)} · milestone ${msIx + 1} of ${cap.milestones.length}`), h('b', {}, cap.title)) : null,
          h('div', { class: 'acts' },
            h('button', { class: 'btn', type: 'button', onclick: () => md.close() }, 'Close'),
            cap ? h('button', { class: 'btn', type: 'button', onclick: () => { md.close(); c.go('projects'); } }, 'Open projects') : null,
            h('button', { class: 'btn primary', type: 'button', onclick: () => { md.close(); openLecture(m === s.month ? lec.id : lecs[0] && lecs[0].id); } }, 'Open lecture')));
        const md = c.modal(body);
        md.box.style.maxWidth = '620px';
        md.box.setAttribute('aria-label', `Month ${m}: ${data.months[m]}`);
      }

      // My lab
      const browserOnly = /browser/i.test(ws.size || '') && !/cloud/i.test(ws.env || '');
      const wsPill = h('span', { class: 'pill' });
      const paintWs = () => {
        const run = /run|start|on/i.test(workspace.status || '');
        wsPill.className = 'pill ' + (run ? 'green' : browserOnly ? 'blue' : '');
        wsPill.textContent = run ? 'Running' : browserOnly ? 'In the browser' : 'Stopped';
      };
      paintWs();
      offs.push(c.on('workspace:state', (p) => { if (p) workspace = Object.assign({}, workspace, p); paintWs(); }));
      const meter = (label, val, pctv, cls) => h('div', { class: 'meter' },
        h('div', { class: 'row small' }, h('span', { class: 'muted' }, label), h('b', { class: 'num' }, val)),
        h('div', { class: 'progress ' + (cls || '') }, h('i', { style: { width: pctv + '%' } })));
      const hm = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} m`;
      function labPanel() {
        const usedMin = Math.max(0, Math.round(ws.hours_used_min || 0));
        const sizeLabel = workspace.size && !browserOnly ? (/large/i.test(workspace.size) ? 'Large 6 GB' : 'Small 2 GB') : ws.size;
        const bPct = budget.cap ? Math.round((budget.used / budget.cap) * 100) : 0;
        return [h('div', { class: 'lab-grid' },
          h('div', { class: 'stack' },
            h('button', { class: 'lrow', type: 'button', onclick: () => c.go('workspace'),
              html: `<span class="day">${icon(browserOnly ? 'code' : 'terminal').replace('<svg', '<svg style="width:20px;height:20px;color:var(--brand)"')}</span><span class="lt"><b>${esc(ws.env)}</b><span>${esc(sizeLabel)}${browserOnly ? '' : ' · VS Code, terminal and Docker'}</span></span>` }, wsPill),
            h('p', { class: 'small muted' }, browserOnly
              ? 'Months 1 to 3 run Python in the browser. A cloud workspace with VS Code and Docker opens in Month 4.'
              : bPct >= 75 ? 'AI budget is above 75%. Hints keep working; harder questions slow down near the cap.' : 'The workspace shuts down after 20 idle minutes, so unused time is never lost.'),
            h('div', { class: 'card-actions' },
              h('button', { class: 'btn primary sm', type: 'button', onclick: () => c.go(browserOnly ? 'practical' : 'workspace'), html: icon(browserOnly ? 'code' : 'cloud') + (browserOnly ? 'Open browser Python' : 'Open workspace') }),
              browserOnly ? h('button', { class: 'more-link', type: 'button', onclick: () => c.go('workspace') }, 'See the Month 4 workspace') : null)),
          h('div', { class: 'stack', style: { gap: '18px' } },
            meter(browserOnly ? 'Coding time this week' : 'Workspace hours this week', `${hm(usedMin)} of 12 h`, Math.min(100, Math.round((usedMin / 720) * 100))),
            meter('Lab AI key budget this month', `₹${budget.used} of ₹${budget.cap}`, Math.min(100, bPct), bPct >= 75 ? 'amber' : '')))];
      }

      // Leaderboard
      const batch = data.students.filter((x) => x.id !== s.id).map((x) => ({ name: x.name, xp: x.xp }));
      batch.push({ name: s.name, xp: state.xp, me: true });
      batch.sort((a, b) => b.xp - a.xp);
      batch.forEach((x, i) => { x.rank = i + 1; });
      function lbPanel() {
        const meRow = batch.find((x) => x.me);
        const shown = meRow.rank <= 5 ? batch.slice(0, 5) : batch.slice(0, 4).concat([meRow]);
        return [
          h('p', { class: 'small muted' }, `All-time XP · ${batch.length} students in ${s.batch}`),
          h('div', { class: 'lb' }, h('ol', {}, shown.map((x, i) => h('li', { class: (x.me ? 'me' : '') + (i > 0 && x.rank - shown[i - 1].rank > 1 ? ' gap' : '') },
            h('button', { class: 'lb-row', type: 'button', onclick: () => c.go('achievements'), 'aria-label': `Rank ${x.rank}, ${x.name}, ${x.xp} XP. Open the leaderboard` },
              h('span', { class: 'rk num' }, `${x.rank}`), h('span', { class: 'nm' }, x.me ? `${x.name} (you)` : x.name), h('span', { class: 'num small' }, `${Number(x.xp).toLocaleString('en-IN')} XP`)))))),
          h('div', {}, h('button', { class: 'more-link', type: 'button', onclick: () => c.go('achievements') }, `Full leaderboard (${batch.length})`)),
        ];
      }

      // Doubt forum
      function forumPanel() {
        const posts = myDoubts.map((q) => [q, 'The AI tutor is writing a first answer. A mentor will confirm it.', 'pending', 'Asked by you'])
          .concat(FORUM[s.id] || FORUM.S1001).slice(0, 3);
        return [
          h('p', { class: 'small muted' }, 'The AI answers first and a mentor confirms.'),
          h('div', {}, posts.map(([q, a, st]) => h('button', { class: 'forum-item', type: 'button', onclick: () => c.go('forum'), title: a },
            h('b', {}, q), h('span', { class: 'ans' }, 'AI: ' + a),
            h('span', { class: 'pill ' + (st === 'ok' ? 'green' : 'amber') }, st === 'ok' ? 'Confirmed' : 'Pending')))),
          h('div', { class: 'card-actions' },
            h('button', { class: 'btn sm primary', type: 'button', onclick: () => { state.forumCompose = true; c.go('forum'); }, html: icon('forum') + 'Ask a doubt' }),
            h('button', { class: 'more-link', type: 'button', onclick: () => c.go('forum') }, 'Open the forum')),
        ];
      }
      paintTabs(); paintPanel();

      // ---------- Notes: field choice (foundation months) and parent consent (under 18) ----------
      function openFieldNote() {
        const caps = (sField.capstones || []).map((cp) => h('div', { class: 'proj cap' }, h('span', { class: 'eyebrow' }, `Capstone ${cp.slot.slice(1)} · Months ${cp.milestones.map((x) => x.month).join(', ')}`), h('b', {}, cp.title)));
        const md = c.modal(h('div', { class: 'm-home-modal stack' },
          h('div', { class: 'eyebrow' }, 'Career field'),
          h('h2', {}, `${sField.name}, from Month 4`),
          h('p', { class: 'small muted' }, `${first} picked ${sField.name}. Months 1 to 3 are the same for every student, so the choice can change until the end of Month 3. Then it locks in, so the next three capstones line up with ${sField.company}, a fictional company.`),
          h('div', { class: 'stack', style: { gap: '8px' } }, caps),
          h('div', { class: 'acts' },
            h('button', { class: 'btn', type: 'button', onclick: () => md.close() }, 'Close'),
            h('button', { class: 'btn primary', type: 'button', onclick: () => { md.close(); fieldSel(); } }, 'Preview another field'))));
        md.box.style.maxWidth = '560px'; md.box.setAttribute('aria-label', 'Career field choice');
      }
      function openConsent() {
        const k = s.consent; if (!k) return;
        const row = (a, b) => h('div', { class: 'check pass' }, h('span', { class: 'ic', html: icon('check') }), h('span', {}, h('b', { class: 'small' }, a), ' ', h('span', { class: 'small muted' }, b)));
        const md = c.modal(h('div', { class: 'm-home-modal stack' },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'eyebrow' }, 'Under 18 · DPDP Act, 2023'), h('span', { class: 'pill green' }, 'On file')),
          h('h2', {}, 'Parent consent'),
          h('p', { class: 'small muted' }, `${first} is ${s.age}, so a parent confirmed with their own phone before ${first} could use the lab.`),
          h('div', { class: 'stack', style: { gap: '6px' } },
            row('Given by', `${k.parent} (${k.relation})`),
            row('Recorded', k.recorded),
            row('Reference', k.ref),
            row('Covers', 'Course data, lockdown exams and AI tutor questions')),
          h('p', { class: 'tiny muted' }, 'The parent can withdraw consent at any time. Demo data.'),
          h('div', { class: 'acts' }, h('button', { class: 'btn primary', type: 'button', onclick: () => md.close() }, 'Close'))));
        md.box.style.maxWidth = '520px'; md.box.setAttribute('aria-label', 'Parent consent');
      }

      root.append(h('div', { class: 'm-home' },
        h('div', { class: 'page-head' }, intro, greetEl),
        h('div', { class: 'hero-strip' }, today, prog),
        h('div', { class: 'grid-2 duo' }, cont, dl),
        more));

      this.destroy = () => { offs.forEach((f) => f()); };
    },
  });
})();
