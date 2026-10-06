# Deploying DevFlow

A checklist from an empty account to a running, monitored production app. It takes about 30 minutes. Everything marked **required** must be done; the rest is recommended.

## What you need

| Service | For | Cost |
|---|---|---|
| [Neon](https://neon.tech) | PostgreSQL database | Free plan works |
| [Vercel](https://vercel.com) (or any Node host) | Running the app | Free (Hobby) works, with the limits below |
| [Groq](https://console.groq.com) | AI workflow generation and AI steps | Free tier works |
| [Resend](https://resend.com) | Email verification and "Forgot password" (recommended) | Free tier; needs a domain you own |
| GitHub Actions *or* any cron caller | Running scheduled workflows | Free |

## 1. Database (required)

1. Create a Neon project. **Pick the region closest to where the app will run.** Vercel's `pdx1` (Portland) pairs with Neon's `us-west-2` (Oregon), which is what `vercel.json` assumes. If you pick another Neon region, change `regions` in `vercel.json` to the matching Vercel region; a database 3,000 km away adds 100-300 ms to every query.
2. Copy the **pooled** connection string (the host contains `-pooler`) and keep `?sslmode=require` on the end.
3. Create the tables:

   ```bash
   DATABASE_URL="postgresql://..." node scripts/migrate.mjs
   ```

   (or put it in `.env.local` and run `npm run db:migrate`). It is safe to run again whenever `db/schema.sql` changes.

## 2. Generate your secrets (required)

```bash
openssl rand -base64 32     # BETTER_AUTH_SECRET
openssl rand -base64 32     # CREDENTIALS_KEY   <- back this up somewhere safe
openssl rand -hex 24        # CRON_SECRET
```

`CREDENTIALS_KEY` encrypts the API keys and webhook URLs users save. **If it is lost or changed, every saved credential becomes unreadable** and users must enter them again. Store a copy in a password manager.

## 3. Environment variables

Set these in your host (Vercel: Project → Settings → Environment Variables). `.env.example` has the same list with comments.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `BETTER_AUTH_SECRET` | yes | 32+ random characters (signs sessions) |
| `CREDENTIALS_KEY` | yes | 32 random bytes, base64 |
| `BETTER_AUTH_URL` | yes | Public address, `https://app.example.com` |
| `NEXT_PUBLIC_APP_URL` | yes | Same address as above |
| `GROQ_API_KEY` | yes* | Without it AI generation and AI steps don't work |
| `CRON_SECRET` | for schedules | Authenticates the scheduler (step 5) |
| `RESEND_API_KEY` + `EMAIL_FROM` | recommended | Turns on email verification and password reset |
| `NEXT_PUBLIC_LEGAL_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL` | recommended | Shown on the Privacy Policy and Terms pages |
| `GROQ_MODEL` | no | Override the default model |

Check your setup before and after deploying. It never prints a secret:

```bash
npm run check:env                     # reads .env.local
NODE_ENV=production npm run check:env # applies the stricter production rules
```

In production the server also checks this when it starts and **refuses to boot** with a clear `[config]` message if something essential is wrong, instead of failing strangely later.

## 4. Deploy the app

1. Push the repository to GitHub and import it in Vercel. The framework (Next.js) is detected automatically.
2. Add the environment variables, then deploy.
3. `vercel.json` pins the functions to `pdx1`. Long-running routes (runs, webhooks, the scheduler) ask for up to 60 seconds; on Vercel's free plan that is the ceiling, and a workflow that needs longer will be cut off.

## 5. Scheduled workflows (recommended)

The app has no timer of its own. **Something must call `GET /api/cron/tick` about once a minute** with `Authorization: Bearer $CRON_SECRET`. Pick one:

- **GitHub Actions (free):** `.github/workflows/scheduler.yml` is included. Add repository secrets `APP_URL` and `CRON_SECRET`. GitHub runs it at most every 5 minutes and sometimes late, so schedules can fire a few minutes behind.
- **cron-job.org** or similar: a request every minute with the header above.
- **Vercel Cron:** per-minute schedules need a paid (Pro) plan. The free plan only allows daily cron jobs, and a more frequent `vercel.json` cron makes the deploy fail, which is why none is included.

Open any workflow with a Schedule trigger: its settings say **Active** when a scheduler has checked in recently, and explain what's wrong when it hasn't. The same call also deletes expired run history about once an hour.

## 6. Email (recommended)

1. In Resend, add and verify your domain, then create an API key.
2. Set `RESEND_API_KEY` and `EMAIL_FROM="DevFlow <noreply@yourdomain.com>"`.
3. Until the domain is verified, Resend only delivers to your own address.

With email on, **new accounts must confirm their address** before signing in, and sign-up stops revealing whether an email is registered. **Existing accounts are unverified**, so they get a confirmation link the next time they sign in. To skip that for accounts you trust:

```sql
UPDATE "user" SET "emailVerified" = true WHERE email = 'you@example.com';
```

Do this for your own account *before* turning email on.

## 7. Verify the deployment

- [ ] `https://your-app/api/health` returns `{"status":"ok"}`
- [ ] You can sign up (and receive the email, if enabled), sign in, and sign out
- [ ] Create a workflow from a template, save it, press **Run**
- [ ] Add a Webhook trigger, copy its URL, and `curl -X POST` it with a JSON body
- [ ] A Schedule trigger's settings say **Active** (after the scheduler's first call)
- [ ] `/privacy` and `/terms` load and show your contact address
- [ ] Add an uptime monitor on `/api/health` (UptimeRobot, Better Stack, ...)

## Operating it

- **Backups:** Neon's free plan keeps only a few hours of point-in-time history. For real data, upgrade the plan or export regularly (`pg_dump` against the *direct*, non-pooled connection). Back up `CREDENTIALS_KEY` separately.
- **Pausing something noisy:** the **Live / Paused** switch in a workflow's header stops its webhook and schedule instantly.
- **Rotating `CRON_SECRET`:** change it in the host and in whatever calls the scheduler.
- **Rotating `CREDENTIALS_KEY`:** not supported in place; users re-enter their credentials.
- **Rotating `BETTER_AUTH_SECRET`:** signs everyone out.
- **Cost control:** AI calls are limited per account (12 chat requests a minute, 120 an hour), the public landing demo is limited per visitor and per day, and each account can send 20 emails an hour.

## Known limits

- Scheduled runs are UTC only and at least 5 minutes apart.
- Signing out elsewhere, or a password reset, can take up to 5 minutes to end an already-open session (a deliberate speed trade-off from the session cache).
- Workflows can query **Neon** databases only, and send email through **Resend** only.
- The remaining `npm audit` findings are in Tailwind 3's build tooling; they never run in production and need the Tailwind 4 upgrade.
