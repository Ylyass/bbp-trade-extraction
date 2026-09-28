# BBP trade extraction

MT5-first, read-only account monitoring proof of concept based on the supplied BBP architecture. No broker passwords or order-execution functionality.

## Structure

```
apps/web/               Next.js + TypeScript web and API
  app/api/collector/v1/ handshake, sync, heartbeat, disabled test route
  components/          Web presentation
  lib/                 Protocol validation and server ingestion
  api/                 Reserved API fixtures
collectors/mt5/         BBPCollectorMT5.mq5
collectors/mt4/         Explicit phase-two placeholder
supabase/migrations/   Core model and atomic ingestion RPC
docs/                  Setup, protocol and terminal installation
scripts/               Private token generation
```

## Start locally

Use Node.js 22 LTS or newer supported LTS and npm. From this folder:

```
npm ci
Copy-Item apps/web/.env.example apps/web/.env.local
npm run dev
```

Open http://localhost:3000. The landing page is a scaffold status page, not a connected dashboard. Build requires no secrets. API fails closed with HTTP 503 until configured.

```
npm run test
npm run typecheck
npm run build
```

Follow [setup](docs/setup.md), [protocol](docs/api-protocol.md), and [MT5 installation](docs/mt5-installation.md).

## Implemented

- Validated versioned collector routes with bounded JSON bodies and no sensitive logs.
- SHA-256 token lookup, expiry/revocation, atomic first-use binding, one active account per student.
- Balance/equity persistence and heartbeat; snapshot retry de-duplication by account + capture time.
- Core tables for later positions, raw executions, cash flows, state, cohorts and aliases. RLS enabled on every table; limited owner reads, no client writes.
- MT5 identity readout, HTTPS handshake, periodic snapshots, capped retry backoff, account-switch stop and in-memory pending snapshot.

## Deliberately unfinished

Student/admin login and dashboards; token issuance UI; admin RLS; positions/deals/history ingestion; analytics; local drawdown sampling; persistent offline outbox; MT4. The current schema reserves fields for these features. Requests containing positions/events are rejected rather than silently discarded.

Production still requires edge/IP rate limiting, operational monitoring, retention policy and integration/security testing. The RPC has a minimal per-token one-request-per-second guard; this is not an internet-facing abuse-control system. Derive online status from `last_seen_at` within 90 seconds, even when the stored status remains `online`. Revoked status always overrides freshness.

Offline equity cannot be reconstructed. This client-submitted data is monitoring data, not broker-verified audit evidence. Pending snapshots survive retries only while the EA is running.

Next milestone: apply migrations to a development Supabase project, compile the EA in MetaEditor, connect one demo account through HTTPS, and confirm actual balance/equity in `account_snapshots`.

Database regression checks: run npm run test:db. See [verification](docs/verification.md) for completed checks and remaining integration work.
