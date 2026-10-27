# Local host setup

The complete application runs on this host with Docker Engine, Buildx, and
Compose. The existing host PostgreSQL 18 cluster stores application data in a
dedicated `medirehab` database, owned by the restricted `medirehab` login.
All 19 repository migrations have been applied, and the seven exercises and
an administrator account have been initialized.

## Open the application

- Frontend: https://medirehab.duckdns.org/
- Administrator login: https://medirehab.duckdns.org/login/admin
- Public API check: https://medirehab.duckdns.org/api/init
- Internal backend health: http://localhost:5000/health
- Administrator email: `admin@example.com`
- Administrator credentials: `.local/admin-credentials.txt`

The credentials file and environment files are private (`0600`) and excluded
from Git. Ten active demo accounts exist: one admin, three doctors, and six patients.
Only `admin@example.com` is an active admin; the two extra admin records are
disabled. Named demo logins are listed in `.local/demo-credentials.txt`.
Additional linked test accounts are `doctor@test.com` and `patient@test.com`;
they require a password change on first login. User accounts are stored in
PostgreSQL; Git commits contain setup code, not the live database.
Use the administrator portal to create additional doctor and patient accounts.

External access uses the HTTPS website directly. Caddy publishes only ports
80 and 443 and forwards frontend, API, and upload requests inside Docker.
See [Public website](public-website.md) for routing and certificate details.

## Manage services

From `/opt/medirehab`:

```bash
docker compose ps -a
docker compose up -d --wait
docker compose logs --tail 50 backend ai-service
docker compose restart backend frontend
```

The root `.env` sets
`COMPOSE_FILE=docker-compose.yml:docker-compose.local.yml:docker-compose.web.yml`.
Ordinary Compose commands therefore manage the complete public website. The
local override mounts the PostgreSQL socket; the public overlay sets production
cookies and builds the frontend with `/api`. Certificate state persists in
`medirehab_caddy_data`. Previous localhost-only settings are saved privately in
`.local/local.env`.

The root database URL uses Prisma's `host=/var/run/postgresql` socket parameter.
The server development `.env` uses the same database over localhost TCP.
PostgreSQL allows socket password authentication only for the application role
and database, using SCRAM. Its network listener remains restricted to loopback.
The prior authentication configuration is saved at
`/etc/postgresql/18/main/pg_hba.conf.before-medirehab`.

Docker and PostgreSQL start at boot. The gateway, frontend, backend, AI service, and
Ollama have automatic restart policies. PostgreSQL remains a host system
service rather than a second database container.

## Ollama

Ollama runs inside Docker with `qwen3.5:0.8b` and `coach-qwen:latest`.
Their shared base weights persist in `medirehab_ollama_models`.
`ollama-init` exiting with status 0 is expected. AI and Ollama ports remain
private to the Compose network.

```bash
docker compose exec ollama ollama list
docker compose exec ollama ollama run coach-qwen:latest
```

## Updates and backups

```bash
docker compose build
docker compose up -d --wait
```

Changing `NEXT_PUBLIC_API_URL` requires rebuilding the frontend. Database
migrations and seeds are manual operations, never container startup actions.
For future schema changes, review the migrations before running
`npx prisma migrate deploy` from `server`.

Back up the PostgreSQL `medirehab` database and the
`medirehab_backend_uploads` Docker volume. Preserve environment files securely.
Do not remove Docker volumes during routine restarts.

## Verification completed

- All application Docker images built successfully.
- Frontend, backend, AI service, and Ollama health checks passed.
- Actual container API login, cookie session, CORS, and seven-exercise catalog passed.
- Database integration workflow passed with temporary test accounts cleaned up.
- All 23 Python tests and database-independent server tests passed.
- Real AI coaching inference returned `source: "ollama"`.

References: [Docker installation](https://docs.docker.com/engine/install/ubuntu/),
[Ollama in Docker](https://docs.ollama.com/docker), and
[Prisma PostgreSQL socket connections](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql).
