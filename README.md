# Peers Program Dashboard

Self-hosted portal for monitoring selected Astar Network archive node names from
the Polkadot Telemetry feed.

## Features

- Public dashboard for registered node uptime status.
- Admin-only node registration, deletion, enable/disable, interval tuning, and
  manual checks.
- Telemetry source: `wss://feed.telemetry.polkadot.io/feed`.
- Astar chain subscription:
  `0x9eb76c5184c4ab8679d2d5d819fdf90b9c001403e9e17da2e14b6d8aec4029c6`.
- Partial, case-insensitive node name matching.
- Weekly and monthly availability summaries based on sampled online presence.
- Calendar-month availability reports, reward calculation, manual payment records,
  and published confirmed reports at `/rewards`.

## Monthly Reports and Rewards

Open `/admin/rewards` after logging in. Configure each monitoring node's reward
profile (Discord name, region, SS58 payment address, verified Identity and reward
eligibility). Eligibility defaults to **off** and is independent of monitoring.

1. Select an operational month and create a draft. Calendar boundaries use Japan
   time; payment month is the following month. Current-month drafts are allowed,
   but confirmation requires the month to have ended.
2. Enter the verified EMA30 USD/ASTR price for the **first day of the operational
   month**, with a source/reason. Base reward defaults to USD 30.
3. Refresh observations and participant snapshots when required. Refresh adds
   eligible nodes and removes explicitly opted-out nodes, while preserving
   monthly states and amount adjustments. It does not alter confirmed reports.
4. Review monthly availability and choose Normal, Recovery or Inactive. Normal
   receives 100% at availability >=80%, otherwise 50%; Recovery receives 30%;
   Inactive receives 0%. A missing Identity halves the resulting amount. Amount
   adjustments and decisions with insufficient observations require a reason.
5. Refresh after month-end, then confirm to freeze the calculation and publish the report. A partial-month snapshot cannot be confirmed. Payment addresses,
   Discord names, internal notes and audit history stay private.
6. Transfer funds externally, then record the actual ASTR amount, payment date
   and Astar Subscan extrinsic link. Multiple payments are supported. Differences
   from the confirmed reward are shown explicitly; records are not chain-verified.

ASTR calculation uses fixed-point BigInt decimal arithmetic (18 decimal places),
truncating any excess decimal places. Display rounds to 2 places (half up); CSV preserves
full precision. Availability retains the existing either-side-online interval
estimate, clipped to month boundaries/current time. Unknown availability is not
zero. Gaps longer than twice the captured check interval are flagged but remain
in that estimate; unobserved month edges are displayed separately. Historical
changes in check interval or monitoring eligibility cannot be reconstructed from
the existing monitoring schema.

An unpaid confirmed ledger can be reopened with a reason (it disappears from
public view until reconfirmed). Once payments exist, use reasoned corrections for
the confirmed reward amount or payment records. Original values are retained in
the private audit history. Editing or deleting a monitoring node does not delete
reward snapshots, payments or period audit history.

The authenticated CSV endpoint is `/api/admin/rewards/export?month=YYYY-MM`.
The public API is `/api/rewards` (published month list) and
`/api/rewards?month=YYYY-MM` (explicitly allowlisted confirmed report fields).
All admin reward mutations use existing session authentication and CSRF tokens,
with ledger versions and database row locks to prevent lost updates.

### Optional Subscan EMA30 Fetch

Set `PUBFI_API_KEY` in the server environment or Compose `.env` for PubFi's
Subscan gateway. Requests use Bearer authentication and only the explicit free
Astar route: `https://api.pubfi.ai/v1/gateway/subscan/astar/api/scan/price/history:free`.
They never retry using a paid route. Alternatively set `SUBSCAN_API_KEY` for
direct Subscan access with `X-API-Key`; its plan must permit price history.
If both are configured, PubFi takes precedence. Keys are used only on the server
and never included in the browser or public API. Do not commit key files;
`pubfi_key.txt` is excluded from Git and Docker build contexts.

