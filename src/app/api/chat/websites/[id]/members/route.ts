import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { isWebsiteOwner } from "@/lib/chat";

export const runtime = "nodejs";

/** Siteye atanmış operatörleri (üyeler + sahip) listeler. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    if (!(await isWebsiteOwner(id, userId))) return errorResponse("No permission", 403);

    const website = await prisma.website.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        members: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!website) return errorResponse("Not found", 404);

    return jsonResponse({
      owner: { ...website.user, role: "owner" },
      members: website.members.map((m) => ({ ...m.user, role: "member", memberId: m.id })),
    });
  } catch {
    return errorResponse("Server error", 500);
  }
}

/** E-posta ile kullanıcıyı siteye atar. Body: { email } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    if (!(await isWebsiteOwner(id, userId))) return errorResponse("No permission", 403);

    const { email } = await req.json();
    if (!email?.trim()) return errorResponse("Email required", 400);

    const target = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true, avatar: true },
    });
    if (!target) return errorResponse("No user registered with this email", 404);

    const website = await prisma.website.findUnique({ where: { id }, select: { userId: true } });
    if (website?.userId === target.id) return errorResponse("Already the site owner", 400);

    // Soft-delete edilmiş kayıt varsa geri aç, yoksa oluştur (upsert — silme yok)
    const existing = await prisma.websiteMember.findUnique({
      where: { websiteId_userId: { websiteId: id, userId: target.id } },
    });
    if (existing) {
      await prisma.websiteMember.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
    } else {
      await prisma.websiteMember.create({ data: { websiteId: id, userId: target.id } });
    }

    return jsonResponse({ ...target, role: "member" }, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}

/** Üyeyi siteden çıkarır (soft-delete — kayıt korunur). Body: { userId } */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    if (!(await isWebsiteOwner(id, userId))) return errorResponse("No permission", 403);

    const { userId: targetId } = await req.json();
    if (!targetId) return errorResponse("userId required", 400);

    const member = await prisma.websiteMember.findUnique({
      where: { websiteId_userId: { websiteId: id, userId: targetId } },
    });
    if (member && !member.deletedAt) {
      await prisma.websiteMember.update({ where: { id: member.id }, data: { deletedAt: new Date() } });
    }
    return jsonResponse({ ok: true });
  } catch {
    return errorResponse("Server error", 500);
  }
}
