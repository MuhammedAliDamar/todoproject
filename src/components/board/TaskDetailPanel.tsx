"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LabelPicker from "./LabelPicker";
import Checklist from "./Checklist";
import ColorPicker from "@/components/shared/ColorPicker";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatDateTime } from "@/lib/date";

interface Label {
  id: string;
  name: string;
  color: string;
}

interface BoardUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface Activity {
  id: string;
  action: string;
  createdAt: string;
  user: { id: string; name: string; avatar?: string | null };
}

interface CardData {
  id: string;
  title: string;
  description: string | null;
  coverColor: string | null;
  dueDate: string | null;
  labels: { label: Label }[];
  checklists: { id: string; title: string; items: { id: string; content: string; isCompleted: boolean }[] }[];
  attachments: { id: string; filename: string; url: string; createdAt: string }[];
  assignees: { user: BoardUser }[];
  activities: Activity[];
  comments: { id: string; content: string; createdAt: string; user: { id: string; name: string; avatar?: string | null } }[];
  list: { id: string; title: string; boardId: string };
}

interface TaskDetailPanelProps {
  cardId: string;
  boardLabels: Label[];
  boardMembers: BoardUser[];
  isOwner: boolean;
  canDelete: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskDetailPanel({ cardId, boardLabels, boardMembers, isOwner, canDelete, onClose, onUpdate }: TaskDetailPanelProps) {
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState("");
  const [showLabels, setShowLabels] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [showAssignees, setShowAssignees] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "comments" | "activity">("details");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const fetchCard = useCallback(async () => {
    try {
      const res = await fetch(`/api/cards/${cardId}`);
      if (res.ok) {
        const data = await res.json();
        setCard(data);
        setDescription(data.description || "");
        setTitleText(data.title || "");
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const updateCard = async (data: Record<string, unknown>) => {
    await fetch(`/api/cards/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchCard();
    onUpdate();
  };

  const saveDescription = () => {
    updateCard({ description });
    setEditingDesc(false);
  };

  const saveTitle = () => {
    const trimmed = titleText.trim();
    if (trimmed && trimmed !== card?.title) {
      updateCard({ title: trimmed });
    } else {
      setTitleText(card?.title || "");
    }
    setEditingTitle(false);
  };

  const toggleAssignee = async (assigneeId: string, isAssigned: boolean) => {
    await fetch(`/api/cards/${cardId}/assignees`, {
      method: isAssigned ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    });
    fetchCard();
    onUpdate();
  };

  const toggleLabel = async (labelId: string) => {
    await fetch(`/api/cards/${cardId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelId }),
    });
    fetchCard();
    onUpdate();
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { filename, url } = await res.json();
      await fetch(`/api/cards/${cardId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, url }),
      });
      fetchCard();
      onUpdate();
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    await fetch(`/api/cards/${cardId}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    fetchCard();
    onUpdate();
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await fetch(`/api/cards/${cardId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      setCommentText("");
      fetchCard();
    } catch { /* ignore */ } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    await fetch(`/api/cards/${cardId}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    fetchCard();
  };

  const deleteCard = async () => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    onUpdate();
    onClose();
  };

  if (loading || !card) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/30" onClick={onClose} />
        <div className="w-[560px] bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] shadow-2xl slide-panel flex items-center justify-center">
          <p className="text-[var(--asana-text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-[560px] bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] shadow-2xl slide-panel flex flex-col h-full overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--asana-border)] shrink-0">
          <div className="flex items-center gap-2 text-xs text-[var(--asana-text-secondary)]">
            <span className="px-2 py-0.5 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded">{card.list.title}</span>
          </div>
          <div className="flex items-center gap-1">
            {canDelete && (
              <button
                onClick={deleteCard}
                className="p-1.5 text-[var(--asana-text-secondary)] hover:text-[var(--asana-accent)] hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded transition"
                title="Delete task"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4">
            {/* Cover */}
            {card.coverColor && (
              <div className="h-16 -mx-6 -mt-4 mb-4" style={{ backgroundColor: card.coverColor }} />
            )}

            {/* Title */}
            {editingTitle ? (
              <input
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
                  if (e.key === "Escape") { setTitleText(card.title); setEditingTitle(false); }
                }}
                autoFocus
                className="w-full text-xl font-semibold px-1 py-0.5 border-b-2 border-[var(--asana-accent)] outline-none bg-transparent text-[var(--asana-text)] dark:text-white"
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="text-xl font-semibold text-[var(--asana-text)] dark:text-white cursor-text hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded px-1 py-0.5 -mx-1 transition"
              >
                {card.title}
              </h2>
            )}

            {/* Meta fields */}
            <div className="mt-4 space-y-3">
              {/* Assignees */}
              <div className="flex items-start gap-4">
                <span className="w-20 shrink-0 text-xs font-medium text-[var(--asana-text-secondary)] pt-1.5">Assignee</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {card.assignees.map((a) => (
                      <div key={a.user.id} className="flex items-center gap-1.5 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded-full pl-1 pr-2.5 py-0.5">
                        <Avatar name={a.user.name} src={a.user.avatar} size="sm" />
                        <span className="text-xs text-[var(--asana-text)] dark:text-white">{a.user.name}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setShowAssignees(!showAssignees)}
                      className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-[var(--asana-accent)] transition"
                    >
                      <svg className="w-3.5 h-3.5 text-[var(--asana-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  {showAssignees && (
                    <div className="mt-2 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded-lg p-2 space-y-0.5">
                      {boardMembers.map((m) => {
                        const isAssigned = card.assignees.some((a) => a.user.id === m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleAssignee(m.id, isAssigned)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3b3d] transition text-left"
                          >
                            <Avatar name={m.name} src={m.avatar} size="sm" />
                            <span className="flex-1 text-sm text-[var(--asana-text)] dark:text-white truncate">{m.name}</span>
                            {isAssigned && (
                              <svg className="w-4 h-4 text-[var(--asana-green)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Due date */}
              <div className="flex items-center gap-4">
                <span className="w-20 shrink-0 text-xs font-medium text-[var(--asana-text-secondary)]">Due date</span>
                <input
                  type="date"
                  value={card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateCard({ dueDate: e.target.value || null })}
                  className="px-2 py-1 text-sm bg-transparent border border-[var(--asana-border)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--asana-accent)] text-[var(--asana-text)] dark:text-white"
                />
              </div>

              {/* Labels */}
              <div className="flex items-start gap-4">
                <span className="w-20 shrink-0 text-xs font-medium text-[var(--asana-text-secondary)] pt-1">Labels</span>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1">
                    {card.labels.map((cl) => (
                      <Badge key={cl.label.id} color={cl.label.color} name={cl.label.name} />
                    ))}
                    <button
                      onClick={() => setShowLabels(!showLabels)}
                      className="px-2 py-0.5 text-xs text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded transition"
                    >
                      + Add label
                    </button>
                  </div>
                  {showLabels && (
                    <div className="mt-2 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded-lg p-2">
                      <LabelPicker
                        boardLabels={boardLabels}
                        activeLabels={card.labels.map((cl) => cl.label.id)}
                        onToggle={toggleLabel}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Cover */}
              <div className="flex items-start gap-4">
                <span className="w-20 shrink-0 text-xs font-medium text-[var(--asana-text-secondary)] pt-1">Cover</span>
                <div>
                  <button
                    onClick={() => setShowCover(!showCover)}
                    className="px-2 py-0.5 text-xs text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded transition"
                  >
                    {card.coverColor ? "Change cover" : "Add cover"}
                  </button>
                  {showCover && (
                    <div className="mt-2 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded-lg p-2">
                      <ColorPicker
                        selected={card.coverColor || ""}
                        onChange={(color) => updateCard({ coverColor: color })}
                      />
                      {card.coverColor && (
                        <button onClick={() => updateCard({ coverColor: null })} className="mt-2 text-xs text-[var(--asana-accent)] hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--asana-border)] my-4" />

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-[var(--asana-border)]">
              {(["details", "comments", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                    activeTab === tab
                      ? "border-[var(--asana-text)] text-[var(--asana-text)] dark:text-white dark:border-white"
                      : "border-transparent text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white"
                  }`}
                >
                  {tab === "details" ? "Details" : tab === "comments" ? `Comments (${card.comments.length})` : "Activity"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "details" && (
              <div className="space-y-5">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-[var(--asana-text-secondary)] uppercase mb-2">Description</h4>
                  {editingDesc ? (
                    <div>
                      <textarea
                        ref={autoGrow}
                        value={description}
                        onChange={(e) => { setDescription(e.target.value); autoGrow(e.target); }}
                        className="w-full min-h-[5rem] px-3 py-2 border border-[var(--asana-border)] rounded-lg text-sm focus:ring-1 focus:ring-[var(--asana-accent)] outline-none resize-none bg-transparent text-[var(--asana-text)] dark:text-white"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={saveDescription}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingDesc(false); setDescription(card.description || ""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingDesc(true)}
                      className="min-h-[48px] bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded-lg p-3 text-sm text-[var(--asana-text)] dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-[#3a3b3d] transition whitespace-pre-wrap"
                    >
                      {card.description || "Add a description..."}
                    </div>
                  )}
                </div>

                {/* Checklists */}
                <Checklist cardId={cardId} checklists={card.checklists} onUpdate={fetchCard} />

                {/* Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-[var(--asana-text-secondary)] uppercase">Attachments</h4>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white transition"
                    >
                      + Add
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {card.attachments.length > 0 ? (
                    <div className="space-y-1.5">
                      {card.attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-3 p-2 bg-[var(--asana-bg)] dark:bg-[#1a1a1a] rounded-lg group">
                          <div className="w-9 h-9 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-[10px] font-medium text-[var(--asana-text-secondary)]">
                            {att.filename.split(".").pop()?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--asana-blue)] hover:underline truncate block">
                              {att.filename}
                            </a>
                            <p className="text-xs text-[var(--asana-text-secondary)]">{formatDate(att.createdAt)}</p>
                          </div>
                          {isOwner && (
                            <button
                              onClick={() => deleteAttachment(att.id)}
                              className="text-[var(--asana-text-secondary)] hover:text-[var(--asana-accent)] opacity-0 group-hover:opacity-100 transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--asana-text-secondary)]">No attachments</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "comments" && (
              <div className="space-y-4">
                {/* Comment input */}
                <div className="flex gap-2">
                  {user && <Avatar name={user.name} size="sm" />}
                  <div className="flex-1">
                    <textarea
                      value={commentText}
                      onChange={(e) => { setCommentText(e.target.value); autoGrow(e.target); }}
                      placeholder="Write a comment..."
                      className="w-full min-h-[3rem] px-3 py-2 border border-[var(--asana-border)] rounded-lg text-sm focus:ring-1 focus:ring-[var(--asana-accent)] outline-none resize-none bg-transparent text-[var(--asana-text)] dark:text-white placeholder-[var(--asana-text-secondary)]"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          addComment();
                        }
                      }}
                    />
                    {commentText.trim() && (
                      <div className="flex justify-end mt-1">
                        <Button size="sm" onClick={addComment} disabled={submittingComment}>
                          {submittingComment ? "..." : "Comment"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {card.comments.map((c) => (
                  <div key={c.id} className="flex gap-2 group">
                    <Avatar name={c.user.name} src={c.user.avatar} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-[var(--asana-text)] dark:text-white">{c.user.name}</span>
                        <span className="text-xs text-[var(--asana-text-secondary)]">{formatDateTime(c.createdAt)}</span>
                        {isOwner && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="text-xs text-[var(--asana-text-secondary)] hover:text-[var(--asana-accent)] opacity-0 group-hover:opacity-100 transition ml-auto"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[var(--asana-text)] dark:text-[#d1d1d1] whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}

                {card.comments.length === 0 && (
                  <p className="text-sm text-[var(--asana-text-secondary)] text-center py-4">No comments yet</p>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="space-y-3">
                {card.activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-2">
                    <Avatar name={act.user.name} src={act.user.avatar} size="sm" />
                    <div>
                      <p className="text-sm">
                        <span className="font-medium text-[var(--asana-text)] dark:text-white">{act.user.name}</span>{" "}
                        <span className="text-[var(--asana-text-secondary)]">{act.action}</span>
                      </p>
                      <p className="text-xs text-[var(--asana-text-secondary)]">{formatDateTime(act.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {card.activities.length === 0 && (
                  <p className="text-sm text-[var(--asana-text-secondary)] text-center py-4">No activity yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
