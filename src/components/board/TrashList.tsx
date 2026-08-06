"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { formatDateTime } from "@/lib/date";

interface DeletedCard {
  id: string;
  title: string;
  deletedAt: string;
  list: { id: string; title: string };
  assignees: { user: { id: string; name: string; avatar?: string | null } }[];
}

interface TrashListProps {
  boardId: string;
  isOwner: boolean;
  onClose: () => void;
  onRestore: () => void;
}

export default function TrashList({ boardId, isOwner, onClose, onRestore }: TrashListProps) {
  const [cards, setCards] = useState<DeletedCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/trash`);
      if (res.ok) {
        const data = await res.json();
        setCards(data);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, [boardId]);

  const restoreCard = async (cardId: string) => {
    const res = await fetch(`/api/boards/${boardId}/trash`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId }),
    });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      onRestore();
    }
  };

  const permanentDelete = async (cardId: string) => {
    if (!confirm("This will permanently delete the task. Are you sure?")) return;
    const res = await fetch(`/api/boards/${boardId}/trash`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId }),
    });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Deleted Tasks">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-sm text-[var(--asana-text-secondary)] text-center py-4">Loading...</p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-[var(--asana-text-secondary)] text-center py-4">No deleted tasks</p>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between p-3 rounded-lg bg-[var(--asana-bg)] dark:bg-[#1a1a1a] group"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm font-medium text-[var(--asana-text)] dark:text-gray-200 truncate">
                  {card.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-[var(--asana-text-secondary)]">
                    {card.list.title}
                  </span>
                  <span className="text-xs text-[var(--asana-text-secondary)]">
                    {formatDateTime(card.deletedAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => restoreCard(card.id)}>
                  Restore
                </Button>
                {isOwner && (
                  <button
                    onClick={() => permanentDelete(card.id)}
                    className="p-1.5 text-[var(--asana-text-secondary)] hover:text-red-500 transition"
                    title="Permanently delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
