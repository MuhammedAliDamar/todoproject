import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess, getCardBoardRole } from "@/lib/utils";
import { notifyCommentAdded } from "@/lib/slack";
import { sendMail } from "@/lib/mail";
import { notifyCommentDM } from "@/lib/slack";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const comments = await prisma.comment.findMany({
      where: { cardId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonResponse(comments);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { content } = await req.json();

    if (!content?.trim()) {
      return errorResponse("Comment content is required", 400);
    }

    const comment = await prisma.comment.create({
      data: { content: content.trim(), cardId, userId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Slack notification
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        title: true,
        assignees: { where: { deletedAt: null }, include: { user: { select: { id: true, email: true, name: true } } } },
        list: { select: { board: { select: { id: true, title: true } } } },
      },
    });
    if (card) {
      notifyCommentAdded(cardId, comment.user.name, content.trim(), card.title, card.list.board.title);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4444";
      const recipients = card.assignees
        .map((a) => a.user)
        .filter((u) => u.id !== userId && u.email);

      for (const recipient of recipients) {
        // Slack DM
        notifyCommentDM(
          card.list.board.id,
          recipient.email,
          comment.user.name,
          content.trim(),
          card.title,
        ).catch(() => {});

        // Email
        sendMail(
          recipient.email,
          `New comment on: ${card.title}`,
          `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <div style="background:#f06a6a;padding:16px 24px;border-radius:12px 12px 0 0;">
              <h2 style="color:#fff;margin:0;font-size:18px;">MarkTasks</h2>
            </div>
            <div style="background:#fff;padding:24px;border:1px solid #eceae9;border-top:none;border-radius:0 0 12px 12px;">
              <p style="color:#1e1f21;margin:0 0 8px;">Hi ${recipient.name},</p>
              <p style="color:#6d6e6f;margin:0 0 16px;"><strong>${comment.user.name}</strong> commented on <strong>${card.title}</strong>:</p>
              <div style="background:#f6f8fa;padding:12px 16px;border-radius:8px;border-left:4px solid #4573d2;margin-bottom:16px;">
                <p style="color:#1e1f21;margin:0;white-space:pre-wrap;">${content.trim()}</p>
              </div>
              <a href="${appUrl}/board/${card.list.board.id}" style="display:inline-block;background:#f06a6a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:500;">View Task</a>
            </div>
          </div>`
        ).catch(() => {});
      }
    }

    return jsonResponse(comment, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const { commentId } = await req.json();

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return errorResponse("Comment not found", 404);
    }

    if (comment.userId !== userId) {
      const role = await getCardBoardRole(cardId, userId);
      if (role !== "OWNER") return errorResponse("You can only delete your own comments", 403);
    }

    await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return jsonResponse({ message: "Comment deleted" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
