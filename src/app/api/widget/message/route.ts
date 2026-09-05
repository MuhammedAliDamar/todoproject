import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { publish, publishAll, websiteTopic, visitorTopic } from "@/lib/chatBus";
import { getClientIp } from "@/lib/chat";
import { rateLimit, MAX_MESSAGE_LEN } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ziyaretçi mesaj gönderir. Açık konuşma yoksa oluşturur.
 * Body: { publicKey, token, body }
 */
export async function POST(req: NextRequest) {
  try {
    const { publicKey, token, body } = await req.json();
    if (!publicKey || !token || !body?.trim()) return errorResponse("Invalid payload", 400);

    // Uzunluk sınırı (DoS/dev boyutlu mesaj)
    if (body.length > MAX_MESSAGE_LEN) return errorResponse("Mesaj çok uzun", 400);

    // Rate limit: ziyaretçi başına 20/dk, IP başına 40/dk
    const ip = getClientIp(req) || "unknown";
    if (!rateLimit(`wmsg:${token}`, 20, 60_000) || !rateLimit(`wmsgip:${ip}`, 40, 60_000)) {
      return errorResponse("Çok fazla istek, lütfen bekleyin", 429);
    }

    const website = await prisma.website.findFirst({
      where: { publicKey, deletedAt: null, active: true },
    });
    if (!website) return errorResponse("Website not found", 404);

    const visitor = await prisma.visitor.findFirst({ where: { token, websiteId: website.id } });
    if (!visitor) return errorResponse("Visitor not found", 404);

    // Açık konuşmayı bul ya da oluştur
    let conversation = await prisma.conversation.findFirst({
      where: { visitorId: visitor.id, status: "OPEN" },
      orderBy: { lastMessageAt: "desc" },
    });
    const isNew = !conversation;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { websiteId: website.id, visitorId: visitor.id },
      });
    }

    const message = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, sender: "VISITOR", body: body.trim() },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        status: "OPEN",
        operatorUnread: { increment: 1 },
      },
    });

    await prisma.visitor.update({
      where: { id: visitor.id },
      data: { online: true, lastSeenAt: new Date() },
    });

    const payload = {
      id: message.id,
      conversationId: conversation.id,
      sender: message.sender,
      body: message.body,
      createdAt: message.createdAt,
      readAt: message.readAt,
      operator: null,
    };

    // Operatör paneline (yeni konuşma + mesaj) bildir
    if (isNew) {
      const full = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: {
          visitor: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      publish(websiteTopic(website.id), { type: "conversation", conversation: full });
    }
    publish(websiteTopic(website.id), {
      type: "message",
      conversationId: conversation.id,
      message: payload,
    });
    // Ziyaretçinin diğer sekmeleri de senkron olsun
    publishAll([visitorTopic(visitor.id)], {
      type: "message",
      conversationId: conversation.id,
      message: payload,
    });

    return jsonResponse({ message: payload, conversationId: conversation.id }, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}
