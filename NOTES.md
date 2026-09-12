# NOTES — tools, decisions, and what's out of scope

## AI tools actually used

- **opencode (CLI agent)** — authored the entire codebase in this repo: scaffolding, Pages Functions, React UI, seed tooling, docs. No code was written by hand outside the agent session.
- **Gemini API** — hosted inference at `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (model: `gemini-3.5-flash-lite`).
- **zen agent** — mentioned in the challenge brief; not invoked in this session. Agent work was done end-to-end with opencode. (Filing this note honestly.)

## Key technical decisions

| Decision | Why |
| --- | --- |
| **Gemini-only inference (`gemini-3.5-flash-lite`)** | We started on NVIDIA Nemotron-3 (`nvidia/nemotron-3-ultra-550b-a55b`), then trialed Groq (`qwen/qwen3.8-27b`) for speed. The team lead's final call was **Google Gemini** via its OpenAI-compatible endpoint, on the **Flash-Lite tier to keep inference costs minimal** — `gemini-3.5-flash-lite` (measured latency ~1s). Same strict JSON contract as before, plus `response_format: { type: 'json_object' }` is now set server-side so the model is *forced* to emit valid JSON — the `parseAnalysis` fallback stays as a safety net. `temperature: 0` kept for reproducibility. Model is overridable via `GEMINI_MODEL`. |
| **`response_format: json_object` on Gemini** | The OpenAI-compat endpoint interprets this as `application/json` output — nullable failure test becomes near-impossible by design. |
| **`temperature: 0`** | Deterministic decisions; a support sort must be reproducible. |
| **Confidence routing computed server-side** | `next-ticket.js` decides `auto_sent` and persists it in one row — the frontend only renders what the server already decided. The audit log is the single source of truth. |
| **Auto-send is simulated** | No real SMTP/SendGrid — the "send" is a DB record + UI state. Real sending is a drop-in adapter behind `submit-action.js`. |
| **10s undo window** | Brief enough to demo urgency, long enough to be meaningful; stored as `undo_window_expires_at`, checked server-side in `undo.js`. |
| **Queue order is FIFO** (`created_at, id`) | A "decides order by priority" version would require analyzing all pending tickets per request (N × LLM calls). For a hackathon, FIFO + server-side routing keeps it honest and fast; noted as a known trade-off. |
| **Skip = `status: processed` + `user_action: skipped`** | Keeps the queue moving with a full audit trail. Requeueing would loop the same ticket forever on every reload. |
| **Parse failure → `confidence: 0`, `department: general`, judgment path** | The UI can never crash on malformed model JSON; the ticket gracefully falls to the human-review gate. |
| **Ticket order FIFO + strict single-card UI** | The "wow" must land in the first 30 seconds: zero navigation, one decision, button-only actions. |
| **Tailwind v4 (`@tailwindcss/vite`), no `tailwind.config.js`/`postcss.config.js`** | v4 needs no config files — fewer moving parts than the v3 setup the brief sketched. Documented deviation, same result. |
| **Scaffolded by hand instead of `create-vite`** | The directory already contained `beyond-the-chatbot-prompt.md`; interactively scaffolding into a non-empty dir is awkward non-deterministic. Hand-written files are equivalent to what `create-vite` emits. |
| **Single decision insert** | `next-ticket.js` inserts the decision row with `user_action`/`final_reply`/`undo_window_expires_at` populated for auto-sent cases — one write, no races between insert and update. |
| **Timestamp timezone fix (`toUtcIso`)** | Supabase `timestamp` columns store UTC wall-clock but return it WITHOUT a `Z` marker. `new Date("2026-09-11T21:37:49")` parses as *local* time, so the undo window silently "expired" in any non-UTC environment (local dev on UTC+1, browsers). `core.js` normalizes responses to explicit UTC ISO (`Z` appended) and `undo.js` compares against UTC the same way — verified by a direct DB/undo/requeue test. |
| **Ordering uses `.maybeSingle()` + secondary `id` sort** | Stable FIFO even when all seed rows share the exact same `created_at` timestamp (batch insert). |

## Dataset

- **29 real rows**: verbatim tickets from the public *Customer Support Dataset* (mirrored at `github.com/monish-sr/Customer_support`, 500 rows over 5 categories: Technical/Account/Billing/General/Product). Cleaned to `data/seed-tickets.json`.
- **11 curated rows**: realistic but deliberately vague/self-contradictory tickets ("About that thing we discussed last week…", "Is it possible to get a refund? Or maybe exchange it?"). These reliably produce `confidence < 50`, guaranteeing the **judgment** path — and the failure test — is demonstrable live.
- Customer names are realistic placeholders: the source CSV has no names.

## Failure-recovery design (the "failure test")

1. **Bad model output** → strict JSON parse with fence-stripping; on failure, `confidence=0` + `department=general` + explanatory `reasoning` → judgment card, nothing sent.
2. **Genuinely ambiguous ticket** → LLM is explicitly instructed to give low confidence on ambiguity → judgment card, reply collapsed, human decides.
3. **High-confidence but wrong** → 10s undo (toast with countdown) → `undone` + ticket requeued as `pending`.
4. **Supabase/network down** → Functions return JSON `500` with a message; the SPA shows a retry state. Keys are never in the bundle.

## Out of scope (deliberately)

- Real email/SMS sending (simulated send; adapter-ready).
- Login/auth — single-agent review flow for the demo.
- Chat input of any kind — instant disqualifier per the brief, not even a "fallback".
- Tables/lists/search/filters/settings — the very thing this project replaces.
- AI-evaluated quality scores / agent analytics.
- Multi-tenant routing or SLA queues.