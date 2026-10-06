<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Postgres-Neon-00E699?style=for-the-badge&logo=postgresql&logoColor=white" alt="Neon Postgres" />
  <a href="https://github.com/Drimdave/devflow/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Drimdave/devflow/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/tests-92_passing-2ea44f?style=for-the-badge" alt="92 tests passing" />
</p>

<h1 align="center">DevFlow</h1>

<p align="center">
  <strong>Describe it. Watch it run.</strong>
</p>

<p align="center">
  <a href="https://devflow-delta-ruby.vercel.app"><strong>Live demo</strong></a>
</p>

<p align="center">
  A workflow automation app. Describe what you want in plain English, an AI draws it as a graph of nodes,<br />
  and it runs for real: webhooks, schedules, HTTP calls, AI steps, Slack, email and SQL, with a full history of every run.
</p>

<p align="center">
  <a href="#what-it-does">What it does</a> •
  <a href="#nodes">Nodes</a> •
  <a href="#getting-started">Getting started</a> •
  <a href="#deploying">Deploying</a> •
  <a href="#accounts--security">Security</a> •
  <a href="#api-reference">API</a> •
  <a href="#testing">Testing</a> •
  <a href="#known-limits">Known limits</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-run.png" alt="The DevFlow editor after a run: every node shows its status and the execution log lists each step" width="920" />
</p>

---

## What it does

DevFlow's rule is that **anything that runs really runs, and anything that doesn't says so.** A node with no real integration shows a **Simulated** badge and explains why; a trigger it can't listen for says so in its settings; a schedule tells you whether anything will actually fire it.

- **Generate:** describe an automation in the chat ("when a ticket comes in, route it by priority") and get a graph. The AI is told exactly which nodes the engine can execute, asked for the fewest nodes that do the job, and told never to invent emails, URLs or keys.
- **Edit visually:** a React Flow canvas with a node library, settings panel, tidy-up, minimap, and a chat that can edit the current workflow or **start fresh**.
- **Run it for real:** from the editor (streaming logs and per-node results), from a **webhook** (a secret URL per workflow), or on a **schedule** (cron).
- **See what happened:** every run is saved with each step's output, status and timing. The latest 100 runs per workflow are kept for 30 days.
- **Keep secrets safe:** a credentials vault for API keys and webhook URLs, encrypted at rest, referenced as `{{secrets.NAME}}`, never shown again, and scrubbed from every log and result.
- **Don't lose work:** version-checked saves (two tabs can't silently overwrite each other), an unsaved-changes guard, optional autosave, and a Live/Paused switch.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/editor-switch.png" alt="A Switch node with one output per case" /><br /><sub><b>Switch</b>: one named output per case, plus a default.</sub></td>
    <td width="50%"><img src="docs/screenshots/runs.png" alt="Run history with a step-by-step breakdown" /><br /><sub><b>Runs</b>: what each step received, returned and how long it took.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/workflows.png" alt="The workflows list showing live and scheduled workflows" /><br /><sub><b>Workflows</b>: previews, next scheduled run, paused state.</sub></td>
    <td width="50%"><img src="docs/screenshots/templates.png" alt="The templates gallery" /><br /><sub><b>Templates</b>: start from a proven graph, with sample data so it runs immediately.</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/landing.png" alt="The landing page with a live demo" width="760" /><br />
  <sub>The landing page includes a live demo that generates a real workflow without signing up (rate-limited).</sub>
</p>

---

## Nodes

