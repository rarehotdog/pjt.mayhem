# Telegram Assistant (Separated Service)

This app is dedicated to the Telegram 5-bot AI assistant backend.
It is intentionally separated from `apps/unmyeong-snap` (2030 viral app).

## Bot Team
- Tyler.Durden (orchestrator)
- 제갈량 / Zhuge Liang (LENS)
- Jensen Huang (BOLT)
- Hemingway, Ernest (INK)
- Alfred.Sentry (SENTRY)

## Main APIs
- `POST /api/telegram/webhook/[botId]`
- `POST /api/telegram/reminder/run`
- `POST /api/telegram/ops/run/[flow]`
- `GET /api/telegram/health`
- `POST /api/assistant/local-jobs/enqueue`
- `POST /api/assistant/local-jobs/claim`
- `POST /api/assistant/local-jobs/complete`
- `POST /api/assistant/actions/approve`
- `POST /api/assistant/actions/reject`

## Run
```bash
cd apps/telegram-assistant
npm install
npm run dev
```

## Required Env
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- 5 bot token/secret/usernames (`TELEGRAM_BOT_*`)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `TELEGRAM_ALLOWED_USER_IDS`, `TELEGRAM_ALLOWED_CHAT_IDS`
- `CRON_SECRET`
- `LOCAL_WORKER_SECRET` (recommended)

Use `.env.example` as template.

## Separation Rule
- `apps/unmyeong-snap`: viral product app only
- `apps/telegram-assistant`: Telegram assistant only

## Deployment
Create a separate Vercel project with root directory:
`apps/telegram-assistant`

After deployment, register webhook URLs to this domain (not unmyeong-snap).
