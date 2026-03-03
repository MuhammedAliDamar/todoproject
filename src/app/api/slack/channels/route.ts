import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const boardId = req.nextUrl.searchParams.get("boardId");
    if (!boardId) return errorResponse("boardId gerekli", 400);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { slackToken: true },
    });

    if (!board?.slackToken) {
      return errorResponse("Bu board Slack'e bağlı değil", 400);
    }

    // Public kanalları çek
    const publicRes = await fetch("https://slack.com/api/conversations.list?types=public_channel&limit=200&exclude_archived=true", {
      headers: { Authorization: `Bearer ${board.slackToken}` },
    });
    const publicData = await publicRes.json();

    // Private kanalları çek
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
    return errorResponse("Slack kanalları alınamadı", 500);
  }
}

// Kanal seçimi kaydetme
export async function POST(req: NextRequest) {
  try {
    const { boardId, channelId, channelName } = await req.json();

    if (!boardId || !channelId) {
      return errorResponse("boardId ve channelId gerekli", 400);
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { slackToken: true },
    });

    if (!board?.slackToken) {
      return errorResponse("Bu board Slack'e bağlı değil", 400);
    }

    // Bot'u kanala ekle (gerekiyorsa)
    await fetch("https://slack.com/api/conversations.join", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${board.slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: channelId }),
    });

    // Board'a kanalı kaydet
    await prisma.board.update({
      where: { id: boardId },
      data: {
        slackChannelId: channelId,
        slackChannelName: channelName || null,
      },
    });

    return jsonResponse({ message: "Kanal seçildi", channelId, channelName });
  } catch {
    return errorResponse("Kanal seçilemedi", 500);
  }
}
