import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { canAccessWebsite } from "@/lib/chat";
import { publish, websiteTopic } from "@/lib/chatBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operatörün bir ziyaretçiyle (çevrimiçi listesinden) konuşma başlatması.
 * Açık konuşma varsa onu döndürür, yoksa oluşturur. Mesaj göndermez.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: visitorId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const visitor = await prisma.visitor.findUnique({ where: { id: visitorId }, select: { id: true, websiteId: true } });
    if (!visitor || !(await canAccessWebsite(visitor.websiteId, userId))) return errorResponse("Not found", 404);

    let conv = await prisma.conversation.findFirst({
      where: { visitorId, status: "OPEN" },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true },
    });

    if (!conv) {
      conv = await prisma.conversation.create({
        data: { websiteId: visitor.websiteId, visitorId, status: "OPEN", assignedUserId: userId },
        select: { id: true },
      });
      // Diğer operatör sekmeleri listeyi tazelesin
      publish(websiteTopic(visitor.websiteId), { type: "conversation", conversation: { id: conv.id } });
    }

    return jsonResponse({ conversationId: conv.id });
  } catch {
    return errorResponse("Server error", 500);
  }
}
