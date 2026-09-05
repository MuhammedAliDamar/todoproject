import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { publish, websiteTopic } from "@/lib/chatBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ziyaretçi heartbeat'i + yan işlemler.
 * Body: { publicKey, token, currentUrl?, typing?, read? }
 *  - typing: operatör paneline "ziyaretçi yazıyor" bildirir
 *  - read: açık konuşmadaki operatör mesajlarını okundu işaretler
 */
export async function POST(req: NextRequest) {
  try {
    const { publicKey, token, currentUrl, typing, read, timezone, language } = await req.json();
    if (!publicKey || !token) return errorResponse("Invalid payload", 400);

    const website = await prisma.website.findFirst({
      where: { publicKey, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!website) return errorResponse("Website not found", 404);

    const visitor = await prisma.visitor.findFirst({
      where: { token, websiteId: website.id },
    });
    if (!visitor) return errorResponse("Visitor not found", 404);

    await prisma.visitor.update({
      where: { id: visitor.id },
      data: {
        online: true,
        lastSeenAt: new Date(),
        currentUrl: currentUrl ?? visitor.currentUrl,
        timezone: (typeof timezone === "string" ? timezone : null) ?? visitor.timezone,
        language: (typeof language === "string" ? language : null) ?? visitor.language,
      },
    });

    const conversation = await prisma.conversation.findFirst({
      where: { visitorId: visitor.id, status: "OPEN" },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true },
    });

    if (typing && conversation) {
      publish(websiteTopic(website.id), {
        type: "typing",
        conversationId: conversation.id,
        from: "visitor",
        name: visitor.name || "Ziyaretçi",
      });
    }

    if (read && conversation) {
      await prisma.chatMessage.updateMany({
        where: { conversationId: conversation.id, sender: "OPERATOR", readAt: null },
        data: { readAt: new Date() },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { visitorUnread: 0 },
      });
      publish(websiteTopic(website.id), {
        type: "read",
        conversationId: conversation.id,
        by: "visitor",
      });
    }

    // Panelde online noktası taze kalsın
    publish(websiteTopic(website.id), {
      type: "visitor",
      visitor: { id: visitor.id, online: true, currentUrl: currentUrl ?? visitor.currentUrl },
    });

    return jsonResponse({ ok: true });
  } catch {
    return errorResponse("Server error", 500);
  }
}
