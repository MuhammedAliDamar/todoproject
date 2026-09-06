import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { isOnline, getAccessibleWebsiteIds } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operatörün sitelerindeki konuşmalar.
 * Query: ?websiteId=<id>&status=OPEN|RESOLVED|ALL
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const websiteId = req.nextUrl.searchParams.get("websiteId");
    const status = req.nextUrl.searchParams.get("status") || "ALL";

    // Kullanıcının erişebildiği (sahip veya üye) site id'leri
    let ids = await getAccessibleWebsiteIds(userId);
    if (websiteId) ids = ids.filter((id) => id === websiteId); // siteye göre filtre
    if (ids.length === 0) return jsonResponse([]);

    const conversations = await prisma.conversation.findMany({
      where: {
        websiteId: { in: ids },
        ...(status === "OPEN" ? { status: "OPEN" } : status === "RESOLVED" ? { status: "RESOLVED" } : {}),
      },
      orderBy: { lastMessageAt: "desc" },
      take: 200,
      include: {
        visitor: true,
        website: { select: { id: true, name: true, color: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return jsonResponse(
      conversations.map((c) => ({
        id: c.id,
        status: c.status,
        lastMessageAt: c.lastMessageAt,
        operatorUnread: c.operatorUnread,
        assignedUserId: c.assignedUserId,
        website: c.website,
        visitor: {
          id: c.visitor.id,
          name: c.visitor.name,
          email: c.visitor.email,
          country: c.visitor.country,
          city: c.visitor.city,
          currentUrl: c.visitor.currentUrl,
          online: isOnline(c.visitor.lastSeenAt),
        },
        lastMessage: c.messages[0]
          ? {
              body: c.messages[0].attachmentType === "image" ? "📷 Photo" : c.messages[0].body,
              sender: c.messages[0].sender,
              createdAt: c.messages[0].createdAt,
            }
          : null,
      }))
    );
  } catch {
    return errorResponse("Server error", 500);
  }
}
