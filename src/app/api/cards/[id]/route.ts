import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess, getCardBoardRole } from "@/lib/utils";
import { notifyCardMoved, notifyCardDeleted, notifyDueDateSet } from "@/lib/slack";
import { formatDate } from "@/lib/date";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(id, userId);
    if (!hasAccess) return errorResponse("Card not found or you don't have permission", 403);

    const card = await prisma.card.findUnique({
      where: { id },
      include: {
        labels: { where: { deletedAt: null }, include: { label: true } },
        checklists: { where: { deletedAt: null }, include: { items: { where: { deletedAt: null } } } },
        attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        assignees: { where: { deletedAt: null }, include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
        activities: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        comments: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
        },
        list: { select: { id: true, title: true, boardId: true } },
      },
    });

    if (!card) return errorResponse("Card not found", 404);

    return jsonResponse(card);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(id, userId);
    if (!hasAccess) return errorResponse("Card not found or you don't have permission", 403);

    const data = await req.json();

    // Taşımadan ÖNCE kartın mevcut listesini yakala (from→to için)
    const before = await prisma.card.findUnique({ where: { id }, select: { listId: true } });

    const card = await prisma.card.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.listId !== undefined && { listId: data.listId }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.coverColor !== undefined && { coverColor: data.coverColor }),
      },
      include: {
        labels: { include: { label: true } },
        checklists: { include: { items: true } },
        attachments: true,
        _count: { select: { attachments: true, checklists: true } },
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    // Log activity + Slack for moves (gerçekten liste değiştiyse)
    if (data.listId !== undefined && before && before.listId !== data.listId) {
      const [fromList, toList] = await Promise.all([
        prisma.list.findUnique({ where: { id: before.listId }, select: { title: true } }),
        prisma.list.findUnique({ where: { id: data.listId }, select: { title: true } }),
      ]);
      const fromTitle = fromList?.title ?? "unknown";
      const toTitle = toList?.title ?? "unknown";

      await prisma.activity.create({
        data: {
          action: `moved card "${card.title}" from "${fromTitle}" to "${toTitle}"`,
          cardId: card.id,
          userId,
        },
      });
      if (user) {
        notifyCardMoved(id, user.name, card.title, fromTitle, toTitle);
      }
    }

    // Slack for due date
    if (data.dueDate && user) {
      notifyDueDateSet(id, user.name, card.title, formatDate(data.dueDate));
    }

    return jsonResponse(card);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const role = await getCardBoardRole(id, userId);
    if (!role) return errorResponse("Card not found or you don't have permission", 403);
    if (role !== "OWNER") return errorResponse("Only the board owner can delete", 403);

    // Capture card info before deletion for Slack notification
    const cardInfo = await prisma.card.findUnique({
      where: { id },
      select: { title: true, list: { select: { board: { select: { id: true, title: true } } } } },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    await prisma.card.update({ where: { id }, data: { deletedAt: new Date() } });

    if (cardInfo && user) {
      notifyCardDeleted(cardInfo.list.board.id, user.name, cardInfo.title, cardInfo.list.board.title);
    }

    return jsonResponse({ message: "Card deleted" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
