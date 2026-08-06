import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, getBoardRole } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const role = await getBoardRole(boardId, userId);
    if (!role) return errorResponse("Board not found or no access", 403);

    const deletedCards = await prisma.card.findMany({
      where: {
        deletedAt: { not: null },
        list: { boardId, deletedAt: null },
      },
      include: {
        list: { select: { id: true, title: true } },
        assignees: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
      orderBy: { deletedAt: "desc" },
    });

    return jsonResponse(deletedCards);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const { cardId } = await req.json();

    const role = await getBoardRole(boardId, userId);
    if (!role || role === "VIEWER") return errorResponse("No permission to restore tasks", 403);

    const card = await prisma.card.findFirst({
      where: { id: cardId, deletedAt: { not: null }, list: { boardId } },
    });

    if (!card) return errorResponse("Deleted card not found", 404);

    await prisma.card.update({
      where: { id: cardId },
      data: { deletedAt: null },
    });

    return jsonResponse({ message: "Card restored" });
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const { cardId } = await req.json();

    const role = await getBoardRole(boardId, userId);
    if (!role || role !== "OWNER") return errorResponse("Only the board owner can permanently delete", 403);

    const card = await prisma.card.findFirst({
      where: { id: cardId, deletedAt: { not: null }, list: { boardId } },
    });

    if (!card) return errorResponse("Deleted card not found", 404);

    await prisma.card.delete({ where: { id: cardId } });

    return jsonResponse({ message: "Card permanently deleted" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
