/* Welcome: the first screen a visitor sees.
   Top half: what the Neuromind AI Lab is, how a student's week works, key numbers, three ways to explore.
   Bottom half: a clickable student sign-up simulator (OTP sign-in, age check, parental consent for under-18s,
   career field, device check). All details are demo data; nothing is sent anywhere. */
(function () {
  const DEMO = { mobile: '9822047788', email: 'new.student@example.com', otp: '482913', parentName: 'Anita Shinde', parentMobile: '9890012345', parentOtp: '275064' };
  // Fictional login details for the 4 demo students (shown masked; demo codes fill in by themselves).
  const LOGIN = {
    S1002: { mobile: '9850031426', email: 'ishita.d@example.com', otp: '615204' },
    S1003: { mobile: '9763208815', email: 'kabir.p@example.com', otp: '739051' },
    S1001: { mobile: '9822041210', email: 'aarav.k@example.com', otp: '482913' },
    S1004: { mobile: '9447106532', email: 'sneha.n@example.com', otp: '204786' },
  };
  // A practical-specific tutor hint for the hero preview, by lecture.
  const HINTS = {
    26: 'Hint: print response.stop_reason before you parse. What does it say when the reply is cut short?',
    43: 'Hint: which line in your Dockerfile makes the app run as a user that is not root?',
    65: 'Hint: send one request with a field missing. Which branch answers it, and what status code comes back?',
    90: 'Hint: hide the instruction inside a retrieved document, not the chat box. Does the model follow it?',
  };
  const RESEND_S = 30;
  const MIN_AGE = 14;

  const blank = () => ({
    step: 'signin', method: 'mobile', mobile: '', email: '', otpSentAt: 0, otp: '', verified: false,
    dob: '', parentName: '', parentMobile: '', parentOtpSentAt: 0, parentOtp: '', parentVerified: false,
    consents: { data: false, exam: false, ai: false, updates: true }, consentTs: 0, consentId: '',
    field: null, fieldLater: false, deviceIdx: 0, notified: false,
  });
  let SIM = blank();
  let ERR = {};               // validation message per input key, cleared on each step change
  let busy = null;            // key of the button showing a spinner
  let pendingFocus = false;   // move focus + scroll to the simulator after the next render
  let loginOpener = null;     // opens the demo-student login step (set on each render)
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.add(t); return t; };
  function cleanup() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.clear(); busy = null; }
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */
  const validMobile = (v) => /^[6-9]\d{9}$/.test(v);
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const maskMobile = (v) => `+91 ${v.slice(0, 2)}${'•'.repeat(5)}${v.slice(7)}`;
  const maskEmail = (v) => { const [u, d] = v.split('@'); return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, u.length - 2))}@${d}`; };
  const contactLabel = () => (SIM.method === 'mobile' ? maskMobile(SIM.mobile) : maskEmail(SIM.email));
  function isoYearsAgo(years) { const d = new Date(); d.setFullYear(d.getFullYear() - years); d.setDate(d.getDate() - 47); return d.toISOString().slice(0, 10); }
  function ageOf(iso) {
    if (!iso) return null; const b = new Date(iso + 'T00:00:00'); if (isNaN(b)) return null;
    const n = new Date(); let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1; return a;
  }
  const isMinor = () => { const a = ageOf(SIM.dob); return a != null && a < 18; };
  function stamp(ts) {
    try { return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST'; } catch (e) { return new Date(ts).toISOString(); }
  }
  function browserName() {
    const ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'Microsoft Edge'; if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua)) return 'Chrome'; if (/Safari\//.test(ua)) return 'Safari'; return 'Your browser';
  }
  function startTour(c) {
    if (window.NM && NM.tour && typeof NM.tour.start === 'function') NM.tour.start();
    else { c.toast('Opening the student dashboard. Use the menu on the left to explore each screen.', 'amber'); c.go('home'); }
  }

  /* ---------- styles ---------- */
  function injectStyles() {
    if (document.getElementById('m-welcome')) return;
    const css = `
.m-welcome { display: grid; gap: 20px; min-width: 0; container-type: inline-size }
.m-welcome .wl-hero { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; padding: 28px;
  background: radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--brand) 13%, transparent), transparent 60%),
              radial-gradient(80% 70% at 0% 100%, color-mix(in srgb, var(--green) 9%, transparent), transparent 60%), var(--surface) }
.m-welcome .wl-copy { display: grid; gap: 16px; align-content: center; min-width: 0 }
.m-welcome .wl-tags { display: flex; gap: 8px; flex-wrap: wrap }
.m-welcome .wl-copy h1 { font-size: clamp(26px, 4.2cqi, 38px); line-height: 1.15; letter-spacing: -.02em; max-width: 20ch }
.m-welcome .wl-copy h1 em { font-style: normal; color: var(--brand) }
.m-welcome .wl-lead { font-size: 16px; color: var(--muted); max-width: 54ch }
.m-welcome .wl-cta { display: flex; gap: 10px; flex-wrap: wrap; align-items: center }
.m-welcome .btn.lg { padding: 13px 20px; font-size: 15.5px; border-radius: 10px }
.m-welcome .btn.lg svg { width: 18px; height: 18px }
.m-welcome .wl-mini { display: flex; gap: 6px 16px; flex-wrap: wrap; font-size: 13px; color: var(--muted) }
.m-welcome .wl-mini span { display: inline-flex; gap: 6px; align-items: center }
.m-welcome .wl-mini svg { width: 15px; height: 15px; color: var(--green); flex: none }

.m-welcome .wl-win { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; min-width: 0; align-self: center }
.m-welcome .wl-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: var(--surface-2); border-bottom: 1px solid var(--line) }
.m-welcome .wl-bar i { width: 9px; height: 9px; border-radius: 50%; background: var(--line); display: block }
.m-welcome .wl-bar b { margin-left: 8px; font-size: 12px; color: var(--muted); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0 }
.m-welcome .wl-wbody { padding: 16px; display: grid; gap: 12px }
.m-welcome .wl-wbody h3 { font-size: 15px }
.m-welcome .wl-chk { display: flex; gap: 10px; align-items: center; font-size: 13px; padding: 7px 10px; border-radius: 8px; background: var(--surface-2); min-width: 0;
  animation: wl-pop .45s ease both }
.m-welcome .wl-chk span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0 }
.m-welcome .wl-chk .ic { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: var(--green-soft); color: var(--green); flex: none }
.m-welcome .wl-chk .ic svg { width: 12px; height: 12px; stroke-width: 3 }
.m-welcome .wl-hint { display: grid; gap: 4px; font-size: 13px; padding: 10px 12px; border-radius: 10px; border: 1px dashed color-mix(in srgb, var(--violet) 45%, var(--line)); background: var(--violet-soft); animation: wl-pop .45s ease both; animation-delay: 1.2s }
.m-welcome .wl-hint p { color: var(--fg) }
.m-welcome .wl-wfoot { display: flex; gap: 10px; justify-content: space-between; align-items: center; flex-wrap: wrap }
@keyframes wl-pop { from { opacity: 0; transform: translateY(6px) } }

.m-welcome .wl-sec-head { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px }
.m-welcome .wl-sec-head > div { min-width: 0 }
.m-welcome .wl-sec-head h2 { margin-top: 2px }
.m-welcome .wl-week { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; list-style: none; margin: 0; padding: 0 }
.m-welcome .wl-week li { min-width: 0; display: flex }
.m-welcome .wl-step { position: relative; display: flex; gap: 12px; align-items: start; width: 100%; text-align: left; cursor: pointer; padding: 14px; border-radius: 10px;
  border: 1px solid var(--line); background: var(--surface); transition: border-color .15s, transform .15s }
.m-welcome .wl-step:hover { border-color: var(--brand); transform: translateY(-2px) }
.m-welcome .wl-step .ix { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); flex: none }
.m-welcome .wl-step .ix svg { width: 19px; height: 19px }
.m-welcome .wl-step .tx { display: grid; gap: 3px; min-width: 0 }
.m-welcome .wl-step .tx small { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--faint) }
.m-welcome .wl-step .tx b { font-size: 14.5px; font-family: var(--display) }
.m-welcome .wl-step .tx span { font-size: 12.5px; color: var(--muted) }
.m-welcome .wl-step .go { font-size: 12px; font-weight: 700; color: var(--brand); margin-top: 4px }
.m-welcome .wl-week li:nth-child(3) .ix { background: var(--green-soft); color: var(--green) }
.m-welcome .wl-week li:nth-child(4) .ix { background: var(--violet-soft); color: var(--violet) }

