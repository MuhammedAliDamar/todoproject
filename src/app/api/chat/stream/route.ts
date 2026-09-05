import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/utils";
import { sseStream, websiteTopic } from "@/lib/chatBus";
import { getAccessibleWebsiteIds } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operatör paneli SSE akışı. Kullanıcının erişebildiği (sahip+üye) sitelerin topic'lerini dinler.
 * Yeni konuşma, yeni ziyaretçi mesajı, ziyaretçi online/yazıyor, okundu.
 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthorized", 401);

  const ids = await getAccessibleWebsiteIds(userId);
  const topics = ids.map((id) => websiteTopic(id));
  // En az bir topic olmalı (aksi halde stream boş dinler ama yine açık kalır)
  return sseStream(topics, req.signal);
}
