/**
 * Basit süreç-içi (in-memory) sabit-pencere rate limiter.
 * pm2 tek instance (fork) çalıştığından süreç-içi sayaç yeterli.
 * Kötüye kullanım/flood'a karşı public widget endpoint'lerinde kullanılır.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

/**
 * `key` için `windowMs` içinde en fazla `limit` isteğe izin verir.
 * İzin varsa true, aşıldıysa false döner.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Ara sıra süresi dolmuş kayıtları temizle (bellek sınırlama)
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/** Metni güvenli bir üst sınıra kırpar (aşırı büyük girdi/DoS'a karşı). */
export function cap(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/** Mesaj gövdesi üst sınırı (karakter). */
export const MAX_MESSAGE_LEN = 4000;
