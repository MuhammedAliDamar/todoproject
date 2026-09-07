import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { getAccessibleWebsiteIds } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Konuşma içi arama: mesaj gövdesinde (ör. order id, link) geçen ifadeyi bulup
 * hangi konuşmada geçtiğini döndürür.
 * Query: ?q=<metin>&websiteId=<opsiyonel>
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    const websiteId = req.nextUrl.searchParams.get("websiteId");
    if (q.length < 2) return jsonResponse([]);

    let ids = await getAccessibleWebsiteIds(userId);
    if (websiteId) ids = ids.filter((id) => id === websiteId);
    if (ids.length === 0) return jsonResponse([]);

    // Eşleşen mesajlar (en yeni önce). Konuşma başına ilk (en yeni) eşleşmeyi alacağız.
    const matches = await prisma.chatMessage.findMany({
      where: {
        body: { contains: q, mode: "insensitive" },
        conversation: { websiteId: { in: ids } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        conversation: {
          include: {
            visitor: { select: { id: true, name: true, email: true } },
            website: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    // Konuşma başına tek satır (en yeni eşleşme)
    const seen = new Set<string>();
    const results = [];
    for (const m of matches) {
      const cid = m.conversationId;
      if (seen.has(cid)) continue;
      seen.add(cid);
      results.push({
        conversationId: cid,
        status: m.conversation.status,
        website: m.conversation.website,
        visitor: m.conversation.visitor,
        snippet: snippet(m.body, q),
        sender: m.sender,
        createdAt: m.createdAt,
      });
      if (results.length >= 40) break;
    }

    return jsonResponse(results);
  } catch {
    return errorResponse("Server error", 500);
  }
}

/** Eşleşen ifadenin çevresinden kısa bir bağlam parçası çıkarır. */
function snippet(body: string, q: string): string {
  const i = body.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return body.slice(0, 120);
  const start = Math.max(0, i - 40);
  const end = Math.min(body.length, i + q.length + 60);
  return (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
}
