# Collector v1 (snapshot proof of concept)

All requests: HTTPS, POST, `Content-Type: application/json`, `Authorization: Bearer BBP_<43 base64url characters>`. Body limit: 16 KiB. No student ID or account ID supplied by the collector is trusted. Identity always comes from the validated request and the token's database binding. Login is a decimal string, preserving 64-bit IDs.

## Handshake

`/api/collector/v1/handshake`

```json
{"platform":"MT5","collectorVersion":"0.1.0","brokerServer":"Demo-Server","accountLogin":"92817361","currency":"USD"}
```

First success binds the token to platform + exact broker server + exact login. Currency mismatches are also rejected. Repeated handshakes on the same account are safe. Response: `{"ok":true,"accountId":"UUID","serverTime":"UTC timestamp"}`. No secret is returned.

## Sync

`/api/collector/v1/sync` requires a successful handshake first.

```json
{"platform":"MT5","collectorVersion":"0.1.0","brokerServer":"Demo-Server","accountLogin":"92817361","currency":"USD","snapshot":{"capturedAt":"2026-09-22T10:00:00Z","balance":1000,"equity":987.42}}
```

Capture time is terminal-reported UTC, not broker wall time. Server receipt time is stored separately. The same account/capture time is first-write-wins, including retries. The starter emits at most one sample per 15 seconds. Future higher-frequency sampling needs a dedicated sample ID. Balance/equity must be finite numbers within ±1e15; storage uses eight decimal places.

## Heartbeat

`/api/collector/v1/heartbeat`: same body as handshake; requires prior binding. Updates last-seen without a snapshot. Regular sync already performs this function; the starter does not send separate heartbeats.

`/api/collector/v1/test` intentionally returns 501 and does not accept/log account data; use authenticated handshake + sync for the proof.

## Errors and retries

400 invalid payload/JSON; 401 invalid, expired or revoked token; 409 binding mismatch / handshake required / unavailable identity; 413 body too large; 415 JSON required; 429 token rate limit; 503 missing configuration or storage unavailable.

Wait at least one second between requests. Retry network failures, 429 and server errors with capped exponential backoff. Preserve the same snapshot on retry. Correct configuration/authentication errors before retrying. The EA retains a single pending sample in memory; it does not yet record every offline sample or recover after restart.

Future positions and raw events will use source IDs, transactional snapshot replacement and unique `(account_id, source_event_id)` execution keys. They are not accepted by v1's current snapshot-only schema.
