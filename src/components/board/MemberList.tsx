"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; email: string; avatar?: string | null };
}

interface MemberListProps {
  boardId: string;
  members: Member[];
  isOwner: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function MemberList({ boardId, members, isOwner, onClose, onUpdate }: MemberListProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "VIEWER">("MEMBER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/boards/${boardId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmail("");
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata olustu");
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Bu uyeyi cikarmak istediginize emin misiniz?")) return;
    await fetch(`/api/boards/${boardId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    onUpdate();
  };

  const roleLabel = (r: string) => {
    switch (r) {
      case "OWNER": return "Sahip";
      case "MEMBER": return "Uye";
      case "VIEWER": return "Izleyici";
      default: return r;
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Board Uyeleri">
      <div className="space-y-4">
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex items-center gap-3">
                <Avatar name={m.user.name} src={m.user.avatar} />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                  {roleLabel(m.role)}
                </span>
                {isOwner && m.role !== "OWNER" && (
                  <button onClick={() => removeMember(m.id)} className="text-xs text-red-500 hover:underline">
                    Cikar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {isOwner && (
          <>
            <hr className="border-gray-200 dark:border-gray-700" />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Uye Davet Et</h3>
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            <form onSubmit={inviteMember} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email adresi..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "MEMBER" | "VIEWER")}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="MEMBER">Uye</option>
                <option value="VIEWER">Izleyici</option>
              </select>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "..." : "Davet Et"}
              </Button>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
