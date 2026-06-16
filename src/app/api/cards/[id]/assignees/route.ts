import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess } from "@/lib/utils";

// Karta atanan kullanıcılar; sadece o panonun üyeleri atanabilir.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { assigneeId } = await req.json();
    if (!assigneeId) return errorResponse("assigneeId is required", 400);

    // Kartın panosunu bul ve hedef kullanıcının üye olduğunu doğrula
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { list: { select: { board: { select: { id: true, userId: true } } } } },
    });
    if (!card) return errorResponse("Card not found", 404);

    const board = card.list.board;
    const isMember =
      board.userId === assigneeId ||
      (await prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId: board.id, userId: assigneeId } },
      })) !== null;

    if (!isMember) return errorResponse("User is not a member of this board", 400);

    await prisma.cardAssignee.upsert({
      where: { cardId_userId: { cardId, userId: assigneeId } },
      create: { cardId, userId: assigneeId },
      update: {},
    });

    const assignees = await prisma.cardAssignee.findMany({
      where: { cardId },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    return jsonResponse(assignees.map((a) => a.user));
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { assigneeId } = await req.json();
    if (!assigneeId) return errorResponse("assigneeId is required", 400);

    await prisma.cardAssignee.deleteMany({ where: { cardId, userId: assigneeId } });

    const assignees = await prisma.cardAssignee.findMany({
      where: { cardId },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    return jsonResponse(assignees.map((a) => a.user));
  } catch {
    return errorResponse("Server error", 500);
  }
}
