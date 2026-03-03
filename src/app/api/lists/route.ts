import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const { title, boardId } = await req.json();

    if (!title?.trim() || !boardId) {
      return errorResponse("Başlık ve board ID gereklidir", 400);
    }

    // Check board access
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [{ userId }, { members: { some: { userId, role: { in: ["OWNER", "MEMBER"] } } } }],
      },
    });

    if (!board) return errorResponse("Board bulunamadı", 404);

    // Get max position
    const lastList = await prisma.list.findFirst({
      where: { boardId },
      orderBy: { position: "desc" },
    });

    const list = await prisma.list.create({
      data: {
        title: title.trim(),
        boardId,
        position: (lastList?.position ?? -1) + 1,
      },
      include: { cards: true },
    });

    return jsonResponse(list, 201);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
