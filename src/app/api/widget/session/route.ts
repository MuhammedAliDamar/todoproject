import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { getClientIp, enrichVisitorGeo, publicWebsiteConfig, tzToLocation } from "@/lib/chat";
import { publish, websiteTopic } from "@/lib/chatBus";
import { rateLimit, cap } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Widget açılışı: ziyaretçiyi tanımlar/oluşturur, konuşma geçmişini döndürür.
 * Body: { publicKey, token?, currentUrl?, referrer? }
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const publicKey = raw.publicKey;
    const token = raw.token;
    if (!publicKey) return errorResponse("publicKey required", 400);

    const ip = getClientIp(req);
    // Rate limit: IP başına 40/dk (yeni ziyaretçi/oturum flood'u)
    if (!rateLimit(`wsess:${ip || "unknown"}`, 40, 60_000)) {
      return errorResponse("Too many requests, please wait", 429);
    }

    // Girdileri güvenli üst sınırlara kırp
    const currentUrl = cap(raw.currentUrl, 2048);
    const referrer = cap(raw.referrer, 2048);
    const timezone = cap(raw.timezone, 64);
    const language = cap(raw.language, 32);

    const website = await prisma.website.findFirst({
      where: { publicKey, deletedAt: null, active: true },
    });
    if (!website) return errorResponse("Website not found", 404);

    const userAgent = cap(req.headers.get("user-agent"), 512);
    // Saat diliminden konum tahmini (IP geo yoksa/gelene kadar kullanılır)
    const tzLoc = tzToLocation(typeof timezone === "string" ? timezone : null);

    // Var olan ziyaretçiyi bul ya da yeni oluştur
    let visitor = token
      ? await prisma.visitor.findFirst({ where: { token, websiteId: website.id } })
      : null;

    if (visitor) {
      visitor = await prisma.visitor.update({
        where: { id: visitor.id },
        data: {
          online: true,
          lastSeenAt: new Date(),
          currentUrl: currentUrl ?? visitor.currentUrl,
          referrer: referrer ?? visitor.referrer,
          ip: ip ?? visitor.ip,
          userAgent: userAgent ?? visitor.userAgent,
          timezone: timezone ?? visitor.timezone,
          language: language ?? visitor.language,
          // IP geo henüz dolmadıysa tz tahminiyle doldur
          country: visitor.country ?? tzLoc.country,
          city: visitor.city ?? tzLoc.city,
        },
      });
    } else {
      visitor = await prisma.visitor.create({
        data: {
          websiteId: website.id,
          online: true,
          currentUrl: currentUrl || null,
          referrer: referrer || null,
          ip,
          userAgent,
          timezone: typeof timezone === "string" ? timezone : null,
          language: typeof language === "string" ? language : null,
          country: tzLoc.country,
          city: tzLoc.city,
        },
      });
    }

    // Ülke/şehir yoksa arka planda doldur
    if (!visitor.country) enrichVisitorGeo(visitor.id, ip);

    // En güncel konuşma (durum/id için)
    const conversation = await prisma.conversation.findFirst({
      where: { visitorId: visitor.id },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true, status: true },
    });

    // Ziyaretçinin TÜM konuşmalarındaki mesajlar (kapatıp yeni oturumda açınca
    // geçmiş kaybolmasın — sürekli tek bir sohbet gibi görünür)
    const history = await prisma.chatMessage.findMany({
      where: { conversation: { visitorId: visitor.id } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true } } },
    });

    // Operatörün paneline ziyaretçi güncellemesini bildir
    publish(websiteTopic(website.id), {
      type: "visitor",
      visitor: {
        id: visitor.id,
        online: true,
        currentUrl: visitor.currentUrl,
        name: visitor.name,
        email: visitor.email,
      },
    });

    return jsonResponse({
      config: publicWebsiteConfig(website),
      visitor: { token: visitor.token, name: visitor.name, email: visitor.email },
      conversation: conversation
        ? { id: conversation.id, status: conversation.status }
        : null,
      messages: history.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        attachmentUrl: m.attachmentUrl,
        attachmentType: m.attachmentType,
        createdAt: m.createdAt,
        readAt: m.readAt,
        // Ziyaretçiye operatörün gerçek adı gösterilmez; site ayarındaki isim (ör. "Support")
        operator: m.user ? { name: website.operatorName, avatar: null } : null,
      })),
    });
  } catch {
    return errorResponse("Server error", 500);
  }
}
