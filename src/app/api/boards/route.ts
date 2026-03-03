import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;

    const boards = await prisma.board.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { lists: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonResponse(boards);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const { title, background } = await req.json();

    if (!title?.trim()) {
      return errorResponse("Board başlığı gereklidir", 400);
    }

    const board = await prisma.board.create({
      data: {
        title: title.trim(),
        background: background || "#0079bf",
        userId,
        members: {
          create: { userId, role: "OWNER" },
        },
        labels: {
          createMany: {
            data: [
              { name: "Öncelikli", color: "#ef4444" },
              { name: "Devam Ediyor", color: "#f59e0b" },
              { name: "Tamamlandı", color: "#22c55e" },
              { name: "Bug", color: "#8b5cf6" },
              { name: "Özellik", color: "#3b82f6" },
              { name: "İyileştirme", color: "#06b6d4" },
            ],
          },
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return jsonResponse(board, 201);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
