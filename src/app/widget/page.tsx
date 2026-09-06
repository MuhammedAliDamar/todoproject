"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Sender = "VISITOR" | "OPERATOR";
interface Msg {
  id: string;
  sender: Sender;
  body: string;
  createdAt: string;
  readAt?: string | null;
  operator?: { name: string; avatar: string | null } | null;
  pending?: boolean;
}
interface Config {
  publicKey: string;
  color: string;
  welcomeMessage: string;
  operatorName: string;
  position: "left" | "right";
}

function post(url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function WidgetInner() {
  const params = useSearchParams();
  const key = params.get("key") || "";

  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [operatorTyping, setOperatorTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [convId, setConvId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingClear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  const parentPost = useCallback((data: unknown) => {
    window.parent?.postMessage(data, "*");
  }, []);

  // Sayfa/gövde şeffaf olsun (iframe köşede saydam görünsün)
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
  }, []);

  // Oturum başlat
  useEffect(() => {
    if (!key) return;
    const stored = localStorage.getItem(`mt_token_${key}`);
    let timezone: string | null = null;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      timezone = null;
    }
    const language = typeof navigator !== "undefined" ? navigator.language : null;
    // Ziyaretçinin geldiği üst sayfa (iframe olduğumuz için parent referrer'ı da dene)
    const pageUrl = document.referrer || null;
    post("/api/widget/session", {
      publicKey: key,
      token: stored,
      currentUrl: pageUrl,
      referrer: pageUrl,
      timezone,
      language,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setConfig(data.config);
        setToken(data.visitor.token);
        localStorage.setItem(`mt_token_${key}`, data.visitor.token);
        setMessages(data.messages || []);
        setConvId(data.conversation?.id || null);
        parentPost({ type: "marktasks:position", position: data.config.position });
        // Açılışta okunmamış operatör mesajı sayısı
        const un = (data.messages || []).filter(
          (m: Msg) => m.sender === "OPERATOR" && !m.readAt
        ).length;
        setUnread(un);
      });
  }, [key, parentPost]);

  // SSE bağlantısı
  useEffect(() => {
    if (!key || !token) return;
    const es = new EventSource(
      `/api/widget/stream?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`
    );
    es.onmessage = (e) => {
      let ev: {
        type: string;
        message?: Msg;
        conversationId?: string;
        from?: string;
        by?: string;
      };
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      if (ev.type === "message" && ev.message) {
        const m = ev.message;
        if (ev.conversationId) setConvId(ev.conversationId);
        setMessages((prev) => {
          if (prev.some((p) => p.id === m.id)) return prev;
          // Kendi optimistic mesajımızı gerçeğiyle değiştir
          if (m.sender === "VISITOR") {
            const idx = prev.findIndex((p) => p.pending && p.body === m.body);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = m;
              return next;
            }
          }
          return [...prev, m];
        });
        if (m.sender === "OPERATOR") {
          setOperatorTyping(false);
          if (!openRef.current) setUnread((u) => u + 1);
          else markRead();
        }
      } else if (ev.type === "typing" && ev.from === "operator") {
        setOperatorTyping(true);
        if (typingClear.current) clearTimeout(typingClear.current);
        typingClear.current = setTimeout(() => setOperatorTyping(false), 4000);
      } else if (ev.type === "read" && ev.by === "operator") {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender === "VISITOR" && !m.readAt
              ? { ...m, readAt: new Date().toISOString() }
              : m
          )
        );
      }
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token]);

  // Heartbeat
  useEffect(() => {
    if (!key || !token) return;
    const ping = () =>
      post("/api/widget/ping", { publicKey: key, token, currentUrl: document.referrer || null });
    ping();
    const iv = setInterval(ping, 30000);
    return () => clearInterval(iv);
  }, [key, token]);

  // Yeni mesajda en alta kaydır
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, operatorTyping, open]);

  const markRead = useCallback(() => {
    if (!key || !token) return;
    setUnread(0);
    post("/api/widget/ping", { publicKey: key, token, read: true });
  }, [key, token]);

  const toggle = (next: boolean) => {
    setOpen(next);
    parentPost({ type: "marktasks:size", open: next });
    if (next) markRead();
  };

  // Parent'tan open/close komutları ($marktasks.open())
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.type === "marktasks:open") toggle(true);
      if (d.type === "marktasks:close") toggle(false);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markRead]);

  const send = async () => {
    const body = input.trim();
    if (!body || !key || !token) return;
    setInput("");
    const tempId = "tmp-" + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempId, sender: "VISITOR", body, createdAt: new Date().toISOString(), pending: true },
    ]);
    const res = await post("/api/widget/message", { publicKey: key, token, body });
    if (res.ok) {
      const data = await res.json();
      setConvId(data.conversationId);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
    }
  };

  const onInputChange = (v: string) => {
    setInput(v);
    const now = Date.now();
    if (token && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      post("/api/widget/ping", { publicKey: key, token, typing: true });
    }
  };

  const color = config?.color || "#1e88e5";
  const opName = config?.operatorName || "Support";

  // ── Kapalı: baloncuk ──
  if (!open) {
    return (
      <div style={{ position: "fixed", bottom: 16, right: 16, ...wrap }}>
        <button aria-label="Open chat" onClick={() => toggle(true)} style={{ ...bubble, background: color }}>
          <ChatIcon />
          {unread > 0 && <span style={badge}>{unread}</span>}
        </button>
      </div>
    );
  }

  // ── Açık: panel ──
  return (
    <div style={{ position: "fixed", inset: 0, ...wrap, display: "flex", flexDirection: "column" }}>
      <div style={{ ...panel }}>
        {/* Header */}
        <div style={{ ...header, background: color }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={avatar}>{opName.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{opName}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Typically replies within minutes</div>
            </div>
          </div>
          <button aria-label="Close" onClick={() => toggle(false)} style={closeBtn}>
            <CloseIcon />
          </button>
        </div>

        {/* Mesajlar */}
        <div style={body}>
          {config?.welcomeMessage && (
            <Bubble side="left" color={color} name={opName}>
              {config.welcomeMessage}
            </Bubble>
          )}
          {messages.map((m) => (
            <Bubble
              key={m.id}
              side={m.sender === "VISITOR" ? "right" : "left"}
              color={color}
              name={m.sender === "OPERATOR" ? opName : undefined}
              pending={m.pending}
              seen={m.sender === "VISITOR" ? !!m.readAt : undefined}
            >
              {m.body}
            </Bubble>
          ))}
          {operatorTyping && (
            <Bubble side="left" color={color} name={opName}>
              <TypingDots />
            </Bubble>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Girdi */}
        <div style={inputBar}>
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Type your message…"
            style={inputBox}
          />
          <button onClick={send} disabled={!input.trim()} style={{ ...sendBtn, background: color, opacity: input.trim() ? 1 : 0.4 }}>
            <SendIcon />
          </button>
        </div>
        <div style={brand}>
          <span>Powered by MarkTasks</span>
        </div>
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={null}>
      <WidgetInner />
    </Suspense>
  );
}

/* ── Alt bileşenler ── */
function Bubble({
  side,
  color,
  name,
  children,
  pending,
  seen,
}: {
  side: "left" | "right";
  color: string;
  name?: string;
  children: React.ReactNode;
  pending?: boolean;
  seen?: boolean;
}) {
  const right = side === "right";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", marginBottom: 10 }}>
      {name && !right && <span style={{ fontSize: 11, color: "#8a8f98", margin: "0 0 3px 6px" }}>{name}</span>}
      <div
        style={{
          maxWidth: "78%",
          padding: "9px 13px",
          borderRadius: right ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: right ? color : "#f1f3f5",
          color: right ? "#fff" : "#1e1f21",
          fontSize: 14,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {children}
      </div>
      {right && seen && <span style={{ fontSize: 10, color: "#8a8f98", marginTop: 2, marginRight: 4 }}>Seen</span>}
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", height: 12 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#adb5bd",
            display: "inline-block",
            animation: `mtblink 1.2s ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes mtblink{0%,60%,100%{opacity:.2}30%{opacity:1}}`}</style>
    </span>
  );
}

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

/* ── Inline stiller ── */
const wrap: React.CSSProperties = { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" };
const bubble: React.CSSProperties = {
  position: "relative",
  width: 60,
  height: 60,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 6px 20px rgba(0,0,0,.22)",
};
const badge: React.CSSProperties = {
  position: "absolute",
  top: -4,
  right: -4,
  minWidth: 20,
  height: 20,
  padding: "0 5px",
  borderRadius: 10,
  background: "#ef4444",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const panel: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  right: 0,
  width: "100%",
  height: "100%",
  maxHeight: "100vh",
  background: "#fff",
  borderRadius: 16,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 12px 40px rgba(0,0,0,.18)",
};
const header: React.CSSProperties = {
  padding: "14px 16px",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
};
const avatar: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  background: "rgba(255,255,255,.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: 16,
};
const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 4,
  display: "flex",
  borderRadius: 6,
};
const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 14px",
  background: "#fafbfc",
};
const inputBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderTop: "1px solid #eceef1",
  flexShrink: 0,
};
const inputBox: React.CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  fontSize: 14,
  padding: "9px 4px",
  background: "transparent",
  color: "#1e1f21",
};
const sendBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const brand: React.CSSProperties = {
  textAlign: "center",
  fontSize: 10,
  color: "#adb5bd",
  padding: "4px 0 8px",
  flexShrink: 0,
};
