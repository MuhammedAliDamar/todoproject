"use client";

import { useEffect, useState } from "react";

interface Website {
  id: string;
  name: string;
  domain: string | null;
  publicKey: string;
  color: string;
  welcomeMessage: string;
  operatorName: string;
  position: string;
  active: boolean;
  _count?: { conversations: number; visitors: number };
}

export default function WebsitesPage() {
  const [sites, setSites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [editing, setEditing] = useState<Website | null>(null);

  const load = () =>
    fetch("/api/chat/websites")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSites(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/chat/websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, domain }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      setDomain("");
      load();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--asana-text)] mb-1">Web Siteleri</h1>
      <p className="text-sm text-[var(--asana-text-secondary)] mb-6">
        Her site için bir chat kutusu oluşturun ve embed kodunu sitenize ekleyin.
      </p>

      {/* Oluştur */}
      <div className="bg-[var(--asana-bg-white)] border border-[var(--asana-border)] rounded-xl p-4 mb-6 flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-[var(--asana-text-secondary)] mb-1">Site adı</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Şirket Sitesi"
            className="w-full px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)]"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-[var(--asana-text-secondary)] mb-1">Alan adı (opsiyonel)</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ornek.com"
            className="w-full px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)]"
          />
        </div>
        <button
          onClick={create}
          disabled={creating || !name.trim()}
          className="px-4 py-2 rounded-lg bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white text-sm font-medium disabled:opacity-50"
        >
          {creating ? "Ekleniyor…" : "Site Ekle"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--asana-text-secondary)]">Yükleniyor…</p>
      ) : sites.length === 0 ? (
        <p className="text-sm text-[var(--asana-text-secondary)]">Henüz site yok. Yukarıdan ekleyin.</p>
      ) : (
        <div className="space-y-4">
          {sites.map((s) => (
            <WebsiteCard key={s.id} site={s} onChange={load} onEdit={() => setEditing(s)} />
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          site={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function WebsiteCard({ site, onChange, onEdit }: { site: Website; onChange: () => void; onEdit: () => void }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<!-- MarkTasks Chat -->
<script>window.$marktasks={websiteId:"${site.publicKey}"};</script>
<script async src="${origin}/widget.js"></script>`;

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const regenerate = async () => {
    if (!confirm("Yeni anahtar üretilsin mi? Eski embed kodu çalışmayı durdurur.")) return;
    await fetch(`/api/chat/websites/${site.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerate: true }),
    });
    onChange();
  };

  const remove = async () => {
    if (!confirm("Bu site arşivlensin mi? (Kayıtlar korunur, widget devre dışı kalır)")) return;
    await fetch(`/api/chat/websites/${site.id}`, { method: "DELETE" });
    onChange();
  };

  return (
    <div className="bg-[var(--asana-bg-white)] border border-[var(--asana-border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full" style={{ background: site.color }} />
          <div>
            <div className="font-semibold text-[var(--asana-text)] flex items-center gap-2">
              {site.name}
              {!site.active && <span className="text-xs text-amber-600">(pasif)</span>}
            </div>
            <div className="text-xs text-[var(--asana-text-secondary)]">{site.domain || "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--asana-text-secondary)]">
          <span>{site._count?.conversations ?? 0} açık</span>
          <span>{site._count?.visitors ?? 0} ziyaretçi</span>
          <button onClick={onEdit} className="text-[var(--asana-blue)] hover:underline">Ayarlar</button>
          <button onClick={regenerate} className="hover:underline">Anahtar yenile</button>
          <button onClick={remove} className="text-red-500 hover:underline">Arşivle</button>
        </div>
      </div>

      <div className="relative">
        <pre className="bg-[#1e1f21] text-[#d6d6d6] text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{snippet}</pre>
        <button
          onClick={copy}
          className="absolute top-2 right-2 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs"
        >
          {copied ? "Kopyalandı ✓" : "Kopyala"}
        </button>
      </div>
    </div>
  );
}

function EditModal({ site, onClose, onSaved }: { site: Website; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: site.name,
    color: site.color,
    welcomeMessage: site.welcomeMessage,
    operatorName: site.operatorName,
    position: site.position,
    active: site.active,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/chat/websites/${site.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) onSaved();
  };

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--asana-bg-white)] rounded-xl p-5 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[var(--asana-text)] mb-4">Widget Ayarları</h2>
        <div className="space-y-3">
          <Field label="Site adı">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inp} />
          </Field>
          <Field label="Operatör adı">
            <input value={form.operatorName} onChange={(e) => set("operatorName", e.target.value)} className={inp} />
          </Field>
          <Field label="Karşılama mesajı">
            <textarea value={form.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} rows={2} className={inp} />
          </Field>
          <div className="flex gap-3">
            <Field label="Renk">
              <input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="w-14 h-9 rounded border border-[var(--asana-border)] bg-transparent" />
            </Field>
            <Field label="Konum">
              <select value={form.position} onChange={(e) => set("position", e.target.value)} className={inp}>
                <option value="right">Sağ alt</option>
                <option value="left">Sol alt</option>
              </select>
            </Field>
            <Field label="Durum">
              <label className="flex items-center gap-2 text-sm text-[var(--asana-text)] mt-2">
                <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
                Aktif
              </label>
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--asana-text-secondary)] hover:bg-[var(--asana-bg)]">
            İptal
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white text-sm font-medium disabled:opacity-50">
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp =
  "w-full px-3 py-2 rounded-lg border border-[var(--asana-border)] bg-transparent text-[var(--asana-text)] text-sm outline-none focus:border-[var(--asana-accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-medium text-[var(--asana-text-secondary)] mb-1">{label}</label>
      {children}
    </div>
  );
}
