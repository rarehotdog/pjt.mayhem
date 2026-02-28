# Telegram market_3h Runtime (Cloud default)

## 1) Default operation mode
- Recommended default: `cloud`
- `local_queue` is optional and should be enabled only when Claude Code CLI is available.
- OpenAI API key auth remains required for cloud path (`OAuth-only API mode is not supported`).

## 1-1) Automatic heavy offloading policy
- Long/analysis/content requests are automatically routed to `local_queue`.
- Main controls:
  - `ASSISTANT_LOCAL_HEAVY_CHARS_THRESHOLD`
  - `ASSISTANT_LOCAL_HEAVY_TOKEN_THRESHOLD`
  - `ASSISTANT_LOCAL_HEAVY_ENABLE_BOTS`
- History windows are split by path:
  - cloud: `ASSISTANT_HISTORY_WINDOW_CLOUD`
  - local: `ASSISTANT_HISTORY_WINDOW_LOCAL`

## 2) launchd install (every 3 hours)
Cloud mode install (default):
```bash
MARKET3H_DISPATCH_MODE=cloud npm run telegram:market3h:launchd -- install
```

Print generated plist:
```bash
MARKET3H_DISPATCH_MODE=cloud npm run telegram:market3h:launchd -- print
```

Status / uninstall:
```bash
npm run telegram:market3h:launchd -- status
npm run telegram:market3h:launchd -- uninstall
```

`status` output now includes:
- resolved dispatch mode (from env/default)
- resolved command
- installed dispatch mode (parsed from plist)
- installed command

## 3) Local queue re-enable (optional)
Prerequisites:
- Claude Code CLI installed (`claude` command available)
- Claude login completed (`claude /login`)
- `.env.local` has `APP_BASE_URL`, `LOCAL_WORKER_SECRET` (or `CRON_SECRET`)

Install launchd in `local_queue` mode:
```bash
MARKET3H_DISPATCH_MODE=local_queue npm run telegram:market3h:launchd -- install
```

Run one worker cycle manually:
```bash
npm run telegram:local:worker -- --once
```

Manual one-off local queue run:
```bash
npm run telegram:ops:run -- market_3h local_queue
```

## 4) Expected launch command by mode
Cloud:
```bash
cd '/Users/taehyeonkim/Documents/New project/apps/telegram-assistant' && npm run telegram:ops:run -- market_3h cloud
```

Local queue:
```bash
cd '/Users/taehyeonkim/Documents/New project/apps/telegram-assistant' && npm run telegram:ops:run -- market_3h local_queue && npm run telegram:local:worker -- --once
```
