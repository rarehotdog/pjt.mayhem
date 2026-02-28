interface HeaderCarrier {
  headers: {
    get: (name: string) => string | null;
  };
}

function isBearerAuthorized(input: HeaderCarrier, candidates: string[]) {
  const secrets = candidates.map((token) => token.trim()).filter(Boolean);
  if (secrets.length === 0) {
    return true;
  }

  const authHeader = input.headers.get("authorization");
  return secrets.some((secret) => authHeader === `Bearer ${secret}`);
}

export function isCronAuthorized(input: HeaderCarrier) {
  return isBearerAuthorized(input, [process.env.CRON_SECRET ?? ""]);
}

export function isWorkerAuthorized(input: HeaderCarrier) {
  const localSecret = process.env.LOCAL_WORKER_SECRET ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (!localSecret.trim() && !cronSecret.trim()) {
    return false;
  }

  return isBearerAuthorized(input, [localSecret, cronSecret]);
}
