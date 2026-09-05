import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { publish, visitorTopic, websiteTopic } from "@/lib/chatBus";
import { canAccessWebsite } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operatör yanıtı. Body: { body } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { website: { select: { userId: true } } },
    });
    if (!conv || !(await canAccessWebsite(conv.websiteId, userId))) return errorResponse("Bulunamadı", 404);

    const { body } = await req.json();
    if (!body?.trim()) return errorResponse("Boş mesaj", 400);

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

    const payload = {
      id: message.id,
      conversationId: id,
      sender: message.sender,
      body: message.body,
      createdAt: message.createdAt,
      readAt: message.readAt,
      operator: message.user ? { name: message.user.name, avatar: message.user.avatar } : null,
    };

    // Ziyaretçinin widget'ına ilet
    publish(visitorTopic(conv.visitorId), { type: "message", conversationId: id, message: payload });
    // Panelin diğer sekmelerine ilet
    publish(websiteTopic(conv.websiteId), { type: "message", conversationId: id, message: payload });

    return jsonResponse({ message: payload }, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}
