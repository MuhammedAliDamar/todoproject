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
- `Conversation` — `status` (OPEN/RESOLVED), `assignedUserId`, `labels` (String[], operatörün serbest etiketleri), `operatorUnread`/`visitorUnread`, `lastMessageAt`.
- `ChatMessage` — `sender` (VISITOR/OPERATOR), `userId` (operatör), `body`, `attachmentUrl`+`attachmentType` (resim eki, nullable), `readAt` (görüldü).
- `PageView` — ziyaretçinin gezdiği sayfalar (`visitorId`, `url`, `createdAt` tam zaman damgası). Widget `session`/`ping`'te URL değişince kaydedilir (son kayıttan farklıysa). Detayda "Pages" sekmesinde tam tarih-saat + göreli zaman ile gösterilir.
  - **Üst sayfa URL'i:** widget iframe içinde `location` host sayfayı vermez. `widget.js` (parent context) gerçek `location.href`'i `postMessage({type:"marktasks:url"})` ile iframe'e bildirir; `pushState`/`replaceState`/`popstate`/`hashchange` sarılarak **SPA gezinmeleri** de yakalanır. Widget URL değişince anında `ping` atıp PageView kaydeder. (Not: `widget.js` değişince gömülü sitelerin cache'i nedeniyle yeniden deploy + cache-bust gerekebilir.)
- Silme yok: `Website` soft-delete (`deletedAt`).

### Operatör verimlilik özellikleri
- **Ziyaretçiyi yeniden adlandır:** `Visitor.name` düzenlenebilir (detay panelinde "edit"). PATCH `/api/chat/conversations/[id]` body `visitorName`. Kişi konuşmalar arası paylaşılır (sağdaki isim değişince sol liste de güncellenir).
- **Ziyaretçi notu:** `Visitor.note` (String?, ≤4000). Detay panelinde "Notes" textarea (blur veya Save ile kaydeder). PATCH body `visitorNote`. Kişi hakkında özel notlar, konuşmalar arası kalıcı (müşteriyi tanımak için).
- **Konuşma içi arama:** `GET /api/chat/search?q=&websiteId=` → hem mesaj gövdesinde hem ziyaretçi adı/e-posta/notunda `contains` (insensitive) arar (ör. "ali" → hem o kişinin konuşması hem mesaj içeriği). Kişi eşleşmeleri önce; sonuçta `match: "visitor"|"message"`, konuşma başına tek satır + snippet. İnbox üstünde arama kutusu (300ms debounce, ≥2 karakter); sonuçlar konuşma listesinin yerini alır, "matches person" rozeti kişi eşleşmesini gösterir, tıklayınca konuşma açılır.
- **Konuşma etiketleri:** `Conversation.labels` (serbest metin çipleri, ≤12, ≤32 karakter, tekilleştirilir). PATCH body `labels`. Listede + detayda renkli çip (`labelStyle` hash→hue).
- **Çevrimiçi ziyaretçiler:** `GET /api/chat/visitors/online?websiteId=` → şu an sitede aktif (lastSeenAt < 45sn) ziyaretçiler, konuşma başlatmamış olsalar da. İnbox'ta "Online" toggle (15sn poll). Bir ziyaretçiye tıkla → `POST /api/chat/visitors/[id]/start` açık konuşmayı bulur/oluşturur → operatör ilk mesajı atabilir (widget SSE `visitorTopic`'ten alır).
- **Site başına bekleyen mesaj:** `/api/chat/websites` GET her siteye `waiting` (OPEN konuşmalarda toplam `operatorUnread`) döndürür; site dropdown'da `Site (N)`, "All sites (toplam)".
- **Canlı durum dairesi:** sohbet başlığında aktifse yeşil `animate-ping` daire "live on site", değilse gri "offline". Liste avatar noktası da online'da pulse eder.
- **Canlı presence (yenilemeden online/offline):** panel `presence` map'i (ziyaretçi→son görülme ms) tutar; 10sn tick ile yeniden hesaplanır → ping kesilince 45sn'de offline'a düşer (sayfa yenilemeden). SSE `visitor` event'i `online:true/false` ile presence'ı günceller ve açık konuşmanın başlığını anında değiştirir. Widget sekme kapanınca/gizlenince `navigator.sendBeacon` ile `ping {offline:true}` yollar (route `online=false` set edip `visitor online:false` publish eder); geri gelince tekrar ping atar. Liste/başlık/Status `onlineOf(id, lastSeenAt, fallback)` ile render edilir.
- **Detay paneli:** başlıkta "Details" butonu (küçük ekranda overlay); iki sekme — Info (isim/not/etiket/konum/tz/dil/tarayıcı) ve Pages (sayfa geçmişi).

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
- **Chat responsive:** `100dvh` + flex `min-h-0`/`shrink-0` → mesaj gövdesi scroll, yanıt kutusu altta sabit. Mobilde tek panel: liste tam genişlik, konuşma açılınca mesaj paneline geçer (geri oku), detay overlay. `md+` üç panel yan yana.
- **Mobil gezinme:** Sidebar `md` altında gizli; Navbar'da hamburger (`md:hidden`) → off-canvas drawer. Ortak durum `src/context/MobileNavContext.tsx` (`MobileNavProvider` dashboard layout'unda; `useMobileNav`). Nav linkleri `Sidebar.tsx` içinde `NAV` dizisinde tekilleştirildi (masaüstü collapsed/expanded + drawer paylaşır). Drawer rota değişince/backdrop/X ile kapanır.

