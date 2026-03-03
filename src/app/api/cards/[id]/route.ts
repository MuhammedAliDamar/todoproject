import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess } from "@/lib/utils";
import { notifyCardMoved, notifyCardDeleted, notifyDueDateSet } from "@/lib/slack";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(id, userId);
    if (!hasAccess) return errorResponse("Kart bulunamadı veya yetkiniz yok", 403);

    const card = await prisma.card.findUnique({
      where: { id },
      include: {
        labels: { include: { label: true } },
        checklists: { include: { items: true } },
        attachments: { orderBy: { createdAt: "desc" } },
        activities: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        comments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
        },
        list: { select: { id: true, title: true, boardId: true } },
      },
    });

    if (!card) return errorResponse("Kart bulunamadı", 404);

    return jsonResponse(card);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(id, userId);
    if (!hasAccess) return errorResponse("Kart bulunamadı veya yetkiniz yok", 403);

    const data = await req.json();

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

    // Log activity + Slack for moves
    if (data.listId !== undefined) {
      const oldList = await prisma.list.findUnique({ where: { id: data.listId }, select: { title: true } });
      await prisma.activity.create({
        data: {
          action: `"${card.title}" kartını taşıdı`,
          cardId: card.id,
          userId,
        },
      });
      if (user && oldList) {
        notifyCardMoved(user.name, card.title, "önceki liste", oldList.title);
      }
    }

    // Slack for due date
    if (data.dueDate && user) {
      notifyDueDateSet(user.name, card.title, new Date(data.dueDate).toLocaleDateString("tr-TR"));
    }

    return jsonResponse(card);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(id, userId);
    if (!hasAccess) return errorResponse("Kart bulunamadı veya yetkiniz yok", 403);

    // Slack bildirimi için kart bilgisini sil öncesi al
    const cardInfo = await prisma.card.findUnique({
      where: { id },
      select: { title: true, list: { select: { board: { select: { title: true } } } } },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    await prisma.card.delete({ where: { id } });

    if (cardInfo && user) {
      notifyCardDeleted(user.name, cardInfo.title, cardInfo.list.board.title);
    }

    return jsonResponse({ message: "Kart silindi" });
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
