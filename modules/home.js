/* Student home: today's plan, progress, continue where you left off, my lab, deadlines, the year at a glance, leaderboard and doubt forum.
   Every card and row opens the screen it describes. */
(function () {
  // Demo progress that survives navigation (other screens emit these events while home is not on screen).
  const done = { lecture: false, practical: false, exam: false, milestone: false };
  const myDoubts = [];
  let workspace = { status: 'stopped', size: 'Small' };
  NM.on('lecture:completed', () => { done.lecture = true; });
  NM.on('practical:submitted', () => { done.practical = true; });
  NM.on('exam:submitted', () => { done.exam = true; });
  NM.on('milestone:submitted', () => { done.milestone = true; });
  NM.on('forum:asked', (p) => { if (p && p.title) myDoubts.unshift(p.title); });
  NM.on('workspace:state', (p) => { if (p) workspace = Object.assign({}, workspace, p); });

  const CSS = `
.m-home { display: grid; gap: 20px; min-width: 0 }
.m-home .today-top { display: flex; justify-content: space-between; gap: 14px; align-items: start; flex-wrap: wrap }
.m-home .today-top > * { min-width: 0 }
.m-home .today-top h2 { font-size: 22px; margin-top: 4px }
.m-home .today-top p { color: var(--muted); font-size: 14px; margin-top: 4px }
.m-home .day-meter { display: grid; gap: 6px; min-width: 150px }
.m-home .day-meter .small { display: flex; justify-content: space-between; gap: 8px }
.m-home .today-step { position: relative }
.m-home .today-step.is-done .ix { background: var(--green-soft); color: var(--green) }
.m-home .today-step.is-done .tx b { color: var(--muted); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--muted) 50%, transparent) }
.m-home .today-step.is-next { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); background: var(--brand-softer) }
.m-home .today-step .st { flex: none }
.m-home .today-step .arrow { width: 16px; height: 16px; color: var(--faint); flex: none }
.m-home .chip-btn { border: 0; cursor: pointer; font-family: inherit; justify-self: end; max-width: 100% ; overflow: hidden; text-overflow: ellipsis }
.m-home .chip-btn:hover { filter: brightness(.97) }
.m-home .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px }
.m-home .stat-btn { display: grid; gap: 2px; text-align: left; border: 1px solid var(--line); background: var(--surface-2); border-radius: 11px; padding: 12px 14px; cursor: pointer; color: var(--fg); min-width: 0; transition: border-color .15s, background .15s }
.m-home .stat-btn:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); background: var(--brand-softer) }
.m-home .stat-btn b { font-family: var(--display); font-size: 22px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums }
.m-home .stat-btn span { color: var(--muted); font-size: 12.5px }
.m-home .stat-btn small { color: var(--brand); font-size: 11.5px; font-weight: 700 }
.m-home .prog-card { display: grid; gap: 14px; align-content: start }
.m-home .cont-thumb { position: relative; border-radius: 11px; overflow: hidden; aspect-ratio: 16 / 7; background: var(--brand-grad); display: grid; place-items: center; cursor: pointer; border: 0; width: 100%; padding: 0 }
.m-home .cont-thumb::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 80% 20%, color-mix(in srgb, var(--surface) 22%, transparent), transparent 55%) }
.m-home .cont-thumb .pl { width: 48px; height: 48px; border-radius: 50%; background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--brand); display: grid; place-items: center; z-index: 1; box-shadow: var(--shadow); transition: transform .15s }
.m-home .cont-thumb:hover .pl { transform: scale(1.06) }
.m-home .cont-thumb .pl svg { width: 24px; height: 24px }
.m-home .cont-thumb .tm { position: absolute; right: 10px; bottom: 10px; z-index: 1; font: 700 11.5px var(--mono); color: var(--on-brand); background: color-mix(in srgb, var(--code-bg) 55%, transparent); padding: 2px 7px; border-radius: 6px }
.m-home .cont-thumb .lb2 { position: absolute; left: 12px; top: 10px; z-index: 1; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--on-brand); opacity: .9 }
.m-home .lrow { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: none; border: 0; border-top: 1px solid var(--line); padding: 10px 2px; cursor: pointer; color: var(--fg); min-width: 0; border-radius: 0 }
.m-home .lrow:first-child { border-top: 0 }
.m-home .lrow:hover .lt b { color: var(--brand) }
.m-home .lrow .lt { flex: 1; min-width: 0; display: grid }
.m-home .lrow .lt b { font-size: 13.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-home .lrow .lt span { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-home .lrow > svg { width: 16px; height: 16px; color: var(--faint); flex: none }
.m-home .day { width: 42px; height: 42px; border-radius: 10px; background: var(--surface-2); display: grid; place-items: center; align-content: center; line-height: 1.05; flex: none }
.m-home .day b { font-family: var(--display); font-size: 13px }
.m-home .day small { font-size: 10px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em }
.m-home .day.hot { background: var(--amber-soft); color: var(--amber) }
.m-home .day.hot small { color: var(--amber) }
.m-home .meter { display: grid; gap: 6px }
.m-home .meter .row { justify-content: space-between; gap: 8px }
.m-home .progress.amber > i { background: var(--amber) }
.m-home .card-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px }
.m-home .months button { cursor: pointer; height: auto; min-height: 54px; padding: 8px 4px; display: grid; gap: 2px; align-content: center; transition: transform .12s, box-shadow .15s, filter .15s }
.m-home .months button:hover { box-shadow: 0 0 0 2px var(--brand) inset }
.m-home .months button.now:hover { box-shadow: 0 0 0 2px var(--brand-strong) inset; filter: brightness(1.05) }
.m-home .months button b { font-size: 13px; font-family: var(--display) }
.m-home .months button small { font-size: 10.5px; font-weight: 700; opacity: .85 }
.m-home .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted) }
.m-home .legend span { display: inline-flex; gap: 6px; align-items: center }
.m-home .legend i { width: 10px; height: 10px; border-radius: 3px; background: var(--surface-2); display: inline-block }
.m-home .legend i.done { background: var(--green-soft); box-shadow: inset 0 0 0 1px var(--green) } .m-home .legend i.now { background: var(--brand) }
.m-home .lb ol { display: grid }
.m-home .lb li { padding: 0; border-top: 1px solid var(--line); display: block }
.m-home .lb li:first-child { border-top: 0 }
.m-home .lb-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; align-items: center; width: 100%; text-align: left; border: 0; background: none; padding: 9px 6px; cursor: pointer; color: inherit; font: inherit; border-radius: 8px }
.m-home .lb-row:hover { background: var(--surface-2) }
.m-home .lb-row .rk { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: var(--surface-2); color: var(--muted) }
.m-home .lb li:nth-child(1) .rk { background: var(--amber-soft); color: var(--amber) }
.m-home .lb li.me .lb-row { background: var(--brand-softer); color: var(--brand) }
.m-home .lb li.me .rk { background: var(--brand); color: var(--on-brand) }
.m-home .lb-row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-home .forum-item { width: 100%; text-align: left; background: none; border: 0; border-top: 1px solid var(--line); cursor: pointer; color: inherit; font: inherit; padding: 12px 6px; border-radius: 0 }
.m-home .forum-item:first-child { border-top: 0 }
.m-home .forum-item:hover b { color: var(--brand) }
.m-home .forum-item .fs { display: flex; gap: 8px; align-items: center; flex-wrap: wrap }
.m-home-modal .mm-list { display: grid; max-height: 42vh; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0 12px }
.m-home-modal .lrow { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: none; border: 0; border-top: 1px solid var(--line); padding: 10px 0; cursor: pointer; color: var(--fg); min-width: 0 }
.m-home-modal .lrow:first-child { border-top: 0 }
.m-home-modal .lrow:hover .lt b { color: var(--brand) }
.m-home-modal .lrow .lt { flex: 1; min-width: 0; display: grid }
.m-home-modal .lrow .lt b { font-size: 13.5px; font-weight: 700 }
.m-home-modal .lrow .lt span { font-size: 12px; color: var(--muted) }
.m-home-modal .wk { font: 700 11px var(--mono); color: var(--muted); background: var(--surface-2); border-radius: 6px; padding: 3px 6px; flex: none; min-width: 46px; text-align: center }
.m-home-modal .proj { display: grid; gap: 4px; border: 1px solid var(--line); border-left: 3px solid var(--green); border-radius: var(--radius-sm); padding: 10px 12px }
.m-home-modal .proj.cap { border-left-color: var(--violet) }
.m-home-modal .acts { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap }
@media (max-width: 1100px) { .m-home .trio { grid-template-columns: repeat(2, minmax(0, 1fr)) } .m-home .trio > :last-child { grid-column: 1 / -1 } }
@media (max-width: 640px) { .m-home .trio { grid-template-columns: minmax(0, 1fr) } .m-home .trio > :last-child { grid-column: auto } .m-home .today-top h2 { font-size: 19px } .m-home .today-step .st { display: none } .m-home .day-meter { min-width: 0; width: 100% } }
`;

  NM.register('home', {
    label: 'Home', title: "Today's plan", icon: 'home', group: 'Student', order: 10,
    render(root, c) {
      const { h, data, state, icon, field, esc } = c;
      if (!document.getElementById('m-home')) document.head.append(h('style', { id: 'm-home' }, CSS));
      const s = data.demo_student;
      const lec = data.lectures.find((l) => l.id === s.lecture);
      const prev = data.lectures.find((l) => l.id === s.lecture - 1) || lec;
      const nextLec = data.lectures.find((l) => l.id === s.lecture + 1) || lec;
      const P = state.progress;
      const capFor = (m) => (m <= 3 ? data.common.capstone : field.capstones.find((cp) => cp.milestones.some((x) => x.month === m)));
      const curCap = capFor(s.month);
      const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
      const openLecture = (id) => { if (id) state.openLecture = id; c.go('lecture'); };
      const hr = new Date().getHours();
      const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

      // ---------- Today's plan ----------
      const lecDone = done.lecture || P.lecturesWatched >= lec.id;
      const pracDone = done.practical || P.practicalScore != null;
      const examDone = done.exam || P.examScore != null;
      const steps = [
        { go: () => openLecture(prev.id), ic: 'check', t: `Revision quiz: Lecture ${prev.id}`, sub: `${prev.topic} · 4 of 5 correct`, st: 'done' },
        { go: () => openLecture(lec.id), ic: 'play', t: `Watch Lecture ${lec.id}: ${lec.topic}`, sub: '40-minute recorded lesson with 4 quick questions inside the video', st: lecDone ? 'done' : 'next' },
        { go: () => c.go('practical'), ic: 'code', t: `Practical: ${lec.practical}`, sub: `20 minutes on ${field.company} data, checked automatically`, st: pracDone ? 'done' : lecDone ? 'next' : 'today' },
        { go: () => c.go('exam'), ic: 'exam', t: 'Month 7 assessment', sub: 'Timed, in lockdown mode, answers saved as you go', st: examDone ? 'done' : 'due' },
      ];
      // Only the first unfinished step is "up next".
      let seenNext = false;
      steps.forEach((x) => { if (x.st === 'next') { if (seenNext) x.st = 'today'; seenNext = true; } });
      const ST = { done: ['green', 'Done'], next: ['blue', 'Up next'], today: ['violet', 'Today'], due: ['amber', 'Due Friday'] };
      const nDone = steps.filter((x) => x.st === 'done').length;
      const fieldSel = () => { const sel = document.getElementById('fieldSel'); if (sel) { sel.focus(); try { sel.showPicker && sel.showPicker(); } catch (e) {} } };
      const today = h('section', { class: 'card today', 'aria-labelledby': 'homeTodayH' },
        h('div', { class: 'today-top' },
          h('div', {},
            h('div', { class: 'eyebrow' }, `Month ${s.month} · Week ${s.week} · ${data.months[s.month]}`),
            h('h2', { id: 'homeTodayH' }, `${greet}, ${s.name.split(' ')[0]}`),
            h('p', {}, nDone === steps.length ? 'All done for today. Nice work.' : `${steps.length - nDone} things left today. About 1 hour 20 minutes.`)),
          h('div', { class: 'day-meter' },
            h('div', { class: 'small' }, h('span', { class: 'muted' }, 'Today'), h('b', { class: 'num' }, `${nDone} of ${steps.length} done`)),
            h('div', { class: 'progress green' }, h('i', { style: { width: `${(nDone / steps.length) * 100}%` } })),
            h('button', { class: 'pill blue chip-btn', type: 'button', title: 'Change career field', onclick: fieldSel }, field.short))),
        h('div', { class: 'today-steps' }, steps.map((x) => h('button', {
          class: `today-step is-${x.st}`, type: 'button', onclick: x.go,
          html: `<span class="ix">${icon(x.st === 'done' ? 'check' : x.ic)}</span><span class="tx"><b>${esc(x.t)}</b><span>${esc(x.sub)}</span></span><span class="pill ${ST[x.st][0]} st">${ST[x.st][1]}</span>${chev.replace('<svg', '<svg class="arrow"')}`,
        }))));

      // ---------- Progress ----------
      const xpStat = h('b', { class: 'num' }, state.xp.toLocaleString('en-IN'));
      const statBtn = (val, label, hint, route) => h('button', { class: 'stat-btn', type: 'button', onclick: () => c.go(route) }, val, h('span', {}, label), h('small', {}, hint));
      const pct = Math.round((P.lecturesWatched / 104) * 100);
      const prog = h('section', { class: 'card prog-card' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('div', { class: 'eyebrow' }, 'Your progress'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => c.go('achievements') }, 'Badges and certificates')),
        h('div', { class: 'stats' },
          statBtn(h('b', { class: 'num' }, `${P.lecturesWatched}/104`), 'lectures completed', 'Open lectures', 'lecture'),
          statBtn(xpStat, 'XP earned', 'See how XP works', 'achievements'),
          statBtn(h('b', { class: 'num' }, `${s.streak} days`), 'learning streak', 'Streak rewards', 'achievements'),
          statBtn(h('b', { class: 'num' }, `#${s.rank}`), 'in batch leaderboard', 'Full leaderboard', 'achievements')),
        h('div', { class: 'meter' },
          h('div', { class: 'row small' }, h('span', { class: 'muted' }, 'Year progress'), h('b', { class: 'num' }, `${pct}%`)),
          h('div', { class: 'progress green' }, h('i', { style: { width: `${pct}%` } })),
          h('span', { class: 'tiny muted' }, `${P.certificates} certificates earned · batch ${s.batch}`)));
      const offs = [c.on('xp', ({ xp }) => { xpStat.textContent = xp.toLocaleString('en-IN'); })];

      // ---------- Continue / My lab / Deadlines ----------
      const cont = h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Continue where you left off'), h('span', { class: 'pill' }, `Week ${lec.week}`)),
        h('button', { class: 'cont-thumb', type: 'button', 'aria-label': `Resume Lecture ${lec.id} at 18 minutes 42 seconds`, onclick: () => openLecture(lec.id),
          html: `<span class="lb2">Lecture ${lec.id}</span><span class="pl">${icon('play')}</span><span class="tm">18:42 / 40:00</span>` }),
        h('div', {}, h('b', {}, lec.topic), h('div', { class: 'progress', style: { marginTop: '8px' } }, h('i', { style: { width: '47%' } }))),
        h('div', { class: 'card-actions' },
          h('button', { class: 'btn primary sm', type: 'button', onclick: () => openLecture(lec.id), html: icon('play') + 'Resume lecture' }),
          h('button', { class: 'btn sm', type: 'button', onclick: () => c.go('practical'), html: icon('code') + 'Open practical' })));

      const wsPill = h('span', { class: 'pill' });
      const paintWs = () => {
        const run = /run|start|on/i.test(workspace.status || '');
        wsPill.className = 'pill ' + (run ? 'green' : '');
        wsPill.textContent = run ? 'Running' : 'Stopped';
      };
      paintWs();
      offs.push(c.on('workspace:state', (p) => { if (p) workspace = Object.assign({}, workspace, p); paintWs(); }));
      const meter = (label, val, pctv, cls) => h('div', { class: 'meter' },
        h('div', { class: 'row small' }, h('span', { class: 'muted' }, label), h('b', { class: 'num' }, val)),
        h('div', { class: 'progress ' + (cls || '') }, h('i', { style: { width: pctv + '%' } })));
      const lab = h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'My lab'), wsPill),
        h('button', { class: 'lrow', type: 'button', onclick: () => c.go('workspace'),
          html: `<span class="day">${icon('terminal').replace('<svg', '<svg style="width:20px;height:20px;color:var(--brand)"')}</span><span class="lt"><b>Cloud workspace · ${esc(workspace.size || 'Small')} (2 GB)</b><span>VS Code, terminal and Docker in the browser</span></span>${chev}` }),
        meter('Workspace hours this week', '3 h 40 m of 12 h', 31),
        meter('Lab AI key budget this month', '38% used', 38),
        h('p', { class: 'tiny muted' }, 'Your workspace shuts down after 20 idle minutes, so unused time is never lost.'),
        h('div', { class: 'card-actions' },
          h('button', { class: 'btn primary sm', type: 'button', onclick: () => c.go('workspace'), html: icon('cloud') + 'Open workspace' })));

      const capLabel = curCap ? `Capstone ${curCap.slot.slice(1)} milestone: ${curCap.title.split(':')[0]}` : 'Capstone milestone';
      const deadlines = [
        ['Thu', `Practical ${lec.id}: ${lec.practical}`, 'Auto-checked within a minute', 'practical', pracDone],
        ['Fri', 'Month 7 assessment', 'Lockdown exam · 45 minutes', 'exam', examDone],
        ['Sun', capLabel, done.milestone ? 'Submitted · waiting for mentor review' : 'Submit for mentor review', 'projects', done.milestone],
        ['Mon', `Lecture ${nextLec.id} unlocks`, nextLec.topic, 'lecture', false],
      ];
      const dl = h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', {}, 'Coming up'), h('span', { class: 'small muted' }, 'This week')),
        h('div', {}, deadlines.map(([d, t, sub, r, ok], i) => h('button', { class: 'lrow', type: 'button', onclick: () => (r === 'lecture' ? openLecture(nextLec.id) : c.go(r)),
          html: `<span class="day ${i < 2 && !ok ? 'hot' : ''}"><small>${ok ? 'Done' : r === 'lecture' ? 'Opens' : 'Due'}</small><b>${d}</b></span><span class="lt"><b>${esc(t)}</b><span>${esc(ok ? 'Done' : sub)}</span></span>${chev}` }))));

      // ---------- The year at a glance ----------
      const doneMonths = s.month - 1;
      const monthBtn = (m) => {
        const cls = m - 1 < doneMonths ? 'done' : m - 1 === doneMonths ? 'now' : '';
        return h('button', { class: cls, type: 'button', title: `Month ${m}: ${data.months[m]}`, 'aria-label': `Month ${m}: ${data.months[m]}. Open details`, onclick: () => openMonth(m) },
          h('b', {}, `M${m}`), h('small', {}, cls === 'done' ? 'Done' : cls === 'now' ? 'Now' : 'Next'));
      };
      const year = h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } },
          h('div', {}, h('h3', {}, 'The year at a glance'), h('p', { class: 'small muted', style: { marginTop: '2px' } }, '104 lectures · 12 months · 4 capstones. Click any month to see what it covers.')),
          h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'done' }), 'Completed'), h('span', {}, h('i', { class: 'now' }), 'This month'), h('span', {}, h('i', {}), 'Coming up'))),
        h('div', { class: 'months' }, Array.from({ length: 12 }, (_, i) => monthBtn(i + 1))),
        h('p', { class: 'small muted' }, `Months 1 to 3 are common for everyone. From Month 4 every practical and project uses ${field.company}, a fictional ${field.short.toLowerCase()} company.`));

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
            h('button', { class: 'btn primary', type: 'button', onclick: () => { md.close(); openLecture(m === s.month ? lec.id : lecs[0] && lecs[0].id); } }, 'Open Lecture')));
        const md = c.modal(body);
        md.box.style.maxWidth = '620px';
        md.box.setAttribute('aria-label', `Month ${m}: ${data.months[m]}`);
      }

      // ---------- Leaderboard and forum ----------
      const batch = data.students.filter((x) => x.id !== s.id).slice(0, 6).map((x) => ({ name: x.name, xp: x.xp }));
      batch.push({ name: s.name, xp: state.xp, me: true });
      batch.sort((a, b) => b.xp - a.xp);
      const lb = h('section', { class: 'card lb' },
        h('div', { class: 'card-head' }, h('h3', {}, 'Batch leaderboard'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => c.go('achievements') }, 'View all')),
        h('ol', {}, batch.slice(0, 6).map((x, i) => h('li', { class: x.me ? 'me' : '' },
          h('button', { class: 'lb-row', type: 'button', onclick: () => c.go('achievements'), 'aria-label': `Rank ${i + 1}, ${x.name}, ${x.xp} XP. Open achievements` },
            h('span', { class: 'rk num' }, `${i + 1}`), h('span', { class: 'nm' }, x.me ? `${x.name} (you)` : x.name), h('span', { class: 'num small' }, `${x.xp.toLocaleString('en-IN')} XP`))))));

      const posts = myDoubts.map((q) => [q, 'The AI tutor is writing a first answer. A mentor will confirm it.', 'pending', 'Asked by you · just now'])
        .concat([
          ['Why does my Router send everything to the fallback branch?', 'The condition compares text "true" with a true/false value. Change the Code step to return a boolean, then retest the step with the sample data.', 'ok', 'Confirmed by mentor'],
          ['Can I use my own dataset for the Month 9 project?', 'Projects use the lab datasets so the automatic checks can grade them. You can add your own data as an extra, shown in your README.', 'pending', 'Mentor reply pending'],
        ]).slice(0, 3);
      const forum = h('section', { class: 'card' },
        h('div', { class: 'card-head' },
          h('div', {}, h('h3', {}, 'Doubt forum'), h('span', { class: 'small muted' }, 'AI answers first, mentors confirm')),
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => { state.forumCompose = true; c.go('forum'); }, html: icon('forum') + 'Ask a doubt' })),
        h('div', {}, posts.map(([q, a, st, lbl]) => h('button', { class: 'forum-item', type: 'button', onclick: () => c.go('forum') },
          h('b', { class: 'small' }, q),
          h('p', { class: 'small muted' }, h('span', { class: 'ai-badge' }, 'AI'), ' ', a),
          h('span', { class: 'fs' }, h('span', { class: 'pill ' + (st === 'ok' ? 'green' : 'amber') }, st === 'ok' ? 'Confirmed' : 'Pending'), h('span', { class: 'tiny muted' }, lbl))))));

      root.append(h('div', { class: 'm-home' },
        h('div', { class: 'hero-strip' }, today, prog),
        h('div', { class: 'grid-3 trio' }, cont, lab, dl),
        year,
        h('div', { class: 'grid-2' }, lb, forum)));

      this.destroy = () => { offs.forEach((f) => f()); };
    },
  });
})();
