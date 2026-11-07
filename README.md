# Neuromind AI Lab

Clickable demo of the **Neuromind AI Lab** by NeuroNetworks AI Ed, plus the course documents for the one-year Neuromind AI Creator Program.

## What is here

| Path | What it is |
|---|---|
| `index.html` | The lab demo. Opens on a welcome page with a 2-minute guided tour. Screens: student home, lectures with in-video questions, practical lab with AI tutor, My lab (cloud workspace, AI key, playground, tokenizer, practice server), exams with lockdown, projects and portfolio, doubt forum, leaderboard, badges and certificate verification, mentor console, admin console (batches, content, exam builder, costs and limits, audit log) and an animated map of how the lab works. Switch between all 9 career fields and Student, Mentor or Admin view from the top bar. Press Ctrl+K to search. |
| `docs/` | Course documents: the full 1-year program and the 20-minute practical for every lecture (Word format). |
| `modules/` | One script per screen, plus `data.js` with the demo data. |

## Demo students

Log in from the welcome page (or "Switch student" in the top bar) as one of 4 students in batch NM-2027-A. Each is at a different point of the year, so every screen changes: lecture, practical, workspace, exam, capstone, certificates, forum and mentor view.

| Student | Age | Month | Field | Lecture and practical | Capstone |
|---|---|---|---|---|---|
| Ishita Deshpande | 16 (parent consent on file) | 3 | Cybersecurity (from Month 4) | L26 First Claude API call | C1 |
| Kabir Patil | 19 | 5 | Cloud | L43 Working Dockerfile | C2 |
| Aarav Kulkarni | 18 | 8 | Data Analytics | L65 Webhooks | C3 |
| Sneha Nair | 21 | 11 | AI / ML | L90 Prompt-injection test report | C4 and Demo Day |

All students, companies and results in the demo are fictional. Everything is scripted; no real code runs.

## Run it locally

It is a static site with no build step. Serve the folder and open it in a browser:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

Import this repository into Vercel (framework: Other, no build command). Every push to `main` redeploys.

© NeuroNetworks AI Ed
