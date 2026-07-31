"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

interface OwnedBoard {
  id: string;
  title: string;
  background: string;
  userId: string;
}

interface SlackInfo {
  connected: boolean;
  teamName: string | null;
}

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slackStatus = searchParams.get("slack");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [boards, setBoards] = useState<OwnedBoard[]>([]);
  const [slackInfo, setSlackInfo] = useState<SlackInfo>({ connected: false, teamName: null });

  const fetchBoards = useCallback(async () => {
    const res = await fetch("/api/boards");
    if (res.ok) {
      const data: OwnedBoard[] = await res.json();
      setBoards(data.filter((b) => b.userId === user?.id));
    }
  }, [user?.id]);

  const fetchSlackStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/account/slack");
      if (res.ok) {
        const data = await res.json();
        setSlackInfo(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchBoards();
    fetchSlackStatus();
  }, [fetchBoards, fetchSlackStatus]);

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
    if (!confirm(`Delete project "${title}"?`)) return;
    const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
    if (res.ok) {
      await fetchBoards();
      router.refresh();
    }
  };

  const connectSlack = () => {
    window.location.href = "/api/slack/install";
  };

  const disconnectSlack = async () => {
    if (!confirm("Disconnect Slack?")) return;
    await fetch("/api/account/slack", { method: "DELETE" });
    setSlackInfo({ connected: false, teamName: null });
  };

  const inputClass =
    "w-full px-3 py-2 border border-[var(--asana-border)] rounded-lg text-sm focus:ring-1 focus:ring-[var(--asana-accent)] outline-none bg-transparent text-[var(--asana-text)] dark:text-white";

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--asana-text)] dark:text-white">Settings</h1>
        {user && <p className="text-sm text-[var(--asana-text-secondary)] mt-1">{user.name} · {user.email}</p>}
      </div>

      {/* Slack Integration */}
      <section className="bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-xl border border-[var(--asana-border)] p-5">
        <h2 className="font-semibold text-[var(--asana-text)] dark:text-white text-sm mb-3">Slack Integration</h2>

        {slackStatus === "connected" && (
          <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">Slack connected successfully!</p>
          </div>
        )}
        {slackStatus === "error" && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">Failed to connect Slack. Please try again.</p>
          </div>
        )}

        {slackInfo.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded-lg">
              <div className="w-10 h-10 bg-[#4A154B] rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--asana-green)] rounded-full" />
                  <span className="text-sm font-medium text-[var(--asana-text)] dark:text-white">Connected</span>
                </div>
                {slackInfo.teamName && (
                  <p className="text-xs text-[var(--asana-text-secondary)] mt-0.5">{slackInfo.teamName}</p>
                )}
              </div>
              <button
                onClick={disconnectSlack}
                className="text-xs text-[var(--asana-accent)] hover:underline"
              >
                Disconnect
              </button>
            </div>
            <p className="text-xs text-[var(--asana-text-secondary)]">
              Task assignments and comments will send DM notifications to team members on Slack.
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-[var(--asana-text-secondary)] mb-4">
              Connect Slack to receive DM notifications when tasks are assigned or commented on — across all projects.
            </p>
            <Button onClick={connectSlack} className="flex items-center gap-2 mx-auto">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
              </svg>
              Connect with Slack
            </Button>
          </div>
        )}
      </section>

      {/* Change password */}
      <section className="bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-xl border border-[var(--asana-border)] p-5">
        <h2 className="font-semibold text-[var(--asana-text)] dark:text-white text-sm mb-3">Change Password</h2>
        {pwError && <p className="text-sm text-[var(--asana-accent)] mb-2">{pwError}</p>}
        {pwSuccess && <p className="text-sm text-[var(--asana-green)] mb-2">{pwSuccess}</p>}
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

      {/* Projects */}
      <section className="bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-xl border border-[var(--asana-border)] p-5">
        <h2 className="font-semibold text-[var(--asana-text)] dark:text-white text-sm mb-3">Your Projects</h2>
        {boards.length === 0 ? (
          <p className="text-sm text-[var(--asana-text-secondary)]">You don&apos;t own any projects</p>
        ) : (
          <div className="space-y-1">
            {boards.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.background }} />
                  <span className="text-sm text-[var(--asana-text)] dark:text-white truncate">{b.title}</span>
                </div>
                <button
                  onClick={() => deleteBoard(b.id, b.title)}
                  className="text-xs text-[var(--asana-accent)] hover:underline shrink-0 ml-2"
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
