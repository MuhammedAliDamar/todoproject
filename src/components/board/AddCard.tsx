"use client";

import { useState, useRef } from "react";
import Button from "@/components/ui/Button";

interface AddCardProps {
  listId: string;
  onAdd: () => void;
}

export default function AddCard({ listId, onAdd }: AddCardProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

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
      if (taRef.current) taRef.current.style.height = "auto";
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
        className="w-full text-left text-sm text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#3a3b3d] rounded-lg p-2 transition flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-1">
      <textarea
        ref={taRef}
        value={title}
        onChange={(e) => { setTitle(e.target.value); autoGrow(e.target); }}
        placeholder="Task name..."
        className="w-full min-h-[3rem] px-3 py-2 border border-[var(--asana-border)] rounded-lg text-sm focus:ring-1 focus:ring-[var(--asana-accent)] outline-none resize-none overflow-hidden bg-transparent text-[var(--asana-text)] dark:text-white"
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
        <Button size="sm" type="submit" disabled={loading}>Add</Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => { setOpen(false); setTitle(""); }}>Cancel</Button>
      </div>
    </form>
  );
}
