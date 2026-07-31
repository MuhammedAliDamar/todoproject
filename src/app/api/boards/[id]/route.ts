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
        deletedAt: null,
        OR: [{ userId }, { members: { some: { userId } } }],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        members: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        },
        labels: true,
        lists: {
          where: { deletedAt: null },
          orderBy: { position: "asc" },
          include: {
            cards: {
              where: { deletedAt: null },
              orderBy: { position: "asc" },
              include: {
                labels: { where: { deletedAt: null }, include: { label: true } },
                checklists: { where: { deletedAt: null }, include: { items: { where: { deletedAt: null } } } },
                attachments: { where: { deletedAt: null } },
                assignees: { where: { deletedAt: null }, include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
                _count: { select: { attachments: { where: { deletedAt: null } }, checklists: { where: { deletedAt: null } } } },
              },
            },
          },
        },
      },
    });

    if (!board) {
      return errorResponse("Board not found", 404);
    }

    // Fetch Slack info separately (not included in include)
    const slackInfo = await prisma.board.findUnique({
      where: { id },
      select: { slackToken: true, slackChannelId: true, slackChannelName: true, slackTeamName: true },
    });

    return jsonResponse({
      ...board,
      slackToken: slackInfo?.slackToken ? "connected" : null,
      slackChannelId: slackInfo?.slackChannelId || null,
      slackChannelName: slackInfo?.slackChannelName || null,
      slackTeamName: slackInfo?.slackTeamName || null,
    });
  } catch {
    return errorResponse("Server error", 500);
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
        deletedAt: null,
        OR: [
          { userId },
          { members: { some: { userId, role: "OWNER" } } },
        ],
      },
    });

    if (!board) {
      return errorResponse("Board not found or you don't have permission", 403);
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
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const board = await prisma.board.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!board) {
      return errorResponse("Board not found or you don't have permission", 404);
    }

    // Soft delete — kayıt silinmez, deletedAt damgalanır
    await prisma.board.update({ where: { id }, data: { deletedAt: new Date() } });

    return jsonResponse({ message: "Board deleted" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
