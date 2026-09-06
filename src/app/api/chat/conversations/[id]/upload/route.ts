import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { publish, visitorTopic, websiteTopic } from "@/lib/chatBus";
import { canAccessWebsite } from "@/lib/chat";
import { saveImageUpload } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operatör resim eki gönderir (multipart/form-data: file). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { website: { select: { userId: true, operatorName: true } } },
    });
    if (!conv || !(await canAccessWebsite(conv.websiteId, userId))) return errorResponse("Not found", 404);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return errorResponse("Invalid payload", 400);

    const saved = await saveImageUpload(file);
    if ("error" in saved) return errorResponse(saved.error, 400);

    const message = await prisma.chatMessage.create({
      data: {
        conversationId: id,
        sender: "OPERATOR",
        userId,
        body: "",
        attachmentUrl: saved.url,
        attachmentType: "image",
      },
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
      attachmentUrl: message.attachmentUrl,
      attachmentType: message.attachmentType,
      createdAt: message.createdAt,
      readAt: message.readAt,
    };
    const operatorPayload = {
      ...base,
      operator: message.user ? { name: message.user.name, avatar: message.user.avatar } : null,
    };
    const visitorPayload = { ...base, operator: { name: conv.website.operatorName, avatar: null } };

    publish(visitorTopic(conv.visitorId), { type: "message", conversationId: id, message: visitorPayload });
    publish(websiteTopic(conv.websiteId), { type: "message", conversationId: id, message: operatorPayload });

    return jsonResponse({ message: operatorPayload }, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}
