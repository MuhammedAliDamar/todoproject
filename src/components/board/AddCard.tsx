"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface AddCardProps {
  listId: string;
  onAdd: () => void;
}

export default function AddCard({ listId, onAdd }: AddCardProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, listId }),
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
        className="w-full text-left text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg p-2 transition"
      >
        + Kart Ekle
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-1">
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Kart basligi..."
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        rows={2}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <div className="flex gap-2 mt-1">
        <Button size="sm" type="submit" disabled={loading}>Ekle</Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => { setOpen(false); setTitle(""); }}>Iptal</Button>
      </div>
    </form>
  );
}
