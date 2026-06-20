// Simple in-memory rate limiter (per serverless instance).
// For multi-instance production use, swap the store for Upstash Redis.

const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + opts.windowSeconds * 1000 });
    return { allowed: true, remaining: opts.limit - 1 };
  }

  if (entry.count >= opts.limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: opts.limit - entry.count };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
