# Live Coaching Model Setup

Live coaching uses Ollama with `qwen3.5:0.8b` as the base model. The
repository tracks the recipe only; Ollama stores the downloaded model files
locally and they must not be committed to Git.

## Container Setup (Recommended)

The repository's Compose stack runs Ollama in its own container and gives the
AI service the Docker-network address `http://ollama:11434`. Do not use
`127.0.0.1:11434` for `OLLAMA_BASE_URL` in this setup: it points at the AI
service container itself.

Configure the root deployment `.env` first (see [Deployment](../../README.md#deployment)).
From the repository root, start the stack against the existing database:

```powershell
docker compose --env-file .env up --build -d
```

On the first run, `ollama-init` downloads `qwen3.5:0.8b` and creates
`coach-qwen:latest` from `ai-service/ollama/Modelfile`. This can take several
minutes. The model is kept in the named `ollama_models` volume, so later
starts reuse that volume. Database migrations and seeds are never run by
Compose startup; they require a separately approved manual operation.

The AI port is private to Docker. Once the services are up, send a request from
inside its container that does not require a
camera, browser, login, or exercise assignment:

```powershell
docker compose exec -T ai-service python -c 'import json, urllib.request; payload=json.dumps({"exercise_name":"Shoulder Flexion","event":"issue_resolved"}).encode(); request=urllib.request.Request("http://127.0.0.1:8000/coaching", data=payload, headers={"Content-Type":"application/json"}); print(urllib.request.urlopen(request, timeout=40).read().decode())'
```

Expect `source` to be `ollama`. Use `docker compose logs ollama-init` if the
model bootstrap did not complete successfully.

## Host Setup

- Install and start [Ollama](https://ollama.com/).
- Run Ollama on the same host as the AI service, or make it reachable from the
  AI service over a trusted private network.

## Create The Coaching Model

From the repository root, pull the base model and build the configured model:

```powershell
ollama pull qwen3.5:0.8b
ollama create coach-qwen:latest -f ai-service/ollama/Modelfile
```

The resulting `coach-qwen:latest` model is based on Qwen 3.5 0.8B and uses
the prompt and generation settings defined in `Modelfile`.

## Configure The AI Service On The Host

Add these values to `ai-service/.env`:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=coach-qwen:latest
OLLAMA_TIMEOUT_MS=30000
OLLAMA_KEEP_ALIVE=10m
```

`OLLAMA_KEEP_ALIVE` keeps the small model loaded between coaching requests to
reduce response delay. `ai-service/.env.example` contains the same variable
names. The Node server sends verified coaching events to this AI service, which
then calls Ollama. Set `AI_SERVICE_URL=http://127.0.0.1:8000` and
`AI_SERVICE_TIMEOUT_MS=120000` in `server/.env`; the same timeout now applies
to both exercise evaluation and live-coaching calls.

## Verify Locally

```powershell
ollama run coach-qwen:latest
```

Try a short verified coaching input, for example:

```text
Exercise: Shoulder Flexion
Verified praise: The patient corrected a movement issue.
```

The live-coaching endpoint only sends verified praise events to Ollama. Direct
movement corrections, safety guidance, and model failures use fixed application
messages instead.
