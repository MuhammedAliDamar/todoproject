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
