"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface AddListProps {
  boardId: string;
  onAdd: () => void;
}

export default function AddList({ boardId, onAdd }: AddListProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, boardId }),
      });
      setTitle("");
      setOpen(false);
      onAdd();
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex-shrink-0 w-72 bg-white/30 hover:bg-white/50 text-white rounded-xl p-3 text-sm font-medium text-left transition"
      >
        + Liste Ekle
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-72 bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Liste basligi..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" type="submit" disabled={loading}>Ekle</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => { setOpen(false); setTitle(""); }}>Iptal</Button>
        </div>
      </form>
    </div>
  );
}
