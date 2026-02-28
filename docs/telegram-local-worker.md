# Telegram Local Worker (Claude Code CLI)

## 1) Prerequisites
- Claude Code CLI installed on Mac (`claude` command available)
- Claude login completed (`claude /login`)
- `.env.local` contains:
  - `APP_BASE_URL`
  - `LOCAL_WORKER_SECRET` (or `CRON_SECRET`)
  - Optional: `CLAUDE_CODE_BIN`, `CLAUDE_CODE_ARGS`, `LOCAL_WORKER_POLL_INTERVAL_MS`

## 2) Run one job manually
```bash
npm run telegram:local:worker -- --once
```

## 3) market_3h with local queue
```bash
npm run telegram:ops:run -- market_3h local_queue
```

## 4) launchd (every 3 hours)
One-command install:
```bash
npm run telegram:market3h:launchd -- install
```

Print generated plist (current app directory is used by default):
```bash
npm run telegram:market3h:launchd -- print
```

Status / uninstall:
```bash
npm run telegram:market3h:launchd -- status
npm run telegram:market3h:launchd -- uninstall
```

Create `~/Library/LaunchAgents/com.tyler.market3h.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.tyler.market3h</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>cd '/Users/taehyeonkim/Documents/New project/apps/telegram-assistant' && npm run telegram:ops:run -- market_3h local_queue && npm run telegram:local:worker -- --once</string>
    </array>

    <key>StartInterval</key>
    <integer>10800</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/tmp/market3h.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/market3h.err.log</string>
  </dict>
</plist>
```

Load:
```bash
launchctl unload ~/Library/LaunchAgents/com.tyler.market3h.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.tyler.market3h.plist
launchctl list | rg com.tyler.market3h
```
