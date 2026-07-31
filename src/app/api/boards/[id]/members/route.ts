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
      where: { boardId, userId, role: "OWNER", deletedAt: null },
    });

    if (!membership) {
      return errorResponse("Only the board owner can add members", 403);
    }

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return errorResponse("User not found", 404);
    }

    const existing = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUser.id } },
    });

    if (existing && !existing.deletedAt) {
      return errorResponse("User is already a member", 400);
    }

    let member;
    if (existing?.deletedAt) {
      member = await prisma.boardMember.update({
        where: { id: existing.id },
        data: { deletedAt: null, role: role as "MEMBER" | "VIEWER" },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });
    } else {
      member = await prisma.boardMember.create({
        data: { boardId, userId: targetUser.id, role: role as "MEMBER" | "VIEWER" },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });
    }

    // Create notification for the invited user
    await prisma.notification.create({
      data: {
        message: `You have been invited to a board`,
        type: "BOARD_INVITE",
        userId: targetUser.id,
        boardId,
      },
    });

    // Slack notification
    const board = await prisma.board.findUnique({ where: { id: boardId }, select: { title: true } });
    const addedByUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (board && addedByUser) {
      notifyMemberAdded(boardId, addedByUser.name, targetUser.name, board.title, role);
    }

    return jsonResponse(member, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const { memberId } = await req.json();

    const membership = await prisma.boardMember.findFirst({
      where: { boardId, userId, role: "OWNER", deletedAt: null },
    });

    if (!membership) {
      return errorResponse("Only the board owner can remove members", 403);
    }

    const target = await prisma.boardMember.findUnique({ where: { id: memberId } });
    if (!target || target.role === "OWNER") {
      return errorResponse("This member cannot be removed", 400);
    }

    await prisma.boardMember.update({ where: { id: memberId }, data: { deletedAt: new Date() } });

    return jsonResponse({ message: "Member removed" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