.m-welcome .wl-nums { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px }
.m-welcome .wl-num { padding: 16px; border-radius: 12px; background: var(--surface-2); display: grid; gap: 2px; min-width: 0 }
.m-welcome .wl-num b { font-family: var(--display); font-size: 30px; line-height: 1.1; color: var(--fg); font-variant-numeric: tabular-nums }
.m-welcome .wl-num b small { font-size: 16px; color: var(--muted); margin-left: 2px }
.m-welcome .wl-num span { font-size: 13px; color: var(--muted) }

.m-welcome .wl-roles { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px }
.m-welcome .wl-role { display: grid; gap: 10px; align-content: start; text-align: left; cursor: pointer; padding: 18px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); min-width: 0; transition: border-color .15s, box-shadow .15s, transform .15s }
.m-welcome .wl-role:hover { border-color: var(--brand); box-shadow: var(--shadow); transform: translateY(-2px) }
.m-welcome .wl-role .ix { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand) }
.m-welcome .wl-role.r-mentor .ix { background: var(--violet-soft); color: var(--violet) }
.m-welcome .wl-role.r-admin .ix { background: var(--green-soft); color: var(--green) }
.m-welcome .wl-role .ix svg { width: 21px; height: 21px }
.m-welcome .wl-role b { font-family: var(--display); font-size: 16px }
.m-welcome .wl-role p { font-size: 13px; color: var(--muted) }
.m-welcome .wl-role .go { font-size: 13px; font-weight: 700; color: var(--brand) }

/* sign-up simulator */
.m-welcome .wl-sim { scroll-margin-top: 84px; padding: 0; overflow: hidden }
.m-welcome .wl-sim-grid { display: grid; grid-template-columns: minmax(0, 1fr) }
.m-welcome .wl-sim-side { padding: 20px; background: var(--surface-2); border-bottom: 1px solid var(--line); display: grid; gap: 14px; align-content: start; min-width: 0 }
.m-welcome .wl-sim-side h2 { font-size: 18px }
.m-welcome .wl-steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: thin }
.m-welcome .wl-steps li { display: flex; gap: 8px; align-items: center; font-size: 13px; font-weight: 700; color: var(--muted); white-space: nowrap; padding: 6px 10px 6px 6px; border-radius: 99px; background: var(--surface); border: 1px solid var(--line); flex: none }
.m-welcome .wl-steps .n { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 11.5px; background: var(--surface-2); color: var(--muted); flex: none }
.m-welcome .wl-steps .n svg { width: 12px; height: 12px; stroke-width: 3 }
.m-welcome .wl-steps li.now { color: var(--brand); border-color: var(--brand) }
.m-welcome .wl-steps li.now .n { background: var(--brand); color: var(--on-brand) }
.m-welcome .wl-steps li.done .n { background: var(--green-soft); color: var(--green) }
.m-welcome .wl-steps li.done { color: var(--fg) }
.m-welcome .wl-steps li.skip { color: var(--faint); border-style: dashed }
.m-welcome .wl-steps li em { font-style: normal; font-weight: 600; font-size: 11.5px; color: var(--faint) }
.m-welcome .wl-sim-main { padding: 22px; display: grid; gap: 16px; align-content: start; min-width: 0 }
.m-welcome .wl-sim-main h3 { font-size: 18px }
.m-welcome .wl-sim-main h3:focus { outline: none }
.m-welcome .wl-form { display: grid; gap: 14px; max-width: 520px }
.m-welcome .wl-lbl { display: grid; gap: 6px; font-size: 13px; font-weight: 700; min-width: 0 }
.m-welcome .wl-lbl > span.h { font-weight: 500; color: var(--muted); font-size: 12.5px }
.m-welcome .wl-phone { display: flex; min-width: 0 }
.m-welcome .wl-phone > span { display: grid; place-items: center; padding: 0 12px; border: 1px solid var(--line); border-right: 0; border-radius: var(--radius-sm) 0 0 var(--radius-sm); background: var(--surface-2); color: var(--muted); font-weight: 700; font-size: 14px }
.m-welcome .wl-phone .field-input { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; min-width: 0 }
.m-welcome .field-input.bad { border-color: var(--red) }
.m-welcome .wl-err { color: var(--red); font-size: 13px; font-weight: 600 }
.m-welcome .wl-err:empty { display: none }
.m-welcome .wl-otp { display: flex; gap: 8px; flex-wrap: nowrap }
.m-welcome .wl-otp input { width: 46px; height: 54px; min-width: 0; flex: 0 1 46px; text-align: center; font-family: var(--mono); font-size: 22px; font-weight: 700;
  border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--fg) }
.m-welcome .wl-otp input:focus { outline: 2px solid var(--brand); outline-offset: 0; border-color: var(--brand) }
.m-welcome .wl-otp.bad input { border-color: var(--red) }
.m-welcome .wl-otp.ok input { border-color: var(--green); background: var(--green-soft) }
.m-welcome .wl-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center }
.m-welcome .wl-actions .sp { flex: 1 }
.m-welcome .wl-linkbtn { background: none; border: 0; padding: 0; color: var(--brand); font-weight: 700; cursor: pointer; font-size: 13px }
.m-welcome .wl-linkbtn:disabled { color: var(--faint); cursor: default }
.m-welcome .wl-ok { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 10px; background: var(--green-soft); color: var(--green); font-weight: 700; font-size: 14px }
.m-welcome .wl-ok svg { width: 18px; height: 18px; flex: none; stroke-width: 2.6 }
.m-welcome .wl-ok span { color: var(--fg); font-weight: 600 }
.m-welcome .wl-quick { display: flex; gap: 8px; flex-wrap: wrap; align-items: center }
.m-welcome .wl-consent { display: grid; gap: 8px }
.m-welcome .wl-cb { display: flex; gap: 10px; align-items: start; font-size: 13.5px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; background: var(--surface) }
.m-welcome .wl-cb input { margin-top: 3px; width: 16px; height: 16px; accent-color: var(--brand); flex: none }
.m-welcome .wl-cb.bad { border-color: var(--red) }
.m-welcome .wl-cb small { display: block; color: var(--muted); font-size: 12px }
.m-welcome .wl-fields { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px }
.m-welcome .wl-fcard { position: relative; display: grid; gap: 4px; align-content: start; text-align: left; cursor: pointer; padding: 14px 40px 14px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); min-width: 0 }
.m-welcome .wl-fcard:hover { border-color: var(--brand) }
.m-welcome .wl-fcard b { font-size: 14px; font-family: var(--display) }
.m-welcome .wl-fcard .co { font-size: 12.5px; font-weight: 700; color: var(--brand) }
.m-welcome .wl-fcard p { font-size: 12.5px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden }
.m-welcome .wl-fcard .tick { position: absolute; top: 12px; right: 12px; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--line); display: grid; place-items: center; color: var(--on-brand) }
.m-welcome .wl-fcard .tick svg { width: 12px; height: 12px; stroke-width: 3; opacity: 0 }
.m-welcome .wl-fcard[aria-pressed="true"] { border-color: var(--brand); background: var(--brand-soft); box-shadow: 0 0 0 1px var(--brand) inset }
.m-welcome .wl-fcard[aria-pressed="true"] .tick { background: var(--brand); border-color: var(--brand) }
.m-welcome .wl-fcard[aria-pressed="true"] .tick svg { opacity: 1 }
.m-welcome .wl-dev .check { align-items: center }
.m-welcome .wl-dev .check .ic svg { width: 12px; height: 12px; stroke-width: 3 }
.m-welcome .wl-dev .check .spin { width: 11px; height: 11px }
.m-welcome .wl-dev .check > div { min-width: 0; display: grid }
.m-welcome .wl-dev .check small { color: var(--muted); font-size: 12.5px }
.m-welcome .wl-done-badge { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: var(--green-soft); color: var(--green) }
.m-welcome .wl-done-badge svg { width: 30px; height: 30px; stroke-width: 2.6 }
.m-welcome .wl-sum .check > span:last-child { min-width: 0 }
.m-welcome .wl-foot { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; text-align: center }

