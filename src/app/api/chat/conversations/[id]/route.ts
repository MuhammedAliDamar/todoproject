import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { isOnline, canAccessWebsite } from "@/lib/chat";
import { publish, visitorTopic, websiteTopic } from "@/lib/chatBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadOwned(id: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: { website: { select: { userId: true } } },
  });
  if (!conv) return null;
  if (!(await canAccessWebsite(conv.websiteId, userId))) return null;
  return conv;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const conv = await loadOwned(id, userId);
    if (!conv) return errorResponse("Not found", 404);

    const full = await prisma.conversation.findUnique({
      where: { id },
      include: {
        visitor: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });
    if (!full) return errorResponse("Not found", 404);

    // Ziyaretçinin gezdiği sayfalar (en yeni önce)
    const pageViews = await prisma.pageView.findMany({
      where: { visitorId: full.visitorId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, url: true, createdAt: true },
    });

    return jsonResponse({
      id: full.id,
      status: full.status,
      assignedUserId: full.assignedUserId,
      labels: full.labels,
      pageViews,
      visitor: {
        ...full.visitor,
        online: isOnline(full.visitor.lastSeenAt),
      },
      messages: full.messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        attachmentUrl: m.attachmentUrl,
        attachmentType: m.attachmentType,
        createdAt: m.createdAt,
        readAt: m.readAt,
        operator: m.user ? { name: m.user.name, avatar: m.user.avatar } : null,
      })),
    });
  } catch {
    return errorResponse("Server error", 500);
  }
}

/** status (OPEN/RESOLVED), atama, ve operatörün "okundu" işareti. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const conv = await loadOwned(id, userId);
    if (!conv) return errorResponse("Not found", 404);

    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.status === "OPEN" || b.status === "RESOLVED") data.status = b.status;
    if (b.assignedUserId === null || typeof b.assignedUserId === "string")
      data.assignedUserId = b.assignedUserId;

    // Ziyaretçiyi yeniden adlandır (ör. "Ali Veli"). Kişi konuşmalar arası paylaşılır.
    let renamedTo: string | null | undefined;
    if (typeof b.visitorName === "string" || b.visitorName === null) {
      renamedTo = typeof b.visitorName === "string" ? b.visitorName.trim().slice(0, 80) || null : null;
      await prisma.visitor.update({ where: { id: conv.visitorId }, data: { name: renamedTo } });
    }

    // Ziyaretçi hakkında operatör notu (konuşmalar arası paylaşılır, kişiyi tanımak için)
    let noteTo: string | null | undefined;
    if (typeof b.visitorNote === "string" || b.visitorNote === null) {
      noteTo = typeof b.visitorNote === "string" ? b.visitorNote.slice(0, 4000) || null : null;
      await prisma.visitor.update({ where: { id: conv.visitorId }, data: { note: noteTo } });
    }

    // Konuşma etiketleri (serbest metin, tekilleştirilir, kırpılır)
    if (Array.isArray(b.labels)) {
      data.labels = [
        ...new Set(
          (b.labels as unknown[])
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim().slice(0, 32))
            .filter(Boolean)
        ),
      ].slice(0, 12);
    }

    // Operatör konuşmayı açtı → ziyaretçi mesajlarını okundu say
    if (b.read === true) {
      await prisma.chatMessage.updateMany({
        where: { conversationId: id, sender: "VISITOR", readAt: null },
        data: { readAt: new Date() },
      });
      data.operatorUnread = 0;
      // Ziyaretçiye "operatör gördü" bildirimi
      publish(visitorTopic(conv.visitorId), { type: "read", conversationId: id, by: "operator" });
    }

    const updated = Object.keys(data).length
      ? await prisma.conversation.update({ where: { id }, data })
      : conv;

    // Panelin diğer sekmeleri güncellensin
    publish(websiteTopic(conv.websiteId), {
      type: "conversation",
      conversation: { id: updated.id, status: updated.status, operatorUnread: updated.operatorUnread },
    });

    return jsonResponse({ ok: true, status: updated.status, labels: updated.labels, visitorName: renamedTo, visitorNote: noteTo });
  } catch {
    return errorResponse("Server error", 500);
  }
}
