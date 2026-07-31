import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Slack configuration is missing" }, { status: 500 });
  }

  const boardId = req.nextUrl.searchParams.get("boardId");

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/callback`;
  const scopes = "chat:write,channels:read,groups:read,users:read,users:read.email";
  // state: "account" for account-level, or boardId for channel setup
  const state = boardId || "account";

  const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return NextResponse.redirect(slackUrl);
}
