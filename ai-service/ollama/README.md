# Live Coaching Model Setup

Live coaching uses Ollama with `qwen3.5:0.8b` as the base model. The
repository tracks the recipe only; Ollama stores the downloaded model files
locally and they must not be committed to Git.

## Prerequisites

- Install and start [Ollama](https://ollama.com/).
- Run Ollama on the same host as the Node server, or make it reachable from
  the server over a trusted private network.

## Create The Coaching Model

From the repository root, pull the base model and build the configured model:

```powershell
ollama pull qwen3.5:0.8b
ollama create coach-qwen:latest -f ai-service/ollama/Modelfile
```

The resulting `coach-qwen:latest` model is based on Qwen 3.5 0.8B and uses
the prompt and generation settings defined in `Modelfile`.

## Configure The AI Service

Add these values to `ai-service/.env`:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=coach-qwen:latest
OLLAMA_TIMEOUT_MS=5000
OLLAMA_KEEP_ALIVE=10m
```

`OLLAMA_KEEP_ALIVE` keeps the small model loaded between coaching requests to
reduce response delay. `ai-service/.env.example` contains the same variable
names. The Node server sends verified coaching events to this AI service, which
then calls Ollama.

## Verify Locally

```powershell
ollama run coach-qwen:latest
```

Try a short verified coaching input, for example:

```text
Exercise: Side Arms Raise
Verified praise: The patient corrected a movement issue.
```

The live-coaching endpoint only sends verified praise events to Ollama. Direct
movement corrections, safety guidance, and model failures use fixed application
messages instead.
