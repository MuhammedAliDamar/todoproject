import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const boardId = req.nextUrl.searchParams.get("boardId");
    if (!boardId) return errorResponse("boardId is required", 400);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { slackToken: true },
    });

    if (!board?.slackToken) {
      return errorResponse("This board is not connected to Slack", 400);
    }

    // Fetch public channels
    const publicRes = await fetch("https://slack.com/api/conversations.list?types=public_channel&limit=200&exclude_archived=true", {
      headers: { Authorization: `Bearer ${board.slackToken}` },
    });
    const publicData = await publicRes.json();

    // Fetch private channels
    const privateRes = await fetch("https://slack.com/api/conversations.list?types=private_channel&limit=200&exclude_archived=true", {
      headers: { Authorization: `Bearer ${board.slackToken}` },
    });
    const privateData = await privateRes.json();

    const channels = [
      ...(publicData.ok ? publicData.channels : []),
      ...(privateData.ok ? privateData.channels : []),
    ].map((ch: { id: string; name: string; is_private: boolean }) => ({
      id: ch.id,
      name: ch.name,
      isPrivate: ch.is_private,
    }));

    return jsonResponse(channels);
  } catch {
    return errorResponse("Failed to fetch Slack channels", 500);
  }
}

// Save channel selection
export async function POST(req: NextRequest) {
  try {
    const { boardId, channelId, channelName } = await req.json();

    if (!boardId || !channelId) {
      return errorResponse("boardId and channelId are required", 400);
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { slackToken: true },
    });

    if (!board?.slackToken) {
      return errorResponse("This board is not connected to Slack", 400);
    }

    // Add bot to channel (if needed)
    await fetch("https://slack.com/api/conversations.join", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${board.slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: channelId }),
    });

    // Save channel to board
    await prisma.board.update({
      where: { id: boardId },
      data: {
        slackChannelId: channelId,
        slackChannelName: channelName || null,
      },
    });

    return jsonResponse({ message: "Channel selected", channelId, channelName });
  } catch {
    return errorResponse("Failed to select channel", 500);
  }
}
