import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { notifyCardCreated } from "@/lib/slack";

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const { title, listId } = await req.json();

    if (!title?.trim() || !listId) {
      return errorResponse("Başlık ve liste ID gereklidir", 400);
    }

    // Get max position in the list
    const lastCard = await prisma.card.findFirst({
      where: { listId },
      orderBy: { position: "desc" },
    });

    const card = await prisma.card.create({
      data: {
        title: title.trim(),
        listId,
        position: (lastCard?.position ?? -1) + 1,
      },
      include: {
        labels: { include: { label: true } },
        checklists: { include: { items: true } },
        attachments: true,
        _count: { select: { attachments: true, checklists: true } },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: `"${card.title}" kartını oluşturdu`,
        cardId: card.id,
        userId,
      },
    });

    // Slack bildirimi
    const list = await prisma.list.findUnique({
      where: { id: listId },
      include: { board: { select: { title: true } } },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (list && user) {
      notifyCardCreated(user.name, card.title, list.title, list.board.title);
    }

    return jsonResponse(card, 201);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
