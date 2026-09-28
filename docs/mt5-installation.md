# MT5 demo installation

1. Configure Supabase and an HTTPS API using setup.md. Prepare a valid private BBP token.
2. In desktop MT5, choose File → Open Data Folder. Copy `collectors/mt5/BBPCollectorMT5.mq5` into `MQL5/Experts/BBP/`.
3. Open the source in MetaEditor and compile. Resolve any compiler errors before use. The repository contains source only; no precompiled EX5 is supplied.
4. In Tools → Options → Expert Advisors, allow WebRequest for your actual HTTPS origin (for example your permanent API hostname, without `/api/collector/v1`).
5. Attach the collector to one chart on a demo account. Set ApiOrigin to the HTTPS origin and ConnectionToken to the private token. Default interval is 30 seconds; minimum is 15.
6. Check the Experts log for handshake HTTP 200 and then sync HTTP 200. Confirm balance/equity in Supabase.

Do not share screenshots of EA inputs or saved presets containing the token. No broker password or Supabase key belongs in EA inputs.

Only one instance per account should run. Reattaching resets its in-memory handshake/retry state. An account switch stops collection until intentionally reconfigured. A successful handshake waits two seconds before the initial sync. Requests time out after five seconds and retry backoff caps at five minutes.

WebRequest is synchronous, requires an allowed URL, and is unavailable in Strategy Tester; validate networking in a running demo terminal. See [MetaQuotes documentation](https://www.mql5.com/en/docs/network/webrequest). Keep the terminal running for snapshots. This starter does not provide tick-perfect drawdown, history, positions or a durable offline queue. It has no trading functions.
