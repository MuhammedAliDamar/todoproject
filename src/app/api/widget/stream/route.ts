import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils";
import { sseStream, visitorTopic } from "@/lib/chatBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Widget SSE akışı. Ziyaretçi-kapsamlı topic'i dinler:
 * operatör mesajları, operatör "yazıyor", okundu bilgisi.
 * Query: ?key=<publicKey>&token=<visitorToken>
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const token = req.nextUrl.searchParams.get("token");
  if (!key || !token) return errorResponse("key and token required", 400);

  const website = await prisma.website.findFirst({
    where: { publicKey: key, deletedAt: null, active: true },
    select: { id: true },
  });
  if (!website) return errorResponse("Website not found", 404);

  const visitor = await prisma.visitor.findFirst({
    where: { token, websiteId: website.id },
    select: { id: true },
  });
  if (!visitor) return errorResponse("Visitor not found", 404);

  return sseStream([visitorTopic(visitor.id)], req.signal);
}
