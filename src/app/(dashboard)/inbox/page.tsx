"use client";

import { useEffect, useState } from "react";

interface Notification {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  boardId: string | null;
  createdAt: string;
}

export default function InboxPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setNotifications(Array.isArray(data) ? data : []);
        fetch("/api/notifications", { method: "PUT" }).catch(() => {});
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--asana-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function typeIcon(type: string) {
    switch (type) {
      case "CARD_ASSIGNED":
        return (
          <div className="w-8 h-8 rounded-full bg-[#f06a6a20] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[var(--asana-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        );
      case "BOARD_INVITE":
        return (
          <div className="w-8 h-8 rounded-full bg-[#4573d220] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[#4573d2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[#6d6e6f20] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[var(--asana-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        );
    }
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[var(--asana-bg)]">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--asana-text)] mb-1">Inbox</h1>
        <p className="text-sm text-[var(--asana-text-secondary)] mb-6">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </p>

        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-[var(--asana-text-secondary)] opacity-40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-[var(--asana-text-secondary)]">No notifications yet</p>
          </div>
        ) : (
          <div className="bg-[var(--asana-card)] rounded-xl border border-[var(--asana-border)] overflow-hidden">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-[var(--asana-border)] last:border-0 flex items-center gap-3 transition ${
                  !n.isRead ? "bg-[var(--asana-accent)]/5" : "hover:bg-[var(--asana-bg)]"
                }`}
              >
                {typeIcon(n.type)}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.isRead ? "font-semibold text-[var(--asana-text)]" : "text-[var(--asana-text)]"}`}>
                    {n.message}
                  </p>
                </div>
                <span className="text-xs text-[var(--asana-text-secondary)] shrink-0 ml-2">
                  {timeAgo(n.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
