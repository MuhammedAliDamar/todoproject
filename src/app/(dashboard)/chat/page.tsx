"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
          new Intl.DateTimeFormat("tr-TR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date())
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
  return "Z" + id.slice(-2, -1).toUpperCase();
}
function visitorLabel(v: ConvItem["visitor"]) {
  return v.name || v.email || "Ziyaretçi #" + v.id.slice(-5);
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

  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const typingClear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);

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
            lastMessage: { body: m.body, sender: m.sender, createdAt: m.createdAt },
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
            <h2 className="font-bold text-[var(--asana-text)]">Gelen Kutusu</h2>
            <button
              onClick={() => setShowSites(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white font-medium"
              title="Site ekle / embed kodu"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Site
            </button>
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
                {f === "OPEN" ? "Açık" : f === "RESOLVED" ? "Çözüldü" : "Tümü"}
              </button>
            ))}
          </div>
          {/* Siteye göre kategorize */}
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] outline-none focus:border-[var(--asana-accent)]"
          >
            <option value="">Tüm siteler ({websites.length})</option>
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {!w.isOwner ? " (üye)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-[var(--asana-text-secondary)]">Yükleniyor…</p>
          ) : convs.length === 0 ? (
            <p className="p-4 text-sm text-[var(--asana-text-secondary)]">Konuşma yok.</p>
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
                    {c.lastMessage ? (c.lastMessage.sender === "OPERATOR" ? "Siz: " : "") + c.lastMessage.body : "—"}
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
            Bir konuşma seçin
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-[var(--asana-border)] bg-[var(--asana-bg-white)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--asana-text)]">{visitorLabel(detail.visitor)}</span>
                {detail.visitor.online ? (
                  <span className="text-xs text-green-600">● çevrimiçi</span>
                ) : (
                  <span className="text-xs text-[var(--asana-text-secondary)]">● çevrimdışı</span>
                )}
              </div>
              <button
                onClick={toggleStatus}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                  detail.status === "OPEN" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-[var(--asana-bg)] text-[var(--asana-text-secondary)] hover:bg-[var(--asana-border)]"
                }`}
              >
                {detail.status === "OPEN" ? "Çözüldü işaretle" : "Yeniden aç"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {detail.messages.map((m) => (
                <MsgBubble key={m.id} m={m} color={convs.find((c) => c.id === detail.id)?.website.color || "#1e88e5"} />
              ))}
              {visitorTyping && <div className="text-xs text-[var(--asana-text-secondary)] italic ml-1">yazıyor…</div>}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-[var(--asana-border)] bg-[var(--asana-bg-white)] flex gap-2 items-end">
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
                placeholder="Yanıt yazın…  (Enter ile gönder)"
                className="flex-1 resize-none px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)] max-h-32"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                className="px-4 py-2 rounded-lg bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white text-sm font-medium disabled:opacity-40"
              >
                Gönder
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sağ: ziyaretçi detayları */}
      {detail && (
        <div className="w-[260px] border-l border-[var(--asana-border)] bg-[var(--asana-bg-white)] p-4 hidden lg:block overflow-y-auto">
          <h3 className="font-semibold text-[var(--asana-text)] mb-3">Ziyaretçi</h3>
          <dl className="space-y-3 text-sm">
            <Info label="İsim" value={detail.visitor.name || "—"} />
            <Info label="E-posta" value={detail.visitor.email || "—"} />
            <Info
              label="Konum (saat diliminden)"
              value={[detail.visitor.city, detail.visitor.country].filter(Boolean).join(", ") || "—"}
            />
            <Info label="Saat dilimi" value={detail.visitor.timezone || "—"} />
            <Info label="Yerel saati" value={localTime ? `${localTime} 🕒` : "—"} />
            <Info label="Dil" value={detail.visitor.language || "—"} />
            <Info label="Şu anki sayfa" value={detail.visitor.currentUrl || "—"} />
            <Info label="Referrer" value={detail.visitor.referrer || "—"} />
            <Info label="Durum" value={detail.visitor.online ? "Çevrimiçi" : "Çevrimdışı"} />
            <Info label="Tarayıcı" value={detail.visitor.userAgent || "—"} />
          </dl>
        </div>
      )}

      {showSites && <SitesModal onClose={() => { setShowSites(false); loadConvs(); loadWebsites(); }} />}
    </div>
  );
}

function MsgBubble({ m, color }: { m: Msg; color: string }) {
  const op = m.sender === "OPERATOR";
  return (
    <div className={`flex flex-col ${op ? "items-end" : "items-start"}`}>
      {op && m.operator?.name && <span className="text-[10px] text-[var(--asana-text-secondary)] mb-0.5 mr-1">{m.operator.name}</span>}
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
      {op && m.readAt && <span className="text-[10px] text-[var(--asana-text-secondary)] mt-0.5 mr-1">Görüldü</span>}
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

interface Member {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: "owner" | "member";
  memberId?: string;
}

/** Site sahibinin operatör (kullanıcı) atadığı bölüm. */
function MembersManager({ websiteId }: { websiteId: string }) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/chat/websites/${websiteId}/members`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setOwner(d.owner);
          setMembers(d.members);
        }
      });

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const add = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/chat/websites/${websiteId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (res.ok) {
      setEmail("");
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Eklenemedi");
    }
  };

  const remove = async (userId: string) => {
    await fetch(`/api/chat/websites/${websiteId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    load();
  };

  return (
    <div className="mt-2 pt-2 border-t border-[var(--asana-border)]">
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-[var(--asana-blue)] hover:underline">
        {open ? "▾ Kullanıcılar" : "▸ Kullanıcılar (operatör ata)"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {owner && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--asana-text)]">{owner.name} · {owner.email}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--asana-bg)] text-[var(--asana-text-secondary)]">sahip</span>
            </div>
          )}
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-xs">
              <span className="text-[var(--asana-text)]">{m.name} · {m.email}</span>
              <button onClick={() => remove(m.id)} className="text-red-500 hover:underline text-[11px]">çıkar</button>
            </div>
          ))}
          <div className="flex gap-1">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="kullanici@eposta.com"
              className="flex-1 text-xs px-2 py-1.5 rounded border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] outline-none focus:border-[var(--asana-accent)]"
            />
            <button onClick={add} disabled={busy || !email.trim()} className="text-xs px-2.5 py-1.5 rounded bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white disabled:opacity-50">
              Ata
            </button>
          </div>
          {err && <p className="text-[11px] text-red-500">{err}</p>}
        </div>
      )}
    </div>
  );
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
          <h2 className="text-lg font-bold text-[var(--asana-text)]">Siteler</h2>
          <button onClick={onClose} className="text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-[var(--asana-text-secondary)] mb-4">
          Site ekleyin, JS kodunu sitenizin <code>&lt;/body&gt;</code> öncesine yapıştırın. Sohbetler bu ekranda düşer.
        </p>

        {/* Ekle */}
        <div className="flex gap-2 items-end mb-5 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-[var(--asana-text-secondary)] mb-1">Site adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Şirket Sitesi"
              className="w-full px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)]" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-[var(--asana-text-secondary)] mb-1">Alan adı (ops.)</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="ornek.com"
              className="w-full px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)]" />
          </div>
          <button onClick={add} disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white text-sm font-medium disabled:opacity-50">
            {busy ? "…" : "Ekle"}
          </button>
        </div>

        {/* Liste */}
        <div className="space-y-3">
          {sites.length === 0 ? (
            <p className="text-sm text-[var(--asana-text-secondary)]">Henüz site yok.</p>
          ) : (
            sites.map((s) => (
              <div key={s.id} className="border border-[var(--asana-border)] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-[var(--asana-text)]">
                    {s.name} {s.domain && <span className="text-[var(--asana-text-secondary)] font-normal">· {s.domain}</span>}
                  </span>
                  <button onClick={() => copy(s.publicKey)} className="text-xs px-2 py-1 rounded bg-[var(--asana-bg)] hover:bg-[var(--asana-border)] text-[var(--asana-text)]">
                    {copied === s.publicKey ? "Kopyalandı ✓" : "Kodu kopyala"}
                  </button>
                </div>
                <pre className="bg-[#1e1f21] text-[#d6d6d6] text-[11px] rounded p-2 overflow-x-auto whitespace-pre-wrap">{snippet(s.publicKey)}</pre>
                {s.isOwner ? (
                  <MembersManager websiteId={s.id} />
                ) : (
                  <div className="mt-2 pt-2 border-t border-[var(--asana-border)] text-[11px] text-[var(--asana-text-secondary)]">
                    Bu siteye üye olarak eklendiniz.
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
