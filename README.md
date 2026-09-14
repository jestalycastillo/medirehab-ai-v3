# MediRehab AI 3.0
## LIVE LINKS
##### Client: https://medirehab-ai.vercel.app
##### Server: https://medirehab-ai-server.onrender.com
##### AI Service: https://medirehab-ai-service.onrender.com

## Containerized Live Coaching

For the full local stack, including Ollama and the `coach-qwen:latest` model:

```powershell
docker compose up --build
```

The first start downloads the Ollama base model, so wait for `ollama-init` to
finish before testing coaching. The AI service reaches Ollama at
`http://ollama:11434` inside Docker; do not override it with `localhost` or
`127.0.0.1`. For a no-camera verification request and host-only instructions,
see [the live-coaching setup guide](ai-service/ollama/README.md).

## Model-backed exercises

The built-in catalog has Side Arms Raise (`side_arms_raise_v1`), Shoulder Flexion
(`shoulder_flexion`), and Shoulder Abduction (`shoulder_abduction`). For flexion
and abduction, the patient selects an arm before recording; the backend routes
evaluation to the corresponding `left_*` or `right_*` checkpoint. Each session
stores the actual checkpoint key and arm, which are returned in care history.

Docker startup runs migrations and the exercise-only catalog seed automatically.
For a host-only backend, run these from `server` after setting `DATABASE_URL`:

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed:exercises
```

The exercise seed is safe to rerun: it adds missing built-ins and model keys
without resetting admin credentials, deleting assignments, or replacing edited
descriptions and images. Run `npm run db:seed` only when you also intend to
create the initial admin account. Checkpoints are packaged under
`ai-service/app/models`; an unavailable checkpoint makes evaluation fail rather
than recording a fabricated score.

Deployment, retention, consent, and backup guidance is documented in
[Operations and Privacy](docs/operations-and-privacy.md).

## DEVELOPMENT SETUP
### 1. Clone this repository.
```bash
clone https://github.com/jc14-ai/medirehab-ai-v3.git
```
### 2. Navigate inside the folder.
```bash
cd medirehab-ai-v3
```
### 3. Navigate to client folder then install dependencies.
```bash
cd client
cp .env.example .env # configure the env variables
npm install
```
### 4. Run client server.
```bash
npm run dev
```
### 5. Navigate to ai-service folder then create local environment and install requirements.txt.
```bash
cd ../ai-service

python3.10 -m venv venv # macOS
py -3.10 -m venv venv # Windows

venv/Scripts/activate # macOS
source venv/bin/activate # Windows

pip install -r requirements.txt # do this if the project contains requirements.txt already
```
### 6. Run AI service server.
```bash
uvicorn app.main:app --reload
```
### 7. Navigate to server folder then install dependencies.
```bash
cd ../server
cp .env.example .env # configure the env variables
npm install

cd src
cp .env.example .env # configure the env variables
```
### 8. Migrate prisma models then generate client.
```bash
npx prisma migrate dev
npx prisma generate
npm run db:seed:exercises
```
### 9. Run backend server.
```bash
npm run dev
```
