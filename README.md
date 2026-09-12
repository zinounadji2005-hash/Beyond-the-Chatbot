# Beyond the Chatbot

**AI-native support ticket triage — one decision at a time.**

Dashboards and chatbots are the wrong default interfaces for AI-native work. This project replaces **both**: you get no chat input, no table, no filters, no search bar. The AI reads each ticket, decides a priority and a suggested reply, and the interface surfaces **exactly one decision** behind a human-review gate.

Built for a hackathon challenge; deploys as a single Cloudflare Pages project.

---

## The core loop

```
                ┌────────────────────────────────────────────────────┐
   Browser SPA  │  Cloudflare Pages Functions                       │
   (React SPA)  │                                                    │
                │   /api/next-ticket   ──►  Gemini API (gemini-3.5-flash-lite) ─┼─► classification
   ──► one card ──► (fetch + infer + store)                          │      priority / department
   ──► action   ──► /api/submit-action (approve / edit / skip) ──────┼─►       suggested reply
   ──► undo     ──► /api/undo (within 10s window)                    │      confidence 0–100
                │                          │                        │
                └──────────────────────────┼────────────────────────┘
                                           ▼
                                   Supabase (PostgreSQL)
                                   · tickets
                                   · ticket_decisions (full audit log)
```

Data flows: **raw ticket → intent inference (Gemini) → surfaced decision → human action → audit record.**

The Gemini call happens **server-side** in the Functions worker. No API key ever reaches the browser bundle.

---

## Confidence-driven routing

| AI confidence | Bucket        | Behavior                                                                          | `user_action` recorded |
| ------------- | ------------- | --------------------------------------------------------------------------------- | ---------------------- |
| `>= 85`       | `auto`        | Reply is "sent" automatically; UI shows **Sent ✓ + Undo** with a 10s countdown    | `auto_sent` → `undone` |
| `50 – 84`     | `propose`     | Suggested reply + priority shown as a proposal; agent must approve / edit / skip  | `approved` / `edited` / `skipped` |
| `< 50`        | `judgment`    | **"Not confident — needs your judgment."** Reply greyed/collapsed; no auto-action  | `approved` / `edited` / `skipped` |

An unparseable or failed model response is treated as `confidence = 0`, `department = general`, and flows down the **judgment** path — the UI never crashes on a bad model reply. This threshold logic is the deliberate "failure test" of the app.

---

## Stack

- **Hosting**: Cloudflare Pages + Pages Functions (single project, no separate server)
- **Frontend**: React 19 + Tailwind CSS v4 (via `@tailwindcss/vite`), vanilla Vite build
- **Database**: Supabase (PostgreSQL) — tickets + full decision audit log
- **AI**: Gemini API — `gemini-3.5-flash-lite` (low-cost Flash-Lite tier) at `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (OpenAI-compatible, `response_format: json_object`; model overridable via `GEMINI_MODEL`)
- **Secrets**: `wrangler pages secret put` (direct upload) or dashboard env vars (git integration) → read via `context.env` in Functions

---

## Project structure

```
beyond-the-chatbot/
├── functions/
│   ├── lib/
│   │   ├── core.js          # thresholds, JSON helpers
│   │   ├── supabase.js      # server-side Supabase client
│   │   └── gemini.js        # model call + strict JSON parse/fallback
│   └── api/
│       ├── next-ticket.js   # GET: next pending ticket → Gemini → store → route
│       ├── submit-action.js # POST: approve / edit / skip
│       └── undo.js          # POST: undo auto-sent within window
├── src/
│   ├── main.jsx
│   ├── App.jsx              # the single view
│   ├── api.js               # thin fetch client
│   └── components/
│       ├── DecisionCard.jsx
│       ├── ConfidenceBadge.jsx
│       ├── WhyExplainer.jsx
│       └── UndoToast.jsx
├── data/seed-tickets.json   # 40 tickets (29 real + 11 curated ambiguous)
├── scripts/seed.js          # one-time Supabase seeder (idempotent, --reset)
├── supabase/schema.sql      # paste into the Supabase SQL editor
├── before-after/legacy-dashboard.html
├── wrangler.toml
├── package.json
├── README.md
├── NOTES.md
└── THESIS.md
```

---

## Local setup

1. **Clone + install**
   ```
   npm install
   ```
2. **Create the Supabase project**, open the SQL editor, paste `supabase/schema.sql`, run.
3. **Seed the tickets**
   ```
   copy .env.example .env   # fill in SUPABASE_URL + SUPABASE_SERVICE_KEY
   npm run seed             # inserts 40 pending tickets
   # repeat demo: npm run seed -- --reset
   ```
4. **Local secrets for Pages Functions** — copy `.dev.vars.example` to `.dev.vars` and fill in:
   ```
   GEMINI_API_KEY=…
   GEMINI_MODEL=gemini-3.5-flash-lite
   SUPABASE_URL=…
   SUPABASE_SERVICE_KEY=…
   ```
   `.dev.vars` is gitignored.
5. **Run**
   ```
   npm run build
   npx wrangler pages dev dist --compatibility-date=2025-01-01
   ```
   Open http://127.0.0.1:8788

---

## Deploy

1. `npm run build`
2. Set production secrets (never commit them):
   ```
   npx wrangler pages secret put GEMINI_API_KEY
   npx wrangler pages secret put SUPABASE_URL
   npx wrangler pages secret put SUPABASE_SERVICE_KEY
   ```
   (`GEMINI_MODEL` is a plain var, set in `wrangler.toml`.)
3. `npx wrangler pages deploy dist`
5. Open the live URL and walk a ticket end-to-end: fetch → infer → act → audit.

---

## Failure-recovery (demonstrable live)

- **Model output unparseable** → `confidence=0`, `department=general`, judgment UI, nothing auto-sent.
- **Model gives low confidence** (`< 50`) → explicit "needs your judgment"; suggested reply collapsed; no auto-action.
- **Model is wrong at high confidence** → the 10s **Undo** window requeues the ticket for re-triage (`undone` recorded).
- **Seed data guarantees these paths**: 11/40 tickets are intentionally vague/ambiguous to force a low-confidence demo (see `NOTES.md`).

## Demo script (Loom, ~90s)

1. Show `before-after/legacy-dashboard.html` — the table it replaces.
2. Open the live app; first ticket auto-sends (high confidence) → undo within 10s → ticket requeued.
3. Approve a proposal; edit a second one; save.
4. Land on a low-confidence ticket — show the collapsed reply and approve/edit it manually.
5. Close the loop: point at `ticket_decisions` in Supabase — a full audit log of every action.

## Dataset provenance

29 rows are verbatim rows from the public *Customer Support Dataset* (mirrored at `github.com/monish-sr/Customer_support`, 500 rows, 5 categories). 11 rows are hand-curated realistic, deliberately ambiguous tickets to guarantee the low-confidence failure path is demonstrable. Customer names are realistic placeholders added because the source CSV has none.