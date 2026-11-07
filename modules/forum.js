/* Doubt forum: students ask about any lecture or practical, the AI tutor answers first with hints,
   and a mentor confirms. Seeded threads are rebuilt per career field; the student's own questions,
   votes and replies live in module-level state so they survive navigation and field switches.
   All people, threads and numbers are fictional demo data. */
(function () {
  const ME = 'S1001';
  const MENTOR = 'Kavita Rao';
  const AI_LABEL = 'AI tutor · gives hints, not full graded answers';

  /* ---------- module-level state ---------- */
  const seeded = {};          // field id -> [thread]
  const mine = [];            // threads the student asked in this session (kept across fields)
  const ui = { filter: 'all', q: '', sort: 'newest', month: 'all', open: null, drafts: {} };
  let pendingOpen = null;     // thread to open on the next visit (set when a mentor replies off-screen)
  let flash = null;           // thread id to highlight briefly in the list
  const streams = {};         // thread id -> { timer, full, finish }
  let mount = null;           // { root, c, main } while the forum is on screen
  let uid = 0;

  /* ---------- helpers ---------- */
  const D = () => window.NM_DATA;
  const lectureById = (id) => D().lectures.find((l) => l.id === Number(id)) || null;
  const initials = (n) => String(n).split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const first = (n) => String(n).split(' ')[0];
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function rel(ts) {
    const m = Math.max(0, (Date.now() - ts) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${Math.round(m)} min ago`;
    if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
    const d = Math.round(m / 1440); return d === 1 ? 'Yesterday' : `${d} days ago`;
  }
  function shortText(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    const cut = s.split(/(?<=\.)\s/)[0];
    const t = cut.length <= n ? cut : s.slice(0, n).replace(/\s+\S*$/, '') + '…';
    return t;
  }
  const moment = (lecId) => { const m = (lecId * 7) % 31 + 6; const s = (lecId * 13) % 60; return `${m}:${String(s).padStart(2, '0')}`; };

  const STOP = new Set('a an the and or but if is are was were be been to of in on at for with my me i it its this that what why how when where do does did not no can cant can\'t cannot from by as so get got just than then there their your you we our they them have has had will would should could into out up about after before still even also only any some all one two use using used'.split(' '));
  const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+#.\- ]/g, ' ').split(/\s+/).map((w) => w.replace(/^[.\-]+|[.\-]+$/g, '')).filter((w) => w.length > 2 && !STOP.has(w));
  const ABUSE = /\b(idiot|stupid|dumb|shut up|moron|useless mentor|loser)\b/i;

  /* Tiny syntax colouring for code blocks (uses the shared .code spans). */
  function hl(code) {
    const re = /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(def|return|import|from|class|if|else|elif|for|in|while|with|as|try|except|finally|raise|print|True|False|None|async|await|const|let|function|FROM|RUN|COPY|USER|CMD|WORKDIR|EXPOSE|ENV|services|image|depends_on|environment|ports|git|docker|curl|POST|GET)\b|\b(\d+(?:\.\d+)?)\b/g;
    const esc = (s) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    let out = ''; let last = 0; let m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      if (m[1]) out += `<span class="c">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="s">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="k">${esc(m[3])}</span>`;
      else out += `<span class="n">${esc(m[4])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  /* ---------- seeded threads per field ---------- */
  function endpointOf(task) { const m = /\b(POST|GET)\s+(\/[\w\-\/{}]+)/.exec(task || ''); return m ? m[2] : '/items'; }
  function loadHint(fmt) {
    const map = {
      csv: ['pandas.read_csv', 13, 'Open the file in the workspace preview first and check the separator and the header row.'],
      json: ['json.load', 16, 'Open the file and check whether the top level is a list or an object; that decides how you loop over it.'],
      jsonl: ['a line-by-line loop with json.loads', 16, 'Each line is its own JSON object. What happens if you call json.load on the whole file?'],
      sql: ['psql to restore the dump, then a SELECT', 35, 'A .sql dump is a script that rebuilds tables. Restore it into the lab database before you query it.'],
      log: ['open() with a for loop over lines', 40, 'The file is large. Read it line by line instead of loading it all at once.'],
      yaml: ['yaml.safe_load', 16, 'YAML is close to JSON. Print the keys at the top level before you dig deeper.'],
      pdf: ['a PDF text extractor such as pypdf', 49, 'Extract the text from one page first and check that it is readable before you process all pages.'],
      repo: ['git log and your editor', 18, 'It is a repository with history. Start with git log --oneline to see how it grew.'],
      xlsx: ['pandas.read_excel', 13, 'Check how many sheets the workbook has before you load it.'],
    };
    return map[fmt] || map.csv;
  }

  function buildSeeds(f) {
    const d = D();
    const P = f.practicals || {};
    const fs = d.students.filter((s) => s.field === f.id && s.id !== ME);
    const others = d.students.filter((s) => s.field !== f.id && s.id !== ME);
    const pick = (i, local) => { const pool = local && fs.length ? fs : others; return pool[i % pool.length]; };
    const me = d.students.find((s) => s.id === ME) || { id: ME, name: d.demo_student.name };
    const now = Date.now();
    const ago = (min) => now - min * 60000;
    const ds = f.datasets || [];
    const ds0 = ds[0] || { id: 'DS-01', title: 'Lab dataset', size: 'small', format: 'csv' };
    const ds2 = ds[2] || ds0;
    const cap = (f.capstones && (f.capstones[1] || f.capstones[0])) || { id: 'C2', title: 'Capstone 2' };
    const task = (k, fallback) => (P[k] ? shortText(P[k].task, 170) : fallback);
    const lh = loadHint(ds2.format);
    const tag = f.id;

    const T = [];
    const add = (o) => T.push(Object.assign({
      id: `${tag}-${T.length + 1}`, field: f.id, fieldShort: f.short, votes: 0, voted: false, replies: [], mentor: null,
      solved: false, needs: false, code: null, codeLabel: null, lecture: null, extraTag: null, mineSeed: false,
      ai: null,
    }, o));
    const reply = (who, text, votes, min) => ({ id: 'r' + (++uid), name: who.name, sid: who.id, text, votes, voted: false, ts: ago(min) });
    const ai = (text, secs) => ({ text, secs, helpful: null, streaming: false, typing: false });
    const mentor = (text, min) => ({ name: MENTOR, text, ts: ago(min), votes: 3, voted: false });

    // 1. The demo student's own open question (so "My questions" and "Mark as solved" work straight away)
    add({
      title: 'Webhook practical: my flow runs but the caller never gets a response',
      author: me.name, sid: ME, mineSeed: true, lecture: 65, ts: ago(35), votes: 6,
      body: `Lecture 65 practical for ${f.company}. The task: "${task('65', 'Catch a webhook and answer the caller.')}" The run shows up in the Runs tab, but curl just waits and then times out. What am I missing?`,
      code: `$ curl -X POST http://localhost:8088/hooks/lab-events \\\n    -H "Content-Type: application/json" \\\n    -d '{"event_id": "ev-001"}'\ncurl: (28) Operation timed out after 30001 milliseconds`, codeLabel: 'terminal',
      ai: ai('Good catch that the run appears. That tells you the trigger works. Some hints:\n1. A Catch Webhook trigger only answers the caller when the flow ends with a Return Response step. Is there one, and is it the last step?\n2. Look at the trigger settings: does it reply straight away, or wait for the flow to finish?\n3. Run curl again with -i so you see the status code. You are aiming for 202, not a timeout.', 6),
      replies: [reply(pick(0, true), 'I had the same thing. Hint 1 was it for me. Check the step order in the flow editor.', 2, 20)],
    });
    // 2. MCP server with no tools
    add({
      title: 'MCP Inspector connects to my server but shows zero tools',
      author: pick(1, true).name, sid: pick(1, true).id, lecture: 57, ts: ago(90), votes: 14,
      body: `Working on Lecture 57: "${task('57', 'Turn a Python function into an MCP server.')}" The Inspector says Connected, but the Tools tab is empty.`,
      code: 'from mcp.server.fastmcp import FastMCP\n\nmcp = FastMCP("lab-tools")\n\ndef lookup(query: str) -> dict:\n    """Return matching rows."""\n    return {"query": query, "rows": []}\n\nif __name__ == "__main__":\n    mcp.run()', codeLabel: 'server.py',
      ai: ai('Hints, not the full fix:\n1. FastMCP only lists functions you register. Look at the line just above def lookup. What does the lecture put there?\n2. After you change the file, restart the server from the Inspector. It does not reload on its own.\n3. Keep the docstring. It becomes the tool description the client sees.', 7),
      mentor: mentor('Confirmed. The missing piece is the tool decorator from the lecture. Also keep type hints on every argument, because the Inspector builds the input form from them.', 60),
      replies: [reply(pick(2, false), 'Restarting the Inspector after the change was the part I kept forgetting.', 4, 55)],
    });
    // 3. Retrieval comparison (solved)
    add({
      title: 'Embedding search scores lower than BM25 on the practical questions. Did I do it wrong?',
      author: pick(2, true).name, sid: pick(2, true).id, lecture: 51, ts: ago(26 * 60), votes: 22, solved: true,
      body: `Lecture 51: "${task('51', 'Compare keyword and embedding retrieval.')}" My keyword search finds more of the right chunks than the embeddings. I expected the opposite.`,
      ai: ai('Not necessarily wrong. Check these before you change anything:\n1. Did you embed the questions with the same model as the chunks (nomic-embed-text)?\n2. Print the top 3 chunks for one question where BM25 wins. Do the question and the chunk share exact words such as IDs or codes? Keyword search is strong on exact terms.\n3. Cosine similarity needs vectors of the same length. Are you comparing like with like?', 9),
      mentor: mentor('Good hints. Exact codes and IDs favour BM25, and spotting that is the point of the lecture. Write it into your comparison. The checker grades your comparison and reasoning, not which method wins.', 22 * 60),
      replies: [reply(pick(3, false), 'Same result here. Adding the reason to my report got it accepted.', 5, 20 * 60)],
    });
    // 4. Dockerfile non-root user
    add({
      title: 'Dockerfile: pip install fails with "Permission denied" after adding a non-root user',
      author: pick(3, true).name, sid: pick(3, true).id, lecture: 43, ts: ago(50), votes: 9,
      body: `Lecture 43: "${task('43', 'Write a Dockerfile for a Python app.')}" The build stops at the pip install line.`,
      code: 'FROM python:3.12-slim\nWORKDIR /app\nRUN useradd -m appuser\nUSER appuser\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]', codeLabel: 'Dockerfile',
      ai: ai('Read the Dockerfile top to bottom and ask one question for each line: which user runs this?\n1. Installing packages usually needs more rights than a normal user has.\n2. So where should USER appuser go, so that installs happen first and the app still runs as appuser?\n3. Keep the requirements install before COPY . . so Docker can cache that layer.', 5),
      replies: [reply(pick(4, false), 'Moving one line fixed it for me. Hint 2 is the whole answer.', 3, 30)],
    });
    // 5. FastAPI 422
    const ep = endpointOf(P['33'] && P['33'].task);
    add({
      title: 'FastAPI returns 422 even though my JSON looks right',
      author: pick(4, true).name, sid: pick(4, true).id, lecture: 33, ts: ago(5 * 60), votes: 11,
      body: `Lecture 33: "${task('33', 'Create an endpoint with a Pydantic model.')}" Every request I send gets a 422.`,
      code: `$ curl -X POST localhost:8000${ep} -d '{"name": "test"}'\n{"detail":[{"type":"missing","loc":["body"],"msg":"Field required"}]}`, codeLabel: 'terminal',
      ai: ai('A 422 means FastAPI received the request but it did not match your Pydantic model.\n1. Read the "loc" list in the reply. It points to the part that failed.\n2. Look at your curl call. Is there a Content-Type: application/json header? Without it the body is not read as JSON.\n3. Then compare each field name and type in your model with the JSON you send.', 8),
      mentor: mentor('Confirmed. Hint 2 is the usual cause. Once the header is there, the error message will name the exact field that is wrong.', 4 * 60),
    });
    // 6. Prompt injection (needs mentor)
    add({
      title: 'Prompt-injection report: how many attacks must succeed for the practical to pass?',
      author: pick(5, true).name, sid: pick(5, true).id, lecture: 90, ts: ago(15), votes: 5, needs: true,
      body: `Lecture 90: "${task('90', 'Run injection cases and write a report.')}" Only a few of my cases worked. Will the report fail?`,
      ai: Object.assign(ai('I can\'t tell you how the grader scores this, but here is how to think about it:\n1. The practical looks at your evidence and how you map each case to the OWASP Top 10 for LLM apps.\n2. Record every case, including the ones that did not work. A failed attack is evidence that a defence held.\n3. Re-read the expected output on the practical page and check each item off.', 8), { helpful: false }),
    });
    // 7. Dataset location (solved)
    add({
      title: `Where do I find ${ds0.id} (${ds0.title}) in my workspace?`,
      author: pick(6, true).name, sid: pick(6, true).id, extraTag: 'Datasets', month: 8, ts: ago(2 * 1440), votes: 7, solved: true,
      body: `The practical mentions ${ds0.id} but I can't see it in my project folder. Do I need to download it from somewhere?`,
      ai: ai('No download needed. Some hints:\n1. Lab datasets are already in your workspace, in the datasets folder. List it from the terminal.\n2. Each dataset sits in a folder named after its ID.\n3. Copy the files into your project folder before you change them, so the original stays clean for the checker.', 6),
      mentor: mentor(`Correct. ${ds0.id} is ${ds0.size}. If the folder is missing, stop and start your workspace once and it will appear.`, 2 * 1440 - 200),
    });
    // 8. Capstone scope
    add({
      title: `Can I add a feature to "${cap.title}" that is not in the brief?`,
      author: pick(7, true).name, sid: pick(7, true).id, extraTag: `Capstone ${cap.slot || 2}`, month: 8, ts: ago(8 * 60), votes: 13, capstone: true,
      body: `I want to add an extra screen to my capstone for ${f.company}. Will that hurt my rubric score, or is it a plus?`,
      ai: ai('Good instinct to ask first. Think about it this way:\n1. The rubric grades the milestones in the brief. Are all of them done and tested?\n2. An extra feature is worth most when it solves a real problem for the company in the brief. Which problem would yours solve?\n3. Keep extras separate, for example on their own branch, so they can\'t break graded work.', 7),
      mentor: mentor('Yes, as an extra. Finish every milestone in the brief first, because that is what the rubric scores. Build the extra on its own branch and describe it in your README. I will look at it in your review.', 6 * 60),
      replies: [reply(pick(8, false), 'My mentor said the same last month. The README note matters.', 1, 5 * 60)],
    });
    // 9. Loading a dataset format
    add({
      title: `${ds2.id} is a .${ds2.format} file. What is the cleanest way to load it in Python?`,
      author: pick(8, true).name, sid: pick(8, true).id, lecture: lh[1], ts: ago(3 * 60), votes: 4,
      body: `${ds2.title} (${ds2.size}). I keep getting messy output when I try to read it.`,
      ai: ai(`Some hints:\n1. The usual tool for this format is ${lh[0]}. Lecture ${lh[1]} shows it.\n2. ${lh[2]}\n3. Print only the first 3 records before you write any processing code.`, 7),
    });

    // Common threads (everyone takes Months 1 to 3 and the shared tools)
    add({
      title: 'IndexError: list index out of range when I loop over my 50-item list',
      author: pick(9, false).name, sid: pick(9, false).id, lecture: 13, ts: ago(3 * 1440), votes: 18, solved: true,
      body: 'The program prints all the titles and then crashes at the very end.',
      code: 'tasks = load_tasks()          # 50 items\nfor i in range(len(tasks) + 1):\n    print(tasks[i]["title"])\n\nIndexError: list index out of range', codeLabel: 'tasks.py',
      ai: ai('The error names the line. Some hints:\n1. Which value of i does the last turn of the loop use?\n2. Python lists start at 0. What is the last valid index for 50 items?\n3. You may not need an index at all. The lecture shows how to loop over the list directly.', 4),
      replies: [reply(pick(10, false), 'Hint 3 made my code shorter too.', 6, 3 * 1440 - 60)],
    });
    add({
      title: 'json.loads fails with "Expecting property name enclosed in double quotes"',
      author: pick(11, false).name, sid: pick(11, false).id, lecture: 16, ts: ago(30 * 60), votes: 15,
      code: 'import json\nraw = "{\'name\': \'Asha\', \'city\': \'Pune\'}"\ndata = json.loads(raw)\n\njson.decoder.JSONDecodeError: Expecting property name enclosed in double quotes', codeLabel: 'storage.py',
      body: 'I saved my data to a file and now I can\'t read it back.',
      ai: ai('Compare your string with a JSON example from the lecture.\n1. Which quote marks does JSON use around keys and text?\n2. Your text looks like a Python dictionary printed with print(). How did you write the file?\n3. If you write the file yourself, the lecture shows a function that always produces valid JSON.', 5),
      mentor: mentor('Confirmed. Save with json.dumps (or json.dump) and the file will always load. Delete the old file once, because it is in the wrong format.', 28 * 60),
    });
    add({
      title: 'git push rejected: "the remote contains work that you do not have locally"',
      author: pick(12, false).name, sid: pick(12, false).id, lecture: 18, ts: ago(4 * 1440), votes: 24,
      body: 'I created the repo on GitHub, then tried to push my project and got this.',
      code: '$ git push origin main\n ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs\nhint: Updates were rejected because the remote contains work that you do not have locally.', codeLabel: 'terminal',
      ai: ai('Nothing is broken. Some hints:\n1. Did you tick "Add a README" when you created the repo on GitHub? That is a commit you don\'t have yet.\n2. Bring that work down first. Which Git command fetches and merges in one step?\n3. Don\'t use --force on your portfolio repo. You can lose commits.', 6),
      mentor: mentor('Right. Pull first, sort out any conflict, then push again. This happens to most people the first time they create a README on GitHub.', 4 * 1440 - 120),
      replies: [reply(pick(13, false), 'This is the most useful thread in the forum.', 9, 3 * 1440)],
    });
    add({
      title: 'My few-shot prompt makes the model copy my examples word for word',
      author: pick(14, false).name, sid: pick(14, false).id, lecture: 20, ts: ago(2 * 60), votes: 8,
      body: 'For new tickets it keeps answering with the exact category text from my examples, even when it does not fit.',
      code: 'Classify the ticket. Examples:\nTicket: "Order late" -> Category: Delivery\nTicket: "Refund not received" -> Category: Payment\nTicket: {ticket} -> Category:', codeLabel: 'prompt',
      ai: ai('Some hints:\n1. Are all your examples similar in length and wording? Try examples that look different from each other.\n2. Add a clear rule for the output: one word, chosen from a fixed list you write in the prompt.\n3. Test on 5 tickets that look nothing like your examples before you change anything else.', 8),
    });
    add({
      title: 'Docker Compose: my app can\'t reach the database on localhost:5432',
      author: pick(15, false).name, sid: pick(15, false).id, lecture: 46, ts: ago(25), votes: 3, needs: true,
      body: 'The database container is running, but the app container logs "connection refused".',
      code: 'services:\n  app:\n    build: .\n    environment:\n      DATABASE_URL: "postgresql://lab:lab@localhost:5432/lab"\n  db:\n    image: postgres:16', codeLabel: 'compose.yaml',
      ai: ai('Some hints:\n1. Inside a container, localhost means that container itself, not your workspace.\n2. In Compose, services reach each other by service name. What is your database service called?\n3. The app may start before the database is ready. Look up depends_on with a health check in the lecture notes.', 9),
    });
    add({
      title: 'My lab AI key says "budget reached" and it is only the 18th',
      author: pick(16, false).name, sid: pick(16, false).id, lecture: 26, ts: ago(20 * 60), votes: 19,
      body: 'My batch script ran for a while and now every call to the lab model is refused.',
      ai: ai('Each lab key has a monthly budget. Some hints:\n1. Open the usage panel in your workspace and find the run that used the most.\n2. Long prompts inside a loop add up fast. Is your script sending the whole document on every call?\n3. Lecture 21 covers tokens, prompt caching and cost. It shows how to cut this down.', 7),
      mentor: mentor('Confirmed. Your batch loop resent the full document each time. I have added a small top-up for this month. Fix the loop first so it does not happen again.', 18 * 60),
    });
    return T;
  }

  function seedsFor(f) { if (!seeded[f.id]) seeded[f.id] = buildSeeds(f); return seeded[f.id]; }
  function allThreads(f) { return mine.concat(seedsFor(f)); }
  const isMine = (t) => t.sid === ME;
  function monthOf(t) { if (t.month) return t.month; const l = lectureById(t.lecture); return l ? l.month : 8; }
  function status(t) {
    if (t.ai && (t.ai.typing || t.ai.streaming)) return ['typing', 'AI tutor is typing', 'violet'];
    if (!t.ai) return ['waiting', 'Waiting for AI tutor', ''];
    if (t.solved) return ['solved', 'Solved', 'green'];
    if (t.mentor) return ['mentor', 'Mentor confirmed', 'blue'];
    if (t.needs || t.ai.helpful === false) return ['needs', 'Needs mentor', 'amber'];
    return ['ai', 'AI answered', 'violet'];
  }
  const answerCount = (t) => (t.ai && !t.ai.typing ? 1 : 0) + (t.mentor ? 1 : 0) + t.replies.length;
  function tagsOf(t) {
    const tags = [];
    const l = lectureById(t.lecture);
    if (l) tags.push(`L${l.id}`, shortText(l.topic.split(/[:;]/)[0], 34));
    if (t.extraTag) tags.push(t.extraTag);
    tags.push(`Month ${monthOf(t)}`);
    return tags;
  }

  /* ---------- AI tutor for new questions (deterministic, built from the title) ---------- */
  function topicHint(text) {
    const s = text.toLowerCase();
    const rules = [
      [/docker|container|compose|image/, 'Run docker ps -a and then docker logs with your container name. Does the container start and stop straight away?'],
      [/\bgit\b|github|push|commit|branch|merge/, 'Run git status and read every line. It tells you which branch you are on and what is waiting to be committed.'],
      [/webhook|flow|activepieces|trigger|router/, 'Open the Runs tab for the flow. Does a run appear at all? If it does, which step turned red?'],
      [/mcp|inspector|tool/, 'Restart the server in MCP Inspector and open the Tools tab. Is your tool listed with the inputs you expect?'],
      [/sql|database|postgres|table|query/, 'Run the query on its own in the database console first, with LIMIT 5, before you call it from code.'],
      [/prompt|few-shot|system prompt|hallucinat/, 'Write down one example of the output you want and compare it with what you get. Change one part of the prompt at a time.'],
      [/api|key|claude|bedrock|model|token|budget|429|rate/, 'Print the whole response, not only the text. Check the status code and the stop reason before you change the prompt.'],
      [/ssh|vps|port|firewall|ufw|deploy/, 'Check one layer at a time: is the service running, is it listening on the port, and does the firewall allow that port?'],
      [/error|exception|traceback|crash|fails?|failing|broken|not working|wrong/, 'Read the last line of the error first. It names the problem. The line above it shows where it happened.'],
      [/json|dict|list|loop|function|python|variable|string/, 'Add a print() just before the line that fails. Show the value and its type() so you can see what Python really has.'],
      [/pandas|csv|chart|dashboard|data/, 'Look at the first 5 rows and the column types before anything else. Many problems start with a column read as text.'],
    ];
    for (const [re, hint] of rules) if (re.test(s)) return hint;
    return 'Make the problem smaller. Try the same step with the smallest input you can, and check each step on its own.';
  }
  function tutorAnswer(t) {
    const kws = [...new Set(words(t.title))].slice(0, 3);
    const lec = lectureById(t.lecture) || lectureById(D().demo_student.lecture);
    const lines = ['Here are some hints to get you moving. I won\'t write the graded part for you.'];
    lines.push(kws.length
      ? `1. Start with "${kws.join('", "')}". Write one line on what you expect to happen and one line on what actually happens.`
      : '1. Write one line on what you expect to happen and one line on what actually happens.');
    lines.push('2. ' + topicHint(t.title + ' ' + t.body));
    if (t.code) {
      const n = Math.min(3, t.code.split('\n').length);
      lines.push(`3. In the code you attached, look closely at line ${n}. Print the values it uses just before it runs and check they are what you expect.`);
    } else {
      lines.push('3. If you can, attach the smallest piece of code that shows the problem. It makes the next hint much sharper.');
    }
    lines.push(`4. Lecture ${lec.id} (${lec.topic}) covers this at about ${moment(lec.id)}. Re-watch that part, then retry one step at a time.`);
    lines.push('Still stuck? Reply here with what you tried. A mentor will check this thread.');
    return lines.join('\n');
  }
  function codeFor(lecId, f) {
    const P = (f.practicals || {})[String(lecId)];
    const lec = lectureById(lecId);
    const byLec = {
      33: `from fastapi import FastAPI\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nclass Item(BaseModel):\n    name: str\n\n@app.post("${endpointOf(P && P.task)}")\ndef create(item: Item):\n    return item`,
      43: 'FROM python:3.12-slim\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nCMD ["python", "main.py"]',
      51: 'def retrieve_keyword(question, chunks, k=3):\n    scores = [bm25(question, c) for c in chunks]\n    # TODO: return the top k chunks\n    return chunks[:k]',
      57: 'from mcp.server.fastmcp import FastMCP\n\nmcp = FastMCP("lab-tools")\n\ndef lookup(query: str) -> dict:\n    return {"query": query}',
      65: '$ curl -i -X POST http://localhost:8088/hooks/lab-events \\\n    -H "Content-Type: application/json" \\\n    -d \'{"event_id": "ev-001"}\'',
      90: 'for case in cases:\n    reply = ask_bot(case["prompt"])\n    leaked = "CANARY" in reply\n    results.append({"id": case["id"], "leaked": leaked})',
    };
    if (byLec[lecId]) return byLec[lecId];
    const m = lec ? lec.month : 2;
    const topic = lec ? lec.topic : 'practical';
    const byMonth = {
      1: `# ${topic}\nQuestion: ...\nAI answer: ...\nCorrect or invented? ...`,
      2: `# ${topic}\ndef run(items):\n    for item in items:\n        print(item)\n\nrun(load_items())`,
      3: `# ${topic}\nimport os\nresponse = client.messages.create(\n    model=os.environ["LAB_MODEL"],\n    max_tokens=300,\n    messages=[{"role": "user", "content": prompt}],\n)`,
      4: `// ${topic}\nconst res = await fetch("/api/items");\nconst data = await res.json();\nrender(data);`,
      5: `$ docker compose up -d\n$ docker compose ps\n# ${topic}`,
      6: `# ${topic}\nchunks = chunk(text, size=500, overlap=50)\nprint(len(chunks))`,
      7: `# ${topic}\n@mcp.tool()\ndef search(query: str, limit: int = 5) -> list:\n    return find(query)[:limit]`,
      8: `// ${topic}\nexport const code = async (inputs) => {\n  const rows = inputs.rows;\n  return rows.filter((r) => r.status === "new");\n};`,
      9: `# ${topic}\nfor step in range(max_steps):\n    result = agent.run(task)\n    if result.done:\n        break`,
      10: `# ${topic}\nlogger.info("request", extra={"route": "/health", "ms": 42})`,
      11: `# ${topic}\nif looks_like_injection(user_text):\n    return refuse()`,
      12: `# ${topic}\ndef test_health(client):\n    assert client.get("/health").status_code == 200`,
    };
    return byMonth[m] || byMonth[2];
  }
  function mentorText(t) {
    const lec = lectureById(t.lecture);
    return `Confirmed. The AI tutor's hints point the right way${lec ? ` for Lecture ${lec.id}` : ''}. Start with hint 2. If it still fails, reply with the full error output and I will go through it with you.`;
  }

  /* ---------- the ask flow: AI typing, streaming, then a mentor confirmation ---------- */
  function rerenderIfOpen(id, full) {
    if (!mount || !mount.root.isConnected) return;
    if (ui.open === id) {
      if (full) renderMain();
      else {
        const t = findThread(id); const el = mount.root.querySelector(`[data-ai-body="${id}"]`);
        if (t && el) el.textContent = t.ai.text;
      }
    } else if (!ui.open && full) renderList();
  }
  function findThread(id) {
    if (!id) return null;
    const m = mine.find((t) => t.id === id); if (m) return m;
    for (const k of Object.keys(seeded)) { const t = seeded[k].find((x) => x.id === id); if (t) return t; }
    return null;
  }
  function startAnswer(t, c) {
    t.ai = { text: '', secs: 3, helpful: null, typing: true, streaming: false };
    const full = tutorAnswer(t);
    const finish = () => {
      const s = streams[t.id]; if (s) { clearTimeout(s.timer); clearInterval(s.timer); delete streams[t.id]; }
      t.ai.text = full; t.ai.typing = false; t.ai.streaming = false;
      NM.emit('forum:answered', { title: t.title, by: 'AI tutor' });
      rerenderIfOpen(t.id, true);
    };
    streams[t.id] = { full, finish };
    streams[t.id].timer = setTimeout(() => {
      t.ai.typing = false;
      if (reduced()) { finish(); return; }
      t.ai.streaming = true;
      rerenderIfOpen(t.id, true);
      const step = Math.ceil(full.length / 30);
      let i = 0;
      streams[t.id].timer = setInterval(() => {
        i += step; t.ai.text = full.slice(0, i);
        if (i >= full.length) finish(); else rerenderIfOpen(t.id, false);
      }, 60);
    }, 1000);
    // Mentor confirmation (sped up for the demo; real mentors confirm within a day)
    t.mentorTimer = setTimeout(() => {
      t.mentorTimer = null;
      if (streams[t.id]) streams[t.id].finish();
      t.mentor = { name: MENTOR, text: mentorText(t), ts: Date.now(), votes: 0, voted: false, fresh: true };
      NM.notify('Mentor replied to your doubt', `${MENTOR} confirmed the answer to "${shortText(t.title, 60)}".`, 'forum');
      NM.toast(`${MENTOR} confirmed the answer to your doubt`, 'green');
      NM.emit('forum:answered', { title: t.title, by: MENTOR });
      const onForum = mount && mount.root.isConnected;
      if (!onForum) pendingOpen = t.id;
      rerenderIfOpen(t.id, true);
    }, 6000);
    void c;
  }

  /* ---------- styles ---------- */
  function injectCSS() {
    if (document.getElementById('m-forum')) return;
    const css = `
.m-forum { display: grid; gap: 20px; min-width: 0 }
.m-forum .fhead { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap }
.m-forum .fhead > div { min-width: 0; display: grid; gap: 4px }
.m-forum .fhead p { color: var(--muted); max-width: 62ch }
.m-forum .flay { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start }
.m-forum .fmain { min-width: 0; display: grid; gap: 14px }
.m-forum .faside { display: grid; gap: 16px; min-width: 0 }
.m-forum .tools { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 0 }
.m-forum .tools .tabs { padding: 0 12px }
.m-forum .tab .ct { font-size: 11.5px; font-weight: 700; color: var(--faint); margin-left: 4px }
.m-forum .tab[aria-selected="true"] .ct { color: var(--brand) }
.m-forum .ctrl { display: flex; gap: 10px; flex-wrap: wrap; padding: 0 16px 14px }
.m-forum .srch { position: relative; flex: 1 1 220px; min-width: 0 }
.m-forum .srch svg { position: absolute; left: 11px; top: 50%; width: 16px; height: 16px; transform: translateY(-50%); color: var(--faint); pointer-events: none }
.m-forum .srch input { padding-left: 34px }
.m-forum .ctrl select { width: auto; flex: 0 1 auto; min-width: 0; max-width: 100%; cursor: pointer }
.m-forum .list { padding: 0; overflow: hidden }
.m-forum .listhead { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap }
.m-forum .trow { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 14px; padding: 14px 16px; border-top: 1px solid var(--line); cursor: pointer; align-items: start; transition: background .15s }
.m-forum .trow:first-of-type { border-top: 0 }
.m-forum .trow:hover { background: var(--surface-2) }
.m-forum .trow.flash { background: var(--brand-soft) }
.m-forum .trow > div { min-width: 0 }
.m-forum .tlink { background: none; border: 0; padding: 0; text-align: left; font-weight: 700; font-size: 15px; color: var(--fg); cursor: pointer; line-height: 1.35 }
.m-forum .trow:hover .tlink { color: var(--brand) }
.m-forum .tmeta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 6px }
.m-forum .tmeta .pill { font-weight: 600 }
.m-forum .tsnip { color: var(--muted); font-size: 13px; margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden }
.m-forum .tside { display: grid; gap: 6px; justify-items: end; text-align: right }
.m-forum .vote { display: grid; justify-items: center; gap: 0; width: 48px; padding: 6px 0; border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius-sm); cursor: pointer; color: var(--muted); font-weight: 800; font-size: 14px; line-height: 1.2 }
.m-forum .vote svg { width: 16px; height: 16px }
.m-forum .vote:hover { border-color: var(--brand); color: var(--brand) }
.m-forum .vote[aria-pressed="true"] { background: var(--brand-soft); border-color: var(--brand); color: var(--brand) }
.m-forum .vote.inline { display: inline-flex; width: auto; gap: 6px; padding: 5px 10px; font-size: 13px }
.m-forum .vote.inline svg { width: 14px; height: 14px }
.m-forum .by { display: inline-flex; gap: 6px; align-items: center; color: var(--muted); font-size: 12.5px }
.m-forum .by.me b { color: var(--brand) }
.m-forum .mini-av { width: 22px; height: 22px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 10px; font-weight: 800; background: var(--surface-2); color: var(--muted); flex: none }
.m-forum .empty .btn { margin-top: 12px }
/* thread page */
.m-forum .back { justify-self: start }
.m-forum .qcard { display: grid; gap: 14px }
.m-forum .qtitle { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 14px; align-items: start }
.m-forum .qtitle > div { min-width: 0; display: grid; gap: 8px }
.m-forum .qtitle h1 { font-size: 21px; overflow-wrap: anywhere }
.m-forum .qbody { white-space: pre-line; overflow-wrap: anywhere }
.m-forum .codebox { display: grid; grid-template-columns: minmax(0, 1fr) }
.m-forum .codebox .lbl { font-family: var(--mono); font-size: 11.5px; color: var(--code-muted); background: var(--code-bg); border: 1px solid color-mix(in srgb, var(--code-bg) 80%, var(--line)); border-bottom: 0; border-radius: var(--radius-sm) var(--radius-sm) 0 0; padding: 8px 16px 0 }
.m-forum .codebox .code { margin: 0; border-radius: 0 0 var(--radius-sm) var(--radius-sm); border-top: 0; padding-top: 6px }
.m-forum .qact { display: flex; gap: 8px; flex-wrap: wrap }
.m-forum .ans { display: grid; gap: 10px; border-left: 3px solid var(--line) }
.m-forum .ans.ai { border-left-color: var(--violet) }
.m-forum .ans.mentor { border-left-color: var(--green) }
.m-forum .ans.mine { border-left-color: var(--brand) }
.m-forum .ans.fresh { animation: mf-in .5s ease }
.m-forum .ahead { display: flex; gap: 10px; align-items: center; flex-wrap: wrap }
.m-forum .ahead > div { min-width: 0 }
.m-forum .ahead b { font-size: 14px }
.m-forum .av { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 12.5px; flex: none; background: var(--surface-2); color: var(--muted) }
.m-forum .av svg { width: 18px; height: 18px }
.m-forum .av.ai { background: var(--violet-soft); color: var(--violet) }
.m-forum .av.mentor { background: var(--green-soft); color: var(--green) }
.m-forum .av.me { background: var(--brand-soft); color: var(--brand) }
.m-forum .atext { white-space: pre-line; overflow-wrap: anywhere; font-size: 14.5px }
.m-forum .afoot { display: flex; gap: 8px; align-items: center; flex-wrap: wrap }
.m-forum .afoot .sp { flex: 1 }
.m-forum .fb[aria-pressed="true"].up { background: var(--green-soft); border-color: var(--green); color: var(--green) }
.m-forum .fb[aria-pressed="true"].down { background: var(--amber-soft); border-color: var(--amber); color: var(--amber) }
.m-forum .typing { display: inline-flex; gap: 4px; align-items: center; padding: 6px 0 }
.m-forum .typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--violet); opacity: .35; animation: mf-dot 1s infinite }
.m-forum .typing i:nth-child(2) { animation-delay: .15s } .m-forum .typing i:nth-child(3) { animation-delay: .3s }
.m-forum .caret { display: inline-block; width: 7px; height: 15px; background: var(--violet); vertical-align: -2px; margin-left: 2px; animation: mf-blink .8s steps(2) infinite }
.m-forum .waitm { display: flex; gap: 10px; align-items: center; color: var(--muted); font-size: 13.5px; border-left: 3px dashed var(--line) }
.m-forum .replybox { display: grid; gap: 10px }
.m-forum .replybox textarea { min-height: 92px; resize: vertical }
.m-forum .rb-foot { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap }
.m-forum .held { color: var(--red); font-size: 13px; font-weight: 600 }
/* aside */
.m-forum .how { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px }
.m-forum .how li { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: start; font-size: 13.5px }
.m-forum .how li b { display: block; font-size: 14px }
.m-forum .how .ix { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand) }
.m-forum .how .ix svg { width: 16px; height: 16px }
.m-forum .how li:nth-child(2) .ix { background: var(--green-soft); color: var(--green) }
.m-forum .how li:nth-child(3) .ix { background: var(--violet-soft); color: var(--violet) }
.m-forum .how li:nth-child(4) .ix { background: var(--amber-soft); color: var(--amber) }
.m-forum .helpers { display: grid; gap: 2px }
.m-forum .helper { display: grid; grid-template-columns: 20px 30px minmax(0, 1fr) auto; gap: 10px; align-items: center; width: 100%; text-align: left; background: none; border: 0; border-radius: var(--radius-sm); padding: 8px 6px; cursor: pointer }
.m-forum .helper:hover { background: var(--surface-2) }
.m-forum .helper .nm { min-width: 0; display: grid }
.m-forum .helper .nm b { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-forum .helper .nm span { font-size: 12px; color: var(--muted) }
.m-forum .helper .av { width: 30px; height: 30px; font-size: 11px }
.m-forum .linkbtn { background: none; border: 0; padding: 0; color: var(--brand); font-weight: 700; cursor: pointer; font-size: 13px }
.m-forum .linkbtn:hover { text-decoration: underline }
.m-forum .fstats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px }
/* ask modal */
.m-forum.mf-ask { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; min-width: 0 }
.m-forum.mf-ask label.fl { display: grid; gap: 6px; font-size: 13px; font-weight: 700 }
.m-forum.mf-ask textarea { min-height: 96px; resize: vertical }
.m-forum.mf-ask .dup { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; background: var(--surface-2); border-radius: var(--radius-sm); padding: 10px 12px }
.m-forum.mf-ask .dup button { display: flex; gap: 8px; align-items: center; justify-content: space-between; width: 100%; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px 10px; cursor: pointer; font-size: 13.5px; font-weight: 600 }
.m-forum.mf-ask .dup button:hover { border-color: var(--brand); color: var(--brand) }
.m-forum.mf-ask .dup button span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.m-forum.mf-ask .sw { display: flex; gap: 10px; align-items: center; cursor: pointer; font-size: 14px; font-weight: 600 }
.m-forum.mf-ask .sw input { appearance: none; -webkit-appearance: none; width: 38px; height: 22px; border-radius: 99px; background: var(--line); position: relative; cursor: pointer; flex: none; margin: 0; transition: background .2s }
.m-forum.mf-ask .sw input::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--surface); transition: transform .2s }
.m-forum.mf-ask .sw input:checked { background: var(--brand) }
.m-forum.mf-ask .sw input:checked::after { transform: translateX(16px) }
.m-forum.mf-ask .err { color: var(--red); font-size: 13px; font-weight: 600 }
.m-forum.mf-ask .mfoot { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap }
.m-forum.mf-ask .code { max-height: 180px }
@keyframes mf-dot { 50% { opacity: 1; transform: translateY(-2px) } }
@keyframes mf-blink { 50% { opacity: 0 } }
@keyframes mf-in { from { opacity: 0; transform: translateY(6px) } }
@media (max-width: 1180px) {
  .m-forum .flay { grid-template-columns: minmax(0, 1fr) }
  .m-forum .faside { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) }
}
@media (max-width: 640px) {
  .m-forum .trow { grid-template-columns: 44px minmax(0, 1fr); gap: 10px; padding: 12px }
  .m-forum .tside { grid-column: 2; justify-items: start; text-align: left; display: flex; gap: 8px; flex-wrap: wrap; align-items: center }
  .m-forum .vote { width: 42px }
  .m-forum .qtitle { grid-template-columns: minmax(0, 1fr) }
  .m-forum .qtitle > .vote { display: none }
  .m-forum .qtitle h1 { font-size: 18px }
  .m-forum .ctrl select { flex: 1 1 140px }
  .m-forum .fhead .btn { width: 100% }
}
@media (prefers-reduced-motion: reduce) { .m-forum .trow, .m-forum .ans.fresh { animation: none; transition: none } .m-forum .caret { animation: none } }
`;
    document.head.append(Object.assign(document.createElement('style'), { id: 'm-forum', textContent: css }));
  }

  /* ---------- rendering ---------- */
  function filtered(f) {
    let list = allThreads(f);
    const q = ui.q.trim().toLowerCase();
    if (ui.filter === 'unanswered') list = list.filter((t) => !t.mentor && !t.solved);
    if (ui.filter === 'mentor') list = list.filter((t) => t.mentor);
    if (ui.filter === 'mine') list = list.filter(isMine);
    if (ui.month !== 'all') list = list.filter((t) => monthOf(t) === Number(ui.month));
    if (q) list = list.filter((t) => [t.title, t.body, t.author, tagsOf(t).join(' '), t.code || ''].join(' ').toLowerCase().includes(q));
    list = list.slice().sort((a, b) => (ui.sort === 'votes' ? (b.votes - a.votes) || (b.ts - a.ts) : b.ts - a.ts));
    return list;
  }

  function voteBtn(c, target, opts) {
    const b = c.h('button', { class: 'vote' + (opts && opts.inline ? ' inline' : ''), type: 'button', 'aria-pressed': target.voted ? 'true' : 'false', 'aria-label': `Upvote (${target.votes} votes)`, title: target.voted ? 'Remove your vote' : 'Upvote: this helped me too' });
    const draw = () => { b.innerHTML = c.icon('star') + `<span class="num">${target.votes}</span>`; b.setAttribute('aria-pressed', target.voted ? 'true' : 'false'); b.setAttribute('aria-label', `Upvote (${target.votes} votes)`); };
    draw();
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      target.voted = !target.voted; target.votes += target.voted ? 1 : -1; draw();
      if (opts && opts.onChange) opts.onChange();
    });
    return b;
  }

  function render(root, c) {
    injectCSS();
    if (pendingOpen) { ui.open = pendingOpen; pendingOpen = null; }
    if (ui.open && !findThread(ui.open)) ui.open = null;
    const { h, field: f } = c;
    const wrap = h('div', { class: 'm-forum' });
    const main = h('div', { class: 'fmain' });
    mount = { root: wrap, c, main, listBox: null, tabsBox: null };

    const head = h('section', { class: 'card fhead' },
      h('div', {},
        h('div', { class: 'eyebrow' }, `Community · ${f.short} · ${f.company}`),
        h('h1', {}, 'Doubt forum'),
        h('p', { class: 'small' }, 'Ask about any lecture or practical. The AI tutor answers in seconds with hints, then a mentor checks the answer.')),
      h('button', { class: 'btn primary', type: 'button', html: c.icon('forum') + '<span>Ask a question</span>', onclick: () => openAsk(c) }));

    wrap.append(head, h('div', { class: 'flay' }, main, aside(c)));
    root.append(wrap);
    renderMain();
  }

  function renderMain() {
    if (!mount) return;
    const { main, c } = mount;
    main.textContent = '';
    const t = ui.open && findThread(ui.open);
    if (t) threadView(main, c, t); else listView(main, c);
  }

  function listView(main, c) {
    const { h, field: f } = c;
    const tabsBox = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Filter questions' });
    const search = h('input', { class: 'field-input', type: 'search', placeholder: 'Search questions, topics or people', value: ui.q, 'aria-label': 'Search questions' });
    search.addEventListener('input', () => { ui.q = search.value; renderList(); });
    const sort = h('select', { class: 'field-input', 'aria-label': 'Sort questions' },
      h('option', { value: 'newest' }, 'Newest first'), h('option', { value: 'votes' }, 'Most votes'));
    sort.value = ui.sort;
    sort.addEventListener('change', () => { ui.sort = sort.value; renderList(); });
    const months = [...new Set(allThreads(f).map(monthOf))].sort((a, b) => a - b);
    if (ui.month !== 'all' && !months.includes(Number(ui.month))) ui.month = 'all';
    const month = h('select', { class: 'field-input', 'aria-label': 'Filter by month' },
      h('option', { value: 'all' }, 'All months'),
      months.map((m) => h('option', { value: String(m) }, `Month ${m} · ${D().months[m]}`)));
    month.value = String(ui.month);
    month.addEventListener('change', () => { ui.month = month.value; renderList(); });

    const tools = h('section', { class: 'card tools' }, tabsBox,
      h('div', { class: 'ctrl' }, h('label', { class: 'srch', html: c.icon('search') }, search), sort, month));
    const listBox = h('section', { class: 'card list', 'aria-live': 'polite' });
    mount.tabsBox = tabsBox; mount.listBox = listBox;
    main.append(tools, listBox);
    renderList();
  }

  function renderList() {
    if (!mount || !mount.listBox || !mount.listBox.isConnected) return;
    const { c, listBox, tabsBox } = mount;
    const { h, field: f } = c;
    const all = allThreads(f);
    const tabs = [['all', 'All', all.length], ['unanswered', 'Unanswered', all.filter((t) => !t.mentor && !t.solved).length], ['mentor', 'Mentor confirmed', all.filter((t) => t.mentor).length], ['mine', 'My questions', all.filter(isMine).length]];
    tabsBox.textContent = '';
    tabs.forEach(([id, label, n]) => tabsBox.append(h('button', {
      class: 'tab', role: 'tab', type: 'button', 'aria-selected': ui.filter === id ? 'true' : 'false',
      title: id === 'unanswered' ? 'Questions still waiting for a mentor' : null,
      onclick: () => { ui.filter = id; renderList(); },
    }, label, h('span', { class: 'ct num' }, String(n)))));

    const list = filtered(f);
    listBox.textContent = '';
    const filterName = tabs.find((x) => x[0] === ui.filter)[1];
    listBox.append(h('div', { class: 'listhead' },
      h('span', { class: 'small muted' }, `${list.length} ${list.length === 1 ? 'question' : 'questions'} · ${filterName}${ui.month !== 'all' ? ` · Month ${ui.month}` : ''}${ui.q.trim() ? ` · matching "${ui.q.trim()}"` : ''}`),
      (ui.q || ui.month !== 'all' || ui.filter !== 'all')
        ? h('button', { class: 'linkbtn', type: 'button', onclick: () => { ui.q = ''; ui.month = 'all'; ui.filter = 'all'; renderMain(); } }, 'Clear filters')
        : h('span', { class: 'demo-tag' }, 'Demo data')));

    if (!list.length) {
      const msg = ui.filter === 'mine' && !ui.q ? 'You have not asked anything here yet.' : 'No questions match. Ask it, and the AI tutor answers in seconds.';
      listBox.append(h('div', { class: 'empty' }, h('p', {}, msg),
        h('button', { class: 'btn primary sm', type: 'button', onclick: () => openAsk(c, ui.q.trim()) }, 'Ask a question')));
      return;
    }
    list.forEach((t) => {
      const [, label, tone] = status(t);
      const st = status(t)[0];
      const n = answerCount(t);
      const open = () => { ui.open = t.id; renderMain(); window.scrollTo({ top: 0 }); };
      const row = h('div', { class: 'trow' + (flash === t.id ? ' flash' : ''), 'data-id': t.id, onclick: open },
        voteBtn(c, t, { onChange: () => { if (ui.sort === 'votes') renderList(); } }),
        h('div', {},
          h('button', { class: 'tlink', type: 'button', onclick: (e) => { e.stopPropagation(); open(); } }, t.title),
          h('div', { class: 'tmeta' },
            tagsOf(t).map((x, i) => h('span', { class: 'pill' + (i === 0 ? ' blue' : '') }, x)),
            h('span', { class: 'by' + (isMine(t) ? ' me' : ''), html: `<span class="mini-av">${initials(t.author)}</span><b>${c.esc(isMine(t) ? 'You' : t.author)}</b> · ${rel(t.ts)}` })),
          h('p', { class: 'tsnip' }, st === 'typing' ? 'The AI tutor is writing hints for this question…' : (t.body || (t.ai && t.ai.text ? t.ai.text.split('\n')[0] : '')))),
        h('div', { class: 'tside' },
          h('span', { class: 'pill ' + tone }, st === 'typing' ? h('span', { class: 'spin', style: { width: '10px', height: '10px' } }) : null, label),
          h('span', { class: 'tiny muted num' }, `${n} ${n === 1 ? 'answer' : 'answers'}`)));
      listBox.append(row);
    });
    if (flash) { const id = flash; setTimeout(() => { if (flash === id) flash = null; }, 2500); }
  }

  function threadView(main, c, t) {
    const { h, esc } = c;
    const lec = lectureById(t.lecture);
    const [, label, tone] = status(t);
    const back = h('button', { class: 'btn sm back', type: 'button', onclick: () => { ui.open = null; renderMain(); window.scrollTo({ top: 0 }); } }, '← All questions');

    const actions = h('div', { class: 'qact' });
    if (lec) actions.append(h('button', { class: 'btn sm', type: 'button', html: c.icon('play') + `<span>Jump to the lecture moment · L${lec.id} at ${moment(lec.id)}</span>`, onclick: () => { c.toast(`Opening Lecture ${lec.id} near ${moment(lec.id)}`); c.go('lecture'); } }));
    if (t.capstone) actions.append(h('button', { class: 'btn sm', type: 'button', html: c.icon('project') + '<span>Open the capstone</span>', onclick: () => c.go('projects') }));
    else actions.append(h('button', { class: 'btn sm', type: 'button', html: c.icon('code') + '<span>Open the practical</span>', onclick: () => c.go('practical') }));
    if (isMine(t)) {
      actions.append(t.solved
        ? h('button', { class: 'btn sm', type: 'button', onclick: () => { t.solved = false; c.toast('Question reopened'); renderMain(); } }, 'Reopen question')
        : h('button', { class: 'btn sm success', type: 'button', html: c.icon('check') + '<span>Mark as solved</span>', disabled: t.ai && (t.ai.typing || t.ai.streaming) ? true : null,
          onclick: () => {
            t.solved = true;
            if (!t.xpSolved) { t.xpSolved = true; c.addXP(5, 'Doubt solved'); } else c.toast('Marked as solved', 'green');
            renderMain();
          } }));
    }

    const q = h('section', { class: 'card qcard' },
      h('div', { class: 'qtitle' },
        voteBtn(c, t),
        h('div', {},
          h('div', { class: 'tmeta', style: { marginTop: 0 } }, h('span', { class: 'pill ' + tone }, label), tagsOf(t).map((x, i) => h('span', { class: 'pill' + (i === 0 ? ' blue' : '') }, x))),
          h('h1', {}, t.title),
          h('span', { class: 'by' + (isMine(t) ? ' me' : ''), html: `<span class="mini-av">${initials(t.author)}</span>Asked by <b>${esc(isMine(t) ? 'you' : t.author)}</b> · ${rel(t.ts)} · ${esc(t.fieldShort)}` }))),
      t.body ? h('p', { class: 'qbody' }, t.body) : null,
      t.code ? h('div', { class: 'codebox' }, h('div', { class: 'lbl' }, t.codeLabel || 'code'), h('pre', { class: 'code', html: hl(t.code) })) : null,
      actions);

    const answers = [];
    // AI tutor answer
    if (t.ai) {
      const a = t.ai;
      const body = a.typing
        ? h('div', { class: 'typing', 'aria-label': 'AI tutor is typing' }, h('i'), h('i'), h('i'), h('span', { class: 'small muted', style: { marginLeft: '6px' } }, 'AI tutor is typing…'))
        : h('p', { class: 'atext', 'data-ai-body': t.id }, a.text);
      const wrapBody = a.streaming ? h('div', {}, body, h('span', { class: 'caret', 'aria-hidden': 'true' })) : body;
      const foot = h('div', { class: 'afoot' });
      if (!a.typing && !a.streaming) {
        const set = (v) => {
          a.helpful = a.helpful === v ? null : v;
          if (a.helpful === true) c.toast('Thanks. Your feedback helps the tutor improve.', 'green');
          if (a.helpful === false) c.toast(t.mentor ? 'Thanks. The mentor will take another look.' : 'Sent to the mentor queue. A mentor will reply here.', 'amber');
          renderMain();
        };
        foot.append(
          h('span', { class: 'small muted' }, 'Was this hint useful?'),
          h('button', { class: 'btn sm fb up', type: 'button', 'aria-pressed': a.helpful === true ? 'true' : 'false', html: c.icon('check') + '<span>Helpful</span>', onclick: () => set(true) }),
          h('button', { class: 'btn sm fb down', type: 'button', 'aria-pressed': a.helpful === false ? 'true' : 'false', onclick: () => set(false) }, 'Not helpful'),
          h('span', { class: 'sp' }),
          h('span', { class: 'tiny muted' }, `Answered in ${a.secs} s`));
      }
      answers.push(h('section', { class: 'card ans ai' },
        h('div', { class: 'ahead', html: `<span class="av ai">${c.icon('spark')}</span><div><b>AI tutor</b><div class="tiny muted">${esc(AI_LABEL)}</div></div>` }),
        wrapBody, foot));
    }
    // Mentor reply, or the waiting note
    if (t.mentor) {
      const m = t.mentor;
      const card = h('section', { class: 'card ans mentor' + (m.fresh ? ' fresh' : '') },
        h('div', { class: 'ahead', html: `<span class="av mentor">${initials(m.name)}</span><div><b>${esc(m.name)}</b> <span class="pill green" style="margin-left:4px">Mentor confirmed</span><div class="tiny muted">Mentor · ${esc(t.fieldShort)} · ${rel(m.ts)}</div></div>` }),
        h('p', { class: 'atext' }, m.text),
        h('div', { class: 'afoot' }, voteBtn(c, m, { inline: true }),
          m.fresh ? h('span', { class: 'tiny muted' }, 'Demo: the reply arrives in seconds here. Real mentors confirm within a day.') : null));
      m.fresh = false;
      answers.push(card);
    } else if (t.ai && !t.solved) {
      answers.push(h('div', { class: 'card waitm' },
        isMine(t) && t.mentorTimer ? h('span', { class: 'spin', style: { color: 'var(--green)' } }) : null,
        h('span', {}, isMine(t) && t.mentorTimer ? `${MENTOR} has been told about your question and will confirm the answer.` : (status(t)[0] === 'needs' ? 'Waiting for a mentor. Mentors confirm within a day.' : 'No mentor reply yet. Mentors check AI answers within a day.'))));
    }
    // Student replies
    t.replies.forEach((r) => {
      const me = r.sid === ME;
      answers.push(h('section', { class: 'card ans' + (me ? ' mine' : '') },
        h('div', { class: 'ahead', html: `<span class="av${me ? ' me' : ''}">${initials(r.name)}</span><div><b>${esc(me ? 'You' : r.name)}</b><div class="tiny muted">Student · ${rel(r.ts)}</div></div>` }),
        h('p', { class: 'atext' }, r.text),
        h('div', { class: 'afoot' }, voteBtn(c, r, { inline: true }))));
    });

    // Reply box
    const ta = h('textarea', { class: 'field-input', placeholder: 'Share what you tried, or help a classmate with a hint…', 'aria-label': 'Your reply' });
    ta.value = ui.drafts[t.id] || '';
    ta.addEventListener('input', () => { ui.drafts[t.id] = ta.value; held.textContent = ''; });
    const held = h('span', { class: 'held', role: 'alert' });
    const post = () => {
      const text = ta.value.trim();
      if (text.length < 3) { held.textContent = 'Write a few words first.'; ta.focus(); return; }
      if (ABUSE.test(text)) { held.textContent = 'Held back: the forum filters abusive language. Please rephrase.'; c.toast('Reply held back by the content filter', 'red'); return; }
      t.replies.push({ id: 'r' + (++uid), name: c.data.demo_student.name, sid: ME, text, votes: 0, voted: false, ts: Date.now() });
      ui.drafts[t.id] = '';
      c.emit('forum:answered', { title: t.title, by: c.data.demo_student.name });
      c.toast('Reply posted', 'green');
      renderMain();
      const mineCards = mount ? mount.main.querySelectorAll('.ans.mine') : [];
      const last = mineCards[mineCards.length - 1];
      if (last && last.scrollIntoView) last.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    };
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) post(); });
    const box = h('section', { class: 'card replybox' },
      h('h3', {}, 'Your reply'),
      ta,
      h('div', { class: 'rb-foot' }, h('div', { class: 'stack', style: { gap: '2px' } }, h('span', { class: 'tiny muted' }, 'Hints are welcome. Please don\'t post full graded answers.'), held), h('button', { class: 'btn primary', type: 'button', onclick: post }, 'Post reply')));

    main.append(back, q,
      h('div', { class: 'row small muted', style: { justifyContent: 'space-between' } }, h('span', {}, `${answerCount(t)} ${answerCount(t) === 1 ? 'answer' : 'answers'}`)),
      ...answers, box);
  }

  function aside(c) {
    const { h, field: f, data } = c;
    const how = h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'How the forum works')),
      h('ul', { class: 'how' },
        [['spark', 'AI answers in seconds', 'The AI tutor replies first, with hints tied to the lecture.'],
          ['mentor', 'Mentors confirm within a day', `${MENTOR} and the mentor team check every AI answer.`],
          ['lock', 'No graded solutions', 'Answers give hints and point to the lecture. They never hand over graded work.'],
          ['shield', 'Abusive content filtered', 'Rude or abusive posts are held back before anyone sees them.']]
          .map(([ic, b, s]) => h('li', { html: `<span class="ix">${c.icon(ic)}</span><span><b>${c.esc(b)}</b><span class="muted">${c.esc(s)}</span></span>` }))));

    const pool = data.students.filter((s) => s.id !== ME);
    const local = pool.filter((s) => s.field === f.id);
    const rest = pool.filter((s) => s.field !== f.id).sort((a, b) => b.xp - a.xp);
    const top = local.concat(rest).slice(0, 5);
    const counts = [23, 18, 14, 11, 9];
    const helpers = h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Top helpers this week'), h('button', { class: 'linkbtn', type: 'button', onclick: () => c.go('achievements') }, 'Badges')),
      h('div', { class: 'helpers' }, top.map((s, i) => {
        const fld = data.fields.find((x) => x.id === s.field);
        return h('button', { class: 'helper', type: 'button', title: `See ${first(s.name)}'s helper badge`, onclick: () => c.go('achievements'), html:
          `<span class="tiny muted num">${i + 1}</span><span class="av">${initials(s.name)}</span><span class="nm"><b>${c.esc(s.name)}</b><span>${c.esc(fld ? fld.short : '')}</span></span><span class="tiny muted num">${counts[i]} answers</span>` });
      })));

    const all = allThreads(f);
    const done = all.filter((t) => t.mentor || t.solved).length;
    const stats = h('section', { class: 'card stack' },
      h('div', { class: 'card-head', style: { marginBottom: 0 } }, h('h3', {}, 'Forum speed'), h('span', { class: 'demo-tag' }, 'Demo data')),
      h('div', { class: 'fstats' },
        h('div', { class: 'stat' }, h('b', { class: 'num' }, '8 s'), h('span', {}, 'median AI answer')),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, '5 h'), h('span', {}, 'median mentor confirmation')),
        h('div', { class: 'stat' }, h('b', { class: 'num', 'data-stat': 'open' }, String(all.length - done)), h('span', {}, 'waiting for a mentor')),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, `${Math.round(done / Math.max(1, all.length) * 100)}%`), h('span', {}, 'confirmed or solved'))));
    return h('aside', { class: 'faside', 'aria-label': 'About the forum' }, how, helpers, stats);
  }

  /* ---------- ask a question ---------- */
  function openAsk(c, preset) {
    const { h, data, field: f } = c;
    const box = h('div', { class: 'm-forum mf-ask' });
    const title = h('input', { class: 'field-input', type: 'text', maxlength: '140', placeholder: 'For example: Why does my Docker container stop straight away?', value: preset || '' });
    const details = h('textarea', { class: 'field-input', placeholder: 'What did you try? What did you expect, and what happened instead?' });
    const lecSel = h('select', { class: 'field-input' });
    for (let m = 1; m <= 12; m++) {
      const g = h('optgroup', { label: `Month ${m} · ${data.months[m]}` });
      data.lectures.filter((l) => l.month === m).forEach((l) => g.append(h('option', { value: String(l.id) }, `L${l.id} · ${l.topic}`)));
      lecSel.append(g);
    }
    lecSel.value = String(data.demo_student.lecture);
    const attach = h('input', { type: 'checkbox', role: 'switch' });
    const codePrev = h('div', { class: 'codebox', hidden: true });
    const drawCode = () => {
      codePrev.textContent = '';
      if (!attach.checked) { codePrev.hidden = true; return; }
      codePrev.hidden = false;
      const lec = lectureById(lecSel.value);
      codePrev.append(h('div', { class: 'lbl' }, `Latest code from your workspace · L${lec.id}`), h('pre', { class: 'code', html: hl(codeFor(lec.id, f)) }));
    };
    attach.addEventListener('change', drawCode);
    lecSel.addEventListener('change', () => { drawCode(); dupCheck(); });
    const dup = h('div', { class: 'dup', hidden: true, 'aria-live': 'polite' });
    const err = h('div', { class: 'err', role: 'alert' });
    let dlg = null;

    function dupCheck() {
      const tw = new Set(words(title.value));
      dup.textContent = '';
      if (title.value.trim().length < 4 || !tw.size) { dup.hidden = true; return; }
      const lecId = Number(lecSel.value);
      const scored = allThreads(f).map((t) => {
        const tt = new Set(words(t.title + ' ' + tagsOf(t).join(' ')));
        let s = 0; tw.forEach((w) => { if (tt.has(w)) s += 1; else if (w.length > 4 && [...tt].some((x) => x.startsWith(w.slice(0, 5)))) s += 0.6; });
        if (s > 0 && t.lecture === lecId) s += 0.5;
        return { t, s };
      }).filter((x) => x.s >= 0.6).sort((a, b) => b.s - a.s).slice(0, 2);
      dup.hidden = false;
      if (!scored.length) { dup.append(h('span', { class: 'small muted' }, 'No similar questions yet. Go ahead and ask.')); return; }
      dup.append(h('span', { class: 'small', style: { fontWeight: 700 } }, 'Similar questions already asked. One of these may answer yours:'));
      scored.forEach(({ t }) => {
        const [, label, tone] = status(t);
        dup.append(h('button', { type: 'button', onclick: () => { dlg.close(); ui.open = t.id; renderMain(); window.scrollTo({ top: 0 }); } },
          h('span', {}, t.title), h('span', { class: 'pill ' + tone }, label)));
      });
    }
    let dupT = null;
    title.addEventListener('input', () => { err.textContent = ''; clearTimeout(dupT); dupT = setTimeout(dupCheck, 180); });

    function submit() {
      const tt = title.value.trim();
      if (tt.length < 10) { err.textContent = 'Give your question a title of at least 10 characters.'; title.focus(); return; }
      if (ABUSE.test(tt + ' ' + details.value)) { err.textContent = 'Held back: the forum filters abusive language. Please rephrase.'; return; }
      const lecId = Number(lecSel.value);
      const t = {
        id: 'mine-' + (++uid), field: f.id, fieldShort: f.short, title: tt, body: details.value.trim(), author: data.demo_student.name, sid: ME,
        lecture: lecId, ts: Date.now(), votes: 0, voted: false, replies: [], mentor: null, solved: false, needs: false,
        code: attach.checked ? codeFor(lecId, f) : null, codeLabel: attach.checked ? 'my code' : null, ai: null,
      };
      mine.unshift(t);
      dlg.close();
      ui.filter = 'all'; ui.q = ''; ui.month = 'all'; ui.sort = 'newest'; ui.open = t.id; flash = t.id;
      c.emit('forum:asked', { title: tt });
      c.addXP(10, 'Asked a doubt');
      startAnswer(t, c);
      renderMain();
      window.scrollTo({ top: 0 });
    }

    box.append(
      h('div', {}, h('div', { class: 'eyebrow' }, `Doubt forum · ${f.short}`), h('h2', {}, 'Ask a question')),
      h('label', { class: 'fl' }, 'Title', title),
      dup,
      h('label', { class: 'fl' }, 'Details', details),
      h('label', { class: 'fl' }, 'Which lecture is it about?', lecSel),
      h('label', { class: 'sw' }, attach, h('span', {}, 'Attach my code from the workspace')),
      codePrev,
      h('p', { class: 'note' }, 'The AI tutor replies in seconds with hints. A mentor confirms within a day. Nobody will post the graded answer for you.'),
      err,
      h('div', { class: 'mfoot' },
        h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Cancel'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, 'Post question')));
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    dlg = c.modal(box);
    if (preset) dupCheck();
    setTimeout(() => title.focus(), 30);
  }

  NM.register('forum', {
    label: 'Doubt forum', title: 'Doubt forum', icon: 'forum', group: 'Community', order: 55,
    render,
    destroy() {
      // Finish any answer still streaming so nothing animates off-screen.
      // The mentor confirmation stays scheduled: it only updates data and the bell, then shows up next visit.
      Object.values(streams).forEach((s) => s.finish());
      mount = null;
    },
  });
})();
