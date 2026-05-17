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
