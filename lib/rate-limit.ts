type RateLimitConfig = {
  windowMs: number;
  limit: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const globalRateStore = globalThis as unknown as {
  __iuiRateLimitStore?: Map<string, Bucket>;
};

function getStore() {
  if (!globalRateStore.__iuiRateLimitStore) {
    globalRateStore.__iuiRateLimitStore = new Map<string, Bucket>();
  }
  return globalRateStore.__iuiRateLimitStore;
}

export function consumeRateLimit(key: string, config: RateLimitConfig) {
  const now = Date.now();
  const store = getStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + config.windowMs };
    store.set(key, fresh);
    return {
      ok: true,
      remaining: config.limit - 1,
      resetAt: fresh.resetAt
    };
  }

  if (current.count >= config.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: current.resetAt
    };
  }

  current.count += 1;
  store.set(key, current);
  return {
    ok: true,
    remaining: Math.max(0, config.limit - current.count),
    resetAt: current.resetAt
  };
}

