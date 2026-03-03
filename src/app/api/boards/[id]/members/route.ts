import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { notifyMemberAdded } from "@/lib/slack";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const { email, role = "MEMBER" } = await req.json();

    // Check if requester is owner
    const membership = await prisma.boardMember.findFirst({
      where: { boardId, userId, role: "OWNER" },
    });

    if (!membership) {
      return errorResponse("Sadece board sahibi üye ekleyebilir", 403);
    }

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return errorResponse("Kullanıcı bulunamadı", 404);
    }

    const existing = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUser.id } },
    });

    if (existing) {
      return errorResponse("Kullanıcı zaten üye", 400);
    }

    const member = await prisma.boardMember.create({
      data: { boardId, userId: targetUser.id, role: role as "MEMBER" | "VIEWER" },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    // Create notification for the invited user
    await prisma.notification.create({
      data: {
        message: `Bir board'a davet edildiniz`,
        type: "BOARD_INVITE",
        userId: targetUser.id,
        boardId,
      },
    });

    // Slack bildirimi
    const board = await prisma.board.findUnique({ where: { id: boardId }, select: { title: true } });
    const addedByUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (board && addedByUser) {
      notifyMemberAdded(boardId, addedByUser.name, targetUser.name, board.title, role);
    }

    return jsonResponse(member, 201);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const { memberId } = await req.json();

    const membership = await prisma.boardMember.findFirst({
      where: { boardId, userId, role: "OWNER" },
    });

    if (!membership) {
      return errorResponse("Sadece board sahibi üye çıkarabilir", 403);
    }

    const target = await prisma.boardMember.findUnique({ where: { id: memberId } });
    if (!target || target.role === "OWNER") {
      return errorResponse("Bu üye çıkarılamaz", 400);
    }

    await prisma.boardMember.delete({ where: { id: memberId } });

    return jsonResponse({ message: "Üye çıkarıldı" });
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
