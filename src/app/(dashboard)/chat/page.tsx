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
  labels?: string[];
  website: { id: string; name: string; color: string };
  visitor: {
    id: string;
    name: string | null;
    email: string | null;
    country: string | null;
    city: string | null;
    currentUrl: string | null;
    online: boolean;
    lastSeenAt?: string | null;
  };
  lastMessage: { body: string; sender: string; createdAt: string } | null;
}
interface OnlineVisitor {
  id: string;
  name: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  currentUrl: string | null;
  lastSeenAt: string;
  website: { id: string; name: string; color: string };
  conversationId: string | null;
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
  labels?: string[];
  pageViews?: { id: string; url: string; createdAt: string }[];
  visitor: ConvItem["visitor"] & {
    userAgent?: string | null;
    referrer?: string | null;
    createdAt?: string;
    timezone?: string | null;
    language?: string | null;
    note?: string | null;
  };
  messages: Msg[];
}
interface SearchResult {
  conversationId: string;
  status: Status;
  website: { id: string; name: string; color: string };
  visitor: { id: string; name: string | null; email: string | null };
  snippet: string;
  match?: "visitor" | "message";
  sender: "VISITOR" | "OPERATOR";
  createdAt: string;
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
/** Etiket metninden tutarlı bir renk üretir (hash → hue). */
function labelStyle(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
  return { background: `hsl(${h} 70% 92%)`, color: `hsl(${h} 65% 32%)` };
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
  const [websites, setWebsites] = useState<{ id: string; name: string; color: string; isOwner: boolean; waiting?: number }[]>([]);
  const [siteFilter, setSiteFilter] = useState("");
  const [muted, setMuted] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [online, setOnline] = useState<OnlineVisitor[]>([]);
  const [savingName, setSavingName] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"info" | "pages">("info");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const openConvRef = useRef<((id: string) => void) | null>(null);
  // Canlı presence: ziyaretçi id → son görülme (ms). 45sn geçerse offline sayılır.
  const presence = useRef<Map<string, number>>(new Map());
  const [onlineTick, setOnlineTick] = useState(0);
  const detailRef = useRef<Detail | null>(null);
  const convsRef = useRef<ConvItem[]>([]);
  detailRef.current = detail;
  convsRef.current = convs;
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

  // 10sn'de bir yeniden hesapla → ziyaretçi ping'i kesilince offline'a düşer (sayfa yenilemeden)
  useEffect(() => {
    const iv = setInterval(() => setOnlineTick((t) => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);

  // Ziyaretçi şu an online mı? Önce canlı presence, yoksa son görülme zamanı.
  const ONLINE_MS = 45000;
  const onlineOf = (id: string, lastSeenAt?: string | null, fallback?: boolean) => {
    void onlineTick; // her tick'te yeniden hesaplansın
    const ts = presence.current.get(id);
    if (ts !== undefined) return Date.now() - ts < ONLINE_MS;
    if (lastSeenAt) return Date.now() - Date.parse(lastSeenAt) < ONLINE_MS;
    return !!fallback;
  };
  const markSeen = (id: string, online: boolean) => {
    presence.current.set(id, online ? Date.now() : 0);
    setOnlineTick((t) => t + 1);
  };

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

  // Çevrimiçi ziyaretçiler (konuşma başlatmamış olsalar da)
  const loadOnline = useCallback(() => {
    const q = siteFilter ? `?websiteId=${siteFilter}` : "";
    fetch(`/api/chat/visitors/online${q}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setOnline(Array.isArray(d) ? d : []));
  }, [siteFilter]);

  // "Çevrimiçi" görünümü açıkken periyodik tazele; her durumda site bekleyen sayıları için websites'i tazele
  useEffect(() => {
    if (!showOnline) return;
    loadOnline();
    const iv = setInterval(() => {
      loadOnline();
      loadWebsites();
    }, 15000);
    return () => clearInterval(iv);
  }, [showOnline, loadOnline, loadWebsites]);

  // Konuşma içi arama (mesaj gövdesinde: order id, link vb.) — debounce'lu
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (siteFilter) params.set("websiteId", siteFilter);
      fetch(`/api/chat/search?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setSearchResults(Array.isArray(d) ? d : []))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, siteFilter]);

  // Bir ziyaretçiyle konuşma başlat (çevrimiçi listesinden) ve aç
  const startWith = useCallback(
    async (visitorId: string, existing: string | null) => {
      if (existing) {
        setShowOnline(false);
        openConvRef.current?.(existing);
        return;
      }
      const res = await fetch(`/api/chat/visitors/${visitorId}/start`, { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setShowOnline(false);
        loadConvs();
        openConvRef.current?.(d.conversationId);
      }
    },
    [loadConvs]
  );

  // Ziyaretçiyi yeniden adlandır
  const saveName = useCallback(async (name: string) => {
    if (!selectedRef.current) return;
    setSavingName(true);
    const res = await fetch(`/api/chat/conversations/${selectedRef.current}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorName: name }),
    });
    setSavingName(false);
    if (res.ok) {
      const nm = name.trim() || null;
      setDetail((d) => (d ? { ...d, visitor: { ...d.visitor, name: nm } } : d));
      setConvs((prev) => prev.map((c) => (c.id === selectedRef.current ? { ...c, visitor: { ...c.visitor, name: nm } } : c)));
    }
  }, []);

  // Ziyaretçi notunu kaydet (kişiyi tanımak için, konuşmalar arası kalıcı)
  const saveNote = useCallback(async (note: string) => {
    if (!selectedRef.current) return;
    setSavingNote(true);
    const res = await fetch(`/api/chat/conversations/${selectedRef.current}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorNote: note }),
    });
    setSavingNote(false);
    if (res.ok) {
      const nt = note.trim() || null;
      setDetail((d) => (d ? { ...d, visitor: { ...d.visitor, note: nt } } : d));
    }
  }, []);

  // Konuşma etiketlerini kaydet
  const saveLabels = useCallback(async (labels: string[]) => {
    if (!selectedRef.current) return;
    const id = selectedRef.current;
    setDetail((d) => (d && d.id === id ? { ...d, labels } : d));
    setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, labels } : c)));
    await fetch(`/api/chat/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels }),
    });
  }, []);

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
      loadWebsites(); // bekleyen sayıları güncelle
    });
  }, [loadWebsites]);
  openConvRef.current = openConv;

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
        visitor?: { id: string; online?: boolean; currentUrl?: string | null };
      };
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      const cur = selectedRef.current;

      if (ev.type === "conversation") {
        loadConvs();
        loadWebsites();
      } else if (ev.type === "message" && ev.message) {
        const m = ev.message;
        const cid = ev.conversationId || m.conversationId!;
        // Gelen ziyaretçi mesajında sesli bildirim + bekleyen sayıları tazele
        if (m.sender === "VISITOR" && !mutedRef.current) playPing();
        if (m.sender === "VISITOR") {
          loadWebsites();
          // Mesaj atan ziyaretçi kesin online → presence tazele
          const vid = cid === cur ? detailRef.current?.visitor.id : convsRef.current.find((c) => c.id === cid)?.visitor.id;
          if (vid) markSeen(vid, true);
        }
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
      } else if (ev.type === "visitor" && ev.visitor) {
        const online = ev.visitor.online !== false;
        markSeen(ev.visitor.id, online); // canlı presence + anında yeniden hesap
        // Açık konuşmanın başlığındaki daireyi de anında güncelle
        setDetail((d) =>
          d && d.visitor.id === ev.visitor!.id ? { ...d, visitor: { ...d.visitor, online } } : d
        );
        if (online) loadConvs();
      }
    };
    return () => es.close();
  }, [loadConvs, loadWebsites]);

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
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Sol: konuşma listesi (mobilde tam genişlik; konuşma açıkken gizlenir) */}
      <div
        className={`w-full md:w-[300px] md:shrink-0 border-r border-[var(--asana-border)] flex-col bg-[var(--asana-bg-white)] ${
          detail ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="shrink-0 p-3 border-b border-[var(--asana-border)]">
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
          <div className="flex gap-1 text-xs mb-2 items-center">
            {(["OPEN", "RESOLVED", "ALL"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setShowOnline(false);
                }}
                className={`px-2.5 py-1 rounded-full ${
                  filter === f && !showOnline ? "bg-[var(--asana-accent)] text-white" : "text-[var(--asana-text-secondary)] hover:bg-[var(--asana-bg)]"
                }`}
              >
                {f === "OPEN" ? "Open" : f === "RESOLVED" ? "Resolved" : "All"}
              </button>
            ))}
            <button
              onClick={() => setShowOnline((v) => !v)}
              className={`ml-auto px-2.5 py-1 rounded-full flex items-center gap-1 ${
                showOnline ? "bg-green-600 text-white" : "text-green-700 hover:bg-green-50"
              }`}
              title="Show visitors currently online"
            >
              <span className={`w-2 h-2 rounded-full ${showOnline ? "bg-white" : "bg-green-500"}`} />
              Online{online.length > 0 ? ` (${online.length})` : ""}
            </button>
          </div>
          {/* Filter by site */}
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] outline-none focus:border-[var(--asana-accent)]"
          >
            <option value="">
              All sites{(() => {
                const t = websites.reduce((s, w) => s + (w.waiting ?? 0), 0);
                return t > 0 ? ` (${t})` : "";
              })()}
            </option>
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.waiting ? ` (${w.waiting})` : ""}
                {!w.isOwner ? " · member" : ""}
              </option>
            ))}
          </select>
          {/* Konuşma içi arama: order id / link vb. */}
          <div className="relative mt-2">
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--asana-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages (order id, link…)"
              className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] outline-none focus:border-[var(--asana-accent)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)]"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {search.trim().length >= 2 ? (
            searching && searchResults.length === 0 ? (
              <p className="p-4 text-sm text-[var(--asana-text-secondary)]">Searching…</p>
            ) : searchResults.length === 0 ? (
              <p className="p-4 text-sm text-[var(--asana-text-secondary)]">No messages match “{search.trim()}”.</p>
            ) : (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-[var(--asana-text-secondary)]">
                  {searchResults.length} conversation{searchResults.length > 1 ? "s" : ""}
                </p>
                {searchResults.map((r) => (
                  <button
                    key={r.conversationId}
                    onClick={() => openConv(r.conversationId)}
                    className={`w-full text-left px-3 py-3 border-b border-[var(--asana-border)] flex gap-3 items-start hover:bg-[var(--asana-bg)] ${
                      selectedId === r.conversationId ? "bg-[var(--asana-bg)]" : ""
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ background: r.website.color }}>
                      {initials(r.visitor.name, r.visitor.id)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-[var(--asana-text)] truncate">
                          {r.visitor.name || r.visitor.email || "Visitor #" + r.visitor.id.slice(-5)}
                        </span>
                        <span className="text-[10px] text-[var(--asana-text-secondary)] shrink-0">
                          {r.status === "OPEN" ? "open" : "resolved"}
                        </span>
                      </div>
                      {r.match === "visitor" && (
                        <span className="inline-block text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--asana-accent)]/10 text-[var(--asana-accent)] font-medium mt-0.5">
                          matches person
                        </span>
                      )}
                      {r.snippet && (
                        <p className="text-xs text-[var(--asana-text-secondary)] break-words line-clamp-2">
                          <span className="text-[var(--asana-text-secondary)]">{r.sender === "OPERATOR" ? "You: " : ""}</span>
                          {r.snippet}
                        </p>
                      )}
                      <span className="text-[10px] text-[var(--asana-text-secondary)] flex items-center gap-1 mt-0.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.website.color }} />
                        <span className="font-medium">{r.website.name}</span>
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )
          ) : showOnline ? (
            online.length === 0 ? (
              <p className="p-4 text-sm text-[var(--asana-text-secondary)]">No visitors online right now.</p>
            ) : (
              online.map((v) => (
                <button
                  key={v.id}
                  onClick={() => startWith(v.id, v.conversationId)}
                  className="w-full text-left px-3 py-3 border-b border-[var(--asana-border)] flex gap-3 items-start hover:bg-[var(--asana-bg)]"
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: v.website.color }}>
                      {initials(v.name, v.id)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--asana-bg-white)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-[var(--asana-text)] truncate">
                        {v.name || v.email || "Visitor #" + v.id.slice(-5)}
                      </span>
                      {v.conversationId ? (
                        <span className="text-[10px] text-[var(--asana-text-secondary)]">open chat</span>
                      ) : (
                        <span className="text-[10px] text-green-700">message →</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--asana-text-secondary)] truncate">{v.currentUrl || "—"}</p>
                    <span className="text-[10px] text-[var(--asana-text-secondary)] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: v.website.color }} />
                      <span className="font-medium">{v.website.name}</span>
                      {(v.city || v.country) && ` · ${[v.city, v.country].filter(Boolean).join(", ")}`}
                    </span>
                  </div>
                </button>
              ))
            )
          ) : loading ? (
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
                  {onlineOf(c.visitor.id, c.visitor.lastSeenAt, c.visitor.online) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--asana-bg-white)]">
                      <span className="absolute inset-0 rounded-full bg-green-400 animate-ping" />
                    </span>
                  )}
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
                  {c.labels && c.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.labels.map((l) => (
                        <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={labelStyle(l)}>
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-[var(--asana-text-secondary)] flex items-center gap-1 mt-0.5">
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

      {/* Orta: mesaj akışı (mobilde yalnızca konuşma açıkken görünür) */}
      <div className={`flex-1 flex-col bg-[var(--asana-bg)] min-w-0 min-h-0 ${detail ? "flex" : "hidden md:flex"}`}>
        {!detail ? (
          <div className="flex-1 flex items-center justify-center text-[var(--asana-text-secondary)] text-sm">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="shrink-0 px-3 md:px-4 py-3 border-b border-[var(--asana-border)] bg-[var(--asana-bg-white)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => { setSelectedId(null); setDetail(null); setPanelOpen(false); }}
                  className="md:hidden -ml-1 p-1 rounded-lg text-[var(--asana-text-secondary)] hover:bg-[var(--asana-bg)] shrink-0"
                  title="Back to inbox"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-semibold text-[var(--asana-text)] truncate">{visitorLabel(detail.visitor)}</span>
                {onlineOf(detail.visitor.id, detail.visitor.lastSeenAt, detail.visitor.online) ? (
                  <span className="flex items-center gap-1.5 text-xs text-green-600 shrink-0">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    <span className="hidden sm:inline">live on site</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-[var(--asana-text-secondary)] shrink-0">
                    <span className="inline-flex rounded-full h-2.5 w-2.5 bg-gray-300" />
                    <span className="hidden sm:inline">offline</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setPanelOpen((v) => !v)}
                  className="text-xs px-2 sm:px-3 py-1.5 rounded-lg font-medium bg-[var(--asana-bg)] text-[var(--asana-text-secondary)] hover:bg-[var(--asana-border)] flex items-center gap-1"
                  title="Visitor details & page history"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Details</span>
                </button>
                <button
                  onClick={toggleStatus}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                    detail.status === "OPEN" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-[var(--asana-bg)] text-[var(--asana-text-secondary)] hover:bg-[var(--asana-border)]"
                  }`}
                >
                  {detail.status === "OPEN" ? "Mark resolved" : "Reopen"}
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
              {detail.messages.map((m) => (
                <MsgBubble key={m.id} m={m} color={convs.find((c) => c.id === detail.id)?.website.color || "#1e88e5"} />
              ))}
              {visitorTyping && <div className="text-xs text-[var(--asana-text-secondary)] italic ml-1">typing…</div>}
              <div ref={bottomRef} />
            </div>

            {uploadErr && <div className="shrink-0 px-3 pt-2 text-xs text-red-500">{uploadErr}</div>}
            <div className="shrink-0 p-3 border-t border-[var(--asana-border)] bg-[var(--asana-bg-white)] flex gap-2 items-end">
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

      {/* Sağ: ziyaretçi detayları (lg'de sabit; küçük ekranda "Details" ile overlay) */}
      {detail && (
        <div
          className={`w-[280px] max-w-[85vw] lg:max-w-none shrink-0 border-l border-[var(--asana-border)] bg-[var(--asana-bg-white)] p-4 overflow-y-auto lg:block ${
            panelOpen ? "block fixed lg:static right-0 top-14 bottom-0 z-30 shadow-2xl lg:shadow-none" : "hidden"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--asana-text)]">Visitor</h3>
            <button
              onClick={() => setPanelOpen(false)}
              className="lg:hidden text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)]"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Sekmeler: Bilgi / Sayfa geçmişi */}
          <div className="flex gap-1 text-xs mb-3">
            <button
              onClick={() => setDetailTab("info")}
              className={`px-2.5 py-1 rounded-full ${detailTab === "info" ? "bg-[var(--asana-accent)] text-white" : "text-[var(--asana-text-secondary)] hover:bg-[var(--asana-bg)]"}`}
            >
              Info
            </button>
            <button
              onClick={() => setDetailTab("pages")}
              className={`px-2.5 py-1 rounded-full ${detailTab === "pages" ? "bg-[var(--asana-accent)] text-white" : "text-[var(--asana-text-secondary)] hover:bg-[var(--asana-bg)]"}`}
            >
              Pages{detail.pageViews && detail.pageViews.length > 0 ? ` (${detail.pageViews.length})` : ""}
            </button>
          </div>

          {detailTab === "info" ? (
            <>
              {/* Düzenlenebilir isim */}
              <NameEditor
                key={detail.visitor.id}
                name={detail.visitor.name}
                saving={savingName}
                onSave={saveName}
              />

              {/* Konuşma etiketleri */}
              <LabelEditor labels={detail.labels || []} onChange={saveLabels} />

              {/* Ziyaretçi hakkında operatör notu */}
              <NoteEditor key={detail.visitor.id + ":note"} note={detail.visitor.note ?? null} saving={savingNote} onSave={saveNote} />

              <dl className="space-y-3 text-sm mt-4">
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
                <Info label="Status" value={onlineOf(detail.visitor.id, detail.visitor.lastSeenAt, detail.visitor.online) ? "Online" : "Offline"} />
                <Info label="Browser" value={detail.visitor.userAgent || "—"} />
              </dl>
            </>
          ) : (
            <PageHistory pages={detail.pageViews || []} />
          )}
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

/** Ziyaretçinin gezdiği sayfaların zaman çizelgesi. */
function PageHistory({ pages }: { pages: { id: string; url: string; createdAt: string }[] }) {
  if (pages.length === 0) {
    return <p className="text-sm text-[var(--asana-text-secondary)]">No page history yet.</p>;
  }
  const short = (u: string) => {
    try {
      const url = new URL(u);
      return url.pathname + url.search || "/";
    } catch {
      return u;
    }
  };
  // Tam tarih-saat-dakika-saniye
  const exact = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const rel = (iso: string) => {
    const d = new Date(iso);
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  return (
    <ol className="space-y-2 text-sm">
      {pages.map((p) => (
        <li key={p.id} className="border-l-2 border-[var(--asana-border)] pl-3 pb-1">
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--asana-blue)] hover:underline break-all block"
            title={p.url}
          >
            {short(p.url)}
          </a>
          <span className="block text-[11px] text-[var(--asana-text)]">{exact(p.createdAt)}</span>
          <span className="text-[10px] text-[var(--asana-text-secondary)]">{rel(p.createdAt)}</span>
        </li>
      ))}
    </ol>
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

/** Ziyaretçi adını düzenler (ör. "Ali Veli"). */
function NameEditor({ name, saving, onSave }: { name: string | null; saving: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name || "");
  useEffect(() => setVal(name || ""), [name]);

  if (!editing) {
    return (
      <div className="mb-3">
        <div className="text-xs text-[var(--asana-text-secondary)] mb-0.5">Name</div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--asana-text)] font-medium text-sm break-words">{name || "Unnamed visitor"}</span>
          <button onClick={() => setEditing(true)} className="text-xs text-[var(--asana-blue)] hover:underline shrink-0">
            edit
          </button>
        </div>
      </div>
    );
  }
  const commit = () => {
    onSave(val);
    setEditing(false);
  };
  return (
    <div className="mb-3">
      <div className="text-xs text-[var(--asana-text-secondary)] mb-0.5">Name</div>
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="e.g. Ali Veli"
          className="flex-1 min-w-0 px-2 py-1 rounded border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)]"
        />
        <button onClick={commit} disabled={saving} className="text-xs px-2 py-1 rounded bg-[var(--asana-accent)] text-white disabled:opacity-50">
          {saving ? "…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/** Ziyaretçi hakkında serbest operatör notu (kaydet ile kalıcı). */
function NoteEditor({ note, saving, onSave }: { note: string | null; saving: boolean; onSave: (v: string) => void }) {
  const [val, setVal] = useState(note || "");
  useEffect(() => setVal(note || ""), [note]);
  const dirty = (val.trim() || null) !== (note || null);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--asana-text-secondary)]">Notes</span>
        {dirty && (
          <button
            onClick={() => onSave(val)}
            disabled={saving}
            className="text-xs px-2 py-0.5 rounded bg-[var(--asana-accent)] text-white disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
        )}
      </div>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => dirty && onSave(val)}
        rows={3}
        placeholder="Private notes about this visitor…"
        className="w-full resize-y px-2 py-1.5 rounded border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)] min-h-[60px]"
      />
    </div>
  );
}

/** Konuşma etiketlerini ekler/çıkarır. */
function LabelEditor({ labels, onChange }: { labels: string[]; onChange: (l: string[]) => void }) {
  const [val, setVal] = useState("");
  const add = () => {
    const t = val.trim().slice(0, 32);
    if (!t || labels.includes(t) || labels.length >= 12) {
      setVal("");
      return;
    }
    onChange([...labels, t]);
    setVal("");
  };
  return (
    <div className="mb-1">
      <div className="text-xs text-[var(--asana-text-secondary)] mb-1">Labels</div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {labels.map((l) => (
          <span key={l} className="text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={labelStyle(l)}>
            {l}
            <button onClick={() => onChange(labels.filter((x) => x !== l))} className="hover:opacity-70" title="Remove">
              ×
            </button>
          </span>
        ))}
        {labels.length === 0 && <span className="text-xs text-[var(--asana-text-secondary)]">No labels</span>}
      </div>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Add label + Enter"
        className="w-full px-2 py-1 rounded border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-xs outline-none focus:border-[var(--asana-accent)]"
      />
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
