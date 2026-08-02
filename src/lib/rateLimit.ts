// Limitador en memoria, por instancia serverless.
//
// LIMITACIÓN CONOCIDA: en Vercel conviven varias instancias, así que el límite
// efectivo es (límite × instancias vivas) y se reinicia en cada arranque en
// frío. Sirve para frenar abuso torpe, no a un atacante decidido. La defensa
// real contra el llenado de agenda es el límite por teléfono contra la base de
// datos en POST /api/reservations, que sí es compartido.
// Para un límite estricto, sustituir el store por Upstash Redis.

const store = new Map<string, { count: number; resetAt: number }>();

/** Sin purga, el Map crece indefinidamente con claves por IP y por token. */
const MAX_ENTRIES = 10_000;

function purgeExpired(now: number): void {
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
  // Si tras purgar sigue desbocado, se vacía entero: preferimos perder cuentas
  // (el peor caso es un límite más laxo un momento) a agotar la memoria.
  if (store.size > MAX_ENTRIES) store.clear();
}

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // Purga oportunista: barata y evita que el Map crezca sin fin.
  if (store.size > 1000) purgeExpired(now);

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
