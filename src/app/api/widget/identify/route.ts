import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { publish, websiteTopic } from "@/lib/chatBus";
import { rateLimit, cap } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ziyaretçi kimliği: e-posta (ve opsiyonel isim) toplar.
 * Body: { publicKey, token, email, name? }
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const { publicKey, token } = raw;
    if (!publicKey || !token) return errorResponse("Invalid payload", 400);

    if (!rateLimit(`widentify:${token}`, 10, 60_000)) {
      return errorResponse("Too many requests", 429);
    }

    const email = cap(raw.email, 200);
    const name = cap(raw.name, 80);
    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      return errorResponse("Invalid email", 400);
    }

    const website = await prisma.website.findFirst({
      where: { publicKey, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!website) return errorResponse("Website not found", 404);

    const visitor = await prisma.visitor.findFirst({
      where: { token, websiteId: website.id },
      select: { id: true, name: true },
    });
    if (!visitor) return errorResponse("Visitor not found", 404);

    const data: { email: string; name?: string } = { email };
    // İsim yalnızca ziyaretçi kendisi verdiyse ve operatör önceden atamadıysa güncelle
    if (typeof name === "string" && name && !visitor.name) data.name = name;

    await prisma.visitor.update({ where: { id: visitor.id }, data });

    // Operatör paneline anlık bildir
    publish(websiteTopic(website.id), {
      type: "visitor",
      visitor: { id: visitor.id, online: true, email, name: data.name ?? visitor.name },
    });

    return jsonResponse({ ok: true, email });
  } catch {
    return errorResponse("Server error", 500);
  }
}
