import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySlackSignature, getWorkspaceToken, resolveAppUserId } from "@/lib/slack";
import { buildTaskModal } from "@/lib/slackModal";

function ephemeral(text: string) {
  return NextResponse.json({ response_type: "ephemeral", text });
}

/**
 * Slash command entrypoint (e.g. `/task ...`).
 * Opens a modal where the user picks a board + list and edits the title.
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
  const teamId = params.get("team_id");
  const channelId = params.get("channel_id");
  const slackUserId = params.get("user_id");
  const triggerId = params.get("trigger_id");
  const text = (params.get("text") || "").trim();

  const token = await getWorkspaceToken(teamId);
  if (!token) return ephemeral("⚠️ Slack connection not found. Connect Slack from the app first.");

  const userId = slackUserId ? await resolveAppUserId(slackUserId, token) : null;
  if (!userId) {
    return ephemeral("⚠️ Your Slack account isn't linked to a marktasks user (email didn't match).");
  }

  const boards = await prisma.board.findMany({
    where: {
      deletedAt: null,
      OR: [{ userId }, { members: { some: { userId, deletedAt: null } } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
    take: 100,
  });
  if (!boards.length) return ephemeral("⚠️ You don't have any boards.");

  const view = buildTaskModal({ userId, channelId, boards, titleValue: text || undefined });

  const res = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trigger_id: triggerId, view }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("views.open error:", data.error);
    return ephemeral(`⚠️ Couldn't open the modal: ${data.error}`);
  }

  return new NextResponse(null, { status: 200 });
}
