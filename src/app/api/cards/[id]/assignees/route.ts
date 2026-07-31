import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess } from "@/lib/utils";
import { sendMail } from "@/lib/mail";
import { notifyTaskAssignedDM } from "@/lib/slack";

// Karta atanan kullanıcılar; sadece o panonun üyeleri atanabilir.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { assigneeId } = await req.json();
    if (!assigneeId) return errorResponse("assigneeId is required", 400);

    // Kartın panosunu bul ve hedef kullanıcının üye olduğunu doğrula
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { title: true, list: { select: { board: { select: { id: true, userId: true } } } } },
    });
    if (!card) return errorResponse("Card not found", 404);

    const board = card.list.board;
    const isMember =
      board.userId === assigneeId ||
      (await prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId: board.id, userId: assigneeId } },
      })) !== null;

    if (!isMember) return errorResponse("User is not a member of this board", 400);

    const existing = await prisma.cardAssignee.findUnique({
      where: { cardId_userId: { cardId, userId: assigneeId } },
    });

    if (!existing || existing.deletedAt) {
      if (existing?.deletedAt) {
        await prisma.cardAssignee.update({
          where: { cardId_userId: { cardId, userId: assigneeId } },
          data: { deletedAt: null },
        });
      } else {
        await prisma.cardAssignee.create({ data: { cardId, userId: assigneeId } });
      }

      if (assigneeId !== userId) {
        const assigner = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { email: true, name: true } });

        await prisma.notification.create({
          data: {
            message: `You were assigned to card "${card.title}"`,
            type: "CARD_ASSIGNED",
            userId: assigneeId,
            boardId: board.id,
          },
        });

        if (assignee?.email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4444";
          sendMail(
            assignee.email,
            `Task assigned: ${card.title}`,
            `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
              <div style="background:#f06a6a;padding:16px 24px;border-radius:12px 12px 0 0;">
                <h2 style="color:#fff;margin:0;font-size:18px;">MarkTasks</h2>
              </div>
              <div style="background:#fff;padding:24px;border:1px solid #eceae9;border-top:none;border-radius:0 0 12px 12px;">
                <p style="color:#1e1f21;margin:0 0 8px;">Hi ${assignee.name},</p>
                <p style="color:#6d6e6f;margin:0 0 16px;"><strong>${assigner?.name || "Someone"}</strong> assigned you to the task:</p>
                <div style="background:#f6f8fa;padding:12px 16px;border-radius:8px;border-left:4px solid #f06a6a;margin-bottom:16px;">
                  <strong style="color:#1e1f21;">${card.title}</strong>
                </div>
                <a href="${appUrl}/board/${board.id}" style="display:inline-block;background:#f06a6a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:500;">View Task</a>
              </div>
            </div>`
          ).catch(() => {});

          const boardData = await prisma.board.findUnique({ where: { id: board.id }, select: { title: true } });
          notifyTaskAssignedDM(
            board.id,
            assignee.email,
            assigner?.name || "Someone",
            card.title,
            boardData?.title || "Project",
            appUrl,
            board.id
          ).catch(() => {});
        }
      }
    }

    const assignees = await prisma.cardAssignee.findMany({
      where: { cardId, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    return jsonResponse(assignees.map((a) => a.user));
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { assigneeId } = await req.json();
    if (!assigneeId) return errorResponse("assigneeId is required", 400);

    await prisma.cardAssignee.updateMany({ where: { cardId, userId: assigneeId }, data: { deletedAt: new Date() } });

    const assignees = await prisma.cardAssignee.findMany({
      where: { cardId, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    return jsonResponse(assignees.map((a) => a.user));
  } catch {
    return errorResponse("Server error", 500);
  }
}