/* log in as a demo student */
.m-welcome .wl-login { scroll-margin-top: 84px }
.m-welcome .wl-stus { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px }
.m-welcome .wl-stu { position: relative; display: grid; gap: 10px; align-content: start; text-align: left; cursor: pointer; padding: 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: inherit; min-width: 0; transition: border-color .15s, box-shadow .15s, transform .15s }
.m-welcome .wl-stu:hover { border-color: var(--brand); box-shadow: var(--shadow); transform: translateY(-2px) }
.m-welcome .wl-stu:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px }
.m-welcome .wl-stu.cur { border-color: color-mix(in srgb, var(--green) 55%, var(--line)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--green) 55%, transparent) inset; background: color-mix(in srgb, var(--green-soft) 35%, var(--surface)) }
.m-welcome .wl-stu > span { min-width: 0 }
.m-welcome .st-top { display: flex; gap: 10px; align-items: center; min-width: 0 }
.m-welcome .avatar { width: 40px; height: 40px; border-radius: 11px; font-size: 14px }
.m-welcome .avatar.av-0 { background: var(--violet-soft); color: var(--violet) }
.m-welcome .avatar.av-1 { background: var(--brand-soft); color: var(--brand) }
.m-welcome .avatar.av-2 { background: var(--amber-soft); color: var(--amber) }
.m-welcome .avatar.av-3 { background: var(--green-soft); color: var(--green) }
.m-welcome .st-who { display: grid; min-width: 0 }
.m-welcome .st-who b { font-family: var(--display); font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-welcome .st-who small { font-size: 12px; color: var(--muted) }
.m-welcome .st-cur { justify-self: start }
.m-welcome .st-tags { display: flex; gap: 6px; flex-wrap: wrap }
.m-welcome .st-year { display: block; height: 5px; border-radius: 99px; background: var(--surface-2); overflow: hidden }
.m-welcome .st-year i { display: block; height: 100%; background: var(--brand); border-radius: inherit }
.m-welcome .st-now { display: grid; gap: 1px; font-size: 13px; font-weight: 700 }
.m-welcome .st-now small { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--faint) }
.m-welcome .st-story { font-size: 12.5px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden }
.m-welcome .st-stats { display: flex; gap: 6px 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); padding-top: 8px; border-top: 1px solid var(--line) }
.m-welcome .st-stats b { color: var(--fg); font-size: 13.5px }
.m-welcome .st-minor { display: flex; gap: 6px; align-items: center; font-size: 12px; font-weight: 700; color: var(--green); background: var(--green-soft); border-radius: 8px; padding: 6px 8px }
.m-welcome .st-minor svg { width: 15px; height: 15px; flex: none }
.m-welcome .wl-stu .go { font-size: 13px; font-weight: 700; color: var(--brand); margin-top: auto }
.m-welcome .wl-or { display: grid; gap: 8px; padding: 12px; border: 1px dashed var(--line-strong); border-radius: 10px }
.m-welcome .wl-or .btn.cur { border-color: var(--green); color: var(--green) }
.wl-login-modal { container-type: normal }
.wl-login-modal .wl-form { max-width: none }
@media (prefers-reduced-motion: reduce) { .m-welcome .wl-stu:hover { transform: none } }

