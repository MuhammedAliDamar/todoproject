import { prisma } from "@/lib/prisma";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
}

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

/**
 * Sends a message using the board's Slack token and channel.
 */
async function sendToBoard(boardId: string, message: SlackMessage): Promise<boolean> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { slackToken: true, slackChannelId: true },
  });

  if (!board?.slackToken || !board?.slackChannelId) return false;

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${board.slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: board.slackChannelId,
        text: message.text,
        blocks: message.blocks,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Slack message error:", data.error);
    return data.ok;
  } catch {
    console.error("Failed to send Slack message");
    return false;
  }
}

/**
 * Resolves the board from a card ID and sends a message.
 */
async function sendViaCard(cardId: string, message: SlackMessage): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { list: { select: { boardId: true } } },
  });
  if (!card) return false;
  return sendToBoard(card.list.boardId, message);
}

/**
 * Gets a Slack token — tries board first, then falls back to any user with a connected Slack.
 */
async function getSlackToken(boardId?: string): Promise<string | null> {
  if (boardId) {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { slackToken: true, userId: true },
    });
    if (board?.slackToken) return board.slackToken;

    // Fall back to board owner's account token
    const owner = await prisma.user.findUnique({
      where: { id: board?.userId },
      select: { slackToken: true },
    });
    if (owner?.slackToken) return owner.slackToken;
  }

  // Fall back to any user with a Slack token
  const anyUser = await prisma.user.findFirst({
    where: { slackToken: { not: null } },
    select: { slackToken: true },
  });
  return anyUser?.slackToken || null;
}

/**
 * Sends a DM to a user by looking up their Slack ID via email.
 * Uses account-level Slack token (not board-specific).
 */
export async function sendDirectMessage(boardId: string, userEmail: string, message: SlackMessage): Promise<boolean> {
  const token = await getSlackToken(boardId);
  if (!token) return false;

  try {
    // Find Slack user by email
    const lookupRes = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(userEmail)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const lookupData = await lookupRes.json();
    if (!lookupData.ok || !lookupData.user?.id) return false;

    // Send DM directly using user ID as channel
    const msgRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: lookupData.user.id,
        text: message.text,
        blocks: message.blocks,
      }),
    });
    const msgData = await msgRes.json();
    if (!msgData.ok) console.error("Slack DM error:", msgData.error);
    return msgData.ok;
  } catch {
    console.error("Failed to send Slack DM");
    return false;
  }
}

// Task assigned — DM notification
export function notifyTaskAssignedDM(
  boardId: string,
  assigneeEmail: string,
  assignerName: string,
  cardTitle: string,
  boardTitle: string,
  appUrl: string,
  boardPageId: string
) {
  return sendDirectMessage(boardId, assigneeEmail, {
    text: `${assignerName} assigned you to "${cardTitle}"`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "📋 New Task Assigned", emoji: true } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${assignerName}* assigned you to a task:`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Task:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Project:*\n${boardTitle}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `<${appUrl}/board/${boardPageId}|View Task>` },
      },
    ],
  });
}

// Comment added — DM notification
export function notifyCommentDM(
  boardId: string,
  assigneeEmail: string,
  commenterName: string,
  comment: string,
  cardTitle: string,
) {
  const short = comment.length > 200 ? comment.substring(0, 200) + "..." : comment;
  return sendDirectMessage(boardId, assigneeEmail, {
    text: `${commenterName} commented on "${cardTitle}"`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "💬 New Comment on Your Task", emoji: true } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${commenterName}* commented on *${cardTitle}*:`,
        },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `>${short}` },
      },
    ],
  });
}

// Card created
export function notifyCardCreated(boardId: string, userName: string, cardTitle: string, listTitle: string, boardTitle: string) {
  return sendToBoard(boardId, {
    text: `${userName} created a new card: "${cardTitle}"`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🆕 New Card Created", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Card:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*List:*\n${listTitle}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
          { type: "mrkdwn", text: `*Created by:*\n${userName}` },
        ],
      },
    ],
  });
}

// Comment added
export function notifyCommentAdded(cardId: string, userName: string, comment: string, cardTitle: string, boardTitle: string) {
  const short = comment.length > 200 ? comment.substring(0, 200) + "..." : comment;
  return sendViaCard(cardId, {
    text: `${userName} added a comment: "${short}"`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "💬 New Comment", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Card:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: `*${userName}:*\n>${short}` } },
    ],
  });
}

// Card moved
export function notifyCardMoved(cardId: string, userName: string, cardTitle: string, fromList: string, toList: string) {
  return sendViaCard(cardId, {
    text: `${userName} moved card "${cardTitle}": ${fromList} → ${toList}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "📦 Card Moved", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Card:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Moved by:*\n${userName}` },
          { type: "mrkdwn", text: `*From List:*\n${fromList}` },
          { type: "mrkdwn", text: `*To List:*\n${toList}` },
        ],
      },
    ],
  });
}

// Member added
export function notifyMemberAdded(boardId: string, addedBy: string, memberName: string, boardTitle: string, role: string) {
  return sendToBoard(boardId, {
    text: `${addedBy} added ${memberName} to the "${boardTitle}" board`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "👤 New Member Added", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Member:*\n${memberName}` },
          { type: "mrkdwn", text: `*Role:*\n${role}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
          { type: "mrkdwn", text: `*Added by:*\n${addedBy}` },
        ],
      },
    ],
  });
}

// Card deleted
export function notifyCardDeleted(boardId: string, userName: string, cardTitle: string, boardTitle: string) {
  return sendToBoard(boardId, {
    text: `${userName} deleted card "${cardTitle}"`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🗑️ Card Deleted", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Card:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
          { type: "mrkdwn", text: `*Deleted by:*\n${userName}` },
        ],
      },
    ],
  });
}

// Due date set
export function notifyDueDateSet(cardId: string, userName: string, cardTitle: string, dueDate: string) {
  return sendViaCard(cardId, {
    text: `${userName} set a due date for card "${cardTitle}": ${dueDate}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "📅 Due Date Set", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Card:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Due Date:*\n${dueDate}` },
          { type: "mrkdwn", text: `*Set by:*\n${userName}` },
        ],
      },
    ],
  });
}
