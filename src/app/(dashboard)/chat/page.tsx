"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playPing, unlockAudio } from "@/lib/notifySound";
import MembersManager from "@/components/chat/MembersManager";

type Status = "OPEN" | "RESOLVED";
interface ConvItem {
  id: string;
  status: Status;
  lastMessageAt: string;
  operatorUnread: number;
  website: { id: string; name: string; color: string };
  visitor: {
    id: string;
    name: string | null;
    email: string | null;
    country: string | null;
    city: string | null;
    currentUrl: string | null;
    online: boolean;
  };
  lastMessage: { body: string; sender: string; createdAt: string } | null;
}
interface Msg {
  id: string;
  sender: "VISITOR" | "OPERATOR";
  body: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  createdAt: string;
  readAt?: string | null;
  operator?: { name: string; avatar: string | null } | null;
  pending?: boolean;
}
interface Detail {
  id: string;
  status: Status;
  visitor: ConvItem["visitor"] & {
    userAgent?: string | null;
    referrer?: string | null;
    createdAt?: string;
    timezone?: string | null;
    language?: string | null;
  };
  messages: Msg[];
}

/** Verilen IANA saat dilimindeki güncel yerel saati (canlı) döndürür. */
function useLocalTime(tz: string | null | undefined) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    if (!tz) {
      setNow(null);
      return;
    }
    const tick = () => {
      try {
        setNow(
          new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date())
        );
      } catch {
        setNow(null);
      }
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [tz]);
  return now;
}

function initials(name: string | null, id: string) {
  if (name) return name.charAt(0).toUpperCase();
  return "V" + id.slice(-2, -1).toUpperCase();
}
function visitorLabel(v: ConvItem["visitor"]) {
  return v.name || v.email || "Visitor #" + v.id.slice(-5);
}

