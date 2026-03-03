import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const board = await prisma.board.findFirst({
      where: {
        id,
        OR: [{ userId }, { members: { some: { userId } } }],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        },
        labels: true,
        lists: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: {
                labels: { include: { label: true } },
                checklists: { include: { items: true } },
                attachments: true,
                _count: { select: { attachments: true, checklists: true } },
              },
            },
          },
        },
      },
    });

    if (!board) {
      return errorResponse("Board bulunamadı", 404);
    }

    // slackToken'ı client'a göndermiyoruz, sadece bağlı olup olmadığını
    return jsonResponse({
      ...board,
      slackToken: board.slackToken ? "connected" : null,
    });
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const data = await req.json();

    const board = await prisma.board.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { members: { some: { userId, role: "OWNER" } } },
        ],
      },
    });

    if (!board) {
      return errorResponse("Board bulunamadı veya yetkiniz yok", 403);
    }

    const updated = await prisma.board.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title.trim() }),
        ...(data.background && { background: data.background }),
        ...(data.slackChannelId !== undefined && { slackChannelId: data.slackChannelId }),
        ...(data.slackChannelName !== undefined && { slackChannelName: data.slackChannelName }),
      },
    });

    return jsonResponse(updated);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const board = await prisma.board.findFirst({
      where: { id, userId },
    });

    if (!board) {
      return errorResponse("Board bulunamadı veya yetkiniz yok", 404);
    }

    await prisma.board.delete({ where: { id } });

    return jsonResponse({ message: "Board silindi" });
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