@container (min-width: 560px) {
  .m-welcome .wl-stus { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .m-welcome .wl-nums { grid-template-columns: repeat(3, minmax(0, 1fr)) }
  .m-welcome .wl-fields { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .m-welcome .wl-week { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .m-welcome .wl-week li:last-child { grid-column: 1 / -1 }
}
@container (min-width: 700px) {
  .m-welcome .wl-roles { grid-template-columns: repeat(3, minmax(0, 1fr)) }
}
@container (min-width: 860px) {
  .m-welcome .wl-week { grid-template-columns: repeat(5, minmax(0, 1fr)) }
  .m-welcome .wl-week li:last-child { grid-column: auto }
  .m-welcome .wl-week .wl-step { flex-direction: column }
  .m-welcome .wl-week li:not(:last-child) .wl-step::after { content: ""; position: absolute; top: 31px; right: -10px; width: 10px; height: 2px; background: var(--line) }
}
@container (min-width: 1000px) {
  .m-welcome .wl-stus { grid-template-columns: repeat(4, minmax(0, 1fr)) }
}
@container (min-width: 900px) {
  .m-welcome .wl-hero { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); padding: 36px; gap: 32px }
  .m-welcome .wl-nums { grid-template-columns: repeat(6, minmax(0, 1fr)) }
  .m-welcome .wl-sim-grid { grid-template-columns: 250px minmax(0, 1fr) }
  .m-welcome .wl-sim-side { border-bottom: 0; border-right: 1px solid var(--line) }
  .m-welcome .wl-steps { flex-direction: column; overflow: visible }
  .m-welcome .wl-steps li { background: transparent; border-color: transparent; padding: 6px 4px }
  .m-welcome .wl-steps li.now { background: var(--surface); border-color: var(--brand) }
  .m-welcome .wl-fields { grid-template-columns: repeat(3, minmax(0, 1fr)) }
  .m-welcome .wl-sim-main { padding: 26px 28px }
}
@container (max-width: 420px) {
  .m-welcome .wl-hero { padding: 20px }
  .m-welcome .wl-cta .btn { width: 100% }
  .m-welcome .wl-otp { gap: 6px }
  .m-welcome .wl-otp input { height: 48px; font-size: 19px }
  .m-welcome .wl-sim-main { padding: 18px }
  .m-welcome .wl-actions .btn { flex: 1 1 auto }
}
@media (prefers-reduced-motion: reduce) {
  .m-welcome .wl-step:hover, .m-welcome .wl-role:hover { transform: none }
}`;
    document.head.append(Object.assign(document.createElement('style'), { id: 'm-welcome', textContent: css }));
  }

  NM.register('welcome', {
    label: 'Welcome', title: 'Welcome', icon: 'login', group: 'Start', order: 1,

    render(root, c) {
      injectStyles();
      cleanup();
      const { h, data, icon, field } = c;
      const fieldById = (id) => data.fields.find((f) => f.id === id);
      const wrap = h('div', { class: 'm-welcome' });
      root.append(wrap);

      /* ---------- hero ---------- */
      const S = data.demo_student;
      const commonPrac = S.practical_company === 'common';
      const pracSet = commonPrac ? (data.common.practicals || {}) : (field.practicals || {});
      const prac = pracSet[String(S.lecture)] || Object.values(pracSet)[0] || null;
      const checks = prac ? prac.checks.slice(0, 3) : [];
      const lec = data.lectures.find((l) => l.id === S.lecture) || data.lectures[0];
      const preview = h('div', { class: 'wl-win', 'aria-label': 'Example of a checked practical' },
        h('div', { class: 'wl-bar' }, h('i'), h('i'), h('i'), h('b', {}, `${S.name.split(' ')[0]}’s practical · Lecture ${lec.id} · ${commonPrac ? 'Foundation' : field.short}`)),
        h('div', { class: 'wl-wbody' },
          h('div', {}, h('div', { class: 'eyebrow' }, commonPrac ? data.common.company : field.company), h('h3', {}, prac ? prac.topic : lec.practical)),
          h('div', { class: 'stack', style: { gap: '6px' } }, checks.map((t, i) =>
            h('div', { class: 'wl-chk', style: { animationDelay: `${0.25 + i * 0.35}s` } }, h('span', { class: 'ic', html: icon('check') }), h('span', { title: t }, t)))),
          h('div', { class: 'wl-wfoot' },
            h('span', { class: 'pill green' }, h('span', { class: 'dot' }), `${checks.length} of ${checks.length} checks passed`),
            h('span', { class: 'tiny muted' }, 'Checked automatically in 38 seconds')),
          h('div', { class: 'wl-hint' }, h('div', {}, h('span', { class: 'ai-badge' }, 'AI tutor')),
            h('p', {}, HINTS[lec.id] || 'Hint: run the checks once before you change anything. Which one fails first, and why?')),
          h('div', { class: 'wl-wfoot' },
            h('span', { class: 'tiny muted' }, commonPrac ? 'Months 1 to 3 are common. Fields open in Month 4.' : `Same lab, ${data.fields.length} fields. Switch the field at the top.`),
            h('button', { class: 'btn sm', onclick: () => c.go('practical'), html: `${icon('code')}Open this practical` }))));

      const simAnchor = () => wrap.querySelector('.wl-sim');
      const hero = h('section', { class: 'card wl-hero' },
        h('div', { class: 'wl-copy' },
          h('div', { class: 'wl-tags' }, h('span', { class: 'pill blue' }, `${data.brand.org}`), h('span', { class: 'pill amber' }, 'Investor demo · demo data')),
          h('h1', { html: `The online practice lab that comes with our <em>one-year AI course</em>.` }),
          h('p', { class: 'wl-lead' }, `${data.brand.name} is where students watch lectures, practise on real-looking company data, get instant feedback and ship projects to GitHub. It works on any basic laptop with a browser.`),
          h('div', { class: 'wl-cta' },
            h('button', { class: 'btn primary lg', 'data-act': 'tour', onclick: () => startTour(c), html: `${icon('play')}Take the 2-minute guided tour` }),
            h('button', { class: 'btn lg', onclick: () => c.go('flowmap'), html: `${icon('flow')}How the lab works` })),
          h('div', { class: 'wl-mini' },
            h('span', { html: `${icon('check')}No install, runs in the browser` }),
            h('span', { html: `${icon('check')}4 GB RAM laptop is enough` }),
            h('span', {}, h('button', { class: 'wl-linkbtn', onclick: () => { const t = wrap.querySelector('.wl-login'); if (t) { t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); const b = t.querySelector('.wl-stu'); if (b) b.focus({ preventScroll: true }); } } }, 'Log in as a student →')),
            h('span', {}, h('button', { class: 'wl-linkbtn', onclick: () => { pendingFocus = true; focusSim(); } }, 'Try student sign-up →')))),
        preview);

      /* ---------- log in as one of the 4 demo students ---------- */
      const students = (c.students && c.students.length ? c.students : [S]).slice().sort((a, b) => a.month - b.month);
      const fieldLabel = (st) => { const f = fieldById(st.field); const n = f ? f.short : st.field; return st.month <= 3 ? `${n} from Month 4` : n; };
      const loginSec = h('section', { class: 'card wl-login', id: 'wl-login', 'aria-labelledby': 'wlLoginH' },
        h('div', { class: 'wl-sec-head' },
          h('div', {}, h('div', { class: 'eyebrow' }, `Batch ${S.batch} · 4 demo students`), h('h2', { id: 'wlLoginH' }, 'Log in as a student'),
            h('p', { class: 'small muted', style: { marginTop: '4px', maxWidth: '62ch' } }, 'Each student is at a different point of the year, in a different field. Pick one and every screen follows them: lecture, practical, exam, capstone and certificates.')),
          h('span', { class: 'pill blue' }, `Currently viewing: ${S.name}`)),
        h('div', { class: 'wl-stus' }, students.map((st, i) => studentCard(st, i))));

      function studentCard(st, i) {
        const cur = st.id === S.id;
        const l = data.lectures.find((x) => x.id === st.lecture) || data.lectures[0];
        const nCert = (st.certificates || []).length;
        return h('button', { class: 'wl-stu' + (cur ? ' cur' : ''), type: 'button', 'data-student': st.id, 'aria-label': `Log in as ${st.name}, Month ${st.month}, ${fieldLabel(st)}${cur ? ', currently viewing' : ''}`, onclick: () => openLogin(st),
          html: `<span class="st-top"><span class="avatar av-${i % 4}">${c.esc(st.initials || st.name.split(' ').map((w) => w[0]).join(''))}</span>`
            + `<span class="st-who"><b>${c.esc(st.name)}</b><small>Age ${st.age} · ${c.esc(st.education)}</small></span></span>`
            + (cur ? '<span class="pill green st-cur"><span class="dot"></span>Currently viewing</span>' : '')
            + `<span class="st-tags"><span class="pill blue">Month ${st.month} · Week ${st.week}</span><span class="pill violet">${c.esc(fieldLabel(st))}</span></span>`
            + `<span class="st-year" aria-hidden="true"><i style="width:${Math.round((st.month / 12) * 100)}%"></i></span>`
            + `<span class="st-now"><small>Now</small>Lecture ${l.id}: ${c.esc(l.topic)}</span>`
            + `<span class="st-story">${c.esc(st.story || st.tagline || '')}</span>`
            + `<span class="st-stats"><span><b class="num">${Number(st.xp).toLocaleString('en-IN')}</b> XP</span><span><b class="num">${nCert}</b> certificate${nCert === 1 ? '' : 's'}</span><span><b class="num">${st.streak}</b>-day streak</span></span>`
            + (st.consent ? `<span class="st-minor">${icon('shield')}Under 18 · parent consent on file</span>` : '')
            + `<span class="go">${cur ? 'Continue' : 'Log in'} as ${c.esc(st.name.split(' ')[0])} →</span>` });
      }

      // Short login step: masked contact, demo code fills itself in, then the whole demo reloads as that student.
      function openLogin(st) {
        const cur = st.id === S.id;
        const L = LOGIN[st.id] || { mobile: '9800000000', email: 'student@example.com', otp: '123456' };
        let filled = false, loading = false;
        const lt = new Set();
        const wait = (fn, ms) => { const t = setTimeout(() => { lt.delete(t); fn(); }, ms); lt.add(t); };
        const boxes = h('div', { class: 'wl-otp', role: 'group', 'aria-label': '6-digit demo code' },
          Array.from({ length: 6 }, (_, k) => h('input', { type: 'text', readonly: true, tabindex: '-1', 'aria-label': `Digit ${k + 1}`, value: '' })));
        const status = h('div', { class: 'small muted', 'aria-live': 'polite' }, 'Sending a demo code…');
        const goBtn = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: () => doLogin() }, cur ? `Continue as ${st.name.split(' ')[0]}` : 'Log in');
        const l = data.lectures.find((x) => x.id === st.lecture) || data.lectures[0];
        const body = h('div', { class: 'm-welcome wl-login-modal stack' },
          h('div', { class: 'row', style: { gap: '12px', flexWrap: 'nowrap', alignItems: 'center' } },
            h('span', { class: `avatar av-${students.indexOf(st) % 4}`, style: { width: '44px', height: '44px', fontSize: '15px', borderRadius: '12px' } }, st.initials || ''),
            h('div', { style: { minWidth: 0 } }, h('div', { class: 'eyebrow' }, 'Demo student login'), h('h3', {}, `Log in as ${st.name}`),
              h('div', { class: 'small muted' }, `Month ${st.month} · ${fieldLabel(st)} · Lecture ${l.id}`))),
          h('div', { class: 'wl-form' },
            h('label', { class: 'wl-lbl' }, 'Mobile number', h('div', { class: 'wl-phone' }, h('span', {}, '+91'), h('input', { class: 'field-input', readonly: true, value: maskMobile(L.mobile).replace('+91 ', ''), 'aria-label': 'Mobile number (demo)' }))),
            h('label', { class: 'wl-lbl' }, 'or email', h('input', { class: 'field-input', readonly: true, value: L.email, 'aria-label': 'Email (demo)' })),
            h('div', { class: 'wl-lbl' }, 'One-time code', boxes), status),
          st.consent ? h('div', { class: 'callout small', style: { borderLeftColor: 'var(--green)' } }, h('b', {}, 'Under 18 · parent consent on file. '), `${st.consent.parent} (${st.consent.relation}) confirmed on ${st.consent.recorded} · ${st.consent.ref}. No extra step at login.`) : null,
          h('p', { class: 'tiny muted' }, 'Demo only: no message is sent. The page reloads so every screen starts fresh for this student.'),
          h('div', { class: 'wl-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'Cancel'), h('span', { class: 'sp' }), goBtn));
        const md = c.modal(body);
        md.box.style.maxWidth = '480px'; md.box.setAttribute('aria-label', `Log in as ${st.name}`);
        const ins = [...boxes.querySelectorAll('input')];
        function close() { lt.forEach((t) => clearTimeout(t)); lt.clear(); md.close(); }
        function fillAll() { ins.forEach((x, k) => { x.value = L.otp[k]; }); boxes.classList.add('ok'); filled = true; status.textContent = 'Demo code filled in automatically.'; goBtn.disabled = false; goBtn.focus(); }
        function doLogin() {
          if (loading) return;
          if (!filled) fillAll();
          if (cur) { close(); c.go('home'); return; }
          loading = true; goBtn.disabled = true; goBtn.textContent = ''; goBtn.append(h('span', { class: 'spin' }), 'Logging in');
          wait(() => { c.toast(`Logged in as ${st.name}`, 'green'); if (typeof c.setStudent === 'function') c.setStudent(st.id, 'home'); else if (window.NM && NM.setStudent) NM.setStudent(st.id, 'home'); }, 550);
        }
        body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && filled) { e.preventDefault(); doLogin(); } });
        if (reduced()) wait(fillAll, 200);
        else { wait(() => { status.textContent = 'Code received. Filling it in…'; }, 350); ins.forEach((x, k) => wait(() => { x.value = L.otp[k]; }, 450 + k * 90)); wait(fillAll, 450 + 6 * 90); }
        goBtn.focus();
      }
      loginOpener = openLogin;

      /* ---------- a student's week ---------- */
      const week = [
        ['play', '2 lectures', 'Two 40-minute recorded lessons, with quick questions inside the video', 'lecture', 'See a lecture'],
        ['code', '20-minute practical', `A hands-on task after each lecture, on ${commonPrac ? data.common.company : field.company} data`, 'practical', 'Try a practical'],
        ['check', 'Instant auto-check', 'Automatic checks mark the work within a minute', 'practical', 'Run the checks'],
        ['spark', 'AI tutor hints', 'Stuck? The tutor gives hints, never the graded answer', 'practical', 'Ask the tutor'],
        ['github', 'Projects to GitHub', 'Work goes to the student’s own GitHub and portfolio site', 'projects', 'See projects'],
      ];
      const weekSec = h('section', { class: 'card' },
        h('div', { class: 'wl-sec-head' },
          h('div', {}, h('div', { class: 'eyebrow' }, 'Every week, for 12 months'), h('h2', {}, 'How a student’s week works')),
          h('span', { class: 'small muted' }, 'Click a step to see that screen')),
        h('ol', { class: 'wl-week' }, week.map(([ic, t, sub, route, go], i) => h('li', {},
          h('button', { class: 'wl-step', onclick: () => c.go(route), html:
            `<span class="ix">${icon(ic)}</span><span class="tx"><small>Step ${i + 1}</small><b>${c.esc(t)}</b><span>${c.esc(sub)}</span><span class="go">${c.esc(go)} →</span></span>` })))));

      /* ---------- key numbers ---------- */
      const L = data.lab_costs || {};
      const capstones = 1 + ((field.capstones && field.capstones.length) || 3);
      const nums = [
        [data.lectures.length, '', 'recorded lectures, 2 a week'],
        [Object.keys(data.months).length, '', 'months, one course year'],
        [data.fields.length, '', 'career fields, chosen after Month 3'],
        [capstones, '', 'capstone projects per student'],
        [12, 'h', 'lab time a week per student'],
        [(L.students || 3000).toLocaleString('en-IN'), '', `students the lab is sized for, ${(L.concurrent_online || 1000).toLocaleString('en-IN')} online at once`],
      ];
      const numSec = h('section', { class: 'card' },
        h('div', { class: 'wl-sec-head' },
          h('div', {}, h('div', { class: 'eyebrow' }, 'The course and the lab'), h('h2', {}, 'Key numbers')),
          h('span', { class: 'small muted' }, 'Planned course design and lab capacity')),
        h('div', { class: 'wl-nums' }, nums.map(([n, unit, label]) => h('div', { class: 'wl-num' }, h('b', { class: 'num' }, String(n), unit ? h('small', {}, unit) : null), h('span', {}, label)))));

      /* ---------- roles ---------- */
      const roles = [
        ['student', 'home', 'home', 'See it as a student', `${data.demo_student.name.split(' ')[0]} is in Month ${data.demo_student.month}: today’s lecture, practical, exam and capstone.`, 'Open the student view'],
        ['mentor', 'mentor', 'mentor', 'See it as a mentor', `A batch of ${data.students.length} students: who needs help, capstone reviews and exam flags.`, 'Open the mentor console'],
        ['admin', 'admin', 'chart', 'See how it’s run', `Lab costs, server budget and AI usage for ${(L.students || 3000).toLocaleString('en-IN')} students.`, 'Open the admin view'],
      ];
      const roleSec = h('section', {},
        h('div', { class: 'wl-sec-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Explore freely'), h('h2', {}, 'Choose how you want to look around'))),
        h('div', { class: 'wl-roles' }, roles.map(([k, route, ic, t, sub, go]) =>
          h('button', { class: `wl-role r-${k}`, 'data-role': k, onclick: () => c.go(route), html:
            `<span class="ix">${icon(ic)}</span><b>${c.esc(t)}</b><p>${c.esc(sub)}</p><span class="go">${c.esc(go)} →</span>` }))));

      /* ---------- sign-up simulator ---------- */
      const simMain = h('div', { class: 'wl-sim-main', 'aria-live': 'polite' });
      const stepsList = h('ol', { class: 'wl-steps', 'aria-label': 'Sign-up steps' });
      const sim = h('section', { class: 'card wl-sim', id: 'wl-signup' },
        h('div', { class: 'wl-sim-grid' },
          h('div', { class: 'wl-sim-side' },
            h('div', {}, h('div', { class: 'eyebrow' }, 'Try student sign-up'), h('h2', {}, 'Join a batch in about a minute')),
            h('p', { class: 'small muted' }, 'Sign in with a one-time code, age check, parent consent for under-18s, field choice and a laptop check. Demo only: nothing is sent.'),
            stepsList,
            h('button', { class: 'btn sm ghost', style: { justifySelf: 'start' }, onclick: () => { SIM = blank(); ERR = {}; cleanup(); pendingFocus = true; draw(); c.toast('Sign-up restarted', ''); }, html: `${icon('login')}Start over` })),
          simMain));

      wrap.append(hero, loginSec, weekSec, numSec, roleSec, sim,
        h('p', { class: 'wl-foot tiny muted' }, h('span', { class: 'pill amber' }, 'Demo data'), 'All people and companies are fictional. Numbers describe the planned course and lab, not real results.'));

      function scrollToSim(smooth) {
        const s = simAnchor(); if (!s) return;
        const tb = document.querySelector('.topbar');
        const off = (tb && /sticky|fixed/.test(getComputedStyle(tb).position) ? tb.getBoundingClientRect().bottom : 0) + 12;
        window.scrollTo({ top: Math.max(0, s.getBoundingClientRect().top + window.scrollY - off), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
      }
      function focusSim() {
        const s = simAnchor(); if (!s) return;
        scrollToSim(true);
        const t = (simMain.querySelector('input:not([type=checkbox]):not([disabled])') || simMain.querySelector('h3'));
        if (t) t.focus({ preventScroll: true });
        pendingFocus = false;
      }
      function go(step) { SIM.step = step; ERR = {}; busy = null; pendingFocus = true; cleanup(); draw(); }

      const STEPS = [['signin', 'Sign in'], ['age', 'Age check'], ['consent', 'Parent consent'], ['field', 'Career field'], ['device', 'Laptop check'], ['done', 'Ready']];
      function drawSteps() {
        stepsList.textContent = '';
        const cur = STEPS.findIndex(([k]) => k === (SIM.step === 'otp' ? 'signin' : SIM.step));
        const ageKnown = cur > 1;
        STEPS.forEach(([k, label], i) => {
          const skip = k === 'consent' && ageKnown && !isMinor();
          const cls = i === cur ? 'now' : skip ? 'skip' : i < cur ? 'done' : '';
          const num = cls === 'done' ? icon('check') : ['1', '2', '2b', '3', '4', '5'][i];
          const note = k === 'consent' ? (skip ? 'Not needed' : !ageKnown ? 'Under 18 only' : '') : '';
          stepsList.append(h('li', { class: cls, 'aria-current': i === cur ? 'step' : null }, h('span', { class: 'n', html: num }), label, note ? h('em', {}, note) : null));
        });
        requestAnimationFrame(() => {
          const li = stepsList.querySelector('li.now');
          if (li && stepsList.scrollWidth > stepsList.clientWidth + 1) stepsList.scrollLeft = Math.max(0, li.offsetLeft - stepsList.offsetLeft - 8);
        });
      }

      function err(key) { return h('div', { class: 'wl-err', role: 'alert', 'data-err': key }, ERR[key] || ''); }
      function setErr(key, msg) { ERR[key] = msg; const el = simMain.querySelector(`[data-err="${key}"]`); if (el) el.textContent = msg || ''; }
      function btn(label, opts) {
        const o = opts || {};
        const b = h('button', { class: 'btn' + (o.primary ? ' primary' : '') + (o.sm ? ' sm' : ''), type: 'button', 'data-k': o.key || null, onclick: o.onclick });
        if (busy && o.key === busy) { b.disabled = true; b.append(h('span', { class: 'spin' }), o.busyLabel || 'Working'); }
        else b.innerHTML = (o.icon ? icon(o.icon) : '') + c.esc(label);
        return b;
      }
      function backBtn(to) { return btn('Back', { onclick: () => go(to), key: 'back' }); }
      function head(eyebrow, title, sub) {
        return h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'eyebrow' }, eyebrow), h('h3', { tabindex: '-1' }, title), sub ? h('p', { class: 'small muted' }, sub) : null);
      }

      // Six one-digit boxes. value is read through get(), written through set(str).
      function otpBoxes(get, set, state) {
        const box = h('div', { class: 'wl-otp' + (state ? ' ' + state : ''), role: 'group', 'aria-label': '6-digit code' });
        const ins = Array.from({ length: 6 }, (_, i) => h('input', { type: 'text', inputmode: 'numeric', maxlength: '6', autocomplete: i === 0 ? 'one-time-code' : 'off', 'aria-label': `Digit ${i + 1}`, value: get()[i] || '' }));
        const read = () => ins.map((x) => x.value).join('');
        ins.forEach((inp, i) => {
          inp.addEventListener('input', () => {
            const digits = inp.value.replace(/\D/g, '');
            if (digits.length > 1) { digits.slice(0, 6 - i).split('').forEach((d, j) => { ins[i + j].value = d; }); const nx = ins[Math.min(5, i + digits.length)]; nx.focus(); }
            else { inp.value = digits; if (digits && i < 5) ins[i + 1].focus(); }
            box.classList.remove('bad'); set(read());
          });
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !inp.value && i > 0) { ins[i - 1].focus(); ins[i - 1].value = ''; set(read()); e.preventDefault(); }
            else if (e.key === 'ArrowLeft' && i > 0) ins[i - 1].focus();
            else if (e.key === 'ArrowRight' && i < 5) ins[i + 1].focus();
            else if (e.key === 'Enter') { const v = box.closest('.wl-sim-main').querySelector('[data-k="verify"]'); if (v) v.click(); }
          });
          inp.addEventListener('focus', () => inp.select());
        });
        box.append(...ins);
        box.fill = (code) => { ins.forEach((x, i) => { x.value = code[i]; }); set(code); box.classList.remove('bad'); ins[5].focus(); };
        return box;
      }
      function countdown(sentAt, onResend) {
        const holder = h('span', { class: 'small muted' });
        const tick = () => {
          const left = Math.max(0, RESEND_S - Math.floor((Date.now() - sentAt) / 1000));
          holder.textContent = '';
          if (left > 0) holder.append(`Resend code in 0:${String(left).padStart(2, '0')}`);
          else { holder.append(h('button', { class: 'wl-linkbtn', type: 'button', 'data-k': 'resend', onclick: onResend }, 'Resend code')); clearInterval(iv); timers.delete(iv); }
        };
        const iv = every(tick, 1000); tick();
        return holder;
      }

      /* ----- step: sign in ----- */
      function stepSignin() {
        const isM = SIM.method === 'mobile';
        const tabs = h('div', { class: 'tabs', role: 'tablist' },
          [['mobile', 'Mobile number'], ['email', 'Email']].map(([k, t]) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(SIM.method === k), onclick: () => { if (SIM.method !== k) { SIM.method = k; ERR = {}; draw(); const i = simMain.querySelector('input'); if (i) i.focus(); } } }, t)));
        const inp = h('input', { class: 'field-input' + (ERR.contact ? ' bad' : ''), id: 'wl-contact', type: isM ? 'tel' : 'email', inputmode: isM ? 'numeric' : 'email', autocomplete: isM ? 'tel-national' : 'email',
          placeholder: isM ? '10-digit mobile number' : 'name@example.com', maxlength: isM ? '10' : '80', value: isM ? SIM.mobile : SIM.email,
          oninput: (e) => { let v = e.target.value; if (isM) { v = v.replace(/\D/g, '').slice(0, 10); e.target.value = v; SIM.mobile = v; } else SIM.email = v.trim(); e.target.classList.remove('bad'); setErr('contact', ''); },
          onkeydown: (e) => { if (e.key === 'Enter') send(); } });
        function send() {
          const v = isM ? SIM.mobile : SIM.email;
          if (!v) return setErr('contact', isM ? 'Enter your mobile number.' : 'Enter your email address.'), inp.classList.add('bad'), inp.focus();
          if (isM && !validMobile(v)) return setErr('contact', 'Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8 or 9).'), inp.classList.add('bad'), inp.focus();
          if (!isM && !validEmail(v)) return setErr('contact', 'That email address does not look right. Check for a missing @ or dot.'), inp.classList.add('bad'), inp.focus();
          busy = 'send'; draw();
          later(() => { SIM.otpSentAt = Date.now(); SIM.otp = ''; SIM.verified = false; busy = null; c.toast(`Code sent to ${contactLabel()} (demo: no real message)`, 'green'); go('otp'); }, 700);
        }
        return [
          head('Step 1 of 5', 'Sign in or create your account', 'Students sign in with a one-time code. No password to forget.'),
          h('div', { class: 'wl-form' }, tabs,
            h('label', { class: 'wl-lbl', for: 'wl-contact' }, isM ? 'Mobile number' : 'Email address',
              isM ? h('div', { class: 'wl-phone' }, h('span', {}, '+91'), inp) : inp),
            err('contact'),
            h('div', { class: 'wl-quick' }, h('button', { class: 'wl-linkbtn', type: 'button', 'data-k': 'demo-contact', onclick: () => { if (isM) SIM.mobile = DEMO.mobile; else SIM.email = DEMO.email; inp.value = isM ? DEMO.mobile : DEMO.email; inp.classList.remove('bad'); setErr('contact', ''); inp.focus(); } }, isM ? 'Use demo number' : 'Use demo email')),
            h('div', { class: 'wl-actions' }, btn('Send OTP', { primary: true, key: 'send', busyLabel: 'Sending code', onclick: send, icon: 'login' }))),
          h('p', { class: 'tiny muted' }, 'By continuing you agree to the course terms and privacy notice. Under-18 students need a parent’s consent in a later step.'),
        ];
      }

      /* ----- step: OTP ----- */
      function stepOtp() {
        let boxes;
        function verify() {
          if (SIM.otp.length < 6) { setErr('otp', 'Enter all 6 digits of the code.'); boxes.classList.add('bad'); return; }
          if (SIM.otp !== DEMO.otp) { setErr('otp', 'That code does not match. Tap “Fill demo OTP” to use the demo code.'); boxes.classList.add('bad'); return; }
          busy = 'verify'; draw();
          later(() => { SIM.verified = true; busy = null; c.toast(SIM.method === 'mobile' ? 'Signed in. Your number is verified.' : 'Signed in. Your email is verified.', 'green'); go('age'); }, 600);
        }
        boxes = otpBoxes(() => SIM.otp, (v) => { SIM.otp = v; setErr('otp', ''); }, ERR.otp ? 'bad' : '');
        const resend = () => { SIM.otpSentAt = Date.now(); SIM.otp = ''; c.toast(`New code sent to ${contactLabel()}`, 'green'); ERR = {}; pendingFocus = true; cleanup(); draw(); };
        return [
          head('Step 1 of 5', 'Enter the 6-digit code', `We sent a code to ${contactLabel()}. It expires in 10 minutes.`),
          h('div', { class: 'wl-form' },
            boxes, err('otp'),
            h('div', { class: 'wl-quick' },
              h('button', { class: 'btn sm', type: 'button', 'data-k': 'fill-otp', onclick: () => boxes.fill(DEMO.otp), html: `${icon('key')}Fill demo OTP` }),
              countdown(SIM.otpSentAt, resend)),
            h('div', { class: 'wl-actions' }, backBtn('signin'), btn('Verify and continue', { primary: true, key: 'verify', busyLabel: 'Checking code', onclick: verify })),
            h('button', { class: 'wl-linkbtn', type: 'button', style: { justifySelf: 'start' }, onclick: () => go('signin') }, SIM.method === 'mobile' ? 'Wrong number? Change it' : 'Wrong email? Change it')),
        ];
      }

      /* ----- step: age ----- */
      function stepAge() {
        const today = new Date().toISOString().slice(0, 10);
        const out = h('div', { class: 'small', 'aria-live': 'polite' });
        const showAge = () => {
          out.textContent = ''; const a = ageOf(SIM.dob);
          if (a == null || a < 0) return;
          out.append(h('span', { class: 'pill ' + (a < 18 ? 'amber' : 'green') }, `Age ${a}`), ' ',
            h('span', { class: 'muted' }, a < 18 ? 'Under 18: a parent gives consent in the next step.' : '18 or over: no parent consent needed.'));
        };
        const inp = h('input', { class: 'field-input' + (ERR.dob ? ' bad' : ''), id: 'wl-dob', type: 'date', max: today, min: '1940-01-01', value: SIM.dob,
          oninput: (e) => { SIM.dob = e.target.value; e.target.classList.remove('bad'); setErr('dob', ''); showAge(); },
          onkeydown: (e) => { if (e.key === 'Enter') next(); } });
        showAge();
        function next() {
          const a = ageOf(SIM.dob);
          const bad = (m) => { setErr('dob', m); inp.classList.add('bad'); inp.focus(); };
          if (!SIM.dob || a == null) return bad('Enter your date of birth.');
          if (SIM.dob > today) return bad('That date is in the future. Check the year.');
          if (a < MIN_AGE) return bad(`The course is for students aged ${MIN_AGE} and above (10th pass onwards).`);
          if (a > 80) return bad('Please check the year of birth.');
          go(a < 18 ? 'consent' : 'field');
        }
        const quick = (n) => { SIM.dob = isoYearsAgo(n); inp.value = SIM.dob; inp.classList.remove('bad'); setErr('dob', ''); showAge(); };
        return [
          head('Step 2 of 5', 'When were you born?', 'India’s data protection law (the DPDP Act) needs a parent’s consent for anyone under 18.'),
          h('div', { class: 'wl-form' },
            h('label', { class: 'wl-lbl', for: 'wl-dob' }, 'Date of birth', inp), err('dob'), out,
            h('div', { class: 'wl-quick' }, h('span', { class: 'tiny muted' }, 'Demo shortcuts:'),
              h('button', { class: 'btn sm', type: 'button', 'data-k': 'age16', onclick: () => quick(16) }, 'I’m 16'),
              h('button', { class: 'btn sm', type: 'button', 'data-k': 'age19', onclick: () => quick(19) }, 'I’m 19')),
            h('div', { class: 'wl-actions' }, backBtn('signin'), btn('Continue', { primary: true, key: 'age-next', onclick: next }))),
        ];
      }

      /* ----- step: parental consent ----- */
      function stepConsent() {
        const name = h('input', { class: 'field-input' + (ERR.pname ? ' bad' : ''), id: 'wl-pname', autocomplete: 'off', placeholder: 'Parent or guardian full name', value: SIM.parentName, disabled: SIM.parentOtpSentAt ? true : null,
          oninput: (e) => { SIM.parentName = e.target.value; e.target.classList.remove('bad'); setErr('pname', ''); } });
        const mob = h('input', { class: 'field-input' + (ERR.pmob ? ' bad' : ''), id: 'wl-pmob', type: 'tel', inputmode: 'numeric', maxlength: '10', placeholder: '10-digit mobile number', value: SIM.parentMobile, disabled: SIM.parentOtpSentAt ? true : null,
          oninput: (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); e.target.value = v; SIM.parentMobile = v; e.target.classList.remove('bad'); setErr('pmob', ''); } });
        function sendParent() {
          let ok = true;
          if (SIM.parentName.trim().length < 3) { setErr('pname', 'Enter the parent’s full name.'); name.classList.add('bad'); ok = false; }
          if (!validMobile(SIM.parentMobile)) { setErr('pmob', 'Enter a valid 10-digit mobile number for the parent.'); mob.classList.add('bad'); ok = false; }
          else if (SIM.method === 'mobile' && SIM.parentMobile === SIM.mobile) { setErr('pmob', 'Use the parent’s own number, not the student’s.'); mob.classList.add('bad'); ok = false; }
          if (!ok) return;
          busy = 'psend'; draw();
          later(() => { busy = null; SIM.parentOtpSentAt = Date.now(); SIM.parentOtp = ''; c.toast(`Code sent to the parent at ${maskMobile(SIM.parentMobile)}`, 'green'); pendingFocus = false; draw(); const f = simMain.querySelector('.wl-otp input'); if (f) f.focus(); }, 700);
        }
        const parts = [
          head('Step 2b · Parent consent', 'A parent or guardian confirms', 'You are under 18, so a parent or guardian confirms with their own phone. This takes about a minute.'),
          h('div', { class: 'wl-form' },
            h('label', { class: 'wl-lbl', for: 'wl-pname' }, 'Parent or guardian name', name), err('pname'),
            h('label', { class: 'wl-lbl', for: 'wl-pmob' }, 'Parent’s mobile number', h('div', { class: 'wl-phone' }, h('span', {}, '+91'), mob)), err('pmob'),
            !SIM.parentOtpSentAt ? h('div', { class: 'wl-quick' },
              h('button', { class: 'wl-linkbtn', type: 'button', 'data-k': 'demo-parent', onclick: () => { SIM.parentName = DEMO.parentName; SIM.parentMobile = DEMO.parentMobile; name.value = DEMO.parentName; mob.value = DEMO.parentMobile; name.classList.remove('bad'); mob.classList.remove('bad'); setErr('pname', ''); setErr('pmob', ''); } }, 'Use demo parent details')) : null,
            !SIM.parentOtpSentAt ? h('div', { class: 'wl-actions' }, backBtn('age'), btn('Send OTP to parent', { primary: true, key: 'psend', busyLabel: 'Sending code', onclick: sendParent, icon: 'lock' })) : null),
        ];
        if (SIM.parentOtpSentAt && !SIM.parentVerified) {
          let boxes;
          const verifyParent = () => {
            if (SIM.parentOtp.length < 6) { setErr('potp', 'Enter all 6 digits the parent received.'); boxes.classList.add('bad'); return; }
            if (SIM.parentOtp !== DEMO.parentOtp) { setErr('potp', 'That code does not match. Tap “Fill demo OTP” to use the demo code.'); boxes.classList.add('bad'); return; }
            SIM.parentVerified = true; ERR = {}; c.toast('Parent’s number verified', 'green'); draw();
            const cb = simMain.querySelector('.wl-cb input'); if (cb) cb.focus();
          };
          boxes = otpBoxes(() => SIM.parentOtp, (v) => { SIM.parentOtp = v; setErr('potp', ''); }, ERR.potp ? 'bad' : '');
          const resend = () => { SIM.parentOtpSentAt = Date.now(); SIM.parentOtp = ''; ERR = {}; c.toast(`New code sent to ${maskMobile(SIM.parentMobile)}`, 'green'); cleanup(); draw(); };
          parts.push(h('div', { class: 'wl-form' },
            h('div', { class: 'callout small' }, `Code sent to ${SIM.parentName.trim()} at ${maskMobile(SIM.parentMobile)}. Ask them to read it out.`),
            boxes, err('potp'),
            h('div', { class: 'wl-quick' }, h('button', { class: 'btn sm', type: 'button', 'data-k': 'fill-potp', onclick: () => boxes.fill(DEMO.parentOtp), html: `${icon('key')}Fill demo OTP` }), countdown(SIM.parentOtpSentAt, resend)),
            h('div', { class: 'wl-actions' }, backBtn('age'),
              btn('Change parent details', { key: 'pchange', onclick: () => { SIM.parentOtpSentAt = 0; SIM.parentOtp = ''; ERR = {}; cleanup(); draw(); } }),
              btn('Verify parent', { primary: true, key: 'verify', onclick: verifyParent }))));
        }
        if (SIM.parentVerified) {
          parts.push(h('div', { class: 'wl-ok', html: `${icon('check')}Parent verified<span>${c.esc(SIM.parentName.trim())} · ${c.esc(maskMobile(SIM.parentMobile))}</span>` }));
          if (!SIM.consentTs) {
            const items = [
              ['data', true, 'I allow NeuroNetworks AI Ed to use my child’s name, contact details, progress and project work to run the course and the lab.', 'Needed for the course. Data is stored in India and deleted on request after the course ends.'],
              ['exam', true, 'I understand online exams run in browser lockdown mode and record events like tab switches.', 'No webcam or microphone is used.'],
              ['ai', true, 'I allow my child’s questions to the AI tutor to be processed by the lab’s AI service in India.', 'Questions are not used to show ads or build a profile of my child.'],
              ['updates', false, 'Send me a monthly progress update by SMS.', 'Optional. You can turn this off at any time.'],
            ];
            const box = h('div', { class: 'wl-consent', role: 'group', 'aria-label': 'Consent' }, items.map(([k, req, t, sub]) =>
              h('label', { class: 'wl-cb' + (ERR.consent && req && !SIM.consents[k] ? ' bad' : '') },
                h('input', { type: 'checkbox', 'data-c': k, checked: SIM.consents[k] ? true : null, onchange: (e) => { SIM.consents[k] = e.target.checked; e.target.closest('.wl-cb').classList.remove('bad'); if (['data', 'exam', 'ai'].every((x) => SIM.consents[x])) setErr('consent', ''); } }),
                h('span', {}, t, req ? '' : ' ', h('small', {}, (req ? 'Required. ' : '') + sub)))));
            const record = () => {
              if (!['data', 'exam', 'ai'].every((x) => SIM.consents[x])) { ERR.consent = 'Tick the three required boxes to give consent.'; draw(); return; }
              SIM.consentTs = Date.now(); SIM.consentId = 'CN-27A-' + String(4800 + (SIM.consentTs % 199)).padStart(5, '0');
              ERR = {}; c.toast('Consent recorded', 'green'); draw();
            };
            parts.push(h('div', { class: 'wl-form' },
              h('div', { class: 'eyebrow' }, 'Consent under India’s DPDP Act, 2023'), box, err('consent'),
              h('div', { class: 'wl-actions' }, backBtn('age'), btn('Record consent', { primary: true, key: 'record', onclick: record, icon: 'shield' }))));
          } else {
            parts.push(h('div', { class: 'callout stack', style: { gap: '6px', borderLeftColor: 'var(--green)' } },
              h('b', {}, 'Consent recorded'),
              h('div', { class: 'small muted' }, `${stamp(SIM.consentTs)} · Reference ${SIM.consentId}`),
              h('div', { class: 'small muted' }, `Given by ${SIM.parentName.trim()} (${maskMobile(SIM.parentMobile)}) by one-time code. A copy goes to the parent by SMS. Consent can be withdrawn at any time.`)),
              h('div', { class: 'wl-actions' }, backBtn('age'), btn('Continue', { primary: true, key: 'consent-next', onclick: () => go('field') })));
          }
        }
        return parts;
      }

      /* ----- step: career field ----- */
      function stepField() {
        const cards = h('div', { class: 'wl-fields' }, data.fields.map((f) => {
          const about = String(f.about || '').replace(/^A fictional\s*/i, '');
          return h('button', { class: 'wl-fcard', type: 'button', 'data-field': f.id, 'aria-pressed': String(SIM.field === f.id),
            onclick: () => {
              SIM.field = f.id; SIM.fieldLater = false; ERR = {};
              c.toast(`${f.short} picked. The demo now uses ${f.company}.`, 'green');
              if (c.field.id !== f.id) { pendingFocus = 'keep'; c.setField(f.id); } else draw();
            },
            html: `<span class="tick">${icon('check')}</span><b>${c.esc(f.name)}</b><span class="co">${c.esc(f.company)}</span><p>${c.esc(about.charAt(0).toUpperCase() + about.slice(1))}</p>` });
        }));
        const next = () => { if (!SIM.field && !SIM.fieldLater) { setErr('field', 'Pick a field, or choose “Decide by Month 3”.'); return; } go('device'); };
        return [
          head('Step 3 of 5', 'Choose your career field', 'Each field has its own fictional company, datasets and three capstone projects.'),
          h('div', { class: 'note' }, h('b', {}, 'Months 1 to 3 are the same for everyone. '), 'Your field opens in Month 4, and you can change your choice until then.'),
          cards, err('field'),
          h('div', { class: 'wl-actions' }, backBtn(isMinor() ? 'consent' : 'age'),
            h('span', { class: 'sp' }),
            btn('Decide by Month 3', { key: 'later', onclick: () => { SIM.field = null; SIM.fieldLater = true; go('device'); } }),
            btn(SIM.field ? `Continue with ${fieldById(SIM.field).short}` : 'Continue', { primary: true, key: 'field-next', onclick: next })),
        ];
      }

      /* ----- step: device check ----- */
      const DEVICE = [
        ['Browser supported', `${browserName()} works. Chrome, Edge, Firefox and Safari are all supported.`],
        ['Camera not needed', 'Exams use browser lockdown, not a webcam.'],
        ['4 GB RAM is enough', 'Code runs in the cloud workspace, not on your laptop.'],
        ['Internet speed OK', '6.2 Mbps measured. 2 Mbps is enough for lectures and the workspace.'],
        ['Lockdown exams supported', 'Full-screen mode and tab-switch detection work here.'],
      ];
      function stepDevice() {
        const list = h('div', { class: 'wl-dev', 'aria-live': 'polite' });
        const paint = () => {
          list.textContent = '';
          DEVICE.forEach(([t, sub], i) => {
            const st = i < SIM.deviceIdx ? 'pass' : i === SIM.deviceIdx ? 'run' : 'wait';
            list.append(h('div', { class: 'check ' + st },
              h('span', { class: 'ic', html: st === 'pass' ? icon('check') : st === 'run' ? '<span class="spin"></span>' : '' }),
              h('div', {}, h('b', { class: 'small' }, t), h('small', {}, st === 'pass' ? sub : st === 'run' ? 'Checking…' : 'Waiting'))));
          });
        };
        const doneBox = h('div');
        const finish = () => {
          doneBox.textContent = '';
          if (SIM.deviceIdx < DEVICE.length) return;
          doneBox.append(h('div', { class: 'wl-ok', html: `${icon('check')}All ${DEVICE.length} checks passed<span>Your laptop is ready for the lab.</span>` }));
        };
        const actions = h('div', { class: 'wl-actions' });
        const paintActions = () => {
          actions.textContent = '';
          const complete = SIM.deviceIdx >= DEVICE.length;
          actions.append(backBtn('field'), h('span', { class: 'sp' }),
            btn('Run the check again', { key: 'rerun', onclick: () => { cleanup(); SIM.deviceIdx = 0; draw(); } }));
          const nx = btn('Finish sign-up', { primary: true, key: 'device-next', onclick: () => go('done') });
          if (!complete) nx.disabled = true;
          actions.append(nx);
        };
        const run = () => {
          paint(); finish(); paintActions();
          if (SIM.deviceIdx >= DEVICE.length) return;
          later(() => { SIM.deviceIdx += 1; run(); }, reduced() ? 60 : 650);
        };
        run();
        return [head('Step 4 of 5', 'Checking your laptop', 'Most students use a basic laptop. Everything heavy runs in the cloud.'), list, doneBox, actions];
      }

      /* ----- step: done ----- */
      function stepDone() {
        const s = data.demo_student;
        const f = SIM.field ? fieldById(SIM.field) : null;
        const a = ageOf(SIM.dob);
        if (!SIM.notified) {
          SIM.notified = true;
          c.notify(`Welcome to batch ${s.batch}`, 'Your first lecture opens on Monday. Two lectures a week, each with a 20-minute practical.', 'home');
        }
        const rows = [
          `Signed in with ${contactLabel()}`,
          a != null && a < 18 ? `Age ${a} · parent consent recorded (${SIM.consentId || 'pending'})` : `Age ${a} · no parent consent needed`,
          f ? `Career field: ${f.name}, with ${f.company} (opens in Month 4)` : 'Career field: you will choose by the end of Month 3',
          'Laptop ready: browser, speed and lockdown exams checked',
        ];
        return [
          h('div', { class: 'row', style: { gap: '14px', flexWrap: 'nowrap', alignItems: 'center' } },
            h('div', { class: 'wl-done-badge', html: icon('check') }),
            h('div', { style: { minWidth: 0 } }, h('div', { class: 'eyebrow' }, 'Step 5 of 5 · Ready'), h('h3', { tabindex: '-1' }, `Welcome to batch ${s.batch}`))),
          h('div', { class: 'wl-sum' }, rows.map((t) => h('div', { class: 'check pass' }, h('span', { class: 'ic', html: icon('check') }), h('span', {}, t)))),
          h('p', { class: 'small muted' }, `A new account starts at Month 1. The dashboard shows ${s.name}, a student already in Month ${s.month} of this batch.`),
          h('div', { class: 'wl-or' },
            h('b', { class: 'small' }, 'Or log in as one of the 4 demo students'),
            h('div', { class: 'wl-quick' }, (c.students || []).slice().sort((x, y) => x.month - y.month).map((st) =>
              h('button', { class: 'btn sm' + (st.id === s.id ? ' cur' : ''), type: 'button', 'data-k': 'login-' + st.id, onclick: () => loginOpener && loginOpener(st) },
                `${st.name.split(' ')[0]} · Month ${st.month}`)))),
          h('div', { class: 'wl-actions' },
            btn(`Go to ${s.name.split(' ')[0]}’s dashboard`, { primary: true, key: 'dash', icon: 'home', onclick: () => c.go('home') }),
            btn('Start the tour', { key: 'tour2', icon: 'play', onclick: () => startTour(c) }),
            h('span', { class: 'sp' }),
            btn('Restart sign-up', { key: 'restart', onclick: () => { SIM = blank(); ERR = {}; go('signin'); } })),
        ];
      }

      function draw() {
        drawSteps();
        simMain.textContent = '';
        const fn = { signin: stepSignin, otp: stepOtp, age: stepAge, consent: stepConsent, field: stepField, device: stepDevice, done: stepDone }[SIM.step] || stepSignin;
        simMain.append(...fn().filter(Boolean));
        if (pendingFocus === 'keep') { pendingFocus = false; requestAnimationFrame(() => scrollToSim(false)); const b = simMain.querySelector(`[data-field="${SIM.field}"]`); if (b) b.focus({ preventScroll: true }); }
        else if (pendingFocus) {
          pendingFocus = false; const s = simAnchor();
          if (s && s.getBoundingClientRect().top < 60) scrollToSim(true);
          const t = (simMain.querySelector('input:not([type=checkbox]):not([disabled])') || simMain.querySelector('h3')); if (t) t.focus({ preventScroll: true });
        }
      }
      draw();
    },

    destroy() { cleanup(); },
  });
})();
