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
```
### 9. Run backend server.
```bash
npm run dev
```
