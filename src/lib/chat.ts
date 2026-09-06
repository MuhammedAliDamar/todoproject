import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/** Reverse-proxy arkasında gerçek istemci IP'sini çıkarır. */
export function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || null;
}

/**
 * Ziyaretçinin ülke/şehir bilgisini best-effort doldurur (ip-api.com, ücretsiz).
 * Hata/timeout durumunda sessizce geçer. Fire-and-forget kullanılmalı.
 */
export async function enrichVisitorGeo(visitorId: string, ip: string | null) {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city`,
      { signal: controller.signal }
    );
    clearTimeout(t);
    if (!res.ok) return;
    const data = (await res.json()) as { status?: string; country?: string; city?: string };
    if (data.status !== "success") return;
    await prisma.visitor.update({
      where: { id: visitorId },
      data: { country: data.country || null, city: data.city || null },
    });
  } catch {
    /* geo best-effort */
  }
}

/**
 * Kullanıcının erişebildiği (sahip VEYA atanmış üye) site id'lerini döndürür.
 * Operatör paneli erişim kontrolünün tek kaynağı.
 */
export async function getAccessibleWebsiteIds(userId: string): Promise<string[]> {
  const rows = await prisma.website.findMany({
    where: {
      deletedAt: null,
      OR: [{ userId }, { members: { some: { userId, deletedAt: null } } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Kullanıcı bu siteye erişebiliyor mu (sahip veya üye)? */
export async function canAccessWebsite(websiteId: string, userId: string): Promise<boolean> {
  const w = await prisma.website.findFirst({
    where: {
      id: websiteId,
      deletedAt: null,
      OR: [{ userId }, { members: { some: { userId, deletedAt: null } } }],
    },
    select: { id: true },
  });
  return !!w;
}

/** Sadece site sahibi mi? (ayar/üye yönetimi için) */
export async function isWebsiteOwner(websiteId: string, userId: string): Promise<boolean> {
  const w = await prisma.website.findFirst({
    where: { id: websiteId, userId, deletedAt: null },
    select: { id: true },
  });
  return !!w;
}

/** Widget'ın döndüğü herkese açık site konfigürasyonu. */
export function publicWebsiteConfig(w: {
  publicKey: string;
  color: string;
  welcomeMessage: string;
  operatorName: string;
  position: string;
}) {
  return {
    publicKey: w.publicKey,
    color: w.color,
    welcomeMessage: w.welcomeMessage,
    operatorName: w.operatorName,
    position: w.position,
  };
}

/**
 * IANA saat dilimini ülke/şehre çözer (tarayıcı timezone'undan konum tahmini).
 * Şehir = tz'nin son segmenti; ülke = yaygın tz'ler için tablo, yoksa bölge.
 */
const TZ_COUNTRY: Record<string, string> = {
  "Europe/Istanbul": "Turkey",
  "Asia/Istanbul": "Turkey",
  "Europe/London": "United Kingdom",
  "Europe/Berlin": "Germany",
  "Europe/Paris": "France",
  "Europe/Amsterdam": "Netherlands",
  "Europe/Madrid": "Spain",
  "Europe/Rome": "Italy",
  "Europe/Moscow": "Russia",
  "Europe/Kiev": "Ukraine",
  "Europe/Athens": "Greece",
  "Europe/Bucharest": "Romania",
  "Europe/Vienna": "Austria",
  "Europe/Zurich": "Switzerland",
  "Europe/Brussels": "Belgium",
  "Europe/Stockholm": "Sweden",
  "Europe/Warsaw": "Poland",
  "America/New_York": "USA",
  "America/Chicago": "USA",
  "America/Denver": "USA",
  "America/Los_Angeles": "USA",
  "America/Toronto": "Canada",
  "America/Sao_Paulo": "Brazil",
  "America/Mexico_City": "Mexico",
  "Asia/Dubai": "UAE",
  "Asia/Riyadh": "Saudi Arabia",
  "Asia/Tehran": "Iran",
  "Asia/Baghdad": "Iraq",
  "Asia/Jerusalem": "Israel",
  "Asia/Baku": "Azerbaijan",
  "Asia/Tokyo": "Japan",
  "Asia/Shanghai": "China",
  "Asia/Hong_Kong": "Hong Kong",
  "Asia/Singapore": "Singapore",
  "Asia/Kolkata": "India",
  "Asia/Karachi": "Pakistan",
  "Africa/Cairo": "Egypt",
  "Africa/Lagos": "Nigeria",
  "Africa/Johannesburg": "South Africa",
  "Australia/Sydney": "Australia",
};
const TZ_REGION: Record<string, string> = {
  Europe: "Europe",
  America: "Americas",
  Asia: "Asia",
  Africa: "Africa",
  Australia: "Australia",
  Pacific: "Pacific",
  Indian: "Indian Ocean",
  Atlantic: "Atlantic",
};

export function tzToLocation(tz: string | null): { city: string | null; country: string | null } {
  if (!tz || !tz.includes("/")) return { city: null, country: null };
  const parts = tz.split("/");
  const city = parts[parts.length - 1].replace(/_/g, " ");
  const country = TZ_COUNTRY[tz] || TZ_REGION[parts[0]] || null;
  return { city, country };
}

/** Ziyaretçinin saat dilimindeki güncel yerel saati (HH:mm), tz geçersizse null. */
export function visitorLocalTime(tz: string | null): string | null {
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return null;
  }
}

/** Ziyaretçiyi çevrimiçi kabul etmek için son görülme eşiği (ms). */
export const ONLINE_THRESHOLD_MS = 45_000;

export function isOnline(lastSeenAt: Date): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}
