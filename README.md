# Neuromind AI Lab

Clickable demo of the **Neuromind AI Lab** by NeuroNetworks AI Ed, plus the course documents for the one-year Neuromind AI Creator Program.

## What is here

| Path | What it is |
|---|---|
| `index.html` | The lab demo. Student journey (lecture, practical, exam, projects and portfolio), mentor console and an animated system flowmap. Switch between all 9 career fields from the top bar. |
| `docs/` | Course documents: the full 1-year program and the 20-minute practical for every lecture (Word format). |
| `modules/` | One script per screen, plus `data.js` with the demo data. |

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
