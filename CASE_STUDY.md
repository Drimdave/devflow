# DevFlow: case study

DevFlow is a workflow automation app. You describe what you want in plain English ("alert me in Slack when a deploy fails"), an AI draws the workflow as a graph of nodes, and you can run it for real: call a webhook, run on a schedule, query a database, send an email.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind, React Flow (`@xyflow/react`), Postgres on Neon, Better Auth, Groq for the AI.

> A note on how it was built: I used Claude Code as a pair programmer throughout (design iteration, implementation, a self-run QA pass, fixes). Product decisions, review and verification were mine. Delete this note if you'd rather not include it, but I'd keep it: it's true, and the testing story below is the part worth being proud of.

## The problem I wanted to solve

Most "AI workflow builders" are demos. The AI draws a nice graph, you press Run, and a progress bar fills while nothing actually happens. I started from a working prototype that had exactly that problem: its execution engine was a random-delay simulation where every node succeeded.

The goal became: make the product honest. Anything that runs should really run, and anything that doesn't should say so.

## What it does

| Area | What's real |
|---|---|
| **Generate** | Describe a workflow, get a graph. The AI prompt is built around the nodes the engine can actually execute, asks for the fewest nodes that do the job, and never invents emails, URLs or keys. |
| **Run** | A real engine runs the graph: HTTP requests, If/Else, Filter, Switch (any number of named branches), Delay, JSON transform, AI steps, Slack and Discord messages, email through Resend, SQL on Neon Postgres. Values pass between nodes with `{{input.email}}`-style templates. |
| **Triggers** | Manual, **webhook** (a secret URL per workflow), and **schedule** (cron, UTC). |
| **Honesty** | A node with no real integration is badged **Simulated** and says why. A trigger DevFlow can't listen for (say Stripe) says so in its settings. A schedule says whether anything will actually fire it. |
| **History** | Every run is saved with per-step results. Last 100 runs per workflow for 30 days, then deleted. |
| **Credentials** | A vault for API keys and webhook URLs, encrypted at rest, referenced as `{{secrets.NAME}}`, never shown again, scrubbed from every log and result. |
| **Product** | Landing page with a live demo, templates gallery, workflows list, runs history, settings, a Live/Paused switch, autosave and conflict detection. |

About 12,000 lines of TypeScript across 17 API routes, 32 components and 34 library modules, plus 1,000 lines of tests.

## Engineering decisions worth talking about

**1. The engine is plain TypeScript with no framework imports.**
It lives in `lib/engine/` and runs the same code in the editor's Run button, the public webhook, and the scheduler. Because it has no dependencies on Next.js it's tested directly (compile with `tsc`, run with `node --test`; no test framework to install). Conditions and templates never use `eval`: there is a small hand-written parser for `a > 5 && (b == "x" || !c)`, and it throws a readable error on anything it doesn't understand instead of guessing "yes".

**2. Running user-defined HTTP requests on your own server is dangerous, so the HTTP client is defensive.**
Users type URLs and the server fetches them. That's a classic SSRF risk (server-side request forgery). The client resolves DNS itself and checks every address at connect time, follows redirects manually and re-checks each hop, strips credentials and request bodies on cross-host redirects, caps response size and time, and parses IPv6 down to bytes so tricks like `[::ffff:127.0.0.1]`, NAT64 and 6to4 can't reach localhost or cloud metadata addresses.

**3. A credentials vault needs more than encryption.**
Values are AES-256-GCM encrypted. But encryption doesn't stop a workflow from sending a secret somewhere it shouldn't, so: credentials may only be used in nodes that send data out; when a request uses one, the destination host must be fixed in the node, never taken from incoming data (otherwise a webhook caller could point your API key at their own server); outputs are scrubbed before later nodes can read them; and the scrubber knows the URL-encoded, form-encoded and base64 spellings of each value.

**4. A real scheduler on infrastructure that has no timers.**
Serverless functions can't run a clock, so a secured endpoint (`/api/cron/tick`) runs whatever is due and *anything* can call it every minute. Overlapping calls are safe: due workflows are claimed with an atomic `UPDATE ... WHERE next_run_at <= now()`, so two simultaneous calls run a workflow exactly once (tested with two real concurrent calls). A heartbeat table lets the editor say "scheduler last checked in 12 minutes ago" rather than pretend.

