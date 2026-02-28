#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ACTION = process.argv[2] ?? "install";
const APP_DIR = process.env.APP_DIR ?? process.cwd();
const LABEL = process.env.MARKET3H_LAUNCHD_LABEL ?? "com.tyler.market3h";
const PLIST_PATH = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const LOG_PATH = process.env.MARKET3H_LOG_PATH ?? "/tmp/market3h.log";
const ERR_LOG_PATH = process.env.MARKET3H_ERR_LOG_PATH ?? "/tmp/market3h.err.log";
const INTERVAL_SEC = Number(process.env.MARKET3H_INTERVAL_SEC ?? "10800");

function buildPlist() {
  const command = `cd '${APP_DIR.replace(/'/g, "'\\''")}' && npm run telegram:ops:run -- market_3h local_queue && npm run telegram:local:worker -- --once`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>${command}</string>
    </array>

    <key>StartInterval</key>
    <integer>${INTERVAL_SEC}</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${LOG_PATH}</string>
    <key>StandardErrorPath</key>
    <string>${ERR_LOG_PATH}</string>
  </dict>
</plist>
`;
}

function run(command) {
  execSync(command, {
    stdio: "inherit"
  });
}

function generateOnly() {
  const plist = buildPlist();
  process.stdout.write(plist);
}

function install() {
  fs.mkdirSync(path.dirname(PLIST_PATH), {
    recursive: true
  });

  fs.writeFileSync(PLIST_PATH, buildPlist(), "utf8");

  try {
    run(`launchctl unload '${PLIST_PATH}'`);
  } catch {
    // ignore
  }

  run(`launchctl load '${PLIST_PATH}'`);
  console.log(`[PASS] installed launchd job: ${LABEL}`);
  console.log(`[INFO] plist: ${PLIST_PATH}`);
}

function uninstall() {
  try {
    run(`launchctl unload '${PLIST_PATH}'`);
  } catch {
    // ignore
  }

  if (fs.existsSync(PLIST_PATH)) {
    fs.unlinkSync(PLIST_PATH);
  }

  console.log(`[PASS] removed launchd job: ${LABEL}`);
}

function status() {
  try {
    run(`launchctl list | rg '${LABEL}'`);
  } catch {
    console.log(`[INFO] ${LABEL} not found in launchctl list`);
  }

  console.log(`[INFO] plist exists: ${fs.existsSync(PLIST_PATH)}`);
  console.log(`[INFO] plist path: ${PLIST_PATH}`);
}

if (ACTION === "install") {
  install();
} else if (ACTION === "uninstall") {
  uninstall();
} else if (ACTION === "status") {
  status();
} else if (ACTION === "print") {
  generateOnly();
} else {
  console.error(`[ERROR] unknown action: ${ACTION}`);
  console.error("usage: node scripts/telegram/install-market3h-launchd.mjs [install|uninstall|status|print]");
  process.exit(1);
}
