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
 * Board'un Slack token ve channel bilgisini kullanarak mesaj gönderir.
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
    if (!data.ok) console.error("Slack mesaj hatası:", data.error);
    return data.ok;
  } catch {
    console.error("Slack mesaj gönderilemedi");
    return false;
  }
}

/**
 * Card ID'den board'u bulup mesaj gönderir.
 */
async function sendViaCard(cardId: string, message: SlackMessage): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { list: { select: { boardId: true } } },
  });
  if (!card) return false;
  return sendToBoard(card.list.boardId, message);
}

// Kart oluşturulduğunda
export function notifyCardCreated(boardId: string, userName: string, cardTitle: string, listTitle: string, boardTitle: string) {
  return sendToBoard(boardId, {
    text: `${userName} yeni bir kart oluşturdu: "${cardTitle}"`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🆕 Yeni Kart Oluşturuldu", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Kart:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Liste:*\n${listTitle}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
          { type: "mrkdwn", text: `*Oluşturan:*\n${userName}` },
        ],
      },
    ],
  });
}

// Yorum eklendiğinde
export function notifyCommentAdded(cardId: string, userName: string, comment: string, cardTitle: string, boardTitle: string) {
  const short = comment.length > 200 ? comment.substring(0, 200) + "..." : comment;
  return sendViaCard(cardId, {
    text: `${userName} yorum ekledi: "${short}"`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "💬 Yeni Yorum", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Kart:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: `*${userName}:*\n>${short}` } },
    ],
  });
}

// Kart taşındığında
export function notifyCardMoved(cardId: string, userName: string, cardTitle: string, fromList: string, toList: string) {
  return sendViaCard(cardId, {
    text: `${userName} "${cardTitle}" kartını taşıdı: ${fromList} → ${toList}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "📦 Kart Taşındı", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Kart:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Taşıyan:*\n${userName}` },
          { type: "mrkdwn", text: `*Eski Liste:*\n${fromList}` },
          { type: "mrkdwn", text: `*Yeni Liste:*\n${toList}` },
        ],
      },
    ],
  });
}

// Üye eklendiğinde
export function notifyMemberAdded(boardId: string, addedBy: string, memberName: string, boardTitle: string, role: string) {
  return sendToBoard(boardId, {
    text: `${addedBy}, ${memberName} kullanıcısını "${boardTitle}" board'una ekledi`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "👤 Yeni Üye Eklendi", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Üye:*\n${memberName}` },
          { type: "mrkdwn", text: `*Rol:*\n${role}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
          { type: "mrkdwn", text: `*Ekleyen:*\n${addedBy}` },
        ],
      },
    ],
  });
}

// Kart silindiğinde
export function notifyCardDeleted(boardId: string, userName: string, cardTitle: string, boardTitle: string) {
  return sendToBoard(boardId, {
    text: `${userName} "${cardTitle}" kartını sildi`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🗑️ Kart Silindi", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Kart:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
          { type: "mrkdwn", text: `*Silen:*\n${userName}` },
        ],
      },
    ],
  });
}

// Son tarih belirlendiğinde
export function notifyDueDateSet(cardId: string, userName: string, cardTitle: string, dueDate: string) {
  return sendViaCard(cardId, {
    text: `${userName} "${cardTitle}" kartına son tarih ekledi: ${dueDate}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "📅 Son Tarih Belirlendi", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Kart:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Son Tarih:*\n${dueDate}` },
          { type: "mrkdwn", text: `*Belirleyen:*\n${userName}` },
        ],
      },
    ],
  });
}
