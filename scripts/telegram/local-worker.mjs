#!/usr/bin/env node

import { spawn } from "node:child_process";
import os from "node:os";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const LOCAL_WORKER_SECRET = process.env.LOCAL_WORKER_SECRET ?? process.env.CRON_SECRET;
const POLL_INTERVAL_MS = Number(process.env.LOCAL_WORKER_POLL_INTERVAL_MS ?? "15000");
const WORKER_ID = process.env.LOCAL_WORKER_ID ?? `${os.hostname()}-claude-worker`;
const ONESHOT = process.argv.includes("--once") || process.env.LOCAL_WORKER_ONESHOT === "1";

const CLAUDE_CODE_BIN = process.env.CLAUDE_CODE_BIN ?? "claude";
const CLAUDE_CODE_ARGS = parseArgs(process.env.CLAUDE_CODE_ARGS ?? "-p");

if (!LOCAL_WORKER_SECRET) {
  console.error("[ERROR] LOCAL_WORKER_SECRET or CRON_SECRET is required");
  process.exit(1);
}

function parseArgs(raw) {
  const matches = raw.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
}

async function apiPost(path, body) {
  const response = await fetch(`${APP_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOCAL_WORKER_SECRET}`
    },
    body: JSON.stringify(body)
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`POST ${path} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

function buildPromptFromJob(job) {
  const payload = job.payload ?? {};
  if (typeof payload.prompt === "string" && payload.prompt.trim()) {
    return payload.prompt.trim();
  }

  const userText = typeof payload.userText === "string" ? payload.userText.trim() : "";
  const history = Array.isArray(payload.history) ? payload.history : [];
  const historyBlock = history
    .slice(-20)
    .map((item, index) => `${index + 1}. ${item.role}: ${item.content}`)
    .join("\n");

  return [
    "아래 대화를 바탕으로 한국어로 간결하게 답변해줘.",
    "출력은 8줄 이내.",
    historyBlock ? `최근 대화:\n${historyBlock}` : "",
    `사용자 요청:\n${userText}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const args = [...CLAUDE_CODE_ARGS, prompt];
    const child = spawn(CLAUDE_CODE_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`claude exit=${code} stderr=${stderr.trim() || "(none)"}`));
    });
  });
}

async function processOneJob() {
  const claim = await apiPost("/api/assistant/local-jobs/claim", {
    workerId: WORKER_ID
  });
  const job = claim?.job;
  if (!job) {
    return false;
  }

  console.log(`[INFO] claimed job=${job.jobId} flow=${job.flowId ?? "chat"}`);

  try {
    const prompt = buildPromptFromJob(job);
    const outputText = await runClaude(prompt);

    await apiPost("/api/assistant/local-jobs/complete", {
      jobId: job.jobId,
      status: "done",
      outputText,
      metadata: {
        workerId: WORKER_ID,
        runner: "claude_code_cli"
      }
    });

    console.log(`[PASS] completed job=${job.jobId}`);
    return true;
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught);
    console.error(`[WARN] local worker failed job=${job.jobId}: ${error}`);

    await apiPost("/api/assistant/local-jobs/complete", {
      jobId: job.jobId,
      status: "failed",
      error,
      metadata: {
        workerId: WORKER_ID,
        runner: "claude_code_cli"
      }
    });

    return true;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  if (ONESHOT) {
    await processOneJob();
    return;
  }

  while (true) {
    const processed = await processOneJob();
    if (!processed) {
      await sleep(Number.isFinite(POLL_INTERVAL_MS) ? POLL_INTERVAL_MS : 15000);
    }
  }
}

run().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[ERROR] ${message}`);
  process.exit(1);
});
