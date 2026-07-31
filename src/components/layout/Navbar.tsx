"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Avatar from "@/components/ui/Avatar";
import NotificationDropdown from "./NotificationDropdown";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] border-b border-[var(--asana-border)] h-14 flex items-center px-4 justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <Link href="/boards" className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="w-8 h-8 bg-gradient-to-br from-[var(--asana-accent)] to-[#e8573a] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="text-lg font-bold text-[var(--asana-text)] dark:text-white">MarkTasks</span>
        </Link>

        {/* Search */}
        <div className="relative hidden sm:block">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--asana-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-64 pl-10 pr-4 py-1.5 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] border border-[var(--asana-border)] rounded-full text-sm text-[var(--asana-text)] dark:text-white placeholder-[var(--asana-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--asana-accent)] focus:border-transparent transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Create button */}
        <Link
          href="/boards"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--asana-accent)] hover:bg-[var(--asana-accent-hover)] text-white rounded-full text-sm font-medium transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create
        </Link>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded-full transition"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <NotificationDropdown />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 p-1 rounded-full hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] transition">
            <Avatar name={user?.name || "U"} size="sm" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-xl shadow-xl border border-[var(--asana-border)] py-1 z-50">
              <div className="px-4 py-3 border-b border-[var(--asana-border)]">
                <p className="font-medium text-[var(--asana-text)] dark:text-white text-sm">{user?.name}</p>
                <p className="text-xs text-[var(--asana-text-secondary)] mt-0.5">{user?.email}</p>
              </div>
              <Link
                href="/account"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--asana-text)] dark:text-[#f5f4f3] hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-[var(--asana-accent)] hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