### Resim eki (güvenli)
Hem ziyaretçi hem operatör mesaja **sadece resim** ekleyebilir. `src/lib/upload.ts`:
- `sniffImage(buf)` türü **magic-byte**'tan belirler (PNG/JPEG/GIF/WebP). İstemcinin bildirdiği MIME/uzantı **hiç** kullanılmaz → spoof edilemez. **SVG kabul edilmez** (script gömülü XSS riski).
- `saveImageUpload(file)` boyut (≤5MB, hem `file.size` hem gerçek buffer uzunluğu), tür doğrular; dosyayı `public/uploads/chat/<uuid>.<ext>` altına **rastgele adla** yazar (istemci adı kullanılmaz → path traversal yok). Dönen URL `/api/media/chat/<ad>`'dir.
- **Sunum API route'undan:** `GET /api/media/chat/[name]` (public, middleware'de). Next production'da `public/`'e **runtime yazılan** dosyaları güvenilir sunmadığı için resim node app'ten stream edilir. Ad kalıbı `^[a-f0-9-]{8,}\.(png|jpg|gif|webp)$` ile sınırlı (traversal/rastgele dosya okuma yok).
- **24 saat ömür:** yüklenen dosyalar 24 saat sonra düşer. `UPLOAD_TTL_MS`. Serve anında `mtime` kontrolü (süresi dolmuşsa 410 + `unlink`) + her yüklemede saatte-bir `sweepExpiredUploads()` ile eski dosyalar silinir. **DB mesaj kaydı silinmez**, sadece dosya kalkar; `Cache-Control: max-age=86400`.
- Endpoint'ler: `POST /api/widget/upload` (public, ziyaretçi; rate-limit token 10/dk + IP 20/dk, mesaj route'unun konuşma mantığını taşır) ve `POST /api/chat/conversations/[id]/upload` (auth, operatör). İkisi de `ChatMessage`'a `attachmentUrl`+`attachmentType="image"` yazıp SSE ile yayınlar.
- UI: widget & panel input barında ataç butonu (`accept="image/*"` raster), optimistic önizleme (objectURL), balonda tıklanabilir `<img>`; liste önizlemesinde "📷 Photo".
- `.gitignore`: `public/uploads/*` (kullanıcı yüklemeleri commit edilmez, `.gitkeep` korunur).

### Güvenlik (public endpoint sertleştirme)
`src/lib/rateLimit.ts` — süreç-içi sabit-pencere rate limiter (tek instance fork için yeterli) + `cap()` girdi kırpma. Uygulanan limitler: `session` 40/dk (IP), `message` 20/dk (token)+40/dk (IP), `ping` 120/dk (token); aşınca 429. Mesaj gövdesi `MAX_MESSAGE_LEN=4000`. Session/ping alanları (currentUrl 2048, referrer 2048, timezone 64, language 32, userAgent 512) kırpılır. XSS yok (React text render), SQLi yok (Prisma), auth cookie httpOnly+sameSite=lax+secure. Not: domain/origin allowlist yok — widget iframe kendi origin'imizden çalıştığı için Origin kontrolü uygulanabilir değil; kötüye kullanım rate-limit ile sınırlanır.

### Kart ekleri (yüklenen dosyalar)
Kart ekleri `POST /api/upload` ile `public/uploads/<uuid><ext>`'e yazılır, `Attachment.url = /uploads/<ad>` olarak saklanır (PDF/doküman/resim; chat ekinden ayrı, magic-byte yok). **Sunum:** Next production'da `public/`'e runtime yazılan dosyaları statik sunmadığı için `/uploads/<ad>` istekleri middleware'de `GET /api/media/file/[name]` route'una **rewrite** edilir → dosya node app'ten stream edilir. Böylece **eski DB kayıtları da** (`/uploads/...`) çalışır; `/api/upload` ve görüntüleme kodu değişmedi. Ad kalıbı `^[a-f0-9-]{8,}\.<ext>$` + izinli uzantı whitelist ile sınırlı (traversal yok), `X-Content-Type-Options: nosniff` + `CSP: sandbox`. Kart ekleri **kalıcıdır** (chat resimlerindeki 24 saat ömür YOK).

### Middleware
`/api/widget` ve `/widget` public path'lerde. `/uploads/<ad>` → `/api/media/file/<ad>` rewrite (kart ekleri). Widget iframe cross-origin gömülebilsin diye public branch `X-Frame-Options` set etmez.

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
