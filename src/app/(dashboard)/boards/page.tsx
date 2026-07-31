"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  const [background, setBackground] = useState("#f06a6a");
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
        setBackground("#f06a6a");
        fetchBoards();
      }
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--asana-text)] dark:text-white">Projects</h1>
          <p className="text-sm text-[var(--asana-text-secondary)] mt-1">Manage your projects and tasks</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--asana-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : boards.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--asana-text-secondary)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[var(--asana-text)] dark:text-white mb-2">No projects yet</h3>
          <p className="text-[var(--asana-text-secondary)] mb-6">Create your first project to start managing tasks</p>
          <Button onClick={() => setShowCreate(true)}>Create Your First Project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/board/${board.id}`}
              className="group bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-xl border border-[var(--asana-border)] hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md transition overflow-hidden"
            >
              <div className="h-2" style={{ backgroundColor: board.background }} />
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: board.background }}>
                    {board.title.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="font-medium text-[var(--asana-text)] dark:text-white group-hover:text-[var(--asana-accent)] transition">{board.title}</h3>
                    <p className="text-xs text-[var(--asana-text-secondary)]">{board._count.lists} sections</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Project">
        <form onSubmit={createBoard} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--asana-text)] dark:text-white mb-1">Project Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--asana-border)] rounded-lg focus:ring-2 focus:ring-[var(--asana-accent)] focus:border-transparent outline-none bg-transparent text-[var(--asana-text)] dark:text-white"
              placeholder="Enter project name..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--asana-text)] dark:text-white mb-2">Color</label>
            <ColorPicker selected={background} onChange={setBackground} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={creating || !title.trim()}>
              {creating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
