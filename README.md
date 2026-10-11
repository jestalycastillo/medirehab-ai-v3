# MediRehab AI 3.0
## UI attribution

The client uses components from [shadcn/ui](https://github.com/shadcn-ui/ui)
(`base-nova` style), adapted with MediRehab's colors and layouts. shadcn/ui is
licensed under the [MIT License](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)
(Copyright (c) 2023 shadcn). The MIT license requires its copyright and
permission notice to be included in copies or substantial portions of the
software.

## Dataset attribution

The [physiotherapy dataset](https://www.kaggle.com/datasets/toobasaeed11/physiotherapy)
is published on Kaggle by [toobasaeed11](https://www.kaggle.com/toobasaeed11).

## LIVE LINKS
##### Client: https://medirehab-ai.vercel.app
##### Server: https://medirehab-ai-server.onrender.com
##### AI Service: https://medirehab-ai-service.onrender.com

## Deployment

The deployment images contain the application, runtime dependencies, and active
model weights. Tests, datasets, notebooks, training checkpoints, secrets, and
local build output are excluded. Research sources remain in Git.

Copy the root `.env.example` to `.env` and configure:

- `DATABASE_URL`: the existing PostgreSQL database, with the provider's TLS settings.
- `JWT_SECRET`: a strong deployment secret.
- `CLIENT_URL`: the HTTPS frontend origin allowed by backend CORS.
- `NEXT_PUBLIC_API_URL`: the HTTPS browser-facing API URL, including `/api`.
  This value is embedded during the frontend build; changing it requires a rebuild.

```powershell
docker compose --env-file .env config --quiet
docker compose --env-file .env build
```

After separately approving any required database changes and verifying the
existing database schema, start the services:

```powershell
docker compose --env-file .env up -d
```

Compose uses the existing database; it does not provision PostgreSQL, migrate,
reset, or seed it. Prisma migration tooling stays in the repository’s development dependencies
for an explicitly approved manual operation from `server`. Never use container startup to apply
schema changes automatically.

Put an HTTPS reverse proxy in front of ports 3000 (frontend) and 5000 (backend),
which bind to loopback by default. Route `/uploads` to the backend too. HTTPS is
required for production authentication cookies and browser camera access. Use
the same site for frontend and API (for example, sibling subdomains) because
session cookies use `SameSite=Lax`.

Backend uploads persist in the `backend_uploads` volume. Back up this volume
alongside PostgreSQL; do not remove deployment volumes during a routine restart.
Ollama weights persist in `ollama_models`. The first startup downloads the
coaching base model. AI and Ollama ports are internal to the Compose network.
For coaching details, see [the setup guide](ai-service/ollama/README.md).

## Model-backed exercises

The catalog contains Shoulder Flexion, Shoulder Abduction, Side Arms Raise,
Arm Circumduction, Cross-body Shoulder Stretch, External Rotation, and Internal
Rotation. Active checkpoints live under `ai-service/app/models`, with YOLO pose
weights at `ai-service/yolo26s-pose.pt`. Versioned shoulder model keys remain
compatible aliases of their canonical runtime checkpoints.

The seven-exercise catalog migration is a manual deployment step. It preserves
existing IDs, assignments, results, custom images, and archived status. Review
and explicitly approve database changes before applying migrations or seeds.
An unavailable checkpoint fails evaluation rather than producing a fake score.

## Development

Install Node dependencies with `npm ci` inside `client` and `server`. Copy each
service's `.env.example` to `.env` and configure the existing database and URLs.
Generate the Prisma client with `npx prisma generate` from `server`; this is a
code generation step, not a migration. Run `npm run dev` in each Node service.

For the Python API:

```powershell
cd ai-service
py -3.10 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

On macOS/Linux, use `python3.10 -m venv venv` and `source venv/bin/activate`.
`requirements.txt` contains pinned runtime dependencies. Use
`requirements-dev.txt` for notebooks, training, and research evaluation.
The Docker image installs CPU PyTorch wheels because deployed inference uses
CPU; GPU development environments can install the matching CUDA wheels first.

Deployment, retention, consent, and backup guidance is in
[Operations and Privacy](docs/operations-and-privacy.md).
