# Setup

## 1. Database and API

Create a development Supabase project. Run both migration files in filename order using the Supabase SQL editor (or your normal Supabase migration workflow). They assume Supabase Auth and standard database roles exist; plain Postgres needs equivalents. Do not apply these initial migrations twice.

Put the project URL and server-only service-role credential in `apps/web/.env.local`, using `.env.example` as the template. Never prefix the credential with NEXT_PUBLIC, send it to an EA or commit it. No real credentials are included.

Create a test user through Supabase Auth, then provision the profile using the user's UUID:

```sql
insert into public.profiles(id,name,role)
values ('REPLACE_WITH_AUTH_USER_UUID','Demo student','student');
```

Run `npm run token:generate` in a private terminal. Copy the private token to the collector; store only the displayed hash in the database. The script generates 32 random bytes and prints the token once per invocation. Do not run it in CI or retain its output in shared logs.

```sql
insert into public.connection_tokens(student_id,token_hash,expires_at)
values ('REPLACE_WITH_AUTH_USER_UUID','REPLACE_WITH_SHA256_HASH',now()+interval '30 days');
```

Tokens remain bearer credentials until expiry/revocation, including after binding. To rotate for the same account, revoke the old token and issue another for the same student. To intentionally switch accounts, revoke all their tokens and mark the former account `revoked`, then issue a new token. This initial scaffold does not allow reclaiming an existing revoked broker identity; build an explicit audited recovery flow before supporting that case. Never change an old account's identity and mix histories.

## 2. HTTPS deployment

Deploy the Next.js workspace to a host supporting Next.js server routes, with `apps/web` as its application root and workspace-aware dependency installation. Configure the same two server environment variables. Use a stable domain you control, such as `https://YOUR_API_HOST`; `https://api.example.invalid` is intentionally nonfunctional. No deployment is performed by this scaffold.

Add host/edge rate limits before public exposure. Do not forward service-role secrets to the browser. No login or authenticated web dashboard is implemented yet.

## 3. Confirm the first snapshot

Follow mt5-installation.md. After a successful handshake and sync, inspect:

```sql
select a.broker_login,a.broker_server,s.balance,s.equity,s.captured_at,s.received_at
from public.account_snapshots s join public.trading_accounts a on a.id=s.account_id
order by s.received_at desc limit 20;
```

Compare amounts with the demo terminal. Retry identical sync JSON after at least one second: row count must not increase. Change the login/server in a request: expect 409. Revoke the token: expect 401. Ensure student A cannot read student B's rows. Invalid/missing token expects 401; invalid JSON 400; unsupported media 415; oversized request 413; absent server configuration 503.

## References

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [MQL5 WebRequest](https://www.mql5.com/en/docs/network/webrequest)
