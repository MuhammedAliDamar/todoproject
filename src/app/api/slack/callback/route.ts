import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!code) {
    return NextResponse.redirect(`${appUrl}/boards?slack=error`);
  }

  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${appUrl}/api/slack/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
      console.error("Slack OAuth error:", tokenData.error);
      const redirect = state && state !== "account" ? `/board/${state}?slack=error` : "/account?slack=error";
      return NextResponse.redirect(`${appUrl}${redirect}`);
    }

    const botToken = tokenData.access_token;
    const teamName = tokenData.team?.name || null;
    const teamId = tokenData.team?.id || null;

    // Get userId from auth cookie
    const token = req.cookies.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const userId = payload?.userId as string | undefined;

    if (userId) {
      // Save to user account
      await prisma.user.update({
        where: { id: userId },
        data: {
          slackToken: botToken,
          slackTeamId: teamId,
          slackTeamName: teamName,
        },
      });
    }

    // If state is a boardId, also save token to board for channel notifications
    if (state && state !== "account") {
      await prisma.board.update({
        where: { id: state },
        data: {
          slackToken: botToken,
          slackTeamName: teamName,
        },
      });
      return NextResponse.redirect(`${appUrl}/board/${state}?slack=connected`);
    }

    return NextResponse.redirect(`${appUrl}/account?slack=connected`);
  } catch (err) {
    console.error("Slack callback error:", err);
    return NextResponse.redirect(`${appUrl}/boards?slack=error`);
  }
}