| Node | `provider` | Settings | Status |
|---|---|---|---|
| **Webhook** trigger | `webhook` | `sample` (JSON used for manual runs) | Real. The workflow's secret URL starts it |
| **Schedule** trigger | `schedule` | `cron`, `sample` | Real. Needs a scheduler call, see [Scheduling](#scheduling) |
| **Manual** trigger | `manual` | `sample` | Real. The Run button |
| **HTTP Request** | `http` | `method`, `url`, `headers`, `body` | Real. SSRF-protected, 10 s timeout |
| **AI Prompt** | `openai` | `prompt` (optional `model`) | Real. Runs on Groq |
| **JSON Transform** | `json` | `mapping` | Real |
| **Send Message** | `slack`, `discord` | `webhookUrl`, `text` | Real with a webhook URL; simulated without one |
| **Send Email** | `resend` | `apiKey`, `to`, `subject`, `text` or `html` | Real with a Resend key; simulated without one |
| **Database Query** | `postgres` | `connection`, `query`, `allowWrites` | Real. Neon only, read-only by default |
| **If/Else** | `if` | `condition` (edges labelled true/false) | Real |
| **Filter** | | `field`, `operator`, `value` | Real |
| **Switch** | `switch` | `value`, `cases` (an output per case, plus `default`) | Real |
| **Delay** | `delay` | `duration_ms` (capped at 5 s) | Real |
| Form Submit, Notification, Spreadsheet, File Upload, other app events | | | Simulated, and marked as such in the editor |

### Passing data between nodes

Settings can contain `{{ templates }}`:

| Syntax | Meaning |
|---|---|
| `{{input.email}}` | a field of the trigger's payload (webhook body or sample) |
| `{{ai_1.text}}`, `{{http_1.body.title}}`, `{{db_1.rows[0].id}}` | the output of an earlier node, by its id |
| `{{secrets.SLACK_WEBHOOK}}` | a saved credential |

Conditions are evaluated by a small hand-written parser (no `eval`): `{{input.amount}} > 500`, `status == "paid"`, `labels contains bug`, combined with `&&`, `||`, `!` and parentheses. Anything it can't understand fails the node with a readable message instead of guessing.

A run is capped at 50 nodes, 30 seconds, 10 HTTP calls, 5 AI calls and 3 emails.

---

## Getting started

### Prerequisites

- **Node.js** 22+ (the `check:env` script uses its built-in TypeScript stripping)
- A **Neon** database ([free tier](https://neon.tech) works)
- A **Groq** API key ([free tier](https://console.groq.com) works)

### Install and run

```bash
git clone https://github.com/Drimdave/devflow.git
cd devflow
npm install

cp .env.example .env.local      # then fill in the required values below
npm run db:migrate              # creates the tables (safe to run again any time)
npm run dev                     # http://localhost:3000
```

The minimum `.env.local` for development:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=...          # openssl rand -base64 32
CREDENTIALS_KEY=...             # openssl rand -base64 32  (encrypts saved credentials: back it up)
GROQ_API_KEY=...
```

`.env.example` documents every variable. Check yours any time (it never prints a secret):

```bash
npm run check:env
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server (webpack) |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | The engine and library test suite |
| `npm run db:migrate` | Applies `db/schema.sql` to `DATABASE_URL` |
| `npm run check:env` | Environment checklist (add `NODE_ENV=production` for the strict rules) |
| `npm run lint` | ESLint |

---

## Deploying

Step-by-step, from an empty account to production: **[DEPLOYMENT.md](./DEPLOYMENT.md)**. In short: create a Neon database and run `npm run db:migrate`, generate your secrets, set the environment variables, deploy to Vercel, and point a scheduler at `/api/cron/tick`. `/api/health` is the endpoint for uptime monitors. In production the server checks its configuration on start and refuses to boot with a clear `[config]` message if something essential is missing.

---

## Accounts & security

- **Passwords:** at least 10 characters; common passwords ("Password123"), simple runs ("1234567890") and passwords containing your name or email are refused, on the sign-up form, in Settings and on the server. No forced symbols: long phrases are encouraged.
- **Brute-force protection:** 8 wrong passwords for one account from one address locks that pair for 15 minutes (the real owner on another network is unaffected), and every address is limited to 10 sign-in attempts a minute. Limits are stored in the database, so they hold across serverless instances.
- **Email verification and "Forgot password?"** only exist when the server can send email. Set these (Resend):

  ```bash
  RESEND_API_KEY=re_...
  EMAIL_FROM="DevFlow <noreply@yourdomain.com>"      # a domain you verified in Resend
  BETTER_AUTH_URL=https://your-app.example.com       # used to build the links in emails
  ```

  With email on, new accounts must confirm their address before signing in, and sign-up no longer reveals whether an email is already registered. **Existing accounts are unverified**, so they'll be sent a confirmation link the next time they sign in; to skip that for accounts you trust, run `UPDATE "user" SET "emailVerified" = true WHERE email = '...';`. Without these variables, email is off: sign-up stays open and password reset is unavailable.
- **Local testing without a mail provider:** set `AUTH_EMAIL_MODE=console` in `.env.local` and the emails are printed to the server log instead (this mode is refused in production).
- **Workflows can't be turned against you or your network:** the HTTP client resolves DNS itself and checks every address at connect time (including IPv6 forms that embed an IPv4 address), re-checks every redirect, and strips credentials on cross-host redirects. Saved credentials work only in nodes that send data out, and only when the destination host is written in the node (never taken from incoming data).
- **Headers and cookies:** CSP, frame denial, `nosniff`, referrer policy and (in production) HSTS; `HttpOnly`, `SameSite=Lax` session cookies.
- **Production checklist:** `BETTER_AUTH_SECRET` (32+ random characters), `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CREDENTIALS_KEY`, `CRON_SECRET`.

---

## Scheduling

A **Schedule** trigger runs a workflow on a cron schedule (`0 9 * * *` = every day at 09:00). Times are **UTC**, runs must be at least **5 minutes apart**, and only **Live** workflows run (the Live/Paused switch in the editor header).

DevFlow does not run a timer inside the app (serverless hosts don't keep one alive). Instead, **something has to call the scheduler endpoint about once a minute**:

1. Set `CRON_SECRET` in your environment (any long random string, e.g. `openssl rand -hex 24`).
2. Make a request every minute with that secret:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.example.com/api/cron/tick
   ```

   Use whatever you have: **GitHub Actions** (`.github/workflows/scheduler.yml` is included; it does nothing until you add `APP_URL` and `CRON_SECRET` as repository secrets), **cron-job.org**, a `crontab` entry on a server, or **Vercel Cron** (per-minute schedules need a Pro plan; the free plan only allows daily, and a more frequent cron makes the deploy fail).

Each call runs every due workflow (up to 10 per call; the rest run on the next call), once, even if calls overlap. The editor's Schedule panel tells you whether a scheduler has actually checked in recently, so you can tell if it's wired up. The same call deletes expired run history about once an hour.

---

## Project structure

```
devflow/
├── app/
│   ├── [[...slug]]/        # The signed-in app (home, workflows, editor, templates, runs, settings)
│   ├── api/                # Route handlers (see API reference)
│   ├── login/, reset-password/, privacy/, terms/
│   ├── ClientPage.tsx      # App shell: views, canvas state, save/load/guard logic
│   └── layout.tsx, globals.css, sitemap.ts, robots.ts, opengraph-image.tsx
│
├── components/
│   ├── canvas/             # React Flow editor, node cards, settings panel, execution console
│   ├── chat/               # "Ask DevFlow" panel (edit or start fresh)
│   ├── editor/             # Unsaved-changes, conflict, delete and load-error dialogs
│   ├── layout/             # Sidebar, header, compact top bar
│   ├── dashboard/, workflows/, templates/, runs/, settings/   # Full-page views
│   ├── landing/            # Landing page and live demo
│   ├── auth/, legal/, ui/  # Password field, legal pages, shared primitives
│
├── lib/
│   ├── engine/             # The execution engine: plain TypeScript, no framework imports
│   │   ├── run.ts          #   graph walk, branching, trigger selection, limits
│   │   ├── executors.ts    #   what each node kind actually does
│   │   ├── safe-fetch.ts   #   SSRF-protected HTTP client
│   │   ├── condition.ts    #   condition parser (no eval)
│   │   ├── template.ts, redact.ts, switch.ts, triggers.ts, types.ts
│   ├── cron.ts, schedule.ts            # Cron parsing, next-run maths, schedule validation
│   ├── auth.ts, auth-*.ts, password-policy.ts   # Better Auth config, lockout, mail, password rules
│   ├── limits.ts, rate-limit.ts        # Shared (Postgres) and in-memory rate limiting
│   ├── run-store.ts, run-retention.ts  # Saving runs, size caps, pruning
│   ├── secrets-crypto.ts, credentials.ts   # AES-256-GCM vault
│   ├── workflow-ai.ts, templates.ts, validate.ts, env-check.ts, ...
│
├── db/schema.sql           # Canonical, idempotent schema (npm run db:migrate)
├── scripts/                # migrate.mjs, check-env.mjs
├── tests/engine/           # 13 test files, 92 tests
├── docs/screenshots/       # Images used in this README
├── DEPLOYMENT.md           # Production checklist
├── CASE_STUDY.md           # Engineering write-up
└── .env.example, vercel.json, instrumentation.ts, next.config.ts
```

---

## API reference

All routes return JSON. "Session" means a signed-in user; every query is scoped to that user.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` `POST` | `/api/workflows` | session | List (previews; `?full=1` for complete graphs) / create |
| `GET` `PUT` `DELETE` | `/api/workflows/:id` | session | Read / update (send `base_version`; `409` if it changed elsewhere) / delete (also deletes its runs) |
| `GET` `POST` | `/api/workflows/:id/webhook` | session | Get this workflow's webhook path / rotate it |
| `POST` | `/api/hooks/:token` | secret URL | **Public webhook:** runs the saved workflow with the JSON body as `{{input}}` |
| `POST` | `/api/execute` | session | Run a graph (server-sent events: logs, per-node results, completion) |
| `POST` | `/api/chat` | session | Generate or edit a workflow from a prompt (rate-limited) |
| `GET` `DELETE` | `/api/runs` | session | List runs (`?workflowId=&status=&limit=`) / clear history (`?workflowId=` for one workflow) |
| `GET` | `/api/runs/:id` | session | One run with every step |
| `GET` `POST` | `/api/credentials` | session | List (names and hints only) / add |
| `PUT` `DELETE` | `/api/credentials/:id` | session | Replace the value or note / delete |
| `GET` `POST` | `/api/cron/tick` | `Bearer CRON_SECRET` | The scheduler: run what's due, purge old history |
| `GET` | `/api/schedule/status` | session | Is a scheduler actually checking in? |
| `POST` | `/api/demo` | none | Landing-page demo generation (per-visitor and daily limits) |
| `GET` | `/api/auth-config` | none | Whether email features are available |
| `GET` | `/api/health` | none | Liveness for uptime monitors |
| `*` | `/api/auth/*` | | Better Auth (sign-in, sign-up, sessions, reset, verification) |

---

## Testing

```bash
npm test
```

92 tests (about 1,000 lines) run with Node's built-in test runner, with no test framework to install. They cover template resolution, the condition parser, branching and trigger selection, secret redaction (including URL-encoded and base64 forms), every IPv4/IPv6 address form the SSRF guard must refuse, database-node safety (parameterised queries, read-only by default), cron maths, input validation, rate limiting, password policy, sign-in lockout, environment checks and run retention.

Beyond unit tests, the app was exercised against a real database with a deliberate QA pass (cross-account access, injection, oversized input, concurrent scheduler calls, restart-persistence of rate limits). The story is in [CASE_STUDY.md](./CASE_STUDY.md).

---

## Known limits

- **Integrations are narrow by design:** database steps work on **Neon** only, email goes through **Resend** only, messages through Slack and Discord webhooks. Everything else is clearly marked simulated.
- **Scheduled runs** are UTC only, at least 5 minutes apart, and depend on an external caller.
- **Email flows** (verification, password reset) are built and tested with a console mailer, but not yet against a live provider.
- **Sessions:** a password reset or sign-out can take up to 5 minutes to end an already-open session (a deliberate speed trade-off from a session cache).
- **Run history** keeps each workflow's latest 100 runs for 30 days.
- **Dependencies:** `npm audit` reports 7 findings, all in Tailwind 3's build tooling (not shipped to production); fixing them means the Tailwind 4 upgrade.
- The Privacy Policy and Terms are drafts written from what the code does, not legal advice.

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run `npm test` and `npm run check:env` before you commit
4. Open a Pull Request

Schema changes go in `db/schema.sql` (idempotent), and anything that runs user-supplied input needs a test.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built by <a href="https://github.com/Drimdave">@Drimdave</a>, developed with AI assistance (Claude Code).
</p>
