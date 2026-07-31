"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TaskCard {
  id: string;
  title: string;
  dueDate: string | null;
}

interface TaskGroup {
  listId: string;
  listTitle: string;
  boardId: string;
  cards: TaskCard[];
}

export default function MyTasksPage() {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/my-tasks")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  const total = groups.reduce((sum, g) => sum + g.cards.length, 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--asana-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[var(--asana-bg)]">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--asana-text)] mb-1">My Tasks</h1>
        <p className="text-sm text-[var(--asana-text-secondary)] mb-6">
          {total} task{total !== 1 ? "s" : ""} assigned to you
        </p>

        {groups.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-[var(--asana-text-secondary)] opacity-40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-[var(--asana-text-secondary)]">No tasks assigned to you yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.listId} className="bg-[var(--asana-card)] rounded-xl border border-[var(--asana-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--asana-border)] flex items-center justify-between">
                  <h2 className="font-semibold text-[var(--asana-text)] text-sm">{group.listTitle}</h2>
                  <Link
                    href={`/board/${group.boardId}`}
                    className="text-xs text-[var(--asana-accent)] hover:underline"
                  >
                    Go to board
                  </Link>
                </div>
                <ul>
                  {group.cards.map((card) => (
                    <li
                      key={card.id}
                      className="px-4 py-3 border-b border-[var(--asana-border)] last:border-0 flex items-center justify-between hover:bg-[var(--asana-bg)] transition"
                    >
                      <span className="text-sm text-[var(--asana-text)]">{card.title}</span>
                      {card.dueDate && (
                        <span className="text-xs text-[var(--asana-text-secondary)] ml-4 shrink-0">
                          {new Date(card.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
