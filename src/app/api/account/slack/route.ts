import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { slackToken: true, slackTeamName: true },
    });

    return jsonResponse({
      connected: !!user?.slackToken,
      teamName: user?.slackTeamName || null,
    });
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    await prisma.user.update({
      where: { id: userId },
      data: {
        slackToken: null,
        slackTeamId: null,
        slackTeamName: null,
      },
    });

    return jsonResponse({ message: "Slack disconnected" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
