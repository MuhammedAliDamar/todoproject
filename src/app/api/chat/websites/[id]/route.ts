import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export const runtime = "nodejs";

async function owns(id: string, userId: string) {
  const w = await prisma.website.findFirst({ where: { id, userId, deletedAt: null } });
  return w;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const website = await owns(id, userId);
    if (!website) return errorResponse("Bulunamadı", 404);
    return jsonResponse(website);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const website = await owns(id, userId);
    if (!website) return errorResponse("Bulunamadı", 404);

    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
    if (typeof b.domain === "string") data.domain = b.domain.trim() || null;
    if (typeof b.color === "string") data.color = b.color;
    if (typeof b.welcomeMessage === "string" && b.welcomeMessage.trim())
      data.welcomeMessage = b.welcomeMessage.trim();
    if (typeof b.operatorName === "string" && b.operatorName.trim())
      data.operatorName = b.operatorName.trim();
    if (b.position === "left" || b.position === "right") data.position = b.position;
    if (typeof b.active === "boolean") data.active = b.active;
    // publicKey yenileme (eski embed kodları geçersiz olur — silme değil, rotasyon)
    if (b.regenerate === true) {
      data.publicKey = crypto.randomUUID().replace(/-/g, "");
    }

    const updated = await prisma.website.update({ where: { id }, data });
    return jsonResponse(updated);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const website = await owns(id, userId);
    if (!website) return errorResponse("Bulunamadı", 404);
    // Kalıcı silme yok — soft delete (kayıtları koru)
    await prisma.website.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    return jsonResponse({ ok: true });
  } catch {
    return errorResponse("Server error", 500);
  }
}
