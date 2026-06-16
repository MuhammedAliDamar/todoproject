"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

interface OwnedBoard {
  id: string;
  title: string;
  background: string;
  userId: string;
}

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Şifre değiştirme
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // Panolar
  const [boards, setBoards] = useState<OwnedBoard[]>([]);

  const fetchBoards = useCallback(async () => {
    const res = await fetch("/api/boards");
    if (res.ok) {
      const data: OwnedBoard[] = await res.json();
      // Sadece sahibi olduğu panolar silinebilir
      setBoards(data.filter((b) => b.userId === user?.id));
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPwSuccess("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setPwLoading(false);
    }
  };

  const deleteBoard = async (boardId: string, title: string) => {
    if (!confirm(`Delete board "${title}"?`)) return;
    const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
    if (res.ok) {
      await fetchBoards();
      router.refresh();
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Account Settings</h1>
        {user && <p className="text-sm text-gray-500 dark:text-gray-400">{user.name} · {user.email}</p>}
      </div>

      {/* Change password */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-3">Change Password</h2>
        {pwError && <p className="text-sm text-red-500 dark:text-red-400 mb-2">{pwError}</p>}
        {pwSuccess && <p className="text-sm text-green-600 dark:text-green-400 mb-2">{pwSuccess}</p>}
        <form onSubmit={changePassword} className="space-y-2 max-w-sm">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className={inputClass}
            autoComplete="new-password"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className={inputClass}
            autoComplete="new-password"
          />
          <Button type="submit" size="sm" disabled={pwLoading}>
            {pwLoading ? "..." : "Update Password"}
          </Button>
        </form>
      </section>

      {/* Boards */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-3">Your Boards</h2>
        {boards.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">You don&apos;t own any boards</p>
        ) : (
          <div className="space-y-2">
            {boards.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded shrink-0" style={{ backgroundColor: b.background }} />
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{b.title}</span>
                </div>
                <button
                  onClick={() => deleteBoard(b.id, b.title)}
                  className="text-xs text-red-500 hover:underline shrink-0 ml-2"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
