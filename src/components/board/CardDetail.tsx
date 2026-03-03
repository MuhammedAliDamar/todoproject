"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LabelPicker from "./LabelPicker";
import Checklist from "./Checklist";
import ColorPicker from "@/components/shared/ColorPicker";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";

interface Label {
  id: string;
  name: string;
  color: string;
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
  activities: Activity[];
  comments: { id: string; content: string; createdAt: string; user: { id: string; name: string; avatar?: string | null } }[];
  list: { id: string; title: string; boardId: string };
}

interface CardDetailProps {
  cardId: string;
  boardLabels: Label[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function CardDetail({ cardId, boardLabels, onClose, onUpdate }: CardDetailProps) {
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const fetchCard = useCallback(async () => {
    try {
      const res = await fetch(`/api/cards/${cardId}`);
      if (res.ok) {
        const data = await res.json();
        setCard(data);
        setDescription(data.description || "");
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

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
    if (!confirm("Bu karti silmek istediginize emin misiniz?")) return;
    await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    onUpdate();
    onClose();
  };

  if (loading || !card) {
    return (
      <Modal isOpen onClose={onClose} title="Kart Detayi" size="lg">
        <p className="text-gray-500 dark:text-gray-400">Yukleniyor...</p>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <div className="space-y-6">
        {card.coverColor && (
          <div className="h-20 -mx-4 -mt-4 rounded-t-xl" style={{ backgroundColor: card.coverColor }} />
        )}

        <div>
          <p className="text-xs text-gray-400 mb-1">{card.list.title} listesinde</p>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{card.title}</h2>
        </div>

        {card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.labels.map((cl) => (
              <Badge key={cl.label.id} color={cl.label.color} name={cl.label.name} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {/* Description */}
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-2">Aciklama</h3>
              {editingDesc ? (
                <div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={4}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={saveDescription}>Kaydet</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingDesc(false); setDescription(card.description || ""); }}>Iptal</Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditingDesc(true)}
                  className="min-h-[60px] bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition whitespace-pre-wrap"
                >
                  {card.description || "Aciklama eklemek icin tiklayin..."}
                </div>
              )}
            </div>

            {/* Due Date */}
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-2">Son Tarih</h3>
              <input
                type="date"
                value={card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : ""}
                onChange={(e) => updateCard({ dueDate: e.target.value || null })}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Checklists */}
            <Checklist cardId={cardId} checklists={card.checklists} onUpdate={fetchCard} />

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Dosyalar</h3>
                <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>Dosya Ekle</Button>
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
                <div className="space-y-2">
                  {card.attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg group">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                        {att.filename.split(".").pop()?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block">
                          {att.filename}
                        </a>
                        <p className="text-xs text-gray-400">{new Date(att.createdAt).toLocaleDateString("tr-TR")}</p>
                      </div>
                      <button
                        onClick={() => deleteAttachment(att.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Henuz dosya eklenmemis</p>
              )}
            </div>

            {/* Comments */}
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-3">Yorumlar</h3>

              {/* Comment input */}
              <div className="flex gap-2 mb-4">
                {user && <Avatar name={user.name} size="sm" />}
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Yorum yaz..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
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
                        {submittingComment ? "..." : "Gonder"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Comment list */}
              {card.comments.length > 0 && (
                <div className="space-y-3">
                  {card.comments.map((c) => (
                    <div key={c.id} className="flex gap-2 group">
                      <Avatar name={c.user.name} src={c.user.avatar} size="sm" />
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{c.user.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString("tr-TR")}</span>
                            {user?.id === c.user.id && (
                              <button
                                onClick={() => deleteComment(c.id)}
                                className="text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-xs"
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity */}
            {card.activities.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-2">Aktivite</h3>
                <div className="space-y-2">
                  {card.activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-2">
                      <Avatar name={act.user.name} src={act.user.avatar} size="sm" />
                      <div>
                        <p className="text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{act.user.name}</span>{" "}
                          <span className="text-gray-500 dark:text-gray-400">{act.action}</span>
                        </p>
                        <p className="text-xs text-gray-400">{new Date(act.createdAt).toLocaleString("tr-TR")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Eylemler</p>

            <button
              onClick={() => setShowLabels(!showLabels)}
              className="w-full text-left px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition"
            >
              Etiketler
            </button>
            {showLabels && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                <LabelPicker
                  boardLabels={boardLabels}
                  activeLabels={card.labels.map((cl) => cl.label.id)}
                  onToggle={toggleLabel}
                />
              </div>
            )}

            <button
              onClick={() => setShowCover(!showCover)}
              className="w-full text-left px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition"
            >
              Kapak Rengi
            </button>
            {showCover && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                <ColorPicker
                  selected={card.coverColor || ""}
                  onChange={(color) => updateCard({ coverColor: color })}
                />
                {card.coverColor && (
                  <button onClick={() => updateCard({ coverColor: null })} className="mt-2 text-xs text-red-500 hover:underline">
                    Kapagi Kaldir
                  </button>
                )}
              </div>
            )}

            <hr className="my-2 border-gray-200 dark:border-gray-600" />

            <button
              onClick={deleteCard}
              className="w-full text-left px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-sm text-red-600 dark:text-red-400 transition"
            >
              Karti Sil
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
