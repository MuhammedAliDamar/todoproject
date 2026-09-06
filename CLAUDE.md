# marktasks

Next.js 16 + Prisma (postgres) Trello klonu. Port 4444. Slack entegrasyonu iki yönlü.
Ayrıca **Crisp-benzeri canlı destek (chat)** modülü içerir (aşağıda).

## Veritabanı
- Aktif: **uzak production DB** `72.61.182.238:5432/marktasks` (kullanıcı `marktasks`). Bağlantı `.env` → `DATABASE_URL`.
- Yerel geliştirme DB `localhost/todoproject` `.env` içinde yorum satırı olarak korunur (silinmedi).
- **Şema uygulama kuralı:** ASLA `prisma db push`/`migrate` ile uzak DB'ye gitme (yıkıcı olabilir). Chat tabloları uzak DB'ye, `prisma migrate diff --from-schema <eski> --to-schema <yeni> --script` ile üretilen **katkı-only SQL** (yalnız CREATE TABLE/INDEX + ADD CONSTRAINT) `psql --single-transaction` ile uygulandı. Uzak DB'de base marktasks tabloları (User/Board/Card…) zaten mevcuttu; sadece Website/Visitor/Conversation/ChatMessage + 2 enum eklendi. Mevcut kayıtlara dokunulmadı.

## Canlı Destek (Crisp klonu)

Embed script'li widget + operatör inbox'ı + ziyaretçi takibi. Realtime = SSE + in-memory event bus (pm2 tek instance fork mode olduğundan süreç-içi yeterli).

### Modeller (`prisma/schema.prisma`)
- `Website` — bir site = bir chat kutusu. `publicKey` embed'de kullanılır. Widget ayarları: `color`, `welcomeMessage`, `operatorName`, `position` (right/left), `active`.
- `Visitor` — `token` (kalıcı, localStorage `mt_token_<key>`), `online`/`lastSeenAt`, `timezone`+`language` (tarayıcıdan: `Intl...timeZone`, `navigator.language`), `country`/`city`, `currentUrl`, `referrer`, `ip`, `userAgent`.
  - **Konum saat diliminden türetilir** (`tzToLocation` in `src/lib/chat.ts`): IANA tz → şehir (son segment) + ülke (tablo/bölge). ip-api.com sadece tz yoksa yedek. Panel sağ tarafında tz + canlı yerel saat (`useLocalTime`) + dil gösterilir; sol listede şehir/ülke.
- `Conversation` — `status` (OPEN/RESOLVED), `assignedUserId`, `operatorUnread`/`visitorUnread`, `lastMessageAt`.
- `ChatMessage` — `sender` (VISITOR/OPERATOR), `userId` (operatör), `body`, `attachmentUrl`+`attachmentType` (resim eki, nullable), `readAt` (görüldü).
- Silme yok: `Website` soft-delete (`deletedAt`).

### Realtime (`src/lib/chatBus.ts`)
In-memory EventEmitter (`globalThis` singleton). 3 topic:
- `website:<id>` → operatör paneli dinler (yeni konuşma, ziyaretçi mesajı, ziyaretçi online/yazıyor, okundu).
- `visitor:<id>` → widget dinler (operatör mesajı, operatör yazıyor, okundu).
- `sseStream(topics, signal)` → `text/event-stream` Response; 25sn heartbeat, abort'ta cleanup.
Yardımcılar `src/lib/chat.ts`: `getClientIp`, `enrichVisitorGeo` (fire-and-forget), `isOnline` (45sn eşik), `publicWebsiteConfig`.

### Widget (herkese açık, auth yok)
- `public/widget.js` — embed loader. Tek `<iframe>` enjekte eder (`ORIGIN/widget?key=<publicKey>`), kapalı 92×92 baloncuk / açık 400×660 panel. postMessage ile boyut/konum. JS API: `$marktasks.open()/.close()`. Site id: `window.$marktasks.websiteId` veya `data-website`.
- `src/app/widget/page.tsx` — iframe içi chat UI (inline stil, tam izole). Session → SSE → heartbeat(30sn) → typing/seen. Body şeffaf yapılır.
- API (`src/app/api/widget/*`): `session` (ziyaretçi tanı/oluştur + geçmiş), `message` (mesaj gönder, açık konuşma yoksa aç), `stream` (SSE, `?key&token`), `ping` (heartbeat + `typing`/`read` flag).

