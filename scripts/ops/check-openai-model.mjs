#!/usr/bin/env node

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = (process.env.OPENAI_MODEL ?? "gpt-5.2").trim();

function parseCandidates(raw) {
  const tokens = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const ordered = [OPENAI_MODEL, ...tokens];
  const unique = new Set();
  const output = [];
  for (const model of ordered) {
    if (unique.has(model)) {
      continue;
    }
    unique.add(model);
    output.push(model);
  }
  return output;
}

async function fetchModels() {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`OpenAI model list failed (${response.status}): ${JSON.stringify(json)}`);
  }

  const data = Array.isArray(json?.data) ? json.data : [];
  return data
    .map((item) => (typeof item?.id === "string" ? item.id : ""))
    .filter(Boolean);
}

async function run() {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const candidates = parseCandidates(process.env.OPENAI_MODEL_CANDIDATES);
  const available = new Set(await fetchModels());

  const primaryAvailable = available.has(OPENAI_MODEL);
  const firstAvailableCandidate = candidates.find((model) => available.has(model));

  if (primaryAvailable) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          model: OPENAI_MODEL,
          fallbackNeeded: false,
          candidates
        },
        null,
        2
      )
    );
    return;
  }

  if (firstAvailableCandidate) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "OPENAI_MODEL is not currently available.",
          currentModel: OPENAI_MODEL,
          suggestedModel: firstAvailableCandidate,
          candidates
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: "No candidate model is currently available.",
        currentModel: OPENAI_MODEL,
        candidates
      },
      null,
      2
    )
  );
  process.exit(1);
}

run().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[ERROR] ${message}`);
  process.exit(1);
});
