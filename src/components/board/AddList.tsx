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
        className="flex-shrink-0 w-72 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#2e2f31] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm font-medium text-[var(--asana-text-secondary)] text-left transition flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Section
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-72 bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-xl p-3 border border-[var(--asana-border)]">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Section name..."
          className="w-full px-3 py-2 border border-[var(--asana-border)] rounded-lg text-sm focus:ring-1 focus:ring-[var(--asana-accent)] outline-none mb-2 bg-transparent text-[var(--asana-text)] dark:text-white"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" type="submit" disabled={loading}>Add</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => { setOpen(false); setTitle(""); }}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
