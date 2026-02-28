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

## OpenAI Auth Note
- OpenAI API uses API key auth (`OPENAI_API_KEY`).
- ChatGPT subscription OAuth does not replace OpenAI API key billing.
- This service keeps OpenAI as primary and uses local Claude worker offloading to reduce token cost.

## Cost Optimization Runtime
- Keep latest stable default:
  - `OPENAI_MODEL=gpt-5.2`
  - `OPENAI_MODEL_CANDIDATES=gpt-5.2,gpt-5.1,gpt-5`
- History window split:
  - `ASSISTANT_HISTORY_WINDOW_CLOUD=8`
  - `ASSISTANT_HISTORY_WINDOW_LOCAL=20`
- Heavy auto-offload policy:
  - `ASSISTANT_LOCAL_HEAVY_CHARS_THRESHOLD=520`
  - `ASSISTANT_LOCAL_HEAVY_TOKEN_THRESHOLD=2200`
  - `ASSISTANT_LOCAL_HEAVY_ENABLE_BOTS=tyler_durden,zhuge_liang,jensen_huang,hemingway_ernest`

## Deploy Guard
- Validate OpenAI model availability before production deploy:
```bash
npm run openai:model:check
```
- Deploy with guard:
```bash
npm run deploy:prod
```

## Operations (market_3h)
- Default runtime mode: `cloud`
- Install/refresh launchd job in cloud mode:
```bash
MARKET3H_DISPATCH_MODE=cloud npm run telegram:market3h:launchd -- install
```
- Check launchd status (includes resolved/installed mode + command):
```bash
npm run telegram:market3h:launchd -- status
```
- Optional local queue mode (requires Claude Code CLI + login):
```bash
MARKET3H_DISPATCH_MODE=local_queue npm run telegram:market3h:launchd -- install
```

## Separation Rule
- `apps/unmyeong-snap`: viral product app only
- `apps/telegram-assistant`: Telegram assistant only

## Deployment
Create a separate Vercel project with root directory:
`apps/telegram-assistant`

After deployment, register webhook URLs to this domain (not unmyeong-snap).