The fetch requests a single UTC calendar date from the Astar native token series
(omitting the optional currency selector). Direct access uses
`https://astar.api.subscan.io/api/scan/price/history`. It accepts `ema30_average`
only when a successful response contains exactly one dated price observation for
that requested day; ordinary `price` or multi-day range averages are never used.
If Subscan does not support that single-day contract, returns unavailable data,
or rejects the credentials, use a verified manual price. A saved price cannot be
overwritten by automatic fetching. Verify the live single-day response against
the Subscan chart after configuring the API key; this cannot be established from
the public API schema alone. Live verification on 2026-09-30 through PubFi's
free route succeeded with authentication and returned the 2026-09-01 ASTR price,
but `ema30_average` was zero. That response is rejected and requires manual
EMA30 entry. Older history can also be refused by the gateway's history window.

### Reward Database Integration Tests

Unit tests run with `npm test`. Database tests are opt-in and restricted to this
disposable local PostgreSQL database; they truncate **only that test database**:

```bash
docker run -d --rm --name rewards-test -p 127.0.0.1:55439:5432 \
  -e POSTGRES_PASSWORD=reward-test-only -e POSTGRES_DB=rewards_test postgres:16-alpine
REWARD_TEST_DATABASE_URL=postgres://postgres:reward-test-only@127.0.0.1:55439/rewards_test npm test
docker stop rewards-test
```

On PowerShell, set `$env:REWARD_TEST_DATABASE_URL` to the same URL before `npm test`
and remove the environment variable afterward. The tests refuse any other URL.

## Run With Docker Compose

```bash
cp .env.example .env
# Edit APP_DOMAIN, ADMIN_PASSWORD, and POSTGRES_PASSWORD in .env
# Leave DATABASE_URL empty unless you use an external database.
docker compose up -d --build
```

Open `https://$APP_DOMAIN`.

The dashboard is public. Admin controls are available at `/admin` and protected
by `ADMIN_PASSWORD`.

## Production HTTPS With Caddy

This compose stack includes Caddy for automatic HTTPS.

1. Point the DNS A/AAAA record for `APP_DOMAIN` to your server.
2. Open TCP ports `80` and `443` on the server firewall.
3. Create `.env` from `.env.example`. Do not leave placeholder values in place.
4. Set at least:

```bash
APP_DOMAIN=monitor.example.com
POSTGRES_PASSWORD=replace-with-a-long-random-postgres-password
ADMIN_PASSWORD=replace-with-a-long-random-admin-password
COOKIE_SECURE=true
```

Leave `DATABASE_URL` empty for the bundled Compose postgres service. Set it only
when using an external database.

5. Start the stack:

```bash
docker compose up -d --build
```

Caddy terminates TLS and proxies traffic to the internal `web:3000` service.
The web container does not publish port `3000` to the host in the production
compose file.

## Public Launch Checklist

Before opening the app to the internet, verify the following:

- Only TCP `80` and `443` are reachable from the internet. Keep `3000` and
  `5432` closed in your cloud firewall or security group.
- HTTPS responses include the expected security headers from Caddy:
  `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, and `Permissions-Policy`.
- The `web` and `worker` containers run as a non-root user.
- Run a production dependency audit and a container image vulnerability scan.
  Treat unresolved high or critical runtime findings as release blockers.

## Local Development

```bash
npm install
npm run migrate
npm run dev
```

Run the worker in another terminal:

```bash
npm run worker
```

For local Docker checks without HTTPS cookies, set `APP_DOMAIN=localhost` and
`COOKIE_SECURE=false` in `.env`, then open `http://localhost`.

## Notes

Telemetry's `Node Uptime` is derived from the node `startupTime`. This app stores
that value for display, while weekly/monthly uptime summaries are calculated from
whether the configured node name pattern was present in each periodic snapshot.
