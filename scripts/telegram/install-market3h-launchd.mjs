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
const DISPATCH_MODE = resolveDispatchMode(process.env.MARKET3H_DISPATCH_MODE ?? "cloud");

function resolveDispatchMode(rawMode) {
  const normalized = String(rawMode ?? "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "cloud") {
    return "cloud";
  }
  if (normalized === "local_queue") {
    return "local_queue";
  }

  throw new Error(`invalid MARKET3H_DISPATCH_MODE: ${rawMode} (expected cloud|local_queue)`);
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function unescapeXml(value) {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function buildLaunchCommand(mode) {
  const appDirEscaped = APP_DIR.replace(/'/g, "'\\''");
  const base = `cd '${appDirEscaped}' && npm run telegram:ops:run -- market_3h`;
  if (mode === "local_queue") {
    return `${base} local_queue && npm run telegram:local:worker -- --once`;
  }
  return `${base} cloud`;
}

function detectDispatchModeFromCommand(command) {
  if (!command) {
    return "unknown";
  }
  if (command.includes("market_3h local_queue")) {
    return "local_queue";
  }
  if (command.includes("market_3h cloud")) {
    return "cloud";
  }
  return "unknown";
}

function extractLaunchCommandFromPlist(plistText) {
  const match = plistText.match(
    /<key>ProgramArguments<\/key>[\s\S]*?<array>[\s\S]*?<string>\/bin\/zsh<\/string>[\s\S]*?<string>-lc<\/string>[\s\S]*?<string>([\s\S]*?)<\/string>[\s\S]*?<\/array>/
  );
  if (!match?.[1]) {
    return null;
  }
  return unescapeXml(match[1]);
}

function buildPlist() {
  const command = buildLaunchCommand(DISPATCH_MODE);

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
      <string>${escapeXml(command)}</string>
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

function runOutput(command) {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function escapeShellArg(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function getGuiDomain() {
  const uid = Number(process.getuid?.() ?? 0);
  return `gui/${uid}`;
}

function getServiceTarget() {
  return `${getGuiDomain()}/${LABEL}`;
}

function bootoutIfExists() {
  try {
    run(`launchctl bootout '${getServiceTarget()}'`);
  } catch {
    // ignore
  }
}

function bootstrap() {
  run(`launchctl bootstrap '${getGuiDomain()}' ${escapeShellArg(PLIST_PATH)}`);
}

function enableService() {
  run(`launchctl enable '${getServiceTarget()}'`);
}

function printService() {
  return runOutput(`launchctl print '${getServiceTarget()}'`);
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

  bootoutIfExists();
  bootstrap();
  enableService();
  console.log(`[PASS] installed launchd job: ${LABEL}`);
  console.log(`[INFO] plist: ${PLIST_PATH}`);
  console.log(`[INFO] dispatch mode: ${DISPATCH_MODE}`);
  console.log(`[INFO] launch command: ${buildLaunchCommand(DISPATCH_MODE)}`);
}

function uninstall() {
  bootoutIfExists();

  if (fs.existsSync(PLIST_PATH)) {
    fs.unlinkSync(PLIST_PATH);
  }

  console.log(`[PASS] removed launchd job: ${LABEL}`);
}

function status() {
  const target = getServiceTarget();
  try {
    printService();
    console.log(`[INFO] ${target} loaded in launchd`);
  } catch {
    console.log(`[INFO] ${target} not found in launchctl`);
  }

  const plistExists = fs.existsSync(PLIST_PATH);
  console.log(`[INFO] resolved dispatch mode (env/default): ${DISPATCH_MODE}`);
  console.log(`[INFO] resolved command: ${buildLaunchCommand(DISPATCH_MODE)}`);
  console.log(`[INFO] plist exists: ${plistExists}`);
  console.log(`[INFO] plist path: ${PLIST_PATH}`);

  if (!plistExists) {
    return;
  }

  const plistText = fs.readFileSync(PLIST_PATH, "utf8");
  const installedCommand = extractLaunchCommandFromPlist(plistText);
  const installedMode = detectDispatchModeFromCommand(installedCommand);
  console.log(`[INFO] installed dispatch mode: ${installedMode}`);
  if (installedCommand) {
    console.log(`[INFO] installed command: ${installedCommand}`);
  } else {
    console.log("[WARN] unable to parse ProgramArguments command from plist");
  }
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
