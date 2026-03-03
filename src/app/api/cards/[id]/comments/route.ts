import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("Yetkiniz yok", 403);

    const comments = await prisma.comment.findMany({
      where: { cardId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonResponse(comments);
  } catch {
    return errorResponse("Sunucu hatasi", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("Yetkiniz yok", 403);

    const { content } = await req.json();

    if (!content?.trim()) {
      return errorResponse("Yorum icerigi gereklidir", 400);
    }

    const comment = await prisma.comment.create({
      data: { content: content.trim(), cardId, userId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    return jsonResponse(comment, 201);
  } catch {
    return errorResponse("Sunucu hatasi", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params;
    const userId = req.headers.get("x-user-id")!;
    const { commentId } = await req.json();

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.userId !== userId) {
      return errorResponse("Yorum bulunamadi veya yetkiniz yok", 403);
    }

    await prisma.comment.delete({ where: { id: commentId } });
    return jsonResponse({ message: "Yorum silindi" });
  } catch {
    return errorResponse("Sunucu hatasi", 500);
  }
}
