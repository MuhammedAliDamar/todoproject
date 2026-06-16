"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface BoardItem {
  id: string;
  title: string;
  background: string;
}

interface TaskGroup {
  listId: string;
  listTitle: string;
  boardId: string;
  cards: { id: string; title: string; dueDate: string | null }[];
}

const navItems = [
  {
    label: "Boards",
    href: "/boards",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [tasks, setTasks] = useState<TaskGroup[]>([]);
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Erişilebilir tüm board'ları çek (owner + üye olunanlar)
    fetch("/api/boards")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBoards(Array.isArray(data) ? data : []))
      .catch(() => setBoards([]));

    // Bana atanmış kartlar (liste bazında gruplu)
    fetch("/api/my-tasks")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));
  }, [pathname]);

  // Sadece "ToDo" listesindeki task'lar gösterilsin
  const todoTasks = tasks.filter((g) => g.listTitle.trim().toLowerCase() === "todo");

  // Task gruplarını ait oldukları pano altına indeksle
  const tasksByBoard = todoTasks.reduce<Record<string, TaskGroup[]>>((acc, g) => {
    (acc[g.boardId] ||= []).push(g);
    return acc;
  }, {});

  const toggleBoard = (boardId: string) =>
    setExpandedBoards((prev) => {
      const next = new Set(prev);
      next.has(boardId) ? next.delete(boardId) : next.add(boardId);
      return next;
    });

  const MAX_CARDS = 4;

  return (
    <aside className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-3.5rem)] p-4 hidden md:block">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Your Boards
        </p>
        <nav className="space-y-1">
          {boards.map((board) => {
            const isActive = pathname === `/board/${board.id}`;
            const groups = tasksByBoard[board.id] || [];
            const boardCardCount = groups.reduce((sum, g) => sum + g.cards.length, 0);
            const isExpanded = expandedBoards.has(board.id);

            // Pano altında gösterilecek task'ları MAX_CARDS ile sınırla (liste başlıklarını koruyarak)
            let budget = isExpanded ? Infinity : MAX_CARDS;
            const visibleGroups = groups
              .map((g) => {
                const cards = g.cards.slice(0, Math.max(0, budget));
                budget -= cards.length;
                return { ...g, cards };
              })
              .filter((g) => g.cards.length > 0);

            return (
              <div key={board.id}>
                <Link
                  href={`/board/${board.id}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded shrink-0"
                    style={{ backgroundColor: board.background }}
                  />
                  <span className="truncate">{board.title}</span>
                </Link>

                {/* Bu panoya ait, bana atanmış task'lar — pano altında iç içe */}
                {boardCardCount > 0 && (
                  <div className="ml-4 mt-1 mb-2 pl-2 border-l border-gray-200 dark:border-gray-700 space-y-2">
                    {visibleGroups.map((group) => (
                      <div key={group.listId}>
                        <p className="px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">
                          {group.listTitle}
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {group.cards.map((card) => (
                            <li key={card.id}>
                              <Link
                                href={`/board/${board.id}`}
                                className="flex items-start gap-2 px-2 py-1 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                <span className="truncate">{card.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {boardCardCount > MAX_CARDS && (
                      <button
                        onClick={() => toggleBoard(board.id)}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {isExpanded ? "Show less" : `Show more (${boardCardCount - MAX_CARDS})`}
                        <svg
                          className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {boards.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No boards yet</p>
          )}
        </nav>
      </div>
    </aside>
  );
}
