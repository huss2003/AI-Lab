/* Student home: today's plan, progress through the year, XP and leaderboard, doubt forum preview. Owned by the lead. */
NM.register('home', {
  label: 'Home', title: "Today's plan", icon: 'home', group: 'Student', order: 10,
  render(root, c) {
    const { h, data, state, icon, field } = c;
    const s = data.demo_student;
    const lec = data.lectures.find((l) => l.id === s.lecture);
    const doneMonths = s.month - 1;

    const stepsDef = [
      ['lecture', 'play', `Watch Lecture ${lec.id}: ${lec.topic}`, '40-minute recorded lesson with 4 quick questions inside the video'],
      ['practical', 'code', `Practical: ${lec.practical}`, `20 minutes on ${field.company} data, checked automatically`],
      ['exam', 'exam', 'Month 7 assessment', 'Timed, in lockdown mode, answers saved every 20 seconds'],
      ['projects', 'project', `Capstone milestone: ${field.capstones[1].title.split(':')[0]}`, 'Submit, get mentor feedback, publish to GitHub'],
    ];
    const today = h('section', { class: 'card today' },
      h('div', { class: 'card-head' },
        h('div', {}, h('div', { class: 'eyebrow' }, `Month ${s.month} · Week ${s.week} · ${data.months[s.month]}`), h('h2', {}, `Good morning, ${s.name.split(' ')[0]}`)),
        h('span', { class: 'pill blue' }, `${field.name}`)),
      h('div', { class: 'today-steps' }, stepsDef.map(([id, ic, t, sub]) =>
        h('button', { class: 'today-step', onclick: () => c.go(id), html: `<span class="ix">${icon(ic)}</span><span class="tx"><b>${c.esc(t)}</b><span>${c.esc(sub)}</span></span>` }))));

    const xpStat = h('b', { class: 'num' }, state.xp.toLocaleString('en-IN'));
    const stats = h('section', { class: 'card stack' },
      h('div', { class: 'eyebrow' }, 'Your progress'),
      h('div', { class: 'grid-2' },
        h('div', { class: 'stat' }, h('b', { class: 'num' }, `${state.progress.lecturesWatched}/104`), h('span', {}, 'lectures completed')),
        h('div', { class: 'stat' }, xpStat, h('span', {}, 'XP earned')),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, `${s.streak} days`), h('span', {}, 'learning streak')),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, `#${s.rank}`), h('span', {}, 'in batch leaderboard'))),
      h('div', {}, h('div', { class: 'row small muted', style: { justifyContent: 'space-between', marginBottom: '6px' } }, h('span', {}, 'Year progress'), h('span', { class: 'num' }, `${Math.round(state.progress.lecturesWatched / 104 * 100)}%`)),
        h('div', { class: 'progress green' }, h('i', { style: { width: `${state.progress.lecturesWatched / 104 * 100}%` } }))));
    const off = c.on('xp', ({ xp }) => { xpStat.textContent = xp.toLocaleString('en-IN'); });
    this.destroy = off;

    const year = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'The year at a glance'), h('span', { class: 'small muted' }, '4 capstones · 12 monthly projects')),
      h('div', { class: 'months' }, Array.from({ length: 12 }, (_, i) => h('i', { class: i < doneMonths ? 'done' : i === doneMonths ? 'now' : '', title: data.months[i + 1] }, `M${i + 1}`))),
      h('p', { class: 'small muted' }, `Months 1 to 3 are common for everyone. From Month 4 every practical and project uses ${field.company}, a fictional ${field.short.toLowerCase()} company.`));

    const batch = data.students.filter((x) => x.id !== s.id).slice(0, 6).map((x) => ({ name: x.name, xp: x.xp }));
    batch.push({ name: s.name, xp: state.xp, me: true });
    batch.sort((a, b) => b.xp - a.xp);
    const lb = h('section', { class: 'card lb' }, h('div', { class: 'card-head' }, h('h3', {}, 'Batch leaderboard'), h('span', { class: 'pill' }, 'This week')),
      h('ol', {}, batch.slice(0, 6).map((x, i) => h('li', { class: x.me ? 'me' : '' }, h('span', { class: 'num muted' }, `${i + 1}`), h('span', {}, x.me ? `${x.name} (you)` : x.name), h('span', { class: 'num small' }, `${x.xp.toLocaleString('en-IN')} XP`)))));

    const posts = [
      ['Why does my Router send everything to the fallback branch?', 'The condition compares text "true" with a true/false value. Change the Code step to return a boolean, then retest the step with the sample data.', 'Confirmed by mentor'],
      ['Can I use my own dataset for the Month 9 project?', 'Projects use the lab datasets so the automatic checks can grade them. You can add your own data as an extra, shown in your README.', 'Mentor reply pending'],
    ];
    const forum = h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Doubt forum'), h('span', { class: 'small muted' }, 'AI answers first, mentors confirm')),
      posts.map(([q, a, st]) => h('div', { class: 'forum-item' }, h('b', { class: 'small' }, q), h('p', { class: 'small muted' }, h('span', { class: 'ai-badge' }, 'AI'), ' ', a), h('span', { class: 'tiny ' + (st.startsWith('Confirmed') ? 'muted' : 'muted') }, st))));

    root.append(
      h('div', { class: 'hero-strip' }, today, stats),
      year,
      h('div', { class: 'grid-2' }, lb, forum));
  },
});
