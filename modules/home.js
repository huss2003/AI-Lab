/* Student home: today's plan, progress, continue where you left off, my lab, deadlines, the year at a glance, leaderboard and doubt forum.
   Every card and row opens the screen it describes. */
(function () {
  // Demo progress that survives navigation (other screens emit these events while home is not on screen).
  const done = { lecture: false, practical: false, exam: false, milestone: false };
  const myDoubts = [];
  let workspace = { status: 'stopped', size: null };
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
.m-home .lb li.gap { border-top: 1px dashed var(--line-strong); margin-top: 4px }
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

.m-home .who-line { display: flex; gap: 8px; align-items: center; margin-top: 8px; min-width: 0 }
.m-home .who-line .avatar { width: 24px; height: 24px; font-size: 10.5px; border-radius: 7px }
.m-home .who-line .small { min-width: 0 }
.m-home .today > *, .m-home .prog-card > * { min-width: 0 }
.m-home .today .eyebrow { overflow-wrap: anywhere }
.m-home .note-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-top: 12px }
.m-home .note-chip { display: flex; gap: 10px; align-items: center; text-align: left; border: 1px dashed color-mix(in srgb, var(--violet) 45%, var(--line)); background: var(--violet-soft); color: var(--fg); border-radius: 11px; padding: 10px 12px; cursor: pointer; font: inherit; min-width: 0 }
.m-home .note-chip.ok { border-color: color-mix(in srgb, var(--green) 45%, var(--line)); background: var(--green-soft) }
.m-home .note-chip svg { width: 18px; height: 18px; color: var(--violet); flex: none }
.m-home .note-chip.ok svg { color: var(--green) }
.m-home .note-chip span { display: grid; min-width: 0 }
.m-home .note-chip b { font-size: 13px }
.m-home .note-chip small { font-size: 12px; color: var(--muted) }
.m-home .note-chip:hover { filter: brightness(.98); border-style: solid }
.m-home .cert-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; text-align: left; background: none; border: 0; padding: 0; cursor: pointer; color: var(--fg); font: inherit; font-size: 13px }
.m-home .cert-line svg { width: 17px; height: 17px; color: var(--brand); flex: none }
.m-home .cert-line:hover b { color: var(--brand) }
.m-home .cert-line .tiny { margin-left: auto }
.m-home-modal .check { align-items: center }
.m-home-modal .check .ic svg { width: 12px; height: 12px; stroke-width: 3 }
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
      const nextLec = data.lectures.find((l) => l.id === s.lecture + 1) || lec;
      const P = state.progress;
      const capFor = (m) => (m <= 3 ? data.common.capstone : field.capstones.find((cp) => cp.milestones.some((x) => x.month === m)));
      // Everything below follows the active demo student; the field only supplies company, datasets and practicals.
      const curCap = s.capstone === 'C1' ? data.common.capstone : (field.capstones.find((cp) => cp.slot === s.capstone) || capFor(s.month));
      const capMonth = s.capstone_month || s.month;
      const capMsIx = curCap ? Math.max(0, curCap.milestones.findIndex((x) => x.month === capMonth)) : 0;
      const capMs = curCap ? curCap.milestones[capMsIx] : null;
      const capNo = curCap ? curCap.slot.slice(1) : String(s.capstone || 'C1').slice(1);
      const capShort = curCap ? curCap.title.split(':')[0] : 'Capstone';
      const commonPrac = s.practical_company === 'common';
      const pracCo = commonPrac ? data.common.company : field.company;
      const nx = s.next_exam || { month: s.month, title: `Month ${s.month} assessment`, due: 'Friday' };
      const ws = s.workspace || { env: 'Cloud workspace', hours_used_min: 0, size: 'Small 2 GB' };
      const budget = s.ai_budget || { used: 0, cap: 120 };
      const first = s.name.split(' ')[0];
      const clip = (t, n) => { t = String(t || '').replace(/\s*\([^)]*\)/g, '').trim(); return t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n - 1) > 20 ? t.lastIndexOf(' ', n - 1) : n - 1) + '…'; };
      const sField = data.fields.find((f) => f.id === s.field) || field;
      const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
      const openLecture = (id) => { if (id) state.openLecture = id; c.go('lecture'); };
      const hr = new Date().getHours();
      const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

      // ---------- Today's plan ----------
      const lecDone = done.lecture || P.lecturesWatched >= lec.id;
      const pracDone = done.practical || P.practicalScore != null;
      const examDone = done.exam || P.examScore != null;
      const msDone = done.milestone || P.milestoneStatus === 'submitted' || P.milestoneStatus === 'approved';
      const steps = [
        { go: () => openLecture(lec.id), ic: 'play', t: `Watch Lecture ${lec.id}: ${lec.topic}`, sub: '40-minute recorded lesson with 4 quick questions inside the video', st: lecDone ? 'done' : 'next' },
        { go: () => c.go('practical'), ic: 'code', t: `Practical: ${lec.practical}`, sub: `20 minutes on ${pracCo} data${commonPrac ? ', in Python in the browser' : ''}, checked automatically`, st: pracDone ? 'done' : lecDone ? 'next' : 'today' },
        { go: () => c.go('exam'), ic: 'exam', t: nx.title, sub: 'Timed, in lockdown mode, answers saved as you go', st: examDone ? 'done' : 'due', due: nx.due },
        { go: () => c.go('projects'), ic: 'project', t: `Capstone ${capNo}: ${capShort}`, sub: `Month ${capMonth} milestone${capMs && capMs.deliverables ? ' · ' + clip(capMs.deliverables[0], 78) : ''}`, st: msDone ? 'done' : 'week' },
      ];
      // Only the first unfinished step is "up next".
      let seenNext = false;
      steps.forEach((x) => { if (x.st === 'next') { if (seenNext) x.st = 'today'; seenNext = true; } });
      const ST = { done: ['green', 'Done'], next: ['blue', 'Up next'], today: ['violet', 'Today'], due: ['amber', `Due ${nx.due || 'Friday'}`], week: ['violet', 'This week'] };
      const nDone = steps.filter((x) => x.st === 'done').length;
      const profileLine = h('div', { class: 'who-line' },
        h('span', { class: 'avatar' }, s.initials || s.name.split(' ').map((w) => w[0]).join('')),
        h('span', { class: 'small muted' }, `${s.name} · ${s.age} · ${s.education} · Batch ${s.batch}`));
      const fieldSel = () => { const sel = document.getElementById('fieldSel'); if (sel) { sel.focus(); try { sel.showPicker && sel.showPicker(); } catch (e) {} } };
      const today = h('section', { class: 'card today', 'aria-labelledby': 'homeTodayH' },
        h('div', { class: 'today-top' },
          h('div', {},
            h('div', { class: 'eyebrow' }, `Month ${s.month} · Week ${s.week} · ${data.months[s.month]}`),
            h('h2', { id: 'homeTodayH' }, `${greet}, ${first}`),
            h('p', {}, nDone === steps.length ? 'All done for today. Nice work.' : `${steps.length - nDone} things left this week. About 1 hour 20 minutes today.`),
            profileLine),
          h('div', { class: 'day-meter' },
            h('div', { class: 'small' }, h('span', { class: 'muted' }, 'Today'), h('b', { class: 'num' }, `${nDone} of ${steps.length} done`)),
            h('div', { class: 'progress green' }, h('i', { style: { width: `${(nDone / steps.length) * 100}%` } })),
            h('button', { class: 'pill blue chip-btn', type: 'button', title: 'Change career field', onclick: fieldSel }, field.short))),
        h('div', { class: 'today-steps' }, steps.map((x) => h('button', {
          class: `today-step is-${x.st}`, type: 'button', onclick: x.go,
          html: `<span class="ix">${icon(x.st === 'done' ? 'check' : x.ic)}</span><span class="tx"><b>${esc(x.t)}</b><span>${esc(x.sub)}</span></span><span class="pill ${ST[x.st][0]} st">${ST[x.st][1]}</span>${chev.replace('<svg', '<svg class="arrow"')}`,
        }))),
        notes());

      // Foundation months: the field is chosen but locks in after Month 3. Under 18: consent on file.
      function notes() {
        const items = [];
        if (s.month <= 3) items.push(h('button', { class: 'note-chip', type: 'button', onclick: openFieldNote,
          html: `${icon('project')}<span><b>Field choice: ${esc(sField.name)}</b><small>Locks in after Month 3 · opens in Month 4 with ${esc(sField.company)}</small></span>` }));
        if (s.consent) items.push(h('button', { class: 'note-chip ok', type: 'button', onclick: openConsent,
          html: `${icon('shield')}<span><b>Parent consent on file</b><small>${esc(s.consent.parent)} (${esc(s.consent.relation)}) · ${esc(s.consent.ref)}</small></span>` }));
        return items.length ? h('div', { class: 'note-row' }, items) : null;
      }
      function openFieldNote() {
        const caps = (sField.capstones || []).map((cp) => h('div', { class: 'proj cap' }, h('span', { class: 'eyebrow' }, `Capstone ${cp.slot.slice(1)} · Months ${cp.milestones.map((x) => x.month).join(', ')}`), h('b', {}, cp.title)));
        const md = c.modal(h('div', { class: 'm-home-modal stack' },
          h('div', { class: 'eyebrow' }, 'Career field'),
          h('h2', {}, `${sField.name}, from Month 4`),
          h('p', { class: 'small muted' }, `${first} picked ${sField.name}. Months 1 to 3 are the same for every student, so the choice can still change until the end of Month 3. After that it locks in, so the next three capstones line up with ${sField.company}, a fictional company.`),
          h('div', { class: 'stack', style: { gap: '8px' } }, caps),
          h('div', { class: 'acts' },
            h('button', { class: 'btn', type: 'button', onclick: () => md.close() }, 'Close'),
            h('button', { class: 'btn primary', type: 'button', onclick: () => { md.close(); fieldSel(); } }, 'Preview another field'))));
        md.box.style.maxWidth = '560px'; md.box.setAttribute('aria-label', 'Career field choice');
      }
      function openConsent() {
        const k = s.consent;
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
          statBtn(h('b', { class: 'num' }, `#${(NM.myRank && NM.myRank()) || s.rank}`), 'in the batch this week', 'Full leaderboard', 'achievements')),
        h('div', { class: 'meter' },
          h('div', { class: 'row small' }, h('span', { class: 'muted' }, 'Year progress'), h('b', { class: 'num' }, `${pct}%`)),
          h('div', { class: 'progress green' }, h('i', { style: { width: `${pct}%` } })),
          h('button', { class: 'cert-line', type: 'button', onclick: () => c.go('achievements'),
            html: `${icon('cert')}<span>${P.certificates ? `<b>${P.certificates} certificate${P.certificates > 1 ? 's' : ''}</b> earned` : '<b>No certificates yet</b> · the first comes after Month 3'}</span><span class="tiny muted">Quiz avg ${s.quiz_avg}% · attendance ${s.attendance}%</span>` })));
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
      const browserOnly = /browser/i.test(ws.size || '') && !/cloud/i.test(ws.env || '');
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
      const usedMin = Math.max(0, Math.round(ws.hours_used_min || 0));
      const sizeLabel = workspace.size && !browserOnly ? (/large/i.test(workspace.size) ? 'Large 6 GB' : 'Small 2 GB') : ws.size;
      const bPct = budget.cap ? Math.round((budget.used / budget.cap) * 100) : 0;
      const lab = h('section', { class: 'card stack' },
        h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'My lab'), wsPill),
        h('button', { class: 'lrow', type: 'button', onclick: () => c.go('workspace'),
          html: `<span class="day">${icon(browserOnly ? 'code' : 'terminal').replace('<svg', '<svg style="width:20px;height:20px;color:var(--brand)"')}</span><span class="lt"><b>${esc(ws.env)}</b><span>${esc(sizeLabel)}${browserOnly ? '' : ' · VS Code, terminal and Docker'}</span></span>${chev}` }),
        meter(browserOnly ? 'Coding time this week' : 'Workspace hours this week', `${hm(usedMin)} of 12 h`, Math.min(100, Math.round((usedMin / 720) * 100))),
        meter('Lab AI key budget this month', `₹${budget.used} of ₹${budget.cap} · ${bPct}%`, Math.min(100, bPct), bPct >= 75 ? 'amber' : ''),
        h('p', { class: 'tiny muted' }, browserOnly
          ? 'Months 1 to 3 run Python in the browser. A cloud workspace with VS Code and Docker opens in Month 4.'
          : bPct >= 75 ? 'AI budget is above 75%. Hints keep working; harder questions slow down near the cap.' : 'Your workspace shuts down after 20 idle minutes, so unused time is never lost.'),
        h('div', { class: 'card-actions' },
          h('button', { class: 'btn primary sm', type: 'button', onclick: () => c.go(browserOnly ? 'practical' : 'workspace'), html: icon(browserOnly ? 'code' : 'cloud') + (browserOnly ? 'Open browser Python' : 'Open workspace') }),
          browserOnly ? h('button', { class: 'btn sm', type: 'button', onclick: () => c.go('workspace') }, 'See the Month 4 workspace') : null));

      const capLabel = `Capstone ${capNo} · Month ${capMonth} milestone: ${capShort}`;
      const dueDay = String(nx.due || 'Friday').slice(0, 3);
      const deadlines = [
        ['Thu', `Practical ${lec.id}: ${lec.practical}`, `Auto-checked within a minute · ${pracCo}`, 'practical', pracDone],
        [dueDay, nx.title, 'Lockdown exam · 45 minutes', 'exam', examDone],
        ['Sun', capLabel, msDone ? 'Submitted · waiting for mentor review' : 'Submit for mentor review', 'projects', msDone],
        ['Mon', `Lecture ${nextLec.id} unlocks`, nextLec.topic, 'lecture', false],
      ];
      if (s.month >= 11) deadlines.push(['M12', 'Demo Day booking', 'Pick a 10-minute slot to present Capstone 4', 'projects', false]);
      const dl = h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', {}, 'Coming up'), h('span', { class: 'small muted' }, 'This week')),
        h('div', {}, deadlines.map(([d, t, sub, r, ok], i) => h('button', { class: 'lrow', type: 'button', onclick: () => (r === 'lecture' ? openLecture(nextLec.id) : c.go(r)),
          html: `<span class="day ${i < 2 && !ok ? 'hot' : ''}"><small>${ok ? 'Done' : r === 'lecture' ? 'Opens' : d === 'M12' ? 'Opens' : 'Due'}</small><b>${d}</b></span><span class="lt"><b>${esc(t)}</b><span>${esc(ok ? 'Done' : sub)}</span></span>${chev}` }))));

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
        h('p', { class: 'small muted' }, s.month <= 3
          ? `Months 1 to 3 are common for everyone and use ${data.common.company}. ${first} is in Month ${s.month}; from Month 4 the practicals use ${field.company}, the fictional company of the ${field.short} track.`
          : `Months 1 to 3 are common for everyone. From Month 4 every practical and project uses ${field.company}, the fictional company of the ${field.short} track. ${first} has finished ${doneMonths} of 12 months.`));

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
      const batch = data.students.filter((x) => x.id !== s.id).map((x) => ({ name: x.name, xp: x.xp }));
      batch.push({ name: s.name, xp: state.xp, me: true });
      batch.sort((a, b) => b.xp - a.xp);
      batch.forEach((x, i) => { x.rank = i + 1; });
      const meRow = batch.find((x) => x.me);
      const shown = meRow.rank <= 6 ? batch.slice(0, 6) : batch.slice(0, 5).concat([meRow]);
      const lb = h('section', { class: 'card lb' },
        h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, 'Batch leaderboard'), h('span', { class: 'small muted' }, `All-time XP · ${batch.length} students in ${s.batch}`)), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => c.go('achievements') }, 'View all')),
        h('ol', {}, shown.map((x, i) => h('li', { class: (x.me ? 'me' : '') + (i > 0 && x.rank - shown[i - 1].rank > 1 ? ' gap' : '') },
          h('button', { class: 'lb-row', type: 'button', onclick: () => c.go('achievements'), 'aria-label': `Rank ${x.rank}, ${x.name}, ${x.xp} XP. Open achievements` },
            h('span', { class: 'rk num' }, `${x.rank}`), h('span', { class: 'nm' }, x.me ? `${x.name} (you)` : x.name), h('span', { class: 'num small' }, `${x.xp.toLocaleString('en-IN')} XP`))))));

      const posts = myDoubts.map((q) => [q, 'The AI tutor is writing a first answer. A mentor will confirm it.', 'pending', 'Asked by you · just now'])
        .concat(FORUM[s.id] || FORUM.S1001).slice(0, 3);
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
