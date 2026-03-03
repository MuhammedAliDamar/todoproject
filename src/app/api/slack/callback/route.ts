import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const boardId = req.nextUrl.searchParams.get("state"); // boardId state'ten geliyor

  if (!code || !boardId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/boards?slack=error`);
  }

  try {
    // Slack'ten access token al
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
      console.error("Slack OAuth hatası:", tokenData.error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/board/${boardId}?slack=error`);
    }

    // Bot token'ı ve workspace bilgisini kaydet
    await prisma.board.update({
      where: { id: boardId },
      data: {
        slackToken: tokenData.access_token,
        slackTeamName: tokenData.team?.name || null,
      },
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/board/${boardId}?slack=connected`);
  } catch (err) {
    console.error("Slack callback hatası:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/board/${boardId}?slack=error`);
  }
}
