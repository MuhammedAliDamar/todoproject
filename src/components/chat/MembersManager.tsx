"use client";

import { useEffect, useState } from "react";

interface Member {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: "owner" | "member";
  memberId?: string;
}

/**
 * Site sahibinin operatör (kullanıcı) atadığı/kaldırdığı bölüm.
 * Hem /chat (SitesModal) hem /websites (EditModal) tarafından kullanılır.
 *
 * @param defaultOpen  true ise bölüm açık başlar (edit modalı için).
 * @param embedded     true ise başlık/aç-kapa toggle'ı olmadan doğrudan gösterilir.
 */
export default function MembersManager({
  websiteId,
  defaultOpen = false,
  embedded = false,
}: {
  websiteId: string;
  defaultOpen?: boolean;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || embedded);
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
  }, [open, websiteId]);

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
      setErr(d.error || "Could not add");
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

  const panel = (
    <div className="mt-2 space-y-2">
      {owner && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--asana-text)]">{owner.name} · {owner.email}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--asana-bg)] text-[var(--asana-text-secondary)]">owner</span>
        </div>
      )}
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between text-xs">
          <span className="text-[var(--asana-text)]">{m.name} · {m.email}</span>
          <button onClick={() => remove(m.id)} className="text-red-500 hover:underline text-[11px]">remove</button>
        </div>
      ))}
      {members.length === 0 && (
        <p className="text-[11px] text-[var(--asana-text-secondary)]">No operators assigned yet.</p>
      )}
      <div className="flex gap-1">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="user@email.com"
          className="flex-1 text-xs px-2 py-1.5 rounded border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] outline-none focus:border-[var(--asana-accent)]"
        />
        <button onClick={add} disabled={busy || !email.trim()} className="text-xs px-2.5 py-1.5 rounded bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white disabled:opacity-50">
          Assign
        </button>
      </div>
      {err && <p className="text-[11px] text-red-500">{err}</p>}
    </div>
  );

  // Edit modalı: başlıklı, her zaman açık
  if (embedded) {
    return (
      <div>
        <label className="block text-xs font-medium text-[var(--asana-text-secondary)] mb-1">
          Operators (add / remove users)
        </label>
        {panel}
      </div>
    );
  }

  // /chat SitesModal: aç-kapa toggle'lı
  return (
    <div className="mt-2 pt-2 border-t border-[var(--asana-border)]">
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-[var(--asana-blue)] hover:underline">
        {open ? "▾ Operators" : "▸ Operators (assign users)"}
      </button>
      {open && panel}
    </div>
  );
}
