interface RateWindow {
  startedAt: number;
  count: number;
}

const WINDOW_MS = 60_000;
const windows = new Map<number, RateWindow>();

export function isRateLimited(userId: number, limitPerMinute: number, now = Date.now()): boolean {
  const current = windows.get(userId);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    windows.set(userId, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  windows.set(userId, current);

  return current.count > limitPerMinute;
}

export function __private_resetRateLimitStore() {
  windows.clear();
}
