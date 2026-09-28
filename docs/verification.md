# Verification

Verified on 2026-09-22 with Node 23.9.0 and npm 10.9.2 (use a supported LTS for deployment):

- npm run build: passed, Next.js 16.3.5 production build, all four collector routes present.
- npm run typecheck: passed.
- npm test: all four protocol tests passed.
- npm run test:db: both migrations executed in local PGlite PostgreSQL; verified token authentication, first-use binding, account mismatch rejection, per-token rate guard, duplicate snapshot protection, expiration, revocation, owner-only RLS and denied client RPC/token access.
- npm install audit: zero known vulnerabilities reported at installation.

PGlite uses mocked Supabase Auth roles/functions; this does not replace testing on an actual Supabase instance or concurrency testing. No live secrets were supplied, no remote deployment was made, and MetaEditor compilation / terminal HTTPS synchronization has not been performed.

Next check: configure development Supabase, apply migrations, provision one demo student/token, deploy HTTPS API, compile the MQ5 in MetaEditor and compare an actual snapshot with the terminal.