export default function ChatPage() {
  const [convs, setConvs] = useState<ConvItem[]>([]);
  const [filter, setFilter] = useState<"OPEN" | "RESOLVED" | "ALL">("OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [input, setInput] = useState("");
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSites, setShowSites] = useState(false);
  const [websites, setWebsites] = useState<{ id: string; name: string; color: string; isOwner: boolean }[]>([]);
  const [siteFilter, setSiteFilter] = useState("");
  const [muted, setMuted] = useState(false);

  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const typingClear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Ses tercihini yükle + tarayıcı ses kilidini ilk tıklamada aç
  useEffect(() => {
    setMuted(localStorage.getItem("mt_chat_muted") === "1");
    const unlock = () => unlockAudio();
    window.addEventListener("click", unlock, { once: true });
    return () => window.removeEventListener("click", unlock);
  }, []);
  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("mt_chat_muted", next ? "1" : "0");
      if (!next) unlockAudio(); // sesi açarken kilidi de aç
      return next;
    });
  };

  const localTime = useLocalTime(detail?.visitor.timezone);

  const loadConvs = useCallback(() => {
    const q = new URLSearchParams({ status: filter });
    if (siteFilter) q.set("websiteId", siteFilter);
    fetch(`/api/chat/conversations?${q.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setConvs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [filter, siteFilter]);

  useEffect(() => {
    loadConvs();
  }, [loadConvs]);

  // Erişilebilir siteleri yükle (filtre + üye yönetimi için)
  const loadWebsites = useCallback(() => {
    fetch("/api/chat/websites")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setWebsites(Array.isArray(d) ? d : []));
  }, []);
  useEffect(() => {
    loadWebsites();
  }, [loadWebsites]);

  // Seçili konuşmayı yükle + okundu işaretle
  const openConv = useCallback((id: string) => {
    setSelectedId(id);
    setVisitorTyping(false);
    fetch(`/api/chat/conversations/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDetail(d));
    fetch(`/api/chat/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).then(() => {
      setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, operatorUnread: 0 } : c)));
    });
  }, []);

  // SSE
  useEffect(() => {
    const es = new EventSource("/api/chat/stream");
    es.onmessage = (e) => {
      let ev: {
        type: string;
        message?: Msg & { conversationId?: string };
        conversationId?: string;
        from?: string;
        by?: string;
      };
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      const cur = selectedRef.current;

      if (ev.type === "conversation") {
        loadConvs();
      } else if (ev.type === "message" && ev.message) {
        const m = ev.message;
        const cid = ev.conversationId || m.conversationId!;
        // Gelen ziyaretçi mesajında sesli bildirim
        if (m.sender === "VISITOR" && !mutedRef.current) playPing();
        // Seçili konuşmadaysa thread'e ekle
        if (cid === cur) {
          setDetail((d) => {
            if (!d) return d;
            if (d.messages.some((x) => x.id === m.id)) return d;
            if (m.sender === "OPERATOR") {
              const idx = d.messages.findIndex((x) => x.pending && x.body === m.body);
              if (idx >= 0) {
                const next = [...d.messages];
                next[idx] = m;
                return { ...d, messages: next };
              }
            }
            return { ...d, messages: [...d.messages, m] };
          });
          if (m.sender === "VISITOR") {
            setVisitorTyping(false);
            fetch(`/api/chat/conversations/${cid}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ read: true }),
            });
          }
        }
        // Liste önizlemesini güncelle
        setConvs((prev) => {
          const found = prev.find((c) => c.id === cid);
          if (!found) {
            loadConvs();
            return prev;
          }
          const updated: ConvItem = {
            ...found,
            lastMessage: { body: m.attachmentType === "image" ? "📷 Photo" : m.body, sender: m.sender, createdAt: m.createdAt },
            lastMessageAt: m.createdAt,
            operatorUnread:
              m.sender === "VISITOR" && cid !== cur ? found.operatorUnread + 1 : found.operatorUnread,
            status: "OPEN",
          };
          return [updated, ...prev.filter((c) => c.id !== cid)];
        });
      } else if (ev.type === "typing" && ev.from === "visitor") {
        if (ev.conversationId === cur) {
          setVisitorTyping(true);
          if (typingClear.current) clearTimeout(typingClear.current);
          typingClear.current = setTimeout(() => setVisitorTyping(false), 4000);
        }
      } else if (ev.type === "read" && ev.by === "visitor") {
        if (ev.conversationId === cur) {
          setDetail((d) =>
            d
              ? {
                  ...d,
                  messages: d.messages.map((m) =>
                    m.sender === "OPERATOR" && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m
                  ),
                }
              : d
          );
        }
      } else if (ev.type === "visitor") {
        loadConvs();
      }
    };
    return () => es.close();
  }, [loadConvs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages, visitorTyping]);

  const send = async () => {
    const body = input.trim();
    if (!body || !selectedId) return;
    setInput("");
    const tempId = "tmp-" + Date.now();
    setDetail((d) =>
      d ? { ...d, messages: [...d.messages, { id: tempId, sender: "OPERATOR", body, createdAt: new Date().toISOString(), pending: true }] } : d
    );
    const res = await fetch(`/api/chat/conversations/${selectedId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const data = await res.json();
      setDetail((d) =>
        d ? { ...d, messages: d.messages.map((m) => (m.id === tempId ? data.message : m)) } : d
      );
    }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !selectedId) return;
    setUploadErr(null);
    if (!f.type.startsWith("image/")) {
      setUploadErr("Only image files are allowed");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUploadErr("Image cannot exceed 5MB");
      return;
    }
    const tempId = "tmp-" + Date.now();
    const preview = URL.createObjectURL(f);
    setDetail((d) =>
      d
        ? { ...d, messages: [...d.messages, { id: tempId, sender: "OPERATOR", body: "", attachmentUrl: preview, attachmentType: "image", createdAt: new Date().toISOString(), pending: true }] }
        : d
    );
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch(`/api/chat/conversations/${selectedId}/upload`, { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      setDetail((d) => (d ? { ...d, messages: d.messages.map((m) => (m.id === tempId ? data.message : m)) } : d));
    } else {
      const dd = await res.json().catch(() => ({}));
      setUploadErr(dd.error || "Upload failed");
      setDetail((d) => (d ? { ...d, messages: d.messages.filter((m) => m.id !== tempId) } : d));
    }
  };

  const onType = (v: string) => {
    setInput(v);
    const now = Date.now();
    if (selectedId && now - lastTyping.current > 2000) {
      lastTyping.current = now;
      fetch(`/api/chat/conversations/${selectedId}/typing`, { method: "POST" });
    }
  };

  const toggleStatus = async () => {
    if (!detail) return;
    const next: Status = detail.status === "OPEN" ? "RESOLVED" : "OPEN";
    await fetch(`/api/chat/conversations/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setDetail((d) => (d ? { ...d, status: next } : d));
    loadConvs();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sol: konuşma listesi */}
      <div className="w-[300px] border-r border-[var(--asana-border)] flex flex-col bg-[var(--asana-bg-white)]">
        <div className="p-3 border-b border-[var(--asana-border)]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-[var(--asana-text)]">Inbox</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg text-[var(--asana-text-secondary)] hover:bg-[var(--asana-bg)]"
                title={muted ? "Sound off — click to enable" : "Sound on — click to mute"}
              >
                {muted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 9l4 4m0-4l-4 4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setShowSites(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white font-medium"
                title="Add site / embed code"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Site
              </button>
            </div>
          </div>
          <div className="flex gap-1 text-xs mb-2">
            {(["OPEN", "RESOLVED", "ALL"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-full ${
                  filter === f ? "bg-[var(--asana-accent)] text-white" : "text-[var(--asana-text-secondary)] hover:bg-[var(--asana-bg)]"
                }`}
              >
                {f === "OPEN" ? "Open" : f === "RESOLVED" ? "Resolved" : "All"}
              </button>
            ))}
          </div>
          {/* Filter by site */}
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] outline-none focus:border-[var(--asana-accent)]"
          >
            <option value="">All sites ({websites.length})</option>
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {!w.isOwner ? " (member)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-[var(--asana-text-secondary)]">Loading…</p>
          ) : convs.length === 0 ? (
            <p className="p-4 text-sm text-[var(--asana-text-secondary)]">No conversations.</p>
          ) : (
            convs.map((c) => (
              <button
                key={c.id}
                onClick={() => openConv(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-[var(--asana-border)] flex gap-3 items-start hover:bg-[var(--asana-bg)] ${
                  selectedId === c.id ? "bg-[var(--asana-bg)]" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: c.website.color }}>
                    {initials(c.visitor.name, c.visitor.id)}
                  </div>
                  {c.visitor.online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--asana-bg-white)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-[var(--asana-text)] truncate">{visitorLabel(c.visitor)}</span>
                    {c.operatorUnread > 0 && (
                      <span className="bg-[var(--asana-accent)] text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{c.operatorUnread}</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--asana-text-secondary)] truncate">
                    {c.lastMessage ? (c.lastMessage.sender === "OPERATOR" ? "You: " : "") + c.lastMessage.body : "—"}
                  </p>
                  <span className="text-[10px] text-[var(--asana-text-secondary)] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.website.color }} />
                    <span className="font-medium">{c.website.name}</span>
                    {(c.visitor.city || c.visitor.country) &&
                      ` · ${[c.visitor.city, c.visitor.country].filter(Boolean).join(", ")}`}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Orta: mesaj akışı */}
      <div className="flex-1 flex flex-col bg-[var(--asana-bg)]">
        {!detail ? (
          <div className="flex-1 flex items-center justify-center text-[var(--asana-text-secondary)] text-sm">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-[var(--asana-border)] bg-[var(--asana-bg-white)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--asana-text)]">{visitorLabel(detail.visitor)}</span>
                {detail.visitor.online ? (
                  <span className="text-xs text-green-600">● online</span>
                ) : (
                  <span className="text-xs text-[var(--asana-text-secondary)]">● offline</span>
                )}
              </div>
              <button
                onClick={toggleStatus}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                  detail.status === "OPEN" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-[var(--asana-bg)] text-[var(--asana-text-secondary)] hover:bg-[var(--asana-border)]"
                }`}
              >
                {detail.status === "OPEN" ? "Mark resolved" : "Reopen"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {detail.messages.map((m) => (
                <MsgBubble key={m.id} m={m} color={convs.find((c) => c.id === detail.id)?.website.color || "#1e88e5"} />
              ))}
              {visitorTyping && <div className="text-xs text-[var(--asana-text-secondary)] italic ml-1">typing…</div>}
              <div ref={bottomRef} />
            </div>

            {uploadErr && <div className="px-3 pt-2 text-xs text-red-500">{uploadErr}</div>}
            <div className="p-3 border-t border-[var(--asana-border)] bg-[var(--asana-bg-white)] flex gap-2 items-end">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={onPickImage}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                title="Attach image"
                className="p-2 rounded-lg text-[var(--asana-text-secondary)] hover:bg-[var(--asana-bg)] shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Type a reply…  (Enter to send)"
                className="flex-1 resize-none px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)] max-h-32"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                className="px-4 py-2 rounded-lg bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white text-sm font-medium disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sağ: ziyaretçi detayları */}
      {detail && (
        <div className="w-[260px] border-l border-[var(--asana-border)] bg-[var(--asana-bg-white)] p-4 hidden lg:block overflow-y-auto">
          <h3 className="font-semibold text-[var(--asana-text)] mb-3">Visitor</h3>
          <dl className="space-y-3 text-sm">
            <Info label="Name" value={detail.visitor.name || "—"} />
            <Info label="Email" value={detail.visitor.email || "—"} />
            <Info
              label="Location (from timezone)"
              value={[detail.visitor.city, detail.visitor.country].filter(Boolean).join(", ") || "—"}
            />
            <Info label="Timezone" value={detail.visitor.timezone || "—"} />
            <Info label="Local time" value={localTime ? `${localTime} 🕒` : "—"} />
            <Info label="Language" value={detail.visitor.language || "—"} />
            <Info label="Current page" value={detail.visitor.currentUrl || "—"} />
            <Info label="Referrer" value={detail.visitor.referrer || "—"} />
            <Info label="Status" value={detail.visitor.online ? "Online" : "Offline"} />
            <Info label="Browser" value={detail.visitor.userAgent || "—"} />
          </dl>
        </div>
      )}

      {showSites && <SitesModal onClose={() => { setShowSites(false); loadConvs(); loadWebsites(); }} />}
    </div>
  );
}

function MsgBubble({ m, color }: { m: Msg; color: string }) {
  const op = m.sender === "OPERATOR";
  const isImage = m.attachmentType === "image" && m.attachmentUrl;
  const hasText = m.body.trim().length > 0;
  return (
    <div className={`flex flex-col ${op ? "items-end" : "items-start"}`}>
      {op && m.operator?.name && <span className="text-[10px] text-[var(--asana-text-secondary)] mb-0.5 mr-1">{m.operator.name}</span>}
      {isImage && (
        <a
          href={m.attachmentUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-1"
          style={{ opacity: m.pending ? 0.6 : 1 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.attachmentUrl!}
            alt="attachment"
            className="rounded-xl object-cover"
            style={{ maxWidth: 240, maxHeight: 260 }}
          />
        </a>
      )}
      {hasText && (
        <div
          className="max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
          style={
            op
              ? { background: color, color: "#fff", borderBottomRightRadius: 4, opacity: m.pending ? 0.6 : 1 }
              : { background: "var(--asana-bg-white)", color: "var(--asana-text)", border: "1px solid var(--asana-border)", borderBottomLeftRadius: 4 }
          }
        >
          {m.body}
        </div>
      )}
      {op && m.readAt && <span className="text-[10px] text-[var(--asana-text-secondary)] mt-0.5 mr-1">Seen</span>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--asana-text-secondary)]">{label}</dt>
      <dd className="text-[var(--asana-text)] break-words">{value}</dd>
    </div>
  );
}

interface SiteRow {
  id: string;
  name: string;
  domain: string | null;
  publicKey: string;
  active: boolean;
  isOwner: boolean;
}

/** /chat içinden site ekleme + embed (JS) kodu alma modalı. */
function SitesModal({ onClose }: { onClose: () => void }) {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = () =>
    fetch("/api/chat/websites")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSites(Array.isArray(d) ? d : []));

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/chat/websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, domain }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setDomain("");
      load();
    }
  };

  const snippet = (key: string) =>
    `<!-- MarkTasks Chat -->\n<script>window.$marktasks={websiteId:"${key}"};</script>\n<script async src="${origin}/widget.js"></script>`;

  const copy = (key: string) => {
    navigator.clipboard.writeText(snippet(key));
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--asana-bg-white)] rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-[var(--asana-text)]">Sites</h2>
          <button onClick={onClose} className="text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-[var(--asana-text-secondary)] mb-4">
          Add a site and paste the JS code right before your page&apos;s <code>&lt;/body&gt;</code>. Conversations land in this screen.
        </p>

        {/* Add */}
        <div className="flex gap-2 items-end mb-5 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-[var(--asana-text-secondary)] mb-1">Site name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company Site"
              className="w-full px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)]" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-[var(--asana-text-secondary)] mb-1">Domain (optional)</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com"
              className="w-full px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)]" />
          </div>
          <button onClick={add} disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white text-sm font-medium disabled:opacity-50">
            {busy ? "…" : "Add"}
          </button>
        </div>

        {/* List */}
        <div className="space-y-3">
          {sites.length === 0 ? (
            <p className="text-sm text-[var(--asana-text-secondary)]">No sites yet.</p>
          ) : (
            sites.map((s) => (
              <div key={s.id} className="border border-[var(--asana-border)] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-[var(--asana-text)]">
                    {s.name} {s.domain && <span className="text-[var(--asana-text-secondary)] font-normal">· {s.domain}</span>}
                  </span>
                  <button onClick={() => copy(s.publicKey)} className="text-xs px-2 py-1 rounded bg-[var(--asana-bg)] hover:bg-[var(--asana-border)] text-[var(--asana-text)]">
                    {copied === s.publicKey ? "Copied ✓" : "Copy code"}
                  </button>
                </div>
                <pre className="bg-[#1e1f21] text-[#d6d6d6] text-[11px] rounded p-2 overflow-x-auto whitespace-pre-wrap">{snippet(s.publicKey)}</pre>
                {s.isOwner ? (
                  <MembersManager websiteId={s.id} />
                ) : (
                  <div className="mt-2 pt-2 border-t border-[var(--asana-border)] text-[11px] text-[var(--asana-text-secondary)]">
                    You were added to this site as a member.
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
