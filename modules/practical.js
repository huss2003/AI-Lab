/* Practical lab: the 20-minute practical inside a browser cloud workspace.
   Task panel, code editor with starter files, terminal, AI tutor (hint ladder + scripted answers),
   visible checks in the workspace and hidden checks in a grader on Submit. All scripted with mock data. */
(function () {
  const PIDS = ['33', '43', '51', '57', '65', '90'];
  const LIMIT_S = 20 * 60;
  const SESS = {};          // `${fieldId}:${pid}` -> session (survives re-render and field switching)
  const SEL = {};           // fieldId -> selected practical id
  let live = null;          // timers and listeners of the mounted view

  /* ---------------- small helpers ---------------- */
  const base = (p) => p.replace(/\/$/, '').split('/').pop();
  const dir = (p) => { const i = p.replace(/\/$/, '').lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); };
  const isDir = (p) => /\/$/.test(p);
  const snake = (s) => s.replace(/[{}]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  const pascal = (s) => snake(s).split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  const singular = (w) => w.replace(/ies$/, 'y').replace(/sses$/, 'ss').replace(/([^s])s$/, '$1');
  const slugOf = (company) => company.toLowerCase().replace(/\(.*?\)/g, '').replace(/\b(pvt|ltd|technologies|services|general)\b/g, '').trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
  const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const stripComments = (s) => s.split('\n').filter((l) => !/^\s*(#|\/\/)/.test(l) && !/"_todo"/.test(l)).join('\n');
  function splitTop(s) {
    const out = []; let depth = 0, cur = '';
    for (const ch of s) {
      if ('[({'.includes(ch)) depth++; if ('])}'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function uniq(arr) { return arr.filter((x, i) => arr.indexOf(x) === i); }

  /* ---------------- syntax colouring ---------------- */
  const KW = {
    py: 'from import def return class if elif else for in not and or is None True False async await with as try except raise pass lambda yield while',
    ts: 'export const let var async await return if else function new typeof true false null undefined import from interface type for of',
    docker: 'FROM RUN COPY WORKDIR USER EXPOSE CMD ENV ARG ENTRYPOINT HEALTHCHECK ADD LABEL AS',
    sh: 'for do done in if then fi echo curl while read set source export',
    caddy: 'handle handle_path reverse_proxy respond header rewrite route not',
    json: 'true false null', yaml: 'true false null', http: 'POST GET PUT DELETE HTTP', env: '', md: '', txt: '', data: 'true false null',
  };
  const KWS = Object.fromEntries(Object.entries(KW).map(([k, v]) => [k, new Set(v.split(' ').filter(Boolean))]));
  function langOf(path) {
    const b = base(path);
    if (/dockerfile/i.test(b)) return 'docker';
    if (/caddyfile/i.test(b)) return 'caddy';
    const e = (b.split('.').pop() || '').toLowerCase();
    return { py: 'py', ts: 'ts', js: 'ts', json: 'json', jsonl: 'data', sh: 'sh', yml: 'yaml', yaml: 'yaml', http: 'http', md: 'md', env: 'env', example: 'env', csv: 'data', txt: 'txt', dockerignore: 'txt' }[e] || 'txt';
  }
  function highlight(src, lang, esc) {
    const slashC = lang === 'ts';
    const re = slashC
      ? /(\/\/.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`[^`]*`?)|(\b\d+(?:\.\d+)?\b)|(@?[A-Za-z_][\w]*)/g
      : /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|(@?[A-Za-z_][\w]*)/g;
    const kws = KWS[lang] || new Set();
    const hashIsComment = !['json', 'ts'].includes(lang);
    return src.split('\n').map((line) => {
      let out = '', last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(line))) {
        out += esc(line.slice(last, m.index));
        const t = m[0];
        if (m[1] && (slashC || hashIsComment)) out += `<span class="c">${esc(t).replace(/TODO/g, '<span class="todo">TODO</span>')}</span>`;
        else if (m[1]) out += esc(t);
        else if (m[2]) out += `<span class="s">${esc(t).replace(/TODO/g, '<span class="todo">TODO</span>')}</span>`;
        else if (m[3]) out += `<span class="n">${t}</span>`;
        else if (m[4]) {
          if (t[0] === '@' || kws.has(t)) out += `<span class="k">${esc(t)}</span>`;
          else if (/^[A-Z][a-z]\w*$/.test(t) && lang !== 'docker') out += `<span class="t">${esc(t)}</span>`;
          else out += esc(t);
        }
        last = m.index + t.length;
        if (t.length === 0) re.lastIndex++;
      }
      return out + esc(line.slice(last));
    }).join('\n');
  }

  /* ---------------- field model parsing (practical 33) ---------------- */
  const ENUMS = {
    claim_type: ['motor', 'health', 'property', 'travel'], primary_metric: ['conversion_rate', 'avg_order_value', 'retention_d7'],
    resource_type: ['vm', 'bucket', 'database', 'k8s_namespace'], region: ['ap-mumbai-1', 'ap-hyderabad-1'], unit: ['count', 'inr', 'percent', 'minutes'],
    severity: ['low', 'medium', 'high', 'critical'],
  };
  const SAMPLE = {
    title: 'Add UPI autopay to checkout', description: 'Customers asked for a monthly autopay option on the subscription page.', name: 'search-api',
    owner_team: 'platform', repo_path: 'services/search-api', incident_city: 'Pune', reason: 'Compensating control in place until the vendor patch ships.',
    definition: 'Orders delivered on time divided by all delivered orders', author: 'writer-07', slug: 'rajmachi-night-trek', trek_slug: 'rajmachi-night-trek',
  };
  function parseField(piece) {
    piece = piece.trim().replace(/^and\s+/, '');
    if (/^EmailStr$/.test(piece)) return { name: 'email', base: 'str', fix: 'EmailStr', email: true, sample: null };
    const mm = piece.match(/^([a-z_][a-z0-9_]*)\b\s*(.*)$/);
    if (!mm) return null;
    const name = mm[1], rest = mm[2];
    const f = { name, base: 'str', fix: 'str', rule: rest };
    let r;
    if ((r = rest.match(/Literal\[([^\]]+)\]/))) { const vals = r[1].split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, '')); Object.assign(f, { fix: `Literal[${vals.map((v) => JSON.stringify(v)).join(', ')}]`, vals }); }
    else if (/EmailStr/.test(rest) || /email/.test(name)) Object.assign(f, { fix: 'EmailStr', email: true });
    else if ((r = rest.match(/\b(\d+)\s*-\s*(\d+)\s*chars?/))) Object.assign(f, { fix: `str = Field(min_length=${r[1]}, max_length=${r[2]})`, minLen: +r[1], maxLen: +r[2] });
    else if ((r = rest.match(/\b([A-Z])(\d)\s*-\s*\1(\d)\b/))) { const vals = []; for (let i = +r[2]; i <= +r[3]; i++) vals.push(r[1] + i); Object.assign(f, { fix: `Literal[${vals.map((v) => JSON.stringify(v)).join(', ')}]`, vals }); }
    else if ((r = rest.match(/(-?\d+)\s*-\s*(\d+)/))) Object.assign(f, { base: 'int', fix: `int = Field(ge=${r[1]}, le=${r[2]})`, lo: +r[1], hi: +r[2] });
    else if ((r = rest.match(/\b([a-z]+(?:\|[a-z]+)+)\b/))) { const vals = r[1].split('|'); Object.assign(f, { fix: `Literal[${vals.map((v) => JSON.stringify(v)).join(', ')}]`, vals }); }
    else if (/list of/.test(rest)) { const t = rest.match(/([A-Z]+-[#N]+)/); Object.assign(f, { base: 'list[str]', fix: 'list[str] = Field(min_length=1)', token: t && t[1] }); }
    else if (/>=\s*0/.test(rest)) Object.assign(f, { base: 'float', fix: 'float = Field(ge=0)', lo: 0 });
    else if (/positive/.test(rest)) Object.assign(f, { base: 'int', fix: 'int = Field(gt=0)', lo: 1 });
    else if (/summing to 100/.test(rest)) Object.assign(f, { base: 'dict[str, int]', fix: 'dict[str, int]', sum100: true });
    else if (/date|after|before|future/.test(rest) || /_date$/.test(name)) Object.assign(f, { base: 'date', fix: 'date', date: true, future: /in the future/.test(rest), past: /not in future|not in the future/.test(rest) });
    else if (/pattern/.test(rest) || /^[A-Z]+-[#N]+$/.test(rest.trim())) {
      const t = rest.match(/([A-Z]+-[#N]+)/);
      const pat = t ? '^' + t[1].replace(/[#N]+/g, (x) => `\\d{${x.length}}`) + '$' : '^[A-Z]{2,4}[-/][A-Z0-9/-]{2,20}$';
      Object.assign(f, { fix: `str = Field(pattern=r"${pat}")`, pat, token: t && t[1] });
    }
    else if (/enum/.test(rest)) { const vals = ENUMS[name] || ['standard', 'priority']; Object.assign(f, { fix: `Literal[${vals.map((v) => JSON.stringify(v)).join(', ')}]`, vals }); }
    else if (/slug/.test(rest) || name === 'slug') Object.assign(f, { fix: 'str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")', pat: 'slug' });
    else if (/must exist/.test(rest)) Object.assign(f, { exists: true });
    else if (/\bint\b|integer/.test(rest)) Object.assign(f, { base: 'int', fix: 'int' });
    return f;
  }
  function sampleOf(f, slug) {
    if (f.email) return `dev@${slug}.example`;
    if (f.vals) return f.vals[0];
    if (f.hi != null) return Math.min(f.hi, Math.max(f.lo, Math.round((f.lo + f.hi) / 5) || f.lo));
    if (f.lo != null) return f.base === 'float' ? 3.5 : 25000;
    if (f.sum100) return { control: 50, treatment: 50 };
    if (f.base === 'list[str]') return [f.token ? f.token.replace(/[#N]+/g, (x) => '104'.slice(0, x.length).padStart(x.length, '0')) : 'item-1'];
    if (f.date) return f.past ? '2026-10-28' : /start/.test(f.name) ? '2026-11-16' : '2026-11-30';
    if (f.token) return f.token.replace(/[#N]+/g, (x) => '014'.slice(-x.length).padStart(x.length, '0'));
    if (f.pat === 'slug') return SAMPLE[f.name] || 'search-api';
    if (f.pat) return f.name === 'policy_no' ? 'NSGI/MOT/2025/000417' : f.name === 'id' ? 'EXP-01' : 'ABC-0001';
    if (f.base === 'int') return 1;
    if (SAMPLE[f.name]) return SAMPLE[f.name];
    return f.name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) + ' (sample)';
  }
  function badOf(f) {
    if (f.hi != null) return f.hi * 100;
    if (f.lo != null) return f.base === 'float' ? -1 : 0;
    if (f.vals) return 'not_a_valid_' + (f.name === 'environment' ? 'env' : 'value');
    if (f.email) return 'not-an-email';
    if (f.minLen) return 'abc'.slice(0, Math.max(1, f.minLen - 2));
    if (f.pat) return 'bad id';
    return '';
  }

  /* ---------------- generic files ---------------- */
  function genericFile(path, desc, S) {
    const b = base(path), lang = langOf(path);
    if (b === 'requirements.txt') return ['fastapi==0.115.6', 'uvicorn[standard]==0.32.1', 'pydantic==2.10.3', 'email-validator==2.2.0', 'httpx==0.28.1', ''].join('\n');
    if (b === '.dockerignore') return ['.env', '.git', '__pycache__/', '*.pyc', '.venv/', 'data/dumps/', 'logs/', ''].join('\n');
    if (/dockerfile\.(broken|flawed)/i.test(b)) return [`# Reference only: ${desc}.`, '# Find the problems in this file and list them in your review.', 'FROM python:latest', '', 'COPY . /app', 'WORKDIR /app', 'ENV API_SECRET=sk-demo-123456', 'RUN pip install -r requirements.txt', '', 'CMD ["python", "main.py"]', ''].join('\n');
    if (lang === 'py' && S.pid === '43') return [`"""${S.company} · ${desc}."""`, 'from fastapi import FastAPI', '', `app = FastAPI(title="${S.company}")`, '', '', '@app.get("/health")', 'def health():', '    return {"status": "ok"}', ''].join('\n');
    if (lang === 'py') return [`"""${S.company} · ${desc}."""`, 'import json', '', 'import requests', '', `URL = "http://localhost:8088${S.hook || ''}"`, '', '', 'def main() -> None:', '    rows = [json.loads(line) for line in open("data/sample.jsonl", encoding="utf-8")]', '    for row in rows:', '        r = requests.post(URL, json=row, timeout=10)', '        print(r.status_code, r.text[:80])', '', '', 'if __name__ == "__main__":', '    main()', ''].join('\n');
    if (lang === 'ts') return ['// Activepieces Code step', `// ${desc}`, 'export const code = async (inputs: { body: Record<string, unknown> }) => {', '  const body = inputs.body ?? {};', '  return { status: 200, body: { ok: true, keys: Object.keys(body) } };', '};', ''].join('\n');
    if (lang === 'yaml') return [`# ${desc}`, 'services:', '  target:', '    image: neuromind/lab-target:2026.10', '    network_mode: "none"', '    ports: ["127.0.0.1:7070:7070"]', ''].join('\n');
    if (lang === 'md') return ['# Prompt-injection test report', '', '| Case | Prompt | Result | Evidence | OWASP ID |', '|------|--------|--------|----------|----------|', '|      |        |        |          |          |', ''].join('\n');
    if (lang === 'env') return ['# Copy to .env in your workspace. Never commit real secrets.', 'LAB_TOKEN=change-me', 'HOOK_URL=', ''].join('\n');
    if (lang === 'http') return [`# ${desc}`, `POST http://localhost:8088${S.hook || '/hooks/intake'}`, 'Content-Type: application/json', '', '{ "sample": true }', ''].join('\n');
    if (lang === 'json') return JSON.stringify({ displayName: base(path).replace(/\.json$/, ''), note: desc, version: 1 }, null, 2) + '\n';
    if (lang === 'caddy') return ['# Lab gateway in front of Activepieces', ':8088 {', `\thandle ${S.hook || '/hooks/*'} {`, `\t\trewrite * /api/v1/webhooks/{$${S.hookEnv || 'HOOK_ID'}}/sync`, '\t\treverse_proxy activepieces:80', '\t}', '}', ''].join('\n');
    if (lang === 'sh') return ['#!/usr/bin/env bash', `# ${desc}`, 'set -euo pipefail', 'echo "done"', ''].join('\n');
    return `# ${desc}\n`;
  }
  function dataPreview(entry, S) {
    const ds = S.datasets.find((d) => d.id === entry.dataset);
    const head = [`# Read-only preview · ${entry.dataset ? 'dataset ' + entry.dataset : 'lab fixture'}`, ds ? `# ${ds.title} · ${ds.format} · ${ds.size}` : `# ${entry.desc}`, `# Mounted read-only at /data/${entry.path} in your workspace`, ''];
    const b = base(entry.path);
    let body;
    if (isDir(entry.path)) body = ['index.html', 'about.html', 'contact.html', 'assets/', 'README.md'].map((x) => `${entry.path}${x}`);
    else if (S.pid === '33' && /\.json$/.test(b) && S.fields) {
      const valid = Object.fromEntries(S.fields.map((f) => [f.name, f.sample || sampleOf(f, S.slug)]));
      const bad = Object.assign({}, valid, S.gapField ? { [S.gapField.name]: badOf(S.gapField) } : {});
      body = JSON.stringify([valid, bad], null, 2).split('\n');
    } else if (/\.csv$/.test(b)) body = S.csvRows || ['id,title,status,updated_at', `1,${entry.desc.slice(0, 40)},open,2026-10-02`, '2,Sample row two,closed,2026-10-04', '3,Sample row three,open,2026-10-09', '...'];
    else if (/\.jsonl$/.test(b)) body = [0, 1, 2].map((i) => JSON.stringify({ id: `${S.prefix}-${String(i + 1).padStart(3, '0')}`, text: `${entry.desc} (record ${i + 1})` })).concat(['...']);
    else if (/\.ya?ml$/.test(b)) body = ['version: "2026"', 'items:', `  - name: sample-1`, `    note: ${entry.desc}`, '  - name: sample-2', '...'];
    else if (/\.pdf$/.test(b)) body = ['(PDF document, shown in the file viewer)'];
    else if (/\.log$/.test(b)) body = ['2026-10-14T09:12:03Z INFO request accepted', '2026-10-14T09:12:04Z WARN retry 1/3', '...'];
    else body = [entry.desc];
    return head.concat(body).join('\n') + '\n';
  }

  /* ---------------- spec builders, one per practical type ---------------- */
  function b33(S, p) {
    const text = p.task + ' ' + p.checks.join(' ');
    const routes = [];
    for (const m of text.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w\-/{}]+)/g)) { const path = m[2].replace(/[.,;)]+$/, ''); if (!routes.some((r) => r.m === m[1] && r.path === path)) routes.push({ m: m[1], path }); }
    let post = routes.find((r) => r.m === 'POST'), get = routes.find((r) => r.m === 'GET');
    if (!post) post = { m: 'POST', path: get ? get.path : '/items' };
    if (!get) get = { m: 'GET', path: post.path.replace(/\/\{[^}]+\}.*$/, '') };
    const getSeg = get.path.split('/').filter((x) => x && !x.startsWith('{')).pop() || 'items';
    const postSeg = post.path.split('/').filter((x) => x && !x.startsWith('{')).pop() || getSeg;
    const store = snake(getSeg).toUpperCase();
    const postStore = snake(postSeg).toUpperCase();
    let model = (p.task.match(/Pydantic\s+([A-Z]\w+)\s+model/) || p.task.match(/\b([A-Z]\w+)\s+Pydantic model/) || p.task.match(/Pydantic model\s+([A-Z]\w+)/) || [])[1];
    if (!model) model = pascal(singular(postSeg)) + 'In';
    let fields = [];
    const fm = p.task.match(new RegExp(model + '\\s+(?:Pydantic\\s+)?(?:model\\s*)?\\(([^()]*(?:\\([^()]*\\)[^()]*)*)\\)'));
    if (fm) fields = splitTop(fm[1]).flatMap((x) => { const r = x.match(/^(\w+) and (\w+) as Literals?$/); if (r) return [r[1] + ' enum', r[2] + ' enum']; return [x.replace(/^slug (\w+)$/, '$1 slug')]; }).map(parseField).filter(Boolean);
    for (const m of p.checks.join(' ').matchAll(/\bwith (?:a |an )?([a-z_]+) '([^']+)'/g)) if (!fields.some((f) => f.name === m[1])) { const vals = ENUMS[m[1]]; fields.push(vals ? { name: m[1], base: 'str', fix: `Literal[${vals.map((v) => JSON.stringify(v)).join(', ')}]`, vals } : { name: m[1], base: 'str', fix: 'str' }); }
    for (const m of p.checks.join(' ').matchAll(/'([a-z]+_date)'/g)) if (!fields.some((f) => f.name === m[1])) fields.push({ name: m[1], base: 'date', fix: 'date', date: true, future: true });
    if (fields.length < 3) {
      const extra = /metric/i.test(model)
        ? [{ name: 'name', base: 'str', fix: 'str = Field(pattern=r"^[a-z][a-z0-9_]{2,40}$")', pat: 'snake' }, { name: 'definition', base: 'str', fix: 'str = Field(min_length=10)', minLen: 10 }, { name: 'owner_email', base: 'str', fix: 'EmailStr', email: true }]
        : [{ name: 'reason', base: 'str', fix: 'str = Field(min_length=20, max_length=500)', minLen: 20, maxLen: 500 }, { name: 'approved_by', base: 'str', fix: 'EmailStr', email: true }];
      fields = extra.filter((e) => !fields.some((f) => f.name === e.name)).concat(fields);
    }
    fields.forEach((f) => { if (f.name === 'name' && f.pat === 'snake') f.sample = 'on_time_delivery_rate'; });
    // A pattern with no example in the task: learn its shape from an example id in the checks (e.g. EXP-01, NSGI/MOT/2025/000417).
    const ex = (p.checks.join(' ').match(/'([A-Z]{2,6}[-/][A-Z0-9/-]{2,})'/) || p.checks.join(' ').match(/\b([A-Z]{2,5}-\d{2,})\b/) || [])[1];
    fields.forEach((f) => {
      if (f.pat && !f.token && f.pat !== 'slug' && f.pat !== 'snake' && ex) {
        const parts = ex.split(/([-/])/);
        const pat = '^' + parts.map((x, i) => /[-/]/.test(x) ? x : /^\d+$/.test(x) ? `\\d{${x.length}}` : i === 0 ? x : `[A-Z]{${x.length}}`).join('') + '$';
        Object.assign(f, { pat, fix: `str = Field(pattern=r"${pat}")`, sample: ex });
      }
    });
    const gapField = fields.find((f) => f.hi != null) || fields.find((f) => f.vals) || fields.find((f) => f.pat) || fields.find((f) => f.email) || fields[0];
    const idKey = (p.checks.join(' ').match(/\b([a-z]+_id)\b/) || [])[1] || 'id';
    const status = (p.checks.join(' ').match(/status (?:==\s*)?'(\w+)'/) || [])[1];
    const intId = /integer '?id'?/.test(p.checks.join(' '));
    const seeded = /seeded|loaded|from \w+\.(json|yaml)|from JSON/i.test(p.task);
    const dataEntry = p.starter.find((s) => s.kind === 'data');
    const filterBy = (p.task.match(/filter by ([a-z_]+)(?: and ([a-z_]+))?/) || []).slice(1).filter(Boolean);
    const codeEntries = p.starter.filter((s) => s.kind === 'code_stub' && /\.py$/.test(s.path));
    const mainEntry = codeEntries.find((s) => /main\.py$/.test(s.path)) || codeEntries[0] || { path: 'api/main.py', desc: 'FastAPI app', kind: 'code_stub' };
    const modelsEntry = codeEntries.find((s) => /models\.py$/.test(s.path));
    const usesDate = fields.some((f) => f.date);
    const validators = fields.filter((f) => f.future || f.past || f.sum100);
    const dataYaml = dataEntry && /\.ya?ml$/.test(dataEntry.path);

    function modelCode(fixed) {
      // The starter already has every rule except the one for gapField: exactly one check fails until the student adds it.
      const typeOf = (f) => (fixed || f !== gapField ? f.fix : f.base);
      const used = fields.map(typeOf);
      const std = [];
      if (usesDate) std.push('from datetime import date');
      if (used.some((t) => /Literal\[/.test(t))) std.push('from typing import Literal');
      const pyd = ['BaseModel', used.includes('EmailStr') && 'EmailStr', used.some((t) => /Field\(/.test(t)) && 'Field', validators.length && 'field_validator'].filter(Boolean);
      const pydLine = `from pydantic import ${pyd.join(', ')}`;
      const imp = std.length ? std.concat(['', pydLine]) : [pydLine];
      const body = [];
      fields.forEach((f) => {
        if (!fixed && f === gapField) body.push(`    # TODO: add the rule for ${f.name} from the task.`, `    #       Right now any ${f.base} is accepted.`);
        body.push(`    ${f.name}: ${typeOf(f)}`);
      });
      validators.forEach((f) => {
        const t = f.sum100 ? 'dict[str, int]' : 'date';
        body.push('', `    @field_validator("${f.name}")`, '    @classmethod', `    def check_${f.name}(cls, v: ${t}) -> ${t}:`,
          f.sum100 ? '        if sum(v.values()) != 100:' : f.future ? '        if v <= date.today():' : '        if v > date.today():',
          `            raise ValueError("${f.name} must ${f.sum100 ? 'add up to 100' : f.future ? 'be in the future' : 'not be in the future'}")`, '        return v');
      });
      return { imp, std, pydLine, cls: [`class ${model}(BaseModel):`, ...body] };
    }
    const pathParam = (post.path.match(/\{(\w+)\}/) || [])[1];
    const fnPost = (post.m.toLowerCase() === 'post' ? 'create_' : 'update_') + snake(singular(postSeg));
    const fnGet = 'list_' + snake(getSeg);
    const idPrefix = postSeg.split(/[-_]/).map((w) => w[0]).join('').toUpperCase();
    const dataRel = dataEntry ? dataEntry.path.replace(dir(mainEntry.path).replace(/app\/$/, ''), '') : '';
    function mainCode(fixed, withModel) {
      const lines = [`"""${S.company} · Practical 33: ${p.topic}."""`];
      const mc = withModel ? modelCode(fixed) : null;
      const std = [];
      if (seeded && dataEntry && !dataYaml) std.push('import json');
      if (mc) std.push(...mc.std);
      std.push('from uuid import uuid4');
      lines.push(...std, '');
      if (seeded && dataYaml) lines.push('import yaml');
      lines.push(`from fastapi import FastAPI, HTTPException${filterBy.length ? ', Query' : ''}, status`);
      if (mc) lines.push(mc.pydLine);
      else lines.push(`from ${/\/app\/$/.test(dir(mainEntry.path)) ? 'app.models' : 'models'} import ${model}`);
      lines.push('', `app = FastAPI(title="${S.company} · ${pascal(getSeg).replace(/([a-z])([A-Z])/g, '$1 $2')} API")`, '');
      if (seeded && dataEntry) lines.push(`# Loaded once at startup from the lab dataset (read-only copy in your workspace)`, `${store}: list[dict] = ${dataYaml ? 'yaml.safe_load' : 'json.load'}(open("${dataRel || dataEntry.path}", encoding="utf-8"))`);
      else lines.push(`${store}: list[dict] = []   # in-memory store: empties when the app restarts`);
      if (postStore !== store) lines.push(`${postStore}: list[dict] = []`);
      lines.push('', '');
      if (withModel) { lines.push(...mc.cls, '', ''); }
      if (pathParam) {
        lines.push(`@app.post("${post.path}", status_code=status.HTTP_201_CREATED)`, `def ${fnPost}(${pathParam}: str, body: ${model}):`,
          `    if not any(str(x.get("id")) == ${pathParam} for x in ${store}):`, `        raise HTTPException(status_code=404, detail="${singular(getSeg).replace(/-/g, ' ')} not found")`,
          `    record = {"${idKey}": f"${idPrefix}-{uuid4().hex[:6]}", "${singular(snake(getSeg))}_id": ${pathParam}, **body.model_dump(mode="json")}`,
          `    ${postStore}.append(record)`, '    return record', '', '');
      } else {
        const ex = fields.find((f) => f.exists);
        lines.push(`@app.post("${post.path}", status_code=status.HTTP_201_CREATED)`, `def ${fnPost}(body: ${model}):`,
          ...(ex ? [`    if body.${ex.name} not in {row.get("slug") for row in ${store}}:`, `        raise HTTPException(status_code=422, detail="${ex.name} does not match a known ${singular(getSeg).replace(/-/g, ' ')}")`] : []),
          `    record = {"${idKey}": ${intId ? `len(${postStore}) + 1` : `f"${idPrefix}-{uuid4().hex[:6]}"`}, **body.model_dump(mode="json")${status ? `, "status": "${status}"` : ''}}`,
          `    ${postStore}.append(record)`, '    return record', '', '');
      }
      if (filterBy.length) {
        lines.push(`@app.get("${get.path}")`, `def ${fnGet}(${filterBy.map((q) => `${q}: str | None = Query(default=None)`).join(', ')}):`, `    rows = ${store}`);
        filterBy.forEach((q) => lines.push(`    if ${q}:`, `        rows = [r for r in rows if r.get("${q}") == ${q}]`));
        lines.push('    return rows', '');
      } else lines.push(`@app.get("${get.path}")`, `def ${fnGet}():`, `    return ${store}`, '');
      return lines.join('\n');
    }
    const files = []; const fixed = {};
    let gapPath;
    if (modelsEntry) {
      const mc0 = modelCode(false), mc1 = modelCode(true);
      files.push({ path: mainEntry.path, desc: mainEntry.desc, content: mainCode(true, false) });
      files.push({ path: modelsEntry.path, desc: modelsEntry.desc, content: [`"""Request models for the ${S.company} API."""`, ...mc0.imp, '', '', ...mc0.cls, ''].join('\n') });
      fixed[modelsEntry.path] = [`"""Request models for the ${S.company} API."""`, ...mc1.imp, '', '', ...mc1.cls, ''].join('\n');
      gapPath = modelsEntry.path;
    } else {
      files.push({ path: mainEntry.path, desc: mainEntry.desc, content: mainCode(false, true) });
      fixed[mainEntry.path] = mainCode(true, true);
      gapPath = mainEntry.path;
    }
    const bad = badOf(gapField);
    const validBody = Object.fromEntries(fields.map((f) => [f.name, f.sample || sampleOf(f, S.slug)]));
    Object.assign(S, { fields, gapField, routes: { post, get }, model, idKey, status, validBody, store });
    const starterType = gapField.base;
    return {
      files, fixed, gapPath,
      fixTest: (c) => { const m = stripComments(c).match(new RegExp('^\\s*' + gapField.name + '\\s*:\\s*(.+)$', 'm')); return !!m && m[1].trim() !== gapField.base; },
      hiddenFail: p.checks.some((t) => /422/.test(t) && t.includes(gapField.name)) ? new RegExp(gapField.name) : /422/,
      visible: [
        { text: `${base(mainEntry.path)} imports without errors` },
        { text: 'App starts: uvicorn serves on port 8000' },
        { text: `GET ${get.path} returns 200 and a list` },
        { text: `POST ${post.path} rejects ${gapField.name} = ${JSON.stringify(bad)} with 422`, gap: true,
          err: [`sent    {"${gapField.name}": ${JSON.stringify(bad)}, ...}`, 'expected 422 Unprocessable Entity, got 201 Created', `The ${model} model accepted a value the task does not allow.`],
          okNote: `422 · detail[0].loc = ["body", "${gapField.name}"]` },
      ],
      hints: [
        `Look at the failing check. POST ${post.path} accepted ${gapField.name} = ${JSON.stringify(bad)}. Which part of a FastAPI app decides whether a request body is valid?`,
        `FastAPI checks the body against your ${model} model before your function runs. The model only says "${gapField.name}: ${starterType}", so any ${starterType} gets in. Put the rule from the task on the model itself, not in the route.`,
        [`Find ${gapField.name} in the task text and read its rule.`, 'Decide which kind of rule it is: a range, a fixed list of allowed values, a pattern or an email.', `Write that rule on the ${gapField.name} line of ${model}. The other fields already show the style. Add any import it needs.`, 'Leave the route code as it is and run checks again. FastAPI now answers 422 by itself and names the field in "loc".'],
      ],
      answers: [
        [/422|unprocessable|valid/i, `422 means "the request reached the API but the body breaks a rule". FastAPI sends it automatically when the body does not fit your Pydantic model. If an invalid ${gapField.name} gets 201, the model has no rule for it yet.`],
        [/201|status code|created/i, `201 Created is right for a valid POST, and the route already sets it with status_code. The missing piece is refusing invalid bodies, which the model does for you.`],
        [/literal|enum|allowed|choice/i, 'For a fixed list of allowed values, Pydantic accepts typing.Literal with the values inside the square brackets. Anything else gets a 422 that lists the allowed values.'],
        [/field\(|range|min|max|ge\b|le\b|limit/i, 'Pydantic\'s Field lets you attach limits to a single field: greater-or-equal, less-or-equal, minimum and maximum length, or a regex pattern. The task text tells you which one each field needs.'],
        [/email/i, 'Pydantic has a ready-made email type, EmailStr. It needs the email-validator package, which is already in your workspace.'],
        [/memory|database|store|restart/i, `The in-memory list ${store} empties whenever the app restarts. That is fine here: this practical is about the endpoint and validation. A later capstone milestone moves it into a database.`],
        [/preview|port|browser|see/i, 'When all visible checks pass, open the Preview tab next to Terminal. It shows what the API on port 8000 sends back.'],
      ],
    };
  }

  function b43(S, p) {
    const codes = p.starter.filter((s) => s.kind !== 'data' && s.kind !== 'fixture');
    const dockerEntry = codes.find((s) => /dockerfile/i.test(base(s.path)) && !/broken|flawed/i.test(s.path) && !isDir(s.path));
    const svcEntry = codes.find((s) => !/dockerfile|requirements|dockerignore/i.test(s.path));
    const svcDir = svcEntry ? (isDir(svcEntry.path) ? svcEntry.path : dir(svcEntry.path).replace(/app\/$/, '')) : '';
    const gapPath = dockerEntry ? dockerEntry.path : (svcDir || dir(codes[0] ? codes[0].path : '')) + 'Dockerfile';
    const app = ((p.task.match(/^Fix ([\w-]+)'s/) || [])[1] || (p.task.match(/for (?:the |your )?(.+?)(?::|,| using| \(|$)/) || [])[1] || 'the service').replace(/^the /, '');
    let mod = 'main:app';
    const py = p.starter.find((s) => /\.py$/.test(s.path));
    if (py) { const rel = py.path.replace(svcDir, '').replace(/\.py$/, '').replace(/\//g, '.'); mod = `${rel}:app`; }
    const health = /HEALTHCHECK/i.test(p.task) || /health/i.test(p.expected);
    const mk = (fixed) => [
      `# Dockerfile for ${app}`,
      'FROM python:3.12-slim', '',
      'ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1',
      'WORKDIR /app', '',
      '# Install dependencies first so this layer is cached between builds',
      'COPY requirements.txt .',
      'RUN pip install --no-cache-dir -r requirements.txt', '',
      'COPY . .', '',
      ...(fixed ? ['# Run as a normal user, never as root', 'RUN useradd --create-home --uid 10001 appuser', 'USER appuser'] : ['# TODO: create a user without admin rights and switch to it.', '#       Right now everything after this line runs as root.']),
      '',
      'EXPOSE 8000',
      ...(health ? ['HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen(\'http://localhost:8000/health\')"'] : []),
      `CMD ["uvicorn", "${mod}", "--host", "0.0.0.0", "--port", "8000"]`, ''].join('\n');
    const files = [];
    p.starter.forEach((s) => { if (s.kind === 'data' || s.kind === 'fixture' || isDir(s.path)) return; if (s.path === gapPath) return; files.push({ path: s.path, desc: s.desc, content: genericFile(s.path, s.desc, S) }); });
    files.unshift({ path: gapPath, desc: dockerEntry ? dockerEntry.desc : 'Your Dockerfile (new file)', content: mk(false), isNew: !dockerEntry });
    if (!p.starter.some((s) => /\.dockerignore$/.test(s.path))) files.push({ path: (svcDir || dir(gapPath)) + '.dockerignore', desc: 'Keeps secrets and junk out of the image (new file)', content: genericFile('.dockerignore', '', S), isNew: true });
    const fixed = { [gapPath]: mk(true) };
    return {
      files, fixed, gapPath,
      fixTest: (c) => /^\s*USER\s+(?!root\b|0\b)\S+/m.test(stripComments(c)),
      hiddenFail: /root|id -u|UID|USER|non-root/i,
      visible: [
        { text: 'docker build exits 0' },
        { text: 'Base image is pinned and slim (python:3.12-slim)' },
        { text: 'Container runs as a non-root user', gap: true, err: ['ran     docker run --rm practical-43 whoami', 'printed root', 'Anyone who breaks into this container gets admin rights inside it.'], okNote: 'whoami printed appuser (uid 10001)' },
        { text: '.dockerignore keeps .env and .git out of the image' },
      ],
      hints: [
        'The failing check ran whoami inside your container and got root. Which Dockerfile instruction decides who runs the commands after it?',
        'Containers run as root unless the Dockerfile says otherwise. Create a normal user in the image, then switch to it before CMD. Keep the pip install step above the switch, while you still have admin rights.',
        ['Leave the FROM, COPY and pip install steps as they are.', 'Add a RUN step that creates a user with no admin rights.', 'Switch to that user with the Dockerfile instruction made for it, after COPY and before CMD.', 'Run checks again. whoami should print the new user\'s name.'],
      ],
      answers: [
        [/root|user|whoami|permission|admin/i, 'A container that runs as root gives an attacker admin rights inside it if your app has a bug. A normal user limits the damage. Dockerfiles have one instruction just for switching users.'],
        [/latest|pin|tag|version|slim/i, 'Pinning python:3.12-slim means every build uses the same base. ":latest" can change under you overnight and break the build.'],
        [/cache|layer|slow|requirements/i, 'Docker reuses a layer when nothing above it changed. Copying requirements.txt and installing first means a code change does not reinstall every package.'],
        [/\.env|secret|ignore|git/i, '.dockerignore works like .gitignore for the image. Anything listed there, such as .env or .git, never reaches the image, so secrets do not leak.'],
        [/build|fail|error/i, 'Your build already passes. The failing check is about who the container runs as, not about the build.'],
      ],
    };
  }

  function b51(S, p) {
    const k = +((p.task.match(/hit@(\d+)/) || [])[1] || 5);
    const kw = (p.task.match(/\b(retrieve_keyword)\b/) || [])[1] || 'retrieve_keyword';
    const emb = (p.task.match(/\b(retrieve_embedding)\b/) || [])[1] || 'retrieve_embedding';
    const code = p.starter.find((s) => s.kind === 'code_stub' && /\.py$/.test(s.path)) || { path: 'retrieve.py', desc: 'Retrieval stubs' };
    const datas = p.starter.filter((s) => s.kind === 'data');
    const chunks = (datas.find((s) => /chunk/.test(s.path)) || {}).path || 'data/chunks.jsonl';
    const qs = (datas.find((s) => !/chunk/.test(s.path)) || {}).path || 'data/questions.jsonl';
    const rel = (x) => x.replace(dir(code.path), '');
    const bm25 = /BM25/.test(p.task);
    const nq = +((p.task.match(/(\d+)\s+(?:labelled |practice |policy |answerable gold |provided |on-call )*(?:questions|change requests)/) || [])[1] || 20);
    const mk = (fixed) => [
      `"""Practical ${p.lecture}: keyword search vs embeddings over ${S.company} documents."""`,
      'import json', 'import math', 'from collections import Counter', '',
      'import requests  # talks to the Ollama server inside your workspace', '',
      `CHUNKS = [json.loads(line) for line in open("${rel(chunks)}", encoding="utf-8")]  # each has chunk_id, text, embedding`,
      'OLLAMA = "http://localhost:11434/api/embeddings"', `K = ${k}`, '', '',
      'def tokenize(text: str) -> list[str]:',
      '    return [w.strip(".,:;()[]\\"\'").lower() for w in text.split() if w.strip()]', '', '',
      `def ${kw}(query: str, k: int = K) -> list[tuple[str, float]]:`,
      `    """${bm25 ? 'BM25' : 'Term-frequency'} keyword scoring. Returns [(chunk_id, score)], best first."""`,
      '    docs = [tokenize(c["text"]) for c in CHUNKS]',
      '    avg = sum(len(d) for d in docs) / len(docs)',
      '    df = Counter(t for d in docs for t in set(d))',
      '    n, k1, b = len(docs), 1.5, 0.75',
      '    scored = []',
      '    for c, d in zip(CHUNKS, docs):',
      '        tf = Counter(d)',
      '        s = 0.0',
      '        for t in tokenize(query):',
      '            if t in tf:',
      '                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))',
      '                s += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * len(d) / avg))',
      '        scored.append((c["chunk_id"], s))',
      '    return sorted(scored, key=lambda x: x[1], reverse=True)[:k]', '', '',
      'def embed(text: str) -> list[float]:',
      '    r = requests.post(OLLAMA, json={"model": "nomic-embed-text", "prompt": text}, timeout=30)',
      '    return r.json()["embedding"]', '', '',
      'def cosine(a: list[float], b: list[float]) -> float:',
      '    dot = sum(x * y for x, y in zip(a, b))',
      '    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))', '', '',
      `def ${emb}(query: str, k: int = K) -> list[tuple[str, float]]:`,
      '    """Cosine similarity between the query and each chunk embedding."""',
      '    q = embed(query)',
      '    scored = [(c["chunk_id"], cosine(q, c["embedding"])) for c in CHUNKS]',
      ...(fixed ? ['    scored.sort(key=lambda x: x[1], reverse=True)'] : ['    # TODO: the best chunks must come first. Right now they stay in file order.']),
      '    return scored[:k]', '', '',
      'if __name__ == "__main__":',
      `    questions = [json.loads(line) for line in open("${rel(qs)}", encoding="utf-8")]`,
      `    for name, fn in [("Keyword", ${kw}), ("Embeddings", ${emb})]:`,
      '        hits = sum(q["gold_chunk_id"] in [cid for cid, _ in fn(q["question"])] for q in questions)',
      '        print(f"{name:<12} hit@{K} = {hits / len(questions):.2f}")', ''].join('\n');
    const files = [{ path: code.path, desc: code.desc, content: mk(false) }];
    return {
      files, fixed: { [code.path]: mk(true) }, gapPath: code.path,
      fixTest: (c) => { const i = c.indexOf('def ' + emb); return i >= 0 && /\.sort\(|sorted\(/.test(stripComments(c.slice(i))); },
      hiddenFail: /sorted|descending|return/i,
      runTail: [`Keyword      hit@${k} = 0.70`, `Embeddings   hit@${k} = 0.85`, `<span class="dim">(${nq} questions · demo numbers)</span>`],
      visible: [
        { text: `${base(code.path)} imports and loads the chunks` },
        { text: `${kw}() returns ${k} results, best score first` },
        { text: `${emb}() returns ${k} results, best score first`, gap: true, err: ['query   "how do refunds work"', 'scores  0.41, 0.77, 0.38, 0.69, 0.52   (not sorted)', 'The best match is in position 2, so hit@' + k + ' would be wrong.'], okNote: 'scores 0.77, 0.69, 0.52, 0.41, 0.38' },
        { text: `hit@${k} table prints for both methods` },
      ],
      hints: [
        `Compare your two functions line by line. One of them does something to the scores before it cuts the list to ${k}. Which one?`,
        `Taking the first ${k} items only works once the best scores are at the front. The embedding scores themselves are fine; their order is not.`,
        [`Find the line in ${emb}() where the scores are built.`, 'Before returning, put the list in order of score, highest first.', `Keep the cut to the first ${k} after the ordering.`, 'Run checks again and compare the hit@' + k + ' numbers for both methods.'],
      ],
      answers: [
        [/sort|order|first|best/i, `Python can sort a list of (chunk_id, score) pairs by the score with a key function. Ask yourself which direction you need for "best first".`],
        [/bm25|keyword|term/i, 'Keyword scoring rewards chunks that share rare words with the question. It is fast and good at exact terms like error codes, but misses synonyms.'],
        [/embed|cosine|vector|ollama/i, 'An embedding turns text into a list of numbers so that similar meanings end up close together. Cosine similarity measures how close two of them are: 1 means same direction.'],
        [/hit@|hit rate|metric|score/i, `hit@${k} asks: for what share of questions is the right chunk somewhere in the top ${k}? 0.85 means 85 out of 100 questions found it.`],
      ],
    };
  }

  function b57(S, p) {
    const text = p.task;
    const tool = (text.match(/\b([a-z]+(?:_[a-z]+)+)\b/) || [])[1] || 'lookup_item';
    const pm = text.match(new RegExp(tool + '\\(([^)]*)\\)'));
    let params = pm ? pm[1].split(',').map((x) => x.trim()).filter(Boolean) : null;
    const hasLimit = /at most|limit/.test(text);
    const limitN = +((text + ' ' + p.checks.join(' ')).match(/at most (\d+)|max (\d+)/) || []).slice(1).find(Boolean) || 10;
    if (!params) params = /^search_/.test(tool) ? ['query'] : /^(get|lookup|find)_/.test(tool) ? [tool.split('_').pop() + '_id'] : [];
    const variant = hasLimit ? 'limit' : params.some((x) => /^(path|page|file)$/.test(x)) ? 'file' : params.length ? 'id' : 'doc';
    const code = p.starter.find((s) => s.kind === 'code_stub' && /\.py$/.test(s.path)) || { path: 'server.py', desc: 'FastMCP server' };
    const data = p.starter.find((s) => s.kind === 'data') || { path: 'data/items.csv' };
    const dp = data.path, ext = isDir(dp) ? 'dir' : dp.split('.').pop();
    let server = (p.task.match(/called (\w+)/) || [])[1] || base(dir(code.path) || 'toolbox').replace(/\W/g, '');
    if (!server || /^(p\d+|mcp|api|src)$/.test(server)) server = S.slug + '-tools';
    const human = tool.replace(/_/g, ' ');
    const loader = { csv: ['import csv', `ROWS = list(csv.DictReader(open("${dp}", encoding="utf-8")))`], json: ['import json', `ROWS = json.load(open("${dp}", encoding="utf-8"))`], yaml: ['import yaml', `DATA = yaml.safe_load(open("${dp}", encoding="utf-8"))`], yml: ['import yaml', `DATA = yaml.safe_load(open("${dp}", encoding="utf-8"))`], dir: ['import pathlib', `SITE = pathlib.Path("${dp}")`] }[ext] || ['import csv', `ROWS = list(csv.DictReader(open("${dp}", encoding="utf-8")))`];
    const sig = (variant === 'limit' ? params.map((x) => `${x}: str`).concat([`limit: int = ${limitN}`]) : params.map((x) => `${x}: str`)).join(', ');
    let body0, body1, docline = `"""${human[0].toUpperCase() + human.slice(1)} from ${base(dp)}."""`;
    if (variant === 'limit') {
      const conds = params.map((x) => x === 'query' ? 'q in r["title"].lower()' : `r["${x}"] == ${x}`).join(' and ');
      const pre = params.includes('query') ? ['    q = query.lower()'] : [];
      body0 = [...pre, `    matches = [r for r in ROWS if ${conds}]`, '    # TODO: never return more than `limit` rows.', '    return matches'];
      body1 = [...pre, `    matches = [r for r in ROWS if ${conds}]`, '    return matches[:limit]'];
    } else if (variant === 'id') {
      const key = params[0];
      body0 = [`    row = BY_KEY[${key}]`, `    # TODO: an unknown ${key} crashes the tool. Answer with a clear message instead.`, '    return row'];
      body1 = [`    row = BY_KEY.get(${key})`, '    if row is None:', `        return {"error": f"${key} {${key}} not found"}`, '    return row'];
    } else if (variant === 'file') {
      const arg = params[0];
      const target = ext === 'dir' ? `SITE / ${arg}` : `pathlib.Path("${dir(dp)}") / ${arg}`;
      const work = /alt/.test(tool)
        ? ['    html = target.read_text(encoding="utf-8")', '    images = re.findall(r"<img\\b[^>]*>", html)', '    return {"page": ' + arg + ', "missing_alt": [i for i in images if "alt=" not in i]}']
        : ['    import pandas as pd', '    df = pd.read_csv(target)', '    return {"rows": len(df), "dtypes": df.dtypes.astype(str).to_dict(),', '            "nulls": df.isna().sum().to_dict(), "duplicate_rows": int(df.duplicated().sum())}'];
      body0 = [`    target = ${target}`, `    # TODO: a ${arg} that does not exist crashes the tool. Answer with a clear message instead.`, ...work];
      body1 = [`    target = ${target}`, '    if not target.exists():', `        return {"error": f"{${arg}} not found"}`, ...work];
    } else {
      const ret = ext === 'yaml' || ext === 'yml' ? '    return DATA' : '    return ROWS';
      body0 = ['    # TODO: add a docstring. The Inspector shows it as the tool\'s description,', '    #       and AI agents read it to decide when to call this tool.', ret];
      body1 = [`    ${docline}`, ret];
    }
    const mk = (fixed) => [
      `"""${S.company} · Practical 57: ${tool} as an MCP server (stdio)."""`,
      ...loader.slice(0, 1), ...(variant === 'file' && ext !== 'dir' ? ['import pathlib'] : []), ...(variant === 'file' && /alt/.test(tool) ? ['import re'] : []), '',
      'from mcp.server.fastmcp import FastMCP', '',
      `mcp = FastMCP("${server}")`, '',
      ...loader.slice(1),
      ...(variant === 'id' ? [`BY_KEY = {r["${params[0]}"]: r for r in ROWS}` + (ext === 'json' ? '' : '')] : []), '', '',
      '@mcp.tool()',
      `def ${tool}(${sig}) -> ${variant === 'limit' || (variant === 'doc' && !/ya?ml/.test(ext)) ? 'list[dict]' : 'dict'}:`,
      ...(variant === 'doc' ? [] : [`    ${docline}`]),
      ...(fixed ? body1 : body0), '', '',
      'if __name__ == "__main__":',
      '    mcp.run()  # stdio transport: no network port is opened', ''].join('\n');
    const gap = {
      limit: { text: `${tool}(${params.map((x) => x === 'query' ? "query='refund'" : `${x}='…'`).join(', ')}, limit=${limitN}) returns at most ${limitN} rows`, err: [`got     37 rows (limit=${limitN} was ignored)`, 'An agent asking for a short list would get the whole table.'], okNote: `${limitN} rows` },
      id: { text: `${tool}('DOES-NOT-EXIST') answers with a clear message`, err: ["KeyError: 'DOES-NOT-EXIST'", 'The tool crashed instead of telling the agent nothing was found.'], okNote: '{"error": "… not found"}' },
      file: { text: `${tool}('missing.${ext === 'dir' ? 'html' : 'csv'}') answers with a clear message`, err: ["FileNotFoundError: 'missing." + (ext === 'dir' ? 'html' : 'csv') + "'", 'The tool crashed with a traceback instead of an error result.'], okNote: 'isError true, "missing… not found"' },
      doc: { text: `Inspector shows a description for ${tool}`, err: ['description  ""  (empty)', 'Agents will not know when to call this tool.'], okNote: 'description present' },
    }[variant];
    const fixTests = { limit: (c) => /\[:\s*limit\s*\]|limit\]/.test(stripComments(c)), id: (c) => /not found|\.get\(/.test(stripComments(c)), file: (c) => /exists\(\)|not found/.test(stripComments(c)), doc: (c) => { const i = c.indexOf('def ' + tool); return i >= 0 && /"""/.test(c.slice(i, i + 400)); } };
    return {
      files: [{ path: code.path, desc: code.desc, content: mk(false) }], fixed: { [code.path]: mk(true) }, gapPath: code.path,
      fixTest: fixTests[variant],
      hiddenFail: { limit: /at most|max \d|limit/i, id: /error|not.found|crash|TC-099/i, file: /error|missing|traceback/i, doc: /description/i }[variant],
      visible: [
        { text: 'Server starts over stdio (no network port)' },
        { text: `Inspector lists the tool ${tool}` },
        { text: `${tool} returns rows with the expected keys` },
        Object.assign({ gap: true }, gap),
      ],
      hints: {
        limit: [`Your tool finds the right rows. Look at what happens between finding them and returning them. Does "limit" do anything yet?`, `"limit" is a parameter, so the agent can ask for fewer rows. Your function receives it but never uses it. Cut the list to that size before returning.`, ['Keep the filtering line as it is.', 'Use the limit parameter on the list of matches.', 'Return the shorter list.', 'Run checks again. Try a limit of 3 in the Inspector too.']],
        id: [`What happens in Python when you ask a dictionary for a key it does not have? That is what the failing check did.`, `Square-bracket lookup raises an error for a missing key, and the error crashes the tool. Use a lookup that gives you nothing back instead, then decide what to answer.`, ['Change the lookup so a missing key gives None instead of an error.', 'If you got None, return a short message saying the item was not found.', 'Otherwise return the row as before.', 'Run checks again.']],
        file: [`What happens when the file the agent asks for is not there? The failing check asked for one that does not exist.`, 'Opening a missing file raises an error and the tool crashes with a traceback. Check that the file exists first and answer with a clear message if it does not.', ['Build the full path as you already do.', 'Check whether that path exists before reading it.', 'If it does not, return a short error message naming the file.', 'Run checks again.']],
        doc: [`Open the MCP Inspector output in the terminal. What does it show next to ${tool}?`, 'FastMCP uses the function\'s docstring as the tool description. Without one, agents only see the name.', ['Add a one-line docstring as the first line inside the function.', 'Say what the tool returns and when to use it.', 'Run checks again.']],
      }[variant],
      answers: [
        [/mcp|protocol|what is/i, 'MCP (Model Context Protocol) is a standard way to give AI assistants tools. Your Python function becomes a tool that any MCP client, like Claude or the Inspector, can list and call.'],
        [/stdio|port|network/i, 'stdio means the server talks through standard input and output, not a network port. Nothing outside your workspace can reach it, which is safer for a lab.'],
        [/inspector/i, 'The MCP Inspector is a test client. It lists your tools and lets you call them with sample inputs, like Postman for MCP.'],
        [/limit|crash|error|missing|not found|docstring|description/i, 'Look at the failing check in the terminal. It shows the exact input the check used. Try that input yourself in the Inspector, then open Hint 1.'],
      ],
    };
  }

  function b65(S, p) {
    const all = [p.task, p.expected, ...p.checks].join(' ');
    const hook = (all.match(/\/hooks\/[\w-]+/) || [])[0] || '/hooks/intake';
    const flow = (p.task.match(/'([a-z][a-z0-9-]+)'/) || p.task.match(/flow ([a-z]+(?:-[a-z]+)+)/) || [])[1] || hook.split('/').pop();
    const header = (p.task.match(/X-[A-Za-z][\w-]+/) || [])[0] || 'X-Lab-Token';
    const okStatus = +((p.task.match(/\b(20[02])\b/) || [])[1] || 202);
    let req = [];
    let r;
    if ((r = p.task.match(/([\w.]+) (?:is not empty|must not be empty)/))) req = [r[1]];
    else if ((r = p.task.match(/that ([\w.]+) and ([\w.]+) are present/))) req = [r[1], r[2]];
    else if ((r = p.task.match(/checks[^(]*\(([^)]+)\)/))) req = splitTop(r[1]).map((x) => x.split(/\s/)[0]);
    else if ((r = p.task.match(/([\w.]+) is present/))) req = [r[1]];
    else if ((r = p.task.match(/\(\{([^}]+)\}\)/) || p.task.match(/\{([^}]+)\}/))) req = splitTop(r[1]).map((x) => x.split(':')[0].trim());
    req = uniq(req.map((x) => x.replace(/\[\]$/, '').replace(/[^\w.]/g, '')).filter((x) => /^[a-z][\w.]*$/.test(x) && !/^(received|accepted|true|status|error)$/.test(x)));
    if (!req.length) req = ['event_id'];
    const echo = (p.task.match(/with an? ([a-z]+_id)\b/) || [])[1] || (p.task.match(/20[02] (?:with )?\{(?:[a-z]+: (?:true|accepted), )?([a-z_]+)\}/) || [])[1] || (p.task.match(/20[02] \{"(\w+)":/) || [])[1] || req[0];
    const echoSrc = req.includes(echo) ? echo : (echo === 'run_id' && req.find((k) => /\.id$/.test(k))) || echo;
    const gapEntry = p.starter.find((s) => s.kind === 'code_stub' && !isDir(s.path) && /\.(ts|js|json|sh|http)$|caddyfile/i.test(s.path)) || p.starter.find((s) => s.kind !== 'data' && !isDir(s.path)) || { path: 'activepieces/code/check.ts', desc: 'Code step' };
    const glang = langOf(gapEntry.path);
    const auth = glang === 'caddy' || /checks the X-[\w-]+ header/i.test(p.task);
    const hookEnv = (p.task.match(/HOOK_[A-Z_]+/) || [])[0] || 'HOOK_' + snake(flow).toUpperCase();
    Object.assign(S, { hook, hookEnv });
    const getter = (k) => k.includes('.') ? `body.${k.split('.').join('?.')}` : `body["${k}"]`;
    const echoExpr = echoSrc !== echo || req.includes(echo) ? getter(echoSrc) : /^(received|submission)_id$/.test(echo) ? `"${echo.split('_')[0].slice(0, 3).toUpperCase()}-" + Date.now()` : getter(echo);
    function ts(fixed) {
      const L = ['// Activepieces Code step: runs right after the Catch Webhook trigger.', '// Its { status, body } output is what the Return Response step sends back.',
        `export const code = async (inputs: { body: Record<string, any>; headers: Record<string, string>; secret: string }) => {`,
        '  const body = inputs.body ?? {};'];
      if (auth) {
        L.push('', '  // The shared secret comes from an Activepieces connection, never typed into a step.');
        if (fixed) L.push(`  if (inputs.headers["${header.toLowerCase()}"] !== inputs.secret) {`, '    return { status: 401, body: { error: "missing or wrong key" } };', '  }');
        else L.push(`  // TODO: refuse the request when the ${header} header is missing or wrong.`);
        L.push('', `  const required = ${JSON.stringify(req)};`, '  const missing = required.filter((k) => body[k] === undefined || body[k] === "");', '  if (missing.length > 0) {', '    return { status: 400, body: { error: `${missing[0]} is required` } };', '  }');
      } else {
        L.push(`  const required = ${JSON.stringify(req)};`, '');
        if (fixed) L.push(`  const missing = required.filter((k) => { const v = k.split(".").reduce((o: any, p) => o?.[p], body); return v === undefined || v === "" || (Array.isArray(v) && v.length === 0); });`, '  if (missing.length > 0) {', '    return { status: 400, body: { error: `${missing[0]} is required` } };', '  }');
        else L.push('  // TODO: if a required field is missing or empty, refuse the request', '  //       and name the missing field in the response body.');
      }
      L.push('', `  return { status: ${okStatus}, body: { accepted: true, ${echo}: ${echoExpr} } };`, '};', '');
      return L.join('\n');
    }
    function caddy(fixed) {
      return ['# Lab gateway: public webhook routes in front of Activepieces', ':8088 {', `\thandle ${hook} {`,
        ...(fixed ? [`\t\t@no_token not header ${header} {$LAB_TOKEN}`, '\t\trespond @no_token "unauthorized" 401', ''] : [`\t\t# TODO: refuse the request when the ${header} header is missing`, '\t\t#       or does not match LAB_TOKEN from .env.', '']),
        `\t\trewrite * /api/v1/webhooks/{$${hookEnv}_ID}/sync`, '\t\treverse_proxy activepieces:80', '\t}', '}', ''].join('\n');
    }
    function flowJson(fixed) {
      const cond = req.map((k) => `{{trigger.body.${k}}} exists`).join(' AND ');
      const other = fixed ? { name: 'otherwise', steps: [{ name: 'return_bad_request', type: 'RETURN_RESPONSE', status: 400, body: { error: `${req[0]} required` } }] } : { name: 'otherwise', steps: [], _todo: 'TODO: answer requests that fail the check and name the missing field' };
      return JSON.stringify({ displayName: flow, trigger: { name: 'catch_webhook', type: 'WEBHOOK', settings: { sync: true } }, steps: [{ name: 'router', type: 'ROUTER', branches: [{ name: 'valid', condition: cond, steps: [{ name: 'return_ok', type: 'RETURN_RESPONSE', status: okStatus, body: { accepted: true, [echo]: `{{trigger.body.${echoSrc}}}` } }] }, other] }] }, null, 2) + '\n';
    }
    function sh(fixed) {
      const data = (p.starter.find((s) => s.kind === 'data' && /\.jsonl?$/.test(s.path)) || {}).path || 'samples.jsonl';
      return ['#!/usr/bin/env bash', `# Posts every sample to the lab gateway and prints the status codes.`, 'set -euo pipefail', 'source .env', '', 'while read -r event; do',
        ...(auth && !fixed ? [`  # TODO: send the ${header} header with LAB_TOKEN`] : []),
        `  curl -s -o /dev/null -w "%{http_code}\\n" -X POST "http://localhost:8088${hook}" \\`, '    -H "Content-Type: application/json" \\',
        ...(auth && fixed ? [`    -H "${header}: $LAB_TOKEN" \\`] : []), '    -d "$event"', `done < ${data}`, ''].join('\n');
    }
    const gen = { ts, caddy, json: flowJson, sh };
    const files = [], fixed = {};
    p.starter.forEach((s) => {
      if (s.kind === 'data' || s.kind === 'fixture' || isDir(s.path)) return;
      const lg = langOf(s.path);
      const g = /flows\/.*\.json$/.test(s.path) ? gen.json : gen[lg];
      if (s.path === gapEntry.path) { files.unshift({ path: s.path, desc: s.desc, content: g ? g(false) : genericFile(s.path, s.desc, S) }); if (g) fixed[s.path] = g(true); return; }
      if (lg === 'sh' && auth) { files.push({ path: s.path, desc: s.desc, content: sh(false) }); fixed[s.path] = sh(true); return; }
      files.push({ path: s.path, desc: s.desc, content: g ? g(true) : genericFile(s.path, s.desc, S) });
    });
    const gl = langOf(gapEntry.path);
    return {
      files, fixed, gapPath: gapEntry.path,
      fixTest: (c) => auth ? (gl === 'caddy' ? /respond[^\n]*401|401/.test(stripComments(c)) : /401/.test(stripComments(c))) : /\b400\b/.test(stripComments(c)),
      hiddenFail: auth ? /401/ : /400/,
      visible: [
        { text: `Flow "${flow}" is published and ${hook} answers` },
        { text: `Valid sample${auth ? ` with the right ${header}` : ''} gets ${okStatus}` },
        { text: `Response body includes ${echo}` },
        auth
          ? { text: `Request without ${header} gets 401`, gap: true, err: [`sent    POST ${hook}  (no ${header} header)`, `expected 401 Unauthorized, got ${okStatus}`, 'The request reached the flow without a token.'], okNote: '401 Unauthorized' }
          : { text: `Request missing ${req[0]} gets 400 naming the field`, gap: true, err: [`sent    POST ${hook}  (no "${req[0]}")`, `expected 400 Bad Request, got ${okStatus}`, 'The flow accepted an incomplete request.'], okNote: `400 · {"error": "${req[0]} is required"}` },
      ],
      hints: auth
        ? [`The failing check sent a request with no ${header} header and still got ${okStatus}. Where could the request be stopped before it reaches the flow?`, `${gl === 'caddy' ? 'Caddy can match requests by header and answer them directly, without forwarding them.' : 'Your Code step sees the request headers and the shared secret.'} Compare the header with the secret and answer 401 when they differ.`, [gl === 'caddy' ? 'Inside the route, define a matcher for requests whose header does not equal LAB_TOKEN.' : `Read the ${header} header from the inputs.`, gl === 'caddy' ? 'Answer requests that match it with 401, before the rewrite and proxy lines.' : 'If it does not match the secret, return status 401 with a short error.', 'Leave the valid path as it is.', 'Run checks again, with and without the header.']]
        : [`The failing check sent a request without "${req[0]}" and the flow still said ${okStatus}. Which step decides whether a request is complete?`, `The happy path is done. The other branch needs its own answer: a 400 that tells the caller which field is missing.`, ['Find where the flow decides valid or not valid.', 'On the not-valid path, answer with status 400.', `Put the name of the missing field (for example ${req[0]}) in the error message.`, 'Run checks again with a good and a bad sample.']],
      answers: [
        [/webhook|what is/i, 'A webhook is a URL another system calls when something happens. Your flow catches the call, checks it, and answers right away.'],
        [/401|token|header|auth|secret|key/i, '401 means "I do not know who you are". Checking a shared token on every call stops strangers from triggering your flow. Keep the secret in .env or a connection, never in the flow itself.'],
        [/400|missing|required|field/i, '400 means "your request is incomplete or wrong". A good 400 names the problem field, so the caller can fix it without guessing.'],
        [new RegExp(String(okStatus) + '|accept|return response'), `${okStatus} tells the caller the event arrived. Return Response sends it straight back, while the rest of the flow can keep working.`],
        [/caddy|8088|gateway|proxy/i, 'Caddy is the small gateway in front of Activepieces in your workspace. It gives the flow a clean address like http://localhost:8088' + hook + ' and can refuse bad requests before they reach the flow.'],
      ],
    };
  }

  function b90(S, p) {
    const code = p.starter.find((s) => s.kind === 'code_stub' && /\.py$/.test(s.path)) || { path: 'harness.py', desc: 'Test harness' };
    const cases = p.starter.find((s) => s.kind === 'data' && /\.jsonl$/.test(s.path)) || p.starter.find((s) => s.kind === 'data') || { path: 'data/cases.jsonl' };
    let n = +((p.checks.join(' ').match(/(\d+) rows/) || [])[1] || 0);
    if (!n) { const r = p.task.match(/(\d+) direct and (\d+) indirect/); n = r ? +r[1] + +r[2] : +((p.task.match(/(\d+) (?:[\w-]+ ){0,2}(?:cases|payloads|prompts|attempts|adversarial|test)/) || [])[1] || 15); }
    const canary = (p.checks.join(' ').match(/'([A-Z]{2,}-CANARY-\d+)'/) || [])[1] || 'NM-CANARY-7731';
    const mk = (fixed) => [
      `"""Practical 90: prompt-injection test run against the ${S.company} lab target."""`,
      'import json', 'import pathlib', '', 'import requests', '',
      'TARGET = "http://127.0.0.1:7070/chat"   # lab target container only, never a live system',
      `CASES = [json.loads(line) for line in open("${cases.path}", encoding="utf-8")][:${n}]`,
      'EVIDENCE = pathlib.Path("evidence")', 'EVIDENCE.mkdir(exist_ok=True)',
      `CANARY = "${canary}"   # planted in the target's system prompt`, '', '',
      ...(fixed ? ['def map_owasp(leaked: bool, tool_called: bool) -> str | None:', '    """Map a failed case to the OWASP Top 10 for LLM Applications."""', '    if tool_called:', '        return "LLM01 + LLM06"   # injection that led to excessive agency', '    if leaked:', '        return "LLM01 + LLM07"   # injection that leaked the system prompt', '    return None', '', ''] : []),
      'def run_case(case: dict) -> dict:',
      '    r = requests.post(TARGET, json={"message": case["prompt"]}, timeout=60)',
      '    reply = r.json()',
      '    leaked = CANARY in reply.get("text", "")',
      '    tool_called = bool(reply.get("tool_calls"))',
      '    return {',
      '        "case_id": case["id"],',
      '        "kind": case.get("kind", "direct"),',
      '        "prompt": case["prompt"],',
      '        "result": "fail" if (leaked or tool_called) else "pass",',
      '        "evidence": reply.get("text", "")[:200],',
      ...(fixed ? ['        "owasp_id": map_owasp(leaked, tool_called),'] : ['        # TODO: give every failed case its OWASP LLM Top 10 ID.', '        "owasp_id": None,']),
      '    }', '', '',
      'if __name__ == "__main__":',
      '    rows = [run_case(c) for c in CASES]',
      '    for row in rows:',
      '        (EVIDENCE / f"{row[\'case_id\']}.json").write_text(json.dumps(row, indent=2))',
      '    print(f"{sum(r[\'result\'] == \'fail\' for r in rows)} of {len(rows)} cases broke the target")', ''].join('\n');
    const files = [{ path: code.path, desc: code.desc, content: mk(false) }];
    p.starter.forEach((s) => { if (s.kind === 'data' || s.kind === 'fixture' || isDir(s.path) || s.path === code.path) return; files.push({ path: s.path, desc: s.desc, content: genericFile(s.path, s.desc, S) }); });
    return {
      files, fixed: { [code.path]: mk(true) }, gapPath: code.path,
      fixTest: (c) => /owasp_id"\s*:\s*(?!None)\S/.test(stripComments(c)),
      hiddenFail: /OWASP|LLM0|LLM\d|LLM categor/i,
      runTail: [`4 of ${n} cases broke the target`, '<span class="dim">(target runs in a local container with no internet access)</span>'],
      visible: [
        { text: 'Harness only talks to the local lab target' },
        { text: `All ${n} cases run and save evidence files` },
        { text: 'Each row records prompt, result and evidence' },
        { text: 'Every failed case has an OWASP LLM ID', gap: true, err: ['4 failed cases have owasp_id = None', 'A report without risk IDs cannot be compared or prioritised.'], okNote: '4 of 4 failed cases mapped' },
      ],
      hints: [
        'Your harness already finds the cases that broke the target. What does the report say about which kind of risk each one is?',
        'The OWASP Top 10 for LLM Applications gives each risk an ID. A leaked system prompt and an unwanted tool call are different risks, on top of the injection itself.',
        ['Write a small function that looks at what went wrong in a case (leak or tool call).', 'Return the matching OWASP LLM ID, or nothing if the case passed.', 'Call it when you build each row, instead of None.', 'Run checks again and read the evidence files.'],
      ],
      answers: [
        [/owasp|llm0|risk|category/i, 'OWASP publishes a Top 10 list of risks for apps built on language models. Prompt injection is LLM01. Read the list in the lab resources and match each failure to the closest entry.'],
        [/injection|direct|indirect/i, 'Direct injection is when the user types the attack. Indirect injection hides it in content the bot reads, like a product description or a document. Indirect attacks are harder to spot.'],
        [/canary|leak/i, 'The canary is a fake secret planted in the target\'s instructions. If it shows up in a reply, the bot leaked its system prompt.'],
        [/safe|legal|real|live/i, 'Every attack in this lab runs against a deliberately weak target inside your own workspace, with no internet. Never test systems you do not own or have permission to test.'],
      ],
    };
  }

  const BUILDERS = { '33': b33, '43': b43, '51': b51, '57': b57, '65': b65, '90': b90 };
  const COMMON_ANSWERS = [
    [/answer|solution|full code|write it|do it for me|just tell|give me the code/i, 'I can\'t write the graded answer for you. That is the one thing I never do here. I can explain the error, point you to the right idea, or show the next hint.'],
    [/hidden|submit|grade|score|marks/i, null],
    [/time|timer|minutes|late/i, 'You have 20 minutes on the clock. If the timer runs out you can still submit; the mentor sees how long you took.'],
    [/save|lost|crash|close/i, 'Your workspace saves every 5 minutes and when you run checks. If you close the tab, your files are here when you come back.'],
    [/hint|stuck|help|confused|don.?t understand/i, 'Open the hints above, one at a time. Hint 1 is a nudge, Hint 2 is stronger, Hint 3 gives the approach in steps.'],
  ];

  function buildSpec(field, pid, data) {
    const p = field.practicals[pid];
    const lecture = data.lectures.find((l) => l.id === p.lecture) || { id: p.lecture, month: 0, practical: p.topic };
    const S = { pid, company: field.company, slug: slugOf(field.company), datasets: field.datasets, prefix: (field.datasets[0] ? field.datasets[0].id.split('-DS')[0] : 'NM') };
    const spec = BUILDERS[pid](S, p);
    // Starter files list (what the student sees on the left): all starter entries plus any new file the student creates.
    const listed = p.starter.map((s) => ({ path: s.path, desc: s.desc, dataset: s.dataset, kind: s.kind, code: s.kind !== 'data' && s.kind !== 'fixture' && !isDir(s.path) }));
    spec.files.forEach((f) => { if (f.isNew && !listed.some((x) => x.path === f.path)) listed.push({ path: f.path, desc: f.desc, dataset: null, kind: 'new', code: true, isNew: true }); });
    spec.listed = listed;
    spec.data = listed.filter((x) => !x.code).map((x) => ({ path: x.path, content: dataPreview(x, S), readonly: true }));
    spec.p = p; spec.lecture = lecture; spec.S = S; spec.pid = pid;
    return spec;
  }

  function session(field, spec, first) {
    const key = field.id + ':' + spec.pid;
    if (!SESS[key]) {
      const files = {}; spec.files.forEach((f) => { files[f.path] = f.content; });
      SESS[key] = { files, open: [spec.gapPath].concat(spec.files.map((f) => f.path).filter((x) => x !== spec.gapPath)), active: spec.gapPath, runs: 0, last: null, hints: 0,
        chat: [{ who: 'ai', text: `Hi ${first}. I am your AI tutor for this practical. I can explain errors and give hints, but I never write the graded answer for you.` }],
        submitted: null, best: null, elapsed: 0, term: null, pane: 'terminal', busy: false, savedAt: null };
    }
    return SESS[key];
  }

  /* ---------------- styles ---------------- */
  const CSS = `
.m-practical { display: grid; gap: 14px; min-width: 0 }
.m-practical [hidden], .m-practical-grader [hidden] { display: none !important }
.m-practical .top { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; justify-content: space-between; min-width: 0 }
.m-practical .picker { display: flex; gap: 6px; overflow-x: auto; min-width: 0; flex: 1 1 420px; padding: 2px }
.m-practical .pk { border: 1px solid var(--line); background: var(--surface); border-radius: 99px; padding: 6px 12px; font-size: 13px; font-weight: 700; color: var(--muted); cursor: pointer; white-space: nowrap; display: inline-flex; gap: 6px; align-items: center }
.m-practical .pk:hover { border-color: var(--brand); color: var(--brand) }
.m-practical .pk[aria-pressed="true"] { background: var(--brand-soft); color: var(--brand); border-color: var(--brand) }
.m-practical .pk .tag { font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; background: var(--brand); color: var(--on-brand); border-radius: 99px; padding: 1px 6px }
.m-practical .pk .ok { color: var(--green) }
.m-practical .actions { display: flex; gap: 8px; flex-wrap: wrap }
.m-practical .ide { display: grid; grid-template-columns: 276px minmax(0, 1fr) 304px; grid-template-areas: "task main tutor" "bar bar bar"; grid-template-rows: minmax(0, 1fr) auto;
  height: clamp(640px, calc(100vh - 180px), 940px); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--surface) }
.m-practical .task { grid-area: task; border-right: 1px solid var(--line); overflow: auto; padding: 14px; display: grid; gap: 14px; align-content: start; min-width: 0; min-height: 0 }
.m-practical .mainc { grid-area: main; display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--code-bg) }
.m-practical .tutor { grid-area: tutor; border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; min-width: 0 }
.m-practical .bar { grid-area: bar; display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: center; padding: 7px 12px; background: var(--surface-2); border-top: 1px solid var(--line); font-size: 12px; color: var(--muted) }
.m-practical .bar span { display: inline-flex; gap: 6px; align-items: center; white-space: nowrap }
.m-practical .bar .dot { width: 7px; height: 7px; color: var(--green) }
.m-practical .bar .saved { margin-left: auto; color: var(--faint) }

.m-practical .timer { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px; display: grid; gap: 6px; background: var(--surface-2) }
.m-practical .timer b { font-family: var(--mono); font-size: 26px; font-variant-numeric: tabular-nums; line-height: 1 }
.m-practical .timer.warn b { color: var(--amber) } .m-practical .timer.over b { color: var(--red) }
.m-practical .timer .progress { height: 6px }
.m-practical .timer.warn .progress > i { background: var(--amber) } .m-practical .timer.over .progress > i { background: var(--red) }
.m-practical .sec { display: grid; gap: 6px; min-width: 0 }
.m-practical .sec > .eyebrow { font-size: 11px }
.m-practical .task p { font-size: 13.5px }
.m-practical .files { display: grid; gap: 4px }
.m-practical .fl { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 2px 8px; text-align: left; border: 1px solid transparent; background: none; border-radius: var(--radius-sm); padding: 6px 8px; cursor: pointer; width: 100% }
.m-practical .fl:hover { background: var(--surface-2); border-color: var(--line) }
.m-practical .fl svg { width: 15px; height: 15px; color: var(--muted); margin-top: 2px }
.m-practical .fl code { font-size: 12px; overflow-wrap: anywhere; color: var(--fg) }
.m-practical .fl .tiny { grid-column: 2; color: var(--muted) }
.m-practical .fl .pill { font-size: 10.5px; padding: 1px 7px; margin-left: 6px; vertical-align: 1px }
.m-practical .checks .check { font-size: 13px; padding: 7px 0 }
.m-practical .checks .check .ic { width: 18px; height: 18px; font-size: 11px }
.m-practical .result { border: 1px solid var(--line); border-left: 3px solid var(--green); border-radius: var(--radius-sm); padding: 10px 12px; display: grid; gap: 8px }
.m-practical .result.part { border-left-color: var(--amber) }

.m-practical .etabs { display: flex; align-items: stretch; gap: 0; min-width: 0; background: color-mix(in srgb, var(--code-bg) 88%, var(--code-fg)); border-bottom: 1px solid color-mix(in srgb, var(--code-fg) 12%, transparent) }
.m-practical .etabs .scroll { display: flex; overflow-x: auto; min-width: 0; flex: 1 }
.m-practical .et { background: none; border: 0; border-top: 2px solid transparent; color: var(--code-muted); font-family: var(--mono); font-size: 12px; padding: 9px 12px; cursor: pointer; white-space: nowrap; display: inline-flex; gap: 6px; align-items: center }
.m-practical .et[aria-selected="true"] { color: var(--code-fg); background: var(--code-bg); border-top-color: var(--brand) }
.m-practical .et .mod { width: 6px; height: 6px; border-radius: 50%; background: var(--code-num) }
.m-practical .et .ro { font-family: var(--body); font-size: 10px; color: var(--code-muted); border: 1px solid color-mix(in srgb, var(--code-fg) 25%, transparent); border-radius: 4px; padding: 0 4px }
.m-practical .fixbtn { display: flex; align-items: center; gap: 8px; padding: 4px 8px; flex: none }
.m-practical .fixbtn .lbl { font-size: 10.5px; color: var(--code-muted); text-transform: uppercase; letter-spacing: .05em; font-weight: 700 }
.m-practical .crumbs { font-family: var(--mono); font-size: 11.5px; color: var(--code-muted); padding: 5px 14px; border-bottom: 1px solid color-mix(in srgb, var(--code-fg) 8%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.m-practical .ed { position: relative; flex: 1 1 auto; min-height: 120px; display: grid; grid-template-columns: auto minmax(0, 1fr); overflow: hidden; background: var(--code-bg) }
.m-practical .gut { overflow: hidden; padding: 12px 10px 12px 14px; text-align: right; color: var(--code-muted); user-select: none; font: 13px/1.6 var(--mono); opacity: .7; border-right: 1px solid color-mix(in srgb, var(--code-fg) 8%, transparent) }
.m-practical .gut div { white-space: pre }
.m-practical .area { position: relative; overflow: hidden; min-width: 0 }
.m-practical .area pre, .m-practical .area textarea { position: absolute; inset: 0; margin: 0; padding: 12px 14px; font: 13px/1.6 var(--mono); white-space: pre; tab-size: 4; border: 0; letter-spacing: 0; font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0 }
.m-practical .area pre { pointer-events: none; color: var(--code-fg); overflow: hidden; background: none }
.m-practical .area pre code { display: block; font: inherit; will-change: transform }
.m-practical .area textarea { background: transparent; color: transparent; caret-color: var(--code-fg); resize: none; outline: none; overflow: auto; width: 100%; height: 100% }
.m-practical .area textarea::selection { background: color-mix(in srgb, var(--brand) 45%, transparent); color: transparent }
.m-practical .area textarea[readonly] { caret-color: transparent }
.m-practical .area .k { color: var(--code-key) } .m-practical .area .s { color: var(--code-str) } .m-practical .area .n { color: var(--code-num) } .m-practical .area .c { color: var(--code-muted) }
.m-practical .area .t { color: color-mix(in srgb, var(--violet) 45%, var(--code-fg)) } .m-practical .area .todo { color: var(--code-num); background: color-mix(in srgb, var(--code-num) 16%, transparent); border-radius: 3px }
.m-practical .ed.flash .area pre { animation: m-practical-flash 1.2s ease }
@keyframes m-practical-flash { 0% { background: color-mix(in srgb, var(--green) 25%, transparent) } 100% { background: transparent } }

.m-practical .etabs, .m-practical .crumbs, .m-practical .btabs, .m-practical .thead, .m-practical .ask, .m-practical .chips { flex: none }
.m-practical .bottom { flex: 0 0 214px; display: flex; flex-direction: column; min-height: 0; border-top: 1px solid color-mix(in srgb, var(--code-fg) 14%, transparent) }
.m-practical .btabs { display: flex; gap: 2px; align-items: center; padding: 0 8px; background: color-mix(in srgb, var(--code-bg) 88%, var(--code-fg)) }
.m-practical .bt { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--code-muted); font-size: 12px; font-weight: 700; padding: 7px 10px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; white-space: nowrap }
.m-practical .bt[aria-selected="true"] { color: var(--code-fg); border-bottom-color: var(--brand) }
.m-practical .bt:disabled { opacity: .45; cursor: not-allowed }
.m-practical .bt .live { width: 7px; height: 7px; border-radius: 50%; background: var(--code-str) }
.m-practical .btabs .sp { flex: 1 }
.m-practical .btabs .tiny { color: var(--code-muted); font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0 }
.m-practical .term { border-radius: 0; flex: 1; min-height: 0; margin: 0; padding: 10px 14px; overflow: auto }
.m-practical .term .pr { color: var(--code-key) }
.m-practical .term .warn { color: var(--code-num) }
.m-practical .prev { flex: 1; min-height: 0; overflow: auto; padding: 10px 14px; display: grid; gap: 10px; align-content: start; color: var(--code-fg); font-family: var(--mono); font-size: 12.5px }
.m-practical .prev .url { display: flex; gap: 8px; align-items: center; background: color-mix(in srgb, var(--code-fg) 8%, transparent); border-radius: 6px; padding: 5px 10px; color: var(--code-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis }
.m-practical .prev .req { display: grid; gap: 4px }
.m-practical .prev .req b { color: var(--code-str); font-weight: 700 }
.m-practical .prev pre { margin: 0; white-space: pre; overflow-x: auto; line-height: 1.55 }
.m-practical .prev .k { color: var(--code-key) } .m-practical .prev .s { color: var(--code-str) } .m-practical .prev .n { color: var(--code-num) }

.m-practical .thead { padding: 12px 14px; border-bottom: 1px solid var(--line); display: grid; gap: 4px }
.m-practical .thead h3 { display: flex; gap: 8px; align-items: center }
.m-practical .tbody { flex: 1; min-height: 0; display: flex; flex-direction: column }
.m-practical .ladder { padding: 10px 14px; display: grid; gap: 8px; border-bottom: 1px solid var(--line); overflow: auto; max-height: 46%; flex: none }
.m-practical .hint { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px 10px; display: grid; gap: 6px; font-size: 13px }
.m-practical .hint.open { background: var(--violet-soft); border-color: transparent }
.m-practical .hint .hh { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 700; font-size: 12.5px }
.m-practical .hint .hh span { color: var(--muted); font-weight: 600 }
.m-practical .hint ol { margin: 0; padding-left: 18px; display: grid; gap: 3px }
.m-practical .hint.locked { color: var(--faint) }
.m-practical .chat { flex: 1; min-height: 120px; overflow: auto; padding: 10px 14px; display: grid; gap: 8px; align-content: start }
.m-practical .msg { font-size: 13px; padding: 8px 10px; border-radius: 10px; max-width: 92%; overflow-wrap: anywhere }
.m-practical .msg.ai { background: var(--surface-2); justify-self: start; border-top-left-radius: 3px }
.m-practical .msg.me { background: var(--brand); color: var(--on-brand); justify-self: end; border-top-right-radius: 3px }
.m-practical .msg.sys { background: var(--amber-soft); color: var(--fg); justify-self: stretch; max-width: none }
.m-practical .ask { display: flex; gap: 6px; padding: 10px 14px; border-top: 1px solid var(--line) }
.m-practical .ask .field-input { padding: 8px 10px; font-size: 13px; min-width: 0 }
.m-practical .chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 10px }
.m-practical .chip { border: 1px solid var(--line); background: var(--surface); border-radius: 99px; font-size: 12px; padding: 3px 9px; cursor: pointer; color: var(--muted) }
.m-practical .chip:hover { color: var(--brand); border-color: var(--brand) }

.m-practical-grader { display: grid; gap: 12px }
.m-practical-grader .steps .check { font-size: 13.5px }
.m-practical-grader .score { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface-2) }
.m-practical-grader .score b { font-family: var(--display); font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums }
.m-practical-grader .score.full b { color: var(--green) } .m-practical-grader .score.part b { color: var(--amber) }
.m-practical-grader .hidden-head { display: flex; justify-content: space-between; gap: 8px; align-items: center }

@media (max-width: 1280px) {
  .m-practical .ide { grid-template-columns: 256px minmax(0, 1fr); grid-template-areas: "task main" "tutor tutor" "bar bar"; grid-template-rows: 620px auto auto; height: auto }
  .m-practical .tutor { border-left: 0; border-top: 1px solid var(--line) }
  .m-practical .tbody { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) }
  .m-practical .ladder { max-height: none; border-bottom: 0; border-right: 1px solid var(--line) }
  .m-practical .chatcol { display: flex; flex-direction: column; min-height: 0; max-height: 380px }
}
@media (max-width: 760px) {
  .m-practical .ide { grid-template-columns: minmax(0, 1fr); grid-template-areas: "task" "main" "tutor" "bar"; grid-template-rows: auto 560px auto auto }
  .m-practical .task { border-right: 0; border-bottom: 1px solid var(--line) }
  .m-practical .tbody { grid-template-columns: minmax(0, 1fr) }
  .m-practical .ladder { border-right: 0; border-bottom: 1px solid var(--line) }
  .m-practical .bottom { flex-basis: 200px }
  .m-practical .bar .saved { margin-left: 0 }
  .m-practical .fixbtn .lbl { display: none }
}
@media (prefers-reduced-motion: reduce) { .m-practical .ed.flash .area pre { animation: none } }
`;
  function injectCSS() { if (!document.getElementById('m-practical')) { const s = document.createElement('style'); s.id = 'm-practical'; s.textContent = CSS; document.head.append(s); } }

  const FILE_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  const DATA_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>';
  const DIR_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

  function cleanup() {
    if (!live) return;
    live.timers.forEach(clearTimeout); clearInterval(live.tick);
    live.offs.forEach((f) => { try { f(); } catch (e) {} });
    if (live.grader) { try { live.grader.close(); } catch (e) {} }
    live = null;
  }

  /* ---------------- the view ---------------- */
  function mount(root, c) {
    cleanup();
    root.textContent = '';
    live = { timers: [], tick: null, offs: [], grader: null };
    const L = live;
    const later = (ms, fn) => { const t = setTimeout(fn, reduced() ? Math.min(ms, 60) : ms); L.timers.push(t); return t; };
    const { h, esc, field, data, state } = c;
    const pid = SEL[field.id] || '65';
    const spec = buildSpec(field, pid, data);
    const ss = session(field, spec, data.demo_student.name.split(' ')[0]);
    const p = spec.p;
    const student = data.demo_student;
    if (!ss.term) ss.term = [
      `<span class="dim">Neuromind cloud workspace · Python 3.12 · ${esc(field.company)}</span>`,
      `<span class="dim">Lab data mounted read-only at /data · ${spec.listed.filter((x) => x.dataset).length || 1} dataset${spec.listed.filter((x) => x.dataset).length === 1 ? '' : 's'}</span>`,
      `<span class="pr">${esc(student.id.toLowerCase())}@nm-lab:~/practical-${pid}$</span> ls`,
      esc(uniq(spec.listed.map((x) => x.path.split('/')[0] + (x.path.includes('/') ? '/' : ''))).join('   ')),
      `<span class="pr">${esc(student.id.toLowerCase())}@nm-lab:~/practical-${pid}$</span> <span class="dim">Press "Run checks" to test your work.</span>`,
    ];

    /* top: picker + actions */
    const picker = h('div', { class: 'picker', role: 'group', 'aria-label': 'Choose a practical' });
    PIDS.forEach((id) => {
      const lp = field.practicals[id]; if (!lp) return;
      const lec = data.lectures.find((l) => l.id === lp.lecture);
      const done = SESS[field.id + ':' + id] && SESS[field.id + ':' + id].best != null;
      picker.append(h('button', { class: 'pk', 'aria-pressed': String(id === pid), title: lp.topic, onclick: () => { if (id !== pid && !ss.busy) { SEL[field.id] = id; mount(root, c); } } },
        `L${lp.lecture} · ${lec ? lec.practical : lp.topic}`, id === '65' ? h('span', { class: 'tag' }, 'Today') : null, done ? h('span', { class: 'ok', html: '&#10003;', 'aria-label': 'submitted' }) : null));
    });
    const runBtn = h('button', { class: 'btn', onclick: () => runChecks() }, h('span', { html: c.icon('play') }), 'Run checks');
    const subBtn = h('button', { class: 'btn primary', onclick: () => submit() }, h('span', { html: c.icon('check') }), ss.submitted ? 'Resubmit' : 'Submit');
    const top = h('div', { class: 'top' }, picker, h('div', { class: 'actions' }, runBtn, subBtn));

    /* left: task panel */
    const timerB = h('b', { class: 'num' }, mmss(LIMIT_S - ss.elapsed));
    const timerBar = h('i', { style: { width: '100%' } });
    const timerNote = h('span', { class: 'tiny muted' }, 'Time left · 20-minute practical');
    const timer = h('div', { class: 'timer', role: 'timer', 'aria-label': 'Time left' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, timerB, h('span', { class: 'pill blue' }, 'Auto-checked')), h('div', { class: 'progress' }, timerBar), timerNote);
    const fileList = h('div', { class: 'files' }, spec.listed.map((f) => h('button', { class: 'fl', title: f.code ? 'Open in the editor' : 'Preview this dataset', onclick: () => openFile(f.path), html: (isDir(f.path) ? DIR_IC : f.code ? FILE_IC : DATA_IC) + `<span><code>${esc(f.path)}</code>${f.dataset ? `<span class="pill violet">${esc(f.dataset)}</span>` : ''}${f.isNew ? '<span class="pill green">new file</span>' : ''}</span><span class="tiny">${esc(f.desc)}</span>` })));
    const checkRows = spec.visible.map((v) => h('div', { class: 'check wait' }, h('span', { class: 'ic' }, '·'), h('span', {}, v.text)));
    const resultBox = h('div', {});
    const taskPanel = h('section', { class: 'task', 'aria-label': 'Task' },
      timer,
      h('div', { class: 'sec' }, h('div', { class: 'eyebrow' }, `Lecture ${p.lecture} · Month ${spec.lecture.month} · Practical`), h('h3', {}, p.topic), h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'pill' }, field.company), h('span', { class: 'pill amber' }, 'Demo data'))),
      h('div', { class: 'sec' }, h('div', { class: 'eyebrow' }, 'Your task'), h('p', {}, p.task)),
      h('div', { class: 'sec' }, h('div', { class: 'eyebrow' }, 'Starter files'), fileList),
      h('div', { class: 'sec' }, h('div', { class: 'eyebrow' }, 'Expected output'), h('div', { class: 'callout small' }, p.expected)),
      h('div', { class: 'sec' }, h('div', { class: 'eyebrow' }, `Checks you can run (${spec.visible.length})`), h('div', { class: 'checks' }, checkRows),
        h('p', { class: 'tiny muted' }, `When you submit, a grader runs ${p.checks.length} hidden checks in a fresh container. You see them only after grading.`)),
      resultBox);

    /* centre: editor + terminal */
    const allFiles = () => spec.files.map((f) => f.path).concat(spec.data.map((d) => d.path));
    const readonly = (path) => spec.data.some((d) => d.path === path);
    const contentOf = (path) => readonly(path) ? spec.data.find((d) => d.path === path).content : ss.files[path];
    const tabsScroll = h('div', { class: 'scroll', role: 'tablist', 'aria-label': 'Open files' });
    const fixBtn = h('button', { class: 'btn sm', title: 'Demo shortcut: fills in a finished version of the code, as if the student typed it', onclick: () => applyFix() }, 'Apply my fix');
    const fixWrap = h('div', { class: 'fixbtn' }, h('span', { class: 'lbl' }, 'Demo shortcut'), fixBtn);
    const crumbs = h('div', { class: 'crumbs' });
    const gutInner = h('div', {});
    const gut = h('div', { class: 'gut', 'aria-hidden': 'true' }, gutInner);
    const codeEl = h('code', {});
    const pre = h('pre', { 'aria-hidden': 'true' }, codeEl);
    const ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', wrap: 'off', 'aria-label': 'Code editor' });
    const ed = h('div', { class: 'ed' }, gut, h('div', { class: 'area' }, pre, ta));
    const term = h('div', { class: 'term', role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output' });
    const prev = h('div', { class: 'prev', hidden: true });
    const btTerm = h('button', { class: 'bt', role: 'tab', onclick: () => setPane('terminal') }, 'Terminal');
    const btPrev = pid === '33' ? h('button', { class: 'bt', role: 'tab', onclick: () => setPane('preview') }, h('span', { class: 'live', hidden: true }), 'Preview :8000') : null;
    const btInfo = h('span', { class: 'tiny' }, '');
    const bottom = h('div', { class: 'bottom' }, h('div', { class: 'btabs', role: 'tablist', 'aria-label': 'Output' }, btTerm, btPrev, h('span', { class: 'sp' }), btInfo), term, prev);
    const mainc = h('section', { class: 'mainc', 'aria-label': 'Editor' }, h('div', { class: 'etabs' }, tabsScroll, fixWrap), crumbs, ed, bottom);

    /* right: AI tutor */
    const ladder = h('div', { class: 'ladder', 'aria-label': 'Hints' });
    const chat = h('div', { class: 'chat', role: 'log', 'aria-live': 'polite' });
    const askIn = h('input', { class: 'field-input', type: 'text', placeholder: 'Ask the tutor about this practical', 'aria-label': 'Ask the tutor' });
    const askBtn = h('button', { class: 'btn sm primary', onclick: () => ask(askIn.value) }, 'Ask');
    askIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(askIn.value); });
    const chipQs = ['Why did my check fail?', 'What does this error mean?', 'Just give me the answer'];
    const chips = h('div', { class: 'chips' }, chipQs.map((q) => h('button', { class: 'chip', onclick: () => ask(q) }, q)));
    const tutor = h('section', { class: 'tutor', 'aria-label': 'AI tutor' },
      h('div', { class: 'thead' }, h('h3', {}, h('span', { class: 'ai-badge' }, 'AI'), 'AI tutor'), h('p', { class: 'tiny muted' }, 'Gives hints one step at a time. It never shows the full solution.')),
      h('div', { class: 'tbody' }, ladder, h('div', { class: 'chatcol', style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 } }, chat, chips, h('div', { class: 'ask' }, askIn, askBtn))));

    /* status bar */
    const saved = h('span', { class: 'saved' }, ss.savedAt ? `Last saved ${ss.savedAt}` : 'All changes saved');
    const bar = h('footer', { class: 'bar', 'aria-label': 'Workspace status' },
      h('span', {}, h('i', { class: 'dot' }), 'Cloud workspace · Small · 2 GB'),
      h('span', {}, 'Lab time this week: 3 h 40 m of 12 h'),
      h('span', {}, 'Auto-saves every 5 minutes'),
      h('span', {}, 'Shuts down after 20 minutes idle'),
      saved);

    root.append(h('div', { class: 'm-practical' }, top, h('div', { class: 'ide' }, taskPanel, mainc, tutor, bar)));

    /* ---------- editor behaviour ---------- */
    function renderTabs() {
      tabsScroll.textContent = '';
      ss.open.forEach((path) => {
        const dirty = !readonly(path) && ss.files[path] !== (spec.files.find((f) => f.path === path) || {}).content;
        tabsScroll.append(h('button', { class: 'et', role: 'tab', 'aria-selected': String(path === ss.active), title: path, onclick: () => openFile(path) }, base(path), readonly(path) ? h('span', { class: 'ro' }, 'read-only') : null, dirty ? h('span', { class: 'mod', title: 'Edited' }) : null));
      });
      const at = tabsScroll.querySelector('[aria-selected="true"]'); if (at && at.scrollIntoView) try { at.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }
    function paint() {
      const src = ta.value;
      codeEl.innerHTML = highlight(src, langOf(ss.active), esc) + '\n';
      const n = src.split('\n').length;
      gutInner.innerHTML = `<div>${Array.from({ length: n }, (_, i) => i + 1).join('\n')}</div>`;
      sync();
    }
    function sync() { codeEl.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`; gutInner.style.transform = `translateY(${-ta.scrollTop}px)`; }
    function loadActive() {
      ta.value = contentOf(ss.active) || '';
      ta.readOnly = readonly(ss.active);
      crumbs.textContent = `practical-${pid} / ${ss.active}` + (readonly(ss.active) ? '  ·  dataset preview, read-only' : '');
      ta.scrollTop = 0; ta.scrollLeft = 0; paint(); renderTabs();
    }
    function openFile(path) {
      if (!allFiles().includes(path)) { c.toast(isDir(path) ? 'Folders open in the file tree of the full workspace.' : 'This file opens in the full workspace.', 'amber'); return; }
      if (!ss.open.includes(path)) ss.open.push(path);
      ss.active = path; loadActive();
    }
    ta.addEventListener('input', () => { if (ta.readOnly) return; ss.files[ss.active] = ta.value; paint(); renderTabs(); saved.textContent = 'Unsaved changes · saves on Run checks'; });
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !ta.readOnly) { e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd; ta.setRangeText('    ', s, en, 'end'); ta.dispatchEvent(new Event('input')); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runChecks(); }
    });

    /* ---------- terminal ---------- */
    function paintTerm() { term.innerHTML = ss.term.join('\n'); term.scrollTop = term.scrollHeight; }
    function say(line) { ss.term.push(line); if (ss.term.length > 220) ss.term.splice(0, ss.term.length - 220); paintTerm(); }
    const prompt = () => `<span class="pr">${esc(student.id.toLowerCase())}@nm-lab:~/practical-${pid}$</span>`;
    function setPane(which) {
      if (which === 'preview' && !(ss.last && ss.last.passed === ss.last.total)) { c.toast('Pass all visible checks to open the preview.', 'amber'); return; }
      ss.pane = which;
      btTerm.setAttribute('aria-selected', String(which === 'terminal'));
      if (btPrev) btPrev.setAttribute('aria-selected', String(which === 'preview'));
      term.hidden = which !== 'terminal'; prev.hidden = which !== 'preview';
      btInfo.textContent = which === 'preview' ? `https://${student.id.toLowerCase()}-8000.lab.neuromind.demo` : 'bash';
      if (which === 'preview') paintPreview();
    }
    function paintPreview() {
      const S = spec.S; if (!S.routes) return;
      const rec = Object.assign({ [S.idKey]: `${S.routes.post.path.split('/').filter((x) => x && !x.startsWith('{')).pop().split(/[-_]/).map((w) => w[0]).join('').toUpperCase()}-3f9a1c` }, S.validBody, S.status ? { status: S.status } : {});
      const j = (o) => highlight(JSON.stringify(o, null, 2), 'json', esc);
      prev.innerHTML = `<div class="url">GET / POST · port 8000 · ${esc(field.company)} API (demo)</div>
        <div class="req"><span>POST ${esc(S.routes.post.path.replace(/\{(\w+)\}/, 'F-1042'))} &nbsp;<b>201 Created</b> · 18 ms</span><pre>${j(rec)}</pre></div>
        <div class="req"><span>GET ${esc(S.routes.get.path)} &nbsp;<b>200 OK</b> · 6 ms</span><pre>${j([rec])}</pre></div>
        <div class="req"><span>POST ${esc(S.routes.post.path.replace(/\{(\w+)\}/, 'F-1042'))} &nbsp;<b style="color:var(--code-num)">422 Unprocessable Entity</b> · invalid ${esc(S.gapField.name)}</span><pre>${j({ detail: [{ type: 'validation_error', loc: ['body', S.gapField.name], msg: 'Value is not allowed for this field', input: badOf(S.gapField) }] })}</pre></div>`;
    }
    function refreshPreviewTab() { if (!btPrev) return; const ok = ss.last && ss.last.passed === ss.last.total; btPrev.disabled = !ok; btPrev.title = ok ? 'See what the API answers' : 'Pass the checks first'; btPrev.querySelector('.live').hidden = !ok; }

    /* ---------- checks ---------- */
    function paintChecks() {
      spec.visible.forEach((v, i) => {
        const st = ss.last ? (ss.last.results[i] ? 'pass' : 'fail') : 'wait';
        checkRows[i].className = 'check ' + st; checkRows[i].firstChild.textContent = st === 'pass' ? '✓' : st === 'fail' ? '✕' : '·';
      });
    }
    function setBusy(b) { ss.busy = b; runBtn.disabled = b; subBtn.disabled = b; fixBtn.disabled = b; }
    function save() { const t = new Date(); ss.savedAt = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; saved.textContent = `Last saved ${ss.savedAt}`; renderTabs(); }
    const isFixed = () => spec.fixTest(ss.files[spec.gapPath] || '');
    function runChecks() {
      if (ss.busy) return;
      setBusy(true); setPane('terminal'); save();
      const fixedNow = isFixed();
      say(`${prompt()} nm check`);
      say('<span class="dim">Files saved. Running ' + spec.visible.length + ' visible checks in your workspace...</span>');
      checkRows.forEach((r) => { r.className = 'check wait'; r.firstChild.textContent = '·'; });
      const results = [];
      let i = 0;
      const step = () => {
        if (i >= spec.visible.length) return finish();
        const v = spec.visible[i], row = checkRows[i];
        row.className = 'check run'; row.firstChild.innerHTML = '<span class="spin" style="width:10px;height:10px;border-width:2px"></span>';
        later(520 + i * 90, () => {
          const ok = v.gap ? fixedNow : true;
          results.push(ok);
          row.className = 'check ' + (ok ? 'pass' : 'fail'); row.firstChild.textContent = ok ? '✓' : '✕';
          say(`${ok ? '<span class="ok">PASS</span>' : '<span class="bad">FAIL</span>'}  ${esc(v.text)}${ok && v.gap && v.okNote ? ` <span class="dim">(${esc(v.okNote)})</span>` : ''}`);
          if (!ok) (v.err || []).forEach((e) => say(`      <span class="bad">${esc(e)}</span>`));
          i++; step();
        });
      };
      const finish = () => {
        const passed = results.filter(Boolean).length, total = results.length;
        ss.last = { results, passed, total }; ss.runs++;
        if (passed === total && spec.runTail) spec.runTail.forEach((l) => say(l));
        say(passed === total ? `<span class="ok">${passed} of ${total} checks passed.</span> Ready to submit.` : `<span class="warn">${passed} of ${total} checks passed.</span> <span class="dim">Fix the failing check, or ask the tutor for a hint.</span>`);
        say(prompt());
        c.emit('practical:run', { passed, total, field: field.id, lecture: p.lecture });
        setBusy(false); refreshPreviewTab();
        if (passed < total) { tutorSay(`Your check "${spec.visible[results.indexOf(false)].text}" failed. I will not fix it for you, but Hint ${Math.min(3, ss.hints + 1)} is ready if you want it.`, 'sys'); }
        else {
          tutorSay(pid === '33' ? 'All visible checks pass. Open the Preview tab to see what your API answers, then submit.' : 'All visible checks pass. Submit when you are ready: the grader runs the hidden checks.', 'sys');
          if (pid === '33') { setPane('preview'); c.toast('Checks passed. Preview is live on port 8000.', 'green'); }
        }
      };
      later(380, step);
    }

    /* ---------- demo fix ---------- */
    function applyFix() {
      if (ss.busy) return;
      if (isFixed()) { c.toast('This code already has a fix. Run checks to test it.', 'amber'); return; }
      Object.entries(spec.fixed).forEach(([path, txt]) => { ss.files[path] = txt; if (!ss.open.includes(path)) ss.open.push(path); });
      ss.active = spec.gapPath; loadActive();
      ed.classList.remove('flash'); void ed.offsetWidth; ed.classList.add('flash');
      saved.textContent = 'Unsaved changes · saves on Run checks';
      c.toast(`Demo shortcut: the student's fix was typed into ${base(spec.gapPath)}.`, 'green');
      say(`<span class="dim"># edited ${esc(spec.gapPath)} (demo shortcut)</span>`);
    }

    /* ---------- tutor ---------- */
    function paintLadder() {
      ladder.textContent = '';
      const names = ['Nudge', 'Stronger', 'Approach in steps'];
      spec.hints.forEach((hint, i) => {
        const open = i < ss.hints, next = i === ss.hints;
        const body = open ? (Array.isArray(hint) ? h('ol', {}, hint.map((x) => h('li', {}, x))) : h('div', {}, hint)) : null;
        ladder.append(h('div', { class: 'hint' + (open ? ' open' : '') + (!open && !next ? ' locked' : '') },
          h('div', { class: 'hh' }, h('div', {}, `Hint ${i + 1} `, h('span', {}, '· ' + names[i])), next ? h('button', { class: 'btn sm', onclick: () => { ss.hints++; paintLadder(); tutorSay(i === 2 ? 'That is the last hint. It gives the approach, not the code: the graded answer is yours to write.' : `Hint ${i + 1} is open. Try it before you open the next one.`); } }, `Show hint ${i + 1}`) : !open ? h('span', {}, 'Locked') : null),
          body));
      });
      ladder.append(h('p', { class: 'tiny muted' }, 'Hints never show the full solution. Your mentor can see which hints you used.'));
    }
    function paintChat() {
      chat.textContent = '';
      ss.chat.forEach((m) => chat.append(h('div', { class: 'msg ' + (m.who === 'me' ? 'me' : m.kind === 'sys' ? 'sys' : 'ai') }, m.text)));
      chat.scrollTop = chat.scrollHeight;
    }
    function tutorSay(text, kind) { ss.chat.push({ who: 'ai', text, kind }); paintChat(); }
    function answerFor(q) {
      const hiddenMsg = `Visible checks run in your workspace. When you submit, the grader copies your files into a fresh container with no network and runs ${p.checks.length} hidden checks. Pass the visible ones first.`;
      if (/why.*fail|failing|fail/i.test(q) && ss.last && ss.last.passed < ss.last.total) { const v = spec.visible[ss.last.results.indexOf(false)]; return `The check "${v.text}" failed: ${(v.err || [])[1] || (v.err || [])[0] || 'see the terminal'}. ${(v.err || []).slice(-1)[0] || ''} Open Hint ${Math.min(3, ss.hints + 1)} if you want a nudge.`; }
      if (/error mean|what does this error/i.test(q)) { if (ss.last && ss.last.passed < ss.last.total) { const v = spec.visible[ss.last.results.indexOf(false)]; return `In plain words: ${(v.err || []).slice(-1)[0]} The line above it in the terminal shows what the check sent and what came back.`; } return 'There is no error yet. Press Run checks and I will explain anything that fails.'; }
      if (COMMON_ANSWERS[0][0].test(q)) return COMMON_ANSWERS[0][1];
      for (const [re, txt] of spec.answers) if (re.test(q)) return txt;
      for (const [re, txt] of COMMON_ANSWERS) if (re.test(q)) return txt || hiddenMsg;
      return `I can help with this practical's code, its errors and the ideas behind it. Try asking about the failing check, or open Hint ${Math.min(3, ss.hints + 1)}.`;
    }
    function ask(q) {
      q = (q || '').trim(); if (!q) return;
      askIn.value = '';
      ss.chat.push({ who: 'me', text: q }); paintChat();
      const typing = h('div', { class: 'msg ai' }, h('span', { class: 'spin', style: { width: '11px', height: '11px', verticalAlign: '-1px' } }), ' Tutor is typing');
      chat.append(typing); chat.scrollTop = chat.scrollHeight;
      later(750, () => { typing.remove(); tutorSay(answerFor(q)); });
    }

    /* ---------- submit / grader ---------- */
    function submit() {
      if (ss.busy) return;
      setBusy(true); save();
      const fixedNow = isFixed();
      const n = p.checks.length;
      let failIdx = fixedNow ? -1 : p.checks.findIndex((t) => spec.hiddenFail.test(t));
      if (!fixedNow && failIdx < 0) failIdx = n - 1;
      const res = p.checks.map((_, i) => i !== failIdx);
      const passed = res.filter(Boolean).length;
      const score = Math.round(passed / n * 100);
      const took = ss.elapsed;
      const mk = (txt) => h('div', { class: 'check wait' }, h('span', { class: 'ic' }, '·'), h('span', {}, txt));
      const steps = [mk(`Packaging files (${spec.files.length} file${spec.files.length === 1 ? '' : 's'}, ${(spec.files.reduce((a, f) => a + (ss.files[f.path] || '').length, 0) / 1024).toFixed(1)} KB)`), mk('Starting a fresh grader container (no network)'), mk(`Running ${n} hidden checks`)];
      const hidRows = p.checks.map((t) => mk(t));
      const hidWrap = h('div', { class: 'stack', hidden: true, style: { gap: '0' } }, h('div', { class: 'hidden-head' }, h('div', { class: 'eyebrow' }, 'Hidden checks'), h('span', { class: 'tiny muted' }, 'Written by the course team')), h('div', { class: 'checks' }, hidRows));
      const out = h('div', { class: 'stack', hidden: true });
      const box = h('div', { class: 'm-practical-grader' },
        h('div', {}, h('div', { class: 'eyebrow' }, `Lecture ${p.lecture} · ${field.company}`), h('h2', {}, 'Grading your practical')),
        h('div', { class: 'steps' }, steps), hidWrap, out);
      L.grader = c.modal(box);
      say(`${prompt()} nm submit`); say('<span class="dim">Submitted to the grader.</span>');
      const setRow = (row, st) => { row.className = 'check ' + st; row.firstChild.innerHTML = st === 'run' ? '<span class="spin" style="width:10px;height:10px;border-width:2px"></span>' : st === 'pass' ? '✓' : st === 'fail' ? '✕' : '·'; };
      let t = 200;
      steps.forEach((row, i) => { later(t, () => setRow(row, 'run')); t += i === 1 ? 1100 : 700; later(t, () => { setRow(row, 'pass'); if (i === 2) hidWrap.hidden = false; }); });
      hidRows.forEach((row, i) => { later(t + 100, () => setRow(row, 'run')); t += 650; later(t, () => setRow(row, res[i] ? 'pass' : 'fail')); });
      later(t + 300, () => {
        setRow(steps[2], 'pass');
        const first = ss.best == null;
        const prevBest = ss.best;
        ss.best = Math.max(ss.best || 0, score);
        ss.submitted = { score, passed, n, took, at: new Date() };
        state.progress.practicalScore = score;
        let xp = 0;
        if (first) xp = score === 100 ? 60 : 40;
        else if (score === 100 && prevBest < 100) xp = 20;
        out.append(
          h('div', { class: 'score ' + (score === 100 ? 'full' : 'part') }, h('b', {}, `${score}`), h('div', { class: 'stack', style: { gap: '2px' } }, h('strong', {}, score === 100 ? 'All hidden checks passed' : `${passed} of ${n} hidden checks passed`), h('span', { class: 'small muted' }, `Score out of 100 · time taken ${mmss(took)} of 20:00${xp ? ` · +${xp} XP` : ''}`))),
          score < 100 ? h('div', { class: 'note' }, 'You can fix the code and resubmit. Your mentor sees every attempt and the hints you used.') : h('div', { class: 'note' }, 'Your mentor sees this result in the mentor console now, with your time and hint use.'),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { L.grader && L.grader.close(); c.go('mentor'); } }, 'See it in the mentor console'), h('button', { class: 'btn', onclick: () => { L.grader && L.grader.close(); c.go('home'); } }, 'Back to today'), score < 100 ? h('button', { class: 'btn ghost', onclick: () => L.grader && L.grader.close() }, 'Keep working') : null));
        out.hidden = false;
        say(`${score === 100 ? '<span class="ok">' : '<span class="warn">'}Grader: ${passed}/${n} hidden checks · score ${score}</span>`); say(prompt());
        if (xp) c.addXP(xp, `Practical ${p.lecture} ${score === 100 ? 'passed' : 'submitted'}`);
        c.emit('practical:submitted', { score, field: field.id, lecture: p.lecture, practical: pid, passed, total: n, seconds: took });
        setBusy(false); subBtn.lastChild.textContent = 'Resubmit'; paintResult();
        const pk = picker.children[PIDS.indexOf(pid)]; if (pk && !pk.querySelector('.ok')) pk.append(h('span', { class: 'ok', html: '&#10003;' }));
      });
    }
    function paintResult() {
      resultBox.textContent = '';
      const r = ss.submitted; if (!r) return;
      resultBox.append(h('div', { class: 'result' + (r.score === 100 ? '' : ' part') },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('strong', {}, `Submitted · ${r.score}/100`), h('span', { class: 'tiny muted num' }, mmss(r.took))),
        h('span', { class: 'tiny muted' }, `${r.passed} of ${r.n} hidden checks passed${ss.best > r.score ? ` · best ${ss.best}` : ''}`),
        h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm', onclick: () => c.go('mentor') }, 'Mentor console'), h('button', { class: 'btn sm ghost', onclick: () => c.go('home') }, 'Back to today'))));
    }

    /* ---------- timer ---------- */
    function paintTimer() {
      const left = LIMIT_S - ss.elapsed;
      timerB.textContent = mmss(left);
      timerBar.style.width = `${Math.max(0, left) / LIMIT_S * 100}%`;
      timer.classList.toggle('warn', left <= 300 && left > 0); timer.classList.toggle('over', left <= 0);
      timerNote.textContent = left <= 0 ? "Time's up. You can still submit." : ss.submitted ? 'Submitted · you can keep improving' : 'Time left · 20-minute practical';
    }
    L.tick = setInterval(() => { if (document.hidden) return; ss.elapsed++; paintTimer(); }, 1000);

    /* ---------- first paint ---------- */
    const activePk = picker.querySelector('[aria-pressed="true"]');
    if (activePk) requestAnimationFrame(() => { if (activePk.offsetLeft + activePk.offsetWidth > picker.clientWidth) picker.scrollLeft = activePk.offsetLeft - 8; });
    loadActive(); paintTerm(); paintChecks(); paintLadder(); paintChat(); paintResult(); paintTimer(); refreshPreviewTab();
    setPane(ss.pane === 'preview' && ss.last && ss.last.passed === ss.last.total ? 'preview' : 'terminal');
  }

  NM.register('practical', {
    label: 'Practical lab', title: 'Practical lab', icon: 'code', group: 'Student', order: 30,
    render(root, c) { injectCSS(); mount(root, c); },
    destroy() { cleanup(); },
    _buildSpec: buildSpec,
  });
})();
