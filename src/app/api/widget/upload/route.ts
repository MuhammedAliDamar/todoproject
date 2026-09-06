import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { publish, publishAll, websiteTopic, visitorTopic } from "@/lib/chatBus";
import { getClientIp } from "@/lib/chat";
import { rateLimit } from "@/lib/rateLimit";
import { saveImageUpload } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ziyaretçi resim eki gönderir (multipart/form-data: publicKey, token, file).
 * Sadece gerçek resim dosyaları (magic-byte doğrulaması) kabul edilir.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || "unknown";

    const form = await req.formData();
    const publicKey = form.get("publicKey");
    const token = form.get("token");
    const file = form.get("file");
    if (typeof publicKey !== "string" || typeof token !== "string" || !(file instanceof File)) {
      return errorResponse("Invalid payload", 400);
    }

    // Rate limit: yükleme daha maliyetli → ziyaretçi 10/dk, IP 20/dk
    if (!rateLimit(`wupl:${token}`, 10, 60_000) || !rateLimit(`wuplip:${ip}`, 20, 60_000)) {
      return errorResponse("Too many uploads, please wait", 429);
    }

    const website = await prisma.website.findFirst({
      where: { publicKey, deletedAt: null, active: true },
    });
    if (!website) return errorResponse("Website not found", 404);

    const visitor = await prisma.visitor.findFirst({ where: { token, websiteId: website.id } });
    if (!visitor) return errorResponse("Visitor not found", 404);

    const saved = await saveImageUpload(file);
    if ("error" in saved) return errorResponse(saved.error, 400);

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
      data: {
        conversationId: conversation.id,
        sender: "VISITOR",
        body: "",
        attachmentUrl: saved.url,
        attachmentType: "image",
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "OPEN", operatorUnread: { increment: 1 } },
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
      attachmentUrl: message.attachmentUrl,
      attachmentType: message.attachmentType,
      createdAt: message.createdAt,
      readAt: message.readAt,
      operator: null,
    };

    if (isNew) {
      const full = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { visitor: true, messages: { orderBy: { createdAt: "asc" } } },
      });
      publish(websiteTopic(website.id), { type: "conversation", conversation: full });
    }
    publish(websiteTopic(website.id), { type: "message", conversationId: conversation.id, message: payload });
    publishAll([visitorTopic(visitor.id)], { type: "message", conversationId: conversation.id, message: payload });

    return jsonResponse({ message: payload, conversationId: conversation.id }, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}
