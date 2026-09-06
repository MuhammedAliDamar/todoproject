import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { publish, visitorTopic } from "@/lib/chatBus";
import { canAccessWebsite } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operatör "yazıyor" bilgisini ziyaretçiye iletir. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { website: { select: { userId: true } } },
    });
    if (!conv || !(await canAccessWebsite(conv.websiteId, userId))) return errorResponse("Not found", 404);

    publish(visitorTopic(conv.visitorId), { type: "typing", conversationId: id, from: "operator" });
    return jsonResponse({ ok: true });
  } catch {
    return errorResponse("Server error", 500);
  }
}
