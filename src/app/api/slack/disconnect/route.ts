import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { boardId } = await req.json();

    if (!boardId) return errorResponse("boardId gerekli", 400);

    await prisma.board.update({
      where: { id: boardId },
      data: {
        slackToken: null,
        slackChannelId: null,
        slackChannelName: null,
        slackTeamName: null,
      },
    });

    return jsonResponse({ message: "Slack bağlantısı kaldırıldı" });
  } catch {
    return errorResponse("İşlem başarısız", 500);
  }
}