**5. Shared state lives in Postgres, not in memory.**
Rate limits (runs, webhooks, AI chat, emails, a public demo that spends AI credits) use an atomic upsert in Postgres. The old in-memory limiter gave every serverless instance its own allowance and reset on every cold start. I proved the new one works by exhausting a limit, restarting the server, and checking it still held.

**6. Data-loss paths are a product bug, not an edge case.**
Saves carry a version and the server rejects stale writes (HTTP 409) with a "load latest / overwrite / cancel" choice. Anything that would replace the canvas asks first (Keep editing / Discard / Save & continue). Closing the tab warns. Autosave is opt-in because saved changes go live for webhooks.

## I tested it like a hostile user

Late in the project I ran a deliberate QA pass in the role of a senior QA engineer, about 150 probes: cross-account access, injection, oversized and malformed input, engine fuzzing, SSRF address tricks, accessibility audits, phone-width layouts and load behaviour. It found real problems, which I then fixed in three batches:

- **A critical SSRF bypass** in the HTTP client (IPv4-mapped IPv6). My own unit tests had missed it because they only used the common spelling. It's now covered by tests for every address form.
- **Secrets leaking in encoded form** into stored run output.
- **Silent wrong answers:** an unparseable condition quietly took the "Yes" branch; two triggers both fired and overwrote each other's data.
- **Silent data loss:** switching workflows discarded unsaved edits; two tabs overwrote each other.
- **Unbounded cost and storage:** no rate limit on the AI chat, saves accepting any size, a list endpoint that returned every full graph (2.9 MB, 3.7 s), run history that grew forever.
- **Vulnerable dependencies:** two critical advisories (Next.js and Better Auth), fixed by upgrading, plus an unused package carrying a SQL-injection advisory that I removed.

Things that held up: every private route returned 401 signed out; twelve cross-account attempts to read, edit, delete or run another user's workflows, runs and credentials all returned 404; stored HTML and script in names never executed; no horizontal overflow on any page at phone width.

The suite is now **92 tests** covering the engine (templates, conditions, branching, triggers, redaction, SSRF, database safety), cron maths, validation, rate limiting, password policy, lockout rules, environment checks and run retention.

## Auth and production readiness

- Passwords: 10+ characters, common and decorated passwords blocked, strength meter that explains *why*, enforced on the client and the server.
- Brute force: 8 wrong guesses lock one account from one address for 15 minutes (the real owner elsewhere is unaffected), plus a per-address limiter stored in the database.
- Email verification and password reset exist when an email provider is configured; sign-up then stops revealing which addresses are registered.
- Security headers (CSP, frame denial, nosniff, referrer policy, HSTS in production), `HttpOnly` + `SameSite=Lax` cookies.
- A canonical idempotent `db/schema.sql` (verified identical to the live database), a migration command, startup config validation that refuses to boot with a clear message, a health endpoint, `.env.example`, Vercel region pinning, a scheduler workflow, Privacy and Terms pages, and a step-by-step `DEPLOYMENT.md`.

## Design

Light theme with black as the action colour and one lime accent, a floating-panel layout with a collapsing sidebar, and node cards that carry their own status (running, succeeded, simulated, skipped, failed). The editor is responsive down to phone width. Landing page JavaScript is about 229 KB gzipped because the editor is lazy-loaded behind it.

## Honest limits

I'd rather list these than have someone find them:

- **Deployed on Vercel (https://devflow-delta-ruby.vercel.app).** Verified locally and with a production build; a live smoke test confirmed sign-up, AI generation and saving.
- **Email is built but untested against a real provider.** It was tested end to end with a dev-only console mailer.
- **Scheduled runs** are UTC only, at least five minutes apart, and need an external caller (GitHub Actions can be up to a few minutes late).
- **Integrations are narrow by design:** database steps work on Neon only, email goes through Resend only, messages through Slack and Discord webhooks. Everything else is clearly marked simulated.
- A password reset or sign-out can take up to five minutes to end an already-open session (a deliberate speed trade-off from a session cache).
- Seven `npm audit` findings remain, all in Tailwind 3's build tooling (they never run in production); fixing them means the Tailwind 4 upgrade.
- The Privacy Policy and Terms are accurate drafts from what the code does, not legal advice.

## What I'd do next

1. Tailwind 4 upgrade (clears the remaining audit findings).
2. Per-credential host allow-lists, so a saved key can only ever be sent to the hosts it's meant for.
3. More real integrations (Google Sheets, GitHub) behind OAuth.
4. Retry and error-handling branches in the engine.
5. Error monitoring on a deployed instance.
