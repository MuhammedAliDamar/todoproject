import { EventEmitter } from "events";

/**
 * Canlı chat için in-memory event yolu (pub/sub).
 * pm2 tek instance (fork) çalıştığından süreç-içi EventEmitter yeterli.
 *
 * İki tür "topic" var:
 *  - `website:<websiteId>`  → operatör panelinin dinlediği olaylar
 *      (yeni konuşma, yeni ziyaretçi mesajı, ziyaretçi online/offline, ziyaretçi yazıyor)
 *  - `conv:<conversationId>` → widget'ın dinlediği olaylar
 *      (yeni operatör mesajı, operatör yazıyor, mesaj okundu)
 */

export type ChatEvent =
  | { type: "message"; conversationId: string; message: unknown }
  | { type: "conversation"; conversation: unknown }
  | { type: "visitor"; visitor: unknown }
  | { type: "typing"; conversationId: string; from: "visitor" | "operator"; name?: string }
  | { type: "read"; conversationId: string; by: "visitor" | "operator" };

const globalForBus = globalThis as unknown as { chatBus: EventEmitter | undefined };

export const chatBus =
  globalForBus.chatBus ??
  (() => {
    const e = new EventEmitter();
    e.setMaxListeners(0); // sınırsız SSE aboneliği
    return e;
  })();

if (process.env.NODE_ENV !== "production") globalForBus.chatBus = chatBus;

export function websiteTopic(websiteId: string) {
  return `website:${websiteId}`;
}
export function convTopic(conversationId: string) {
  return `conv:${conversationId}`;
}
export function visitorTopic(visitorId: string) {
  return `visitor:${visitorId}`;
}

export function publish(topic: string, event: ChatEvent) {
  chatBus.emit(topic, event);
}

/** Birden çok topic'e aynı anda yayınlar (ör. hem website hem conversation). */
export function publishAll(topics: string[], event: ChatEvent) {
  for (const t of topics) chatBus.emit(t, event);
}

/**
 * Verilen topic'lere abone olup SSE ReadableStream döndürür.
 * İstemci bağlantıyı kapatınca (abort) dinleyiciler temizlenir.
 */
export function sseStream(topics: string[], signal: AbortSignal): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          /* controller kapanmış olabilir */
        }
      };

      // İlk yorum satırı + retry bilgisi (bağlantıyı açık tutar)
      send(`retry: 3000\n\n`);

      const listener = (event: ChatEvent) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      };
      for (const t of topics) chatBus.on(t, listener);

      // 25 sn'de bir heartbeat (proxy timeout'larına karşı)
      const heartbeat = setInterval(() => send(`: ping\n\n`), 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        for (const t of topics) chatBus.off(t, listener);
        try {
          controller.close();
        } catch {
          /* zaten kapalı */
        }
      };

      signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
