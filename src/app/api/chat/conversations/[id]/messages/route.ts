import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { publish, visitorTopic, websiteTopic } from "@/lib/chatBus";
import { canAccessWebsite } from "@/lib/chat";
import { MAX_MESSAGE_LEN } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operatör yanıtı. Body: { body } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { website: { select: { userId: true, operatorName: true } } },
    });
    if (!conv || !(await canAccessWebsite(conv.websiteId, userId))) return errorResponse("Not found", 404);

    const { body } = await req.json();
    if (!body?.trim()) return errorResponse("Empty message", 400);
    if (body.length > MAX_MESSAGE_LEN) return errorResponse("Message too long", 400);

    const message = await prisma.chatMessage.create({
      data: { conversationId: id, sender: "OPERATOR", userId, body: body.trim() },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        status: "OPEN",
        visitorUnread: { increment: 1 },
        operatorUnread: 0,
        ...(conv.assignedUserId ? {} : { assignedUserId: userId }),
      },
    });

    const base = {
      id: message.id,
      conversationId: id,
      sender: message.sender,
      body: message.body,
      createdAt: message.createdAt,
      readAt: message.readAt,
    };
    // Operatör paneli: gerçek operatör adı/avatarı
    const operatorPayload = {
      ...base,
      operator: message.user ? { name: message.user.name, avatar: message.user.avatar } : null,
    };
    // Ziyaretçi widget'ı: gerçek isim gizli, site ayarındaki isim (ör. "Support")
    const visitorPayload = {
      ...base,
      operator: { name: conv.website.operatorName, avatar: null },
    };

    // Ziyaretçinin widget'ına ilet (isim gizli)
    publish(visitorTopic(conv.visitorId), { type: "message", conversationId: id, message: visitorPayload });
    // Panelin diğer sekmelerine ilet (gerçek isim)
    publish(websiteTopic(conv.websiteId), { type: "message", conversationId: id, message: operatorPayload });

    return jsonResponse({ message: operatorPayload }, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}
