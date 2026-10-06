-- DevFlow database schema. Idempotent: safe to run on an empty database or on one that already has some of it.
-- Apply with:  npm run db:migrate
-- (Better Auth's tables come first; the rest are DevFlow's own.)

-- ── Better Auth (accounts and sessions) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS "user" (
    id              text PRIMARY KEY,
    name            text NOT NULL,
    email           text NOT NULL UNIQUE,
    "emailVerified" boolean NOT NULL,
    image           text,
    "createdAt"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session (
    id          text PRIMARY KEY,
    "expiresAt" timestamptz NOT NULL,
    token       text NOT NULL UNIQUE,
    "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamptz NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId"    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON session ("userId");

CREATE TABLE IF NOT EXISTS account (
    id                      text PRIMARY KEY,
    "accountId"             text NOT NULL,
    "providerId"            text NOT NULL,
    "userId"                text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "accessToken"           text,
    "refreshToken"          text,
    "idToken"               text,
    "accessTokenExpiresAt"  timestamptz,
    "refreshTokenExpiresAt" timestamptz,
    scope                   text,
    password                text,
    "createdAt"             timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON account ("userId");

CREATE TABLE IF NOT EXISTS verification (
    id          text PRIMARY KEY,
    identifier  text NOT NULL,
    value       text NOT NULL,
    "expiresAt" timestamptz NOT NULL,
    "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification (identifier);

-- Better Auth's own rate limiter (sign-in, sign-up, password reset), stored here so limits hold across serverless instances
CREATE TABLE IF NOT EXISTS "rateLimit" (
    id            text PRIMARY KEY,
    key           text NOT NULL UNIQUE,
    count         integer NOT NULL,
    "lastRequest" bigint NOT NULL
);

-- Wrong-password attempts per account+address (the 15-minute lockout)
CREATE TABLE IF NOT EXISTS auth_failures (
    key text NOT NULL,
    at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_failures_key_idx ON auth_failures (key, at DESC);

-- ── Workflows ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflows (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          varchar(255) NOT NULL DEFAULT 'Untitled Workflow',
    description   text,
    nodes_json    jsonb NOT NULL DEFAULT '[]'::jsonb,
    edges_json    jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active     boolean NOT NULL DEFAULT true,           -- the Live / Paused switch
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    user_id       text REFERENCES "user"(id),
    webhook_token text,
    version       integer NOT NULL DEFAULT 0,              -- bumped on every content edit; saves are checked against it
    next_run_at   timestamptz,                             -- when the scheduler should run it next (null = not scheduled)
    last_run_at   timestamptz
);
-- Columns added after the first release, for databases created from an older version of this file
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS user_id text REFERENCES "user"(id);
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS webhook_token text;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS next_run_at timestamptz;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON workflows (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS workflows_due_idx ON workflows (next_run_at) WHERE next_run_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workflows_webhook_token_idx ON workflows (webhook_token) WHERE webhook_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS workflow_runs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id text NOT NULL,            -- text, not a foreign key: runs are cleaned up by the app and may briefly outlive a workflow
    user_id     text NOT NULL,
    status      text NOT NULL,
    mode        text NOT NULL DEFAULT 'full',   -- full | node | webhook | schedule
    started_at  timestamptz NOT NULL DEFAULT now(),
    duration_ms integer NOT NULL DEFAULT 0,
    error       text,
    steps_json  jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx ON workflow_runs (workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS workflow_runs_user_idx ON workflow_runs (user_id, started_at DESC);

-- Saved API keys, tokens and URLs: values are AES-256-GCM encrypted by the app (CREDENTIALS_KEY), never stored in plain text
CREATE TABLE IF NOT EXISTS credentials (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL,
    name        text NOT NULL,
    description text NOT NULL DEFAULT '',
    hint        text NOT NULL DEFAULT '',
    value_enc   text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

-- ── Scheduler and shared limits ──────────────────────────────────────────

-- One row that records when something last called /api/cron/tick, so the editor can say whether scheduling really works
CREATE TABLE IF NOT EXISTS scheduler_heartbeat (
    id            integer PRIMARY KEY,
    last_tick_at  timestamptz NOT NULL,
    last_due      integer NOT NULL DEFAULT 0,
    last_ran      integer NOT NULL DEFAULT 0,
    last_purge_at timestamptz
);

-- DevFlow's own rate limits (runs, webhooks, chat, emails, public demo), shared by every server instance
CREATE TABLE IF NOT EXISTS rate_limits (
    key      text PRIMARY KEY,
    count    integer NOT NULL,
    reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits (reset_at);
