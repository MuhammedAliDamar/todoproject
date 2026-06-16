"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface BoardItem {
  id: string;
  title: string;
  background: string;
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

  useEffect(() => {
    // Erişilebilir tüm board'ları çek (owner + üye olunanlar)
    fetch("/api/boards")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBoards(Array.isArray(data) ? data : []))
      .catch(() => setBoards([]));
  }, [pathname]);

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
            return (
              <Link
                key={board.id}
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
