const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: { type: string; text: string }[];
}

export async function sendSlackNotification(message: SlackMessage): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) return false;

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    return res.ok;
  } catch {
    console.error("Slack bildirim gönderilemedi");
    return false;
  }
}

// Kart oluşturulduğunda
export function notifyCardCreated(userName: string, cardTitle: string, listTitle: string, boardTitle: string) {
  return sendSlackNotification({
    text: `${userName} yeni bir kart oluşturdu: "${cardTitle}"`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🆕 Yeni Kart Oluşturuldu", emoji: true },
      },
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
export function notifyCommentAdded(userName: string, comment: string, cardTitle: string, boardTitle: string) {
  const shortComment = comment.length > 200 ? comment.substring(0, 200) + "..." : comment;
  return sendSlackNotification({
    text: `${userName} yorum ekledi: "${shortComment}"`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "💬 Yeni Yorum", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Kart:*\n${cardTitle}` },
          { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${userName}:*\n>${shortComment}` },
      },
    ],
  });
}

// Kart taşındığında
export function notifyCardMoved(userName: string, cardTitle: string, fromList: string, toList: string) {
  return sendSlackNotification({
    text: `${userName} "${cardTitle}" kartını taşıdı: ${fromList} → ${toList}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📦 Kart Taşındı", emoji: true },
      },
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
export function notifyMemberAdded(addedBy: string, memberName: string, boardTitle: string, role: string) {
  return sendSlackNotification({
    text: `${addedBy}, ${memberName} kullanıcısını "${boardTitle}" board'una ekledi`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "👤 Yeni Üye Eklendi", emoji: true },
      },
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
export function notifyCardDeleted(userName: string, cardTitle: string, boardTitle: string) {
  return sendSlackNotification({
    text: `${userName} "${cardTitle}" kartını sildi`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🗑️ Kart Silindi", emoji: true },
      },
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

// Son tarih yaklaşıyorsa
export function notifyDueDateSet(userName: string, cardTitle: string, dueDate: string) {
  return sendSlackNotification({
    text: `${userName} "${cardTitle}" kartına son tarih ekledi: ${dueDate}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📅 Son Tarih Belirlendi", emoji: true },
      },
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
