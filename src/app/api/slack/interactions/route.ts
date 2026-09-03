import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySlackSignature, getWorkspaceToken, notifyCardCreated } from "@/lib/slack";
import { buildTaskModal } from "@/lib/slackModal";

async function boardsForUser(userId: string) {
  return prisma.board.findMany({
    where: {
      deletedAt: null,
      OR: [{ userId }, { members: { some: { userId, deletedAt: null } } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
    take: 100,
  });
}

/**
 * Interactivity endpoint — handles the modal's board select (block_actions)
 * and the final submit (view_submission) that creates the card.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const valid = verifySlackSignature(
    rawBody,
    req.headers.get("x-slack-request-timestamp"),
    req.headers.get("x-slack-signature")
  );
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get("payload") || "{}");
  const token = await getWorkspaceToken(payload?.team?.id);

  // --- Board selected: reload lists and update the modal ---
  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    if (action?.action_id === "board" && token) {
      const boardId = action.selected_option?.value;
      const meta = JSON.parse(payload.view?.private_metadata || "{}");
      const titleValue = payload.view?.state?.values?.title_block?.title?.value || undefined;

      const [boards, lists] = await Promise.all([
        boardsForUser(meta.userId),
        prisma.list.findMany({
          where: { boardId, deletedAt: null },
          orderBy: { position: "asc" },
          select: { id: true, title: true },
        }),
      ]);

      const view = buildTaskModal({
        userId: meta.userId,
        channelId: meta.channelId,
        boards,
        selectedBoardId: boardId,
        lists,
        titleValue,
      });

      await fetch("https://slack.com/api/views.update", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ view_id: payload.view.id, hash: payload.view.hash, view }),
      });
    }
    return new NextResponse(null, { status: 200 });
  }

  // --- Modal submitted: create the card ---
  if (payload.type === "view_submission") {
    const meta = JSON.parse(payload.view?.private_metadata || "{}");
    const values = payload.view?.state?.values || {};
    const title = (values.title_block?.title?.value || "").trim();
    const boardId = values.board_block?.board?.selected_option?.value;
    const listId = values.list_block?.list?.selected_option?.value;

    const errors: Record<string, string> = {};
    if (!title) errors.title_block = "Başlık gerekli";
    if (!boardId) errors.board_block = "Board seçin";
    else if (!listId) errors.board_block = "Bu board'da liste yok — başka board seçin";
    if (Object.keys(errors).length) {
      return NextResponse.json({ response_action: "errors", errors });
    }

    const userId: string = meta.userId;

    const lastCard = await prisma.card.findFirst({
      where: { listId, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const card = await prisma.card.create({
      data: { title, listId, position: (lastCard?.position ?? -1) + 1 },
    });

    await prisma.activity.create({
      data: { action: `created card "${card.title}" via Slack`, cardId: card.id, userId },
    });

    const list = await prisma.list.findUnique({
      where: { id: listId },
      include: { board: { select: { id: true, title: true } } },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (list) {
      notifyCardCreated(list.board.id, user?.name || "Slack", card.title, list.title, list.board.title);
    }

    // Best-effort ephemeral confirmation back in the channel the command was run in
    if (token && meta.channelId && payload.user?.id) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      fetch("https://slack.com/api/chat.postEphemeral", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: meta.channelId,
          user: payload.user.id,
          text: `✅ Görev oluşturuldu: *${card.title}* → _${list?.title}_ (${list?.board.title})\n<${appUrl}/board/${list?.board.id}|Board'u aç>`,
        }),
      }).catch(() => {});
    }

    // Empty 200 closes the modal
    return new NextResponse(null, { status: 200 });
  }

  return new NextResponse(null, { status: 200 });
}
