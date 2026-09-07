import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { getAccessibleWebsiteIds, ONLINE_THRESHOLD_MS } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Şu anda sitede aktif (çevrimiçi) ziyaretçiler.
 * Konuşma başlatmamış olsalar bile listelenir → operatör onlara mesaj gönderebilir.
 * Query: ?websiteId=<id> (opsiyonel filtre)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const websiteId = req.nextUrl.searchParams.get("websiteId");

    let ids = await getAccessibleWebsiteIds(userId);
    if (websiteId) ids = ids.filter((id) => id === websiteId);
    if (ids.length === 0) return jsonResponse([]);

    const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
    const visitors = await prisma.visitor.findMany({
      where: { websiteId: { in: ids }, lastSeenAt: { gt: cutoff } },
      orderBy: { lastSeenAt: "desc" },
      take: 200,
      include: {
        website: { select: { id: true, name: true, color: true } },
        conversations: {
          where: { status: "OPEN" },
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });

    return jsonResponse(
      visitors.map((v) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        city: v.city,
        country: v.country,
        currentUrl: v.currentUrl,
        lastSeenAt: v.lastSeenAt,
        website: v.website,
        conversationId: v.conversations[0]?.id ?? null,
      }))
    );
  } catch {
    return errorResponse("Server error", 500);
  }
}
