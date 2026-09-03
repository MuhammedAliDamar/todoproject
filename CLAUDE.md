# marktasks

Next.js 16 + Prisma (postgres) Trello klonu. Port 4444. Slack entegrasyonu iki yönlü.

## Slack

### App → Slack (bildirim)
`src/lib/slack.ts` — kart oluşturma/taşıma/yorum/atama vb. olaylarında board'un `slackChannelId` kanalına veya kullanıcıya DM atar. Token board veya user üzerinde tutulur.

### Slack → App (slash command + modal ile task açma)
Trello'nun "Create card" modalı gibi: board + liste seçilir, başlık girilir.

- `POST /api/slack/command` (`src/app/api/slack/command/route.ts`) — slash command. İmza doğrular, Slack user'ı email ile app user'a eşler (`resolveAppUserId`), kullanıcının board'larıyla modal'ı `views.open` ile açar. `/task <metin>` yazılırsa metin başlık olarak ön-dolar.
- `POST /api/slack/interactions` (`src/app/api/slack/interactions/route.ts`) — interactivity.
  - `block_actions` (board seçimi) → o board'un listeleriyle `views.update`.
  - `view_submission` → kart oluşturur (seçilen listenin sonuna), activity yazar, `notifyCardCreated` + kullanıcıya ephemeral onay.
- Modal alanları: başlık, açıklama (opsiyonel, multiline), board, liste, etiketler, atananlar (board üyeleri — owner + aktif member'lar, çoklu, opsiyonel). Liste/etiket/üyeler board seçilince yüklenir. Etiketler `CardLabel`, atananlar `CardAssignee` ile bağlanır (sadece o board'a ait olanlar). Atananlara `notifyTaskAssignedDM` ile DM gider.
- Modal builder: `src/lib/slackModal.ts` (`buildTaskModal`, open+update'te paylaşılır).
- Paylaşılan helper'lar `src/lib/slack.ts`: `verifySlackSignature`, `getWorkspaceToken`, `resolveAppUserId`.
- Her iki endpoint middleware'de public.

### Kurulum (Slack app tarafında)
1. Basic Information > Signing Secret → `.env` içindeki `SLACK_SIGNING_SECRET`.
2. Slash Commands > Create: `/task`, Request URL = `${NEXT_PUBLIC_APP_URL}/api/slack/command`.
3. **Interactivity & Shortcuts** > aç, Request URL = `${NEXT_PUBLIC_APP_URL}/api/slack/interactions`.
4. Slack user email'i, marktasks kullanıcısının email'i ile aynı olmalı (eşleme email üzerinden).

Not: `NEXT_PUBLIC_APP_URL` internetten erişilebilir olmalı (Slack local IP'ye ulaşamaz → ngrok/tünel/public domain).
