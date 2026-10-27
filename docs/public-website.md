# Public website

The live deployment is https://medirehab.duckdns.org and uses a single HTTPS domain. Caddy routes `/api` and
`/uploads` to `backend:5000` inside Docker and sends other paths to
`frontend:3000`. The browser uses the relative API URL `/api`, so no public
backend address or port is needed. PostgreSQL, Ollama, and the AI service keep
private listeners.

## DNS

`medirehab.duckdns.org` has an A record pointing to `5.223.75.26`. If you also publish an AAAA record, it must point to this
server's IPv6 address, `2a01:4ff:2f0:215d::1`. Otherwise omit the AAAA record.
Allow inbound TCP ports 80 and 443 in any hosting-provider firewall.

## Activate after DNS is ready

In the root `.env`, preserve the existing database connection and JWT secret,
then apply the values shown in `deploy/web.env.example`, replacing the example
domain with the real one. `SITE_ADDRESS` is a hostname without `http://`.

```bash
docker compose config --quiet
docker compose build frontend
docker compose run --rm --no-deps gateway caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose up -d --wait
docker compose logs --tail 50 gateway
```

The public overlay sets the backend to production mode for Secure cookies.
Caddy obtains and renews the domain's certificate and redirects HTTP to HTTPS.
The `/api` prefix is preserved when proxying. Long inference requests have a
180-second proxy response-header timeout.

The active root `.env` selects all three Compose files: the base stack, the
host PostgreSQL socket override, and the public website overlay. The frontend
uses the `medirehab-frontend:web` image, built with `/api`, and the backend runs
in production mode. Caddy has obtained a trusted Let's Encrypt certificate.
The previous local configuration is saved privately in `.local/local.env`.
Do not restore it during routine website restarts.

Verification passed through the public hostname: trusted TLS, HTTP-to-HTTPS
redirect, frontend and administrator login pages, API routing, admin login,
Secure cookie persistence, CORS, and all seven exercises.

## Verify

Open `https://medirehab.duckdns.org/login/admin` from another computer, sign in using
`.local/admin-credentials.txt`, and confirm the exercise catalog loads. Check
`https://medirehab.duckdns.org/api/init` for the API response through the same address.
Use the browser network panel to confirm requests target `/api` on that domain.
Browser camera recording requires the trusted HTTPS address.

The gateway persists certificates in `medirehab_caddy_data`. Preserve this
volume during restarts. Ports 3000 and 5000 remain bound to host loopback for
local diagnostics; only the gateway publishes externally.

[Caddy routing patterns](https://caddyserver.com/docs/caddyfile/patterns) and
[automatic HTTPS requirements](https://caddyserver.com/docs/automatic-https).
