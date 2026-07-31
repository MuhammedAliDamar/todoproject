"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { formatDate } from "@/lib/date";

interface Notification {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PUT" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded-full transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[var(--asana-accent)] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-xl shadow-xl border border-[var(--asana-border)] z-50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[var(--asana-border)]">
            <h3 className="font-semibold text-[var(--asana-text)] dark:text-white text-sm">Inbox</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[var(--asana-accent)] hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-2 text-[var(--asana-text-secondary)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-sm text-[var(--asana-text-secondary)]">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-[var(--asana-border)] last:border-0 text-sm hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] transition cursor-pointer ${
                    n.isRead ? "" : "bg-[var(--asana-bg)]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="w-2 h-2 bg-[var(--asana-accent)] rounded-full mt-1.5 shrink-0" />}
                    <div className={n.isRead ? "pl-4" : ""}>
                      <p className="text-[var(--asana-text)] dark:text-white">{n.message}</p>
                      <p className="text-xs text-[var(--asana-text-secondary)] mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
