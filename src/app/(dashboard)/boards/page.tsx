"use client";

import { useState, useEffect, useCallback } from "react";
import BoardCard from "@/components/board/BoardCard";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ColorPicker from "@/components/shared/ColorPicker";

interface Board {
  id: string;
  title: string;
  background: string;
  _count: { lists: number };
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [background, setBackground] = useState("#0079bf");
  const [creating, setCreating] = useState(false);

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch("/api/boards");
      if (res.ok) {
        const data = await res.json();
        setBoards(data);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const createBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, background }),
      });
      if (res.ok) {
        setShowCreate(false);
        setTitle("");
        setBackground("#0079bf");
        fetchBoards();
      }
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Boardlarim</h1>
        <Button onClick={() => setShowCreate(true)}>+ Yeni Board</Button>
      </div>

      {loading ? (
        <div className="text-gray-500 dark:text-gray-400">Yukleniyor...</div>
      ) : boards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Henuz board olusturmadiniz</p>
          <Button onClick={() => setShowCreate(true)}>Ilk Board&apos;unuzu Olusturun</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              id={board.id}
              title={board.title}
              background={board.background}
              listCount={board._count.lists}
            />
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Yeni Board Olustur">
        <form onSubmit={createBoard} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Board Adi</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Proje adi..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Arkaplan Rengi</label>
            <ColorPicker selected={background} onChange={setBackground} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Iptal
            </Button>
            <Button type="submit" disabled={creating || !title.trim()}>
              {creating ? "Olusturuluyor..." : "Olustur"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
