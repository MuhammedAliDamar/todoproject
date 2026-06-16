import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Giriş yapan kullanıcıya atanmış kartlar; liste adına göre gruplanır.
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;

    const assigned = await prisma.cardAssignee.findMany({
      where: { userId },
      select: {
        card: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            list: { select: { id: true, title: true, boardId: true } },
          },
        },
      },
      orderBy: { card: { createdAt: "desc" } },
    });

    // Liste bazında grupla
    const groups: Record<string, { listId: string; listTitle: string; boardId: string; cards: { id: string; title: string; dueDate: Date | null }[] }> = {};
    for (const { card } of assigned) {
      const key = card.list.id;
      if (!groups[key]) {
        groups[key] = { listId: card.list.id, listTitle: card.list.title, boardId: card.list.boardId, cards: [] };
      }
      groups[key].cards.push({ id: card.id, title: card.title, dueDate: card.dueDate });
    }

    return jsonResponse(Object.values(groups));
  } catch {
    return errorResponse("Server error", 500);
  }
}