### Operatör paneli (auth: middleware `x-user-id`)
- `src/app/(dashboard)/chat/page.tsx` — 3-pane inbox (konuşma listesi / mesaj akışı / ziyaretçi detayı). SSE `/api/chat/stream`, optimistic gönderim, typing, görüldü, çöz/yeniden aç.
- `src/app/(dashboard)/websites/page.tsx` — site CRUD + embed kodu (kopyala) + ayar modalı + anahtar yenileme + arşivle.
- API (`src/app/api/chat/*`): `websites` (GET sahip+üye, POST), `websites/[id]` (GET/PATCH/DELETE, PATCH `regenerate:true` → yeni publicKey), `websites/[id]/members` (GET/POST e-posta ile ata/DELETE soft-kaldır — sadece sahip), `conversations` (GET, `?status` + `?websiteId` filtre), `conversations/[id]` (GET/PATCH: status/assign/read), `conversations/[id]/messages` (POST operatör yanıtı), `conversations/[id]/typing` (POST), `stream` (SSE, erişilebilir site topic'leri).
- **Site kullanıcı tanımlama:** `WebsiteMember` (soft-delete). Erişim kontrolü `src/lib/chat.ts` → `getAccessibleWebsiteIds`/`canAccessWebsite`/`isWebsiteOwner` (sahip VEYA atanmış üye). Üye atama /chat içindeki Siteler modalından (`MembersManager`, e-posta ile).
- **Siteye göre kategorize:** inbox'ta site dropdown filtresi; konuşma listesinde renkli site rozeti + isim.
- Sidebar'a "Canlı Destek" (`/chat`) ve "Web Siteleri" (`/websites`) linkleri; `/chat`'te sidebar varsayılan **kapalı** (geniş 3-pane).

### Resim eki (güvenli)
Hem ziyaretçi hem operatör mesaja **sadece resim** ekleyebilir. `src/lib/upload.ts`:
- `sniffImage(buf)` türü **magic-byte**'tan belirler (PNG/JPEG/GIF/WebP). İstemcinin bildirdiği MIME/uzantı **hiç** kullanılmaz → spoof edilemez. **SVG kabul edilmez** (script gömülü XSS riski).
- `saveImageUpload(file)` boyut (≤5MB, hem `file.size` hem gerçek buffer uzunluğu), tür doğrular; dosyayı `public/uploads/chat/<uuid>.<ext>` altına **rastgele adla** yazar (istemci adı kullanılmaz → path traversal yok).
- Endpoint'ler: `POST /api/widget/upload` (public, ziyaretçi; rate-limit token 10/dk + IP 20/dk, mesaj route'unun konuşma mantığını taşır) ve `POST /api/chat/conversations/[id]/upload` (auth, operatör). İkisi de `ChatMessage`'a `attachmentUrl`+`attachmentType="image"` yazıp SSE ile yayınlar.
- UI: widget & panel input barında ataç butonu (`accept="image/*"` raster), optimistic önizleme (objectURL), balonda tıklanabilir `<img>`; liste önizlemesinde "📷 Photo".
- `.gitignore`: `public/uploads/*` (kullanıcı yüklemeleri commit edilmez, `.gitkeep` korunur).

### Güvenlik (public endpoint sertleştirme)
`src/lib/rateLimit.ts` — süreç-içi sabit-pencere rate limiter (tek instance fork için yeterli) + `cap()` girdi kırpma. Uygulanan limitler: `session` 40/dk (IP), `message` 20/dk (token)+40/dk (IP), `ping` 120/dk (token); aşınca 429. Mesaj gövdesi `MAX_MESSAGE_LEN=4000`. Session/ping alanları (currentUrl 2048, referrer 2048, timezone 64, language 32, userAgent 512) kırpılır. XSS yok (React text render), SQLi yok (Prisma), auth cookie httpOnly+sameSite=lax+secure. Not: domain/origin allowlist yok — widget iframe kendi origin'imizden çalıştığı için Origin kontrolü uygulanabilir değil; kötüye kullanım rate-limit ile sınırlanır.

### Middleware
`/api/widget` ve `/widget` public path'lerde. Widget iframe cross-origin gömülebilsin diye public branch `X-Frame-Options` set etmez.

### Kurulum (müşteri sitesi)
Panelden site ekle → embed kodunu kopyala → hedef sitenin `<head>`/`</body>` öncesine yapıştır:
```html
<script>window.$marktasks={websiteId:"PUBLIC_KEY"};</script>
<script async src="https://DOMAIN/widget.js"></script>
```

## Slack

### App → Slack (bildirim)
`src/lib/slack.ts` — kart oluşturma/taşıma/yorum/atama vb. olaylarında board'un `slackChannelId` kanalına veya kullanıcıya DM atar. Token board veya user üzerinde tutulur.

### Slack → App (slash command + modal ile task açma)
Trello'nun "Create card" modalı gibi: board + liste seçilir, başlık girilir.

- `POST /api/slack/command` (`src/app/api/slack/command/route.ts`) — slash command. İmza doğrular, Slack user'ı email ile app user'a eşler (`resolveAppUserId`), kullanıcının board'larıyla modal'ı `views.open` ile açar. `/task <metin>` yazılırsa metin başlık olarak ön-dolar.
- `POST /api/slack/interactions` (`src/app/api/slack/interactions/route.ts`) — interactivity.
  - `block_actions` (board seçimi) → o board'un listeleriyle `views.update`.
  - `view_submission` → kart oluşturur (seçilen listenin sonuna), activity yazar, `notifyCardCreated` + kullanıcıya ephemeral onay.
- Modal alanları: başlık, açıklama (opsiyonel, multiline), board, liste, atananlar (board üyeleri — owner + aktif member'lar, çoklu, opsiyonel). Liste/üyeler board seçilince yüklenir. Atananlar `CardAssignee` ile bağlanır (sadece o board'a ait olanlar) ve her birine `notifyTaskAssignedDM` ile DM gider.
- Modal builder: `src/lib/slackModal.ts` (`buildTaskModal`, open+update'te paylaşılır).
- Paylaşılan helper'lar `src/lib/slack.ts`: `verifySlackSignature`, `getWorkspaceToken`, `resolveAppUserId`.
- Her iki endpoint middleware'de public.

### Kurulum (Slack app tarafında)
1. Basic Information > Signing Secret → `.env` içindeki `SLACK_SIGNING_SECRET`.
2. Slash Commands > Create: `/task`, Request URL = `${NEXT_PUBLIC_APP_URL}/api/slack/command`.
3. **Interactivity & Shortcuts** > aç, Request URL = `${NEXT_PUBLIC_APP_URL}/api/slack/interactions`.
4. Slack user email'i, marktasks kullanıcısının email'i ile aynı olmalı (eşleme email üzerinden).

Not: `NEXT_PUBLIC_APP_URL` internetten erişilebilir olmalı (Slack local IP'ye ulaşamaz → ngrok/tünel/public domain).
