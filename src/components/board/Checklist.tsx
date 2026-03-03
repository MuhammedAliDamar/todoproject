"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface ChecklistItemData {
  id: string;
  content: string;
  isCompleted: boolean;
}

interface ChecklistData {
  id: string;
  title: string;
  items: ChecklistItemData[];
}

interface ChecklistProps {
  cardId: string;
  checklists: ChecklistData[];
  onUpdate: () => void;
}

export default function Checklist({ cardId, checklists, onUpdate }: ChecklistProps) {
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [newItemContent, setNewItemContent] = useState<Record<string, string>>({});

  const addChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    await fetch(`/api/cards/${cardId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newChecklistTitle }),
    });
    setNewChecklistTitle("");
    setShowAddChecklist(false);
    onUpdate();
  };

  const addItem = async (checklistId: string) => {
    const content = newItemContent[checklistId];
    if (!content?.trim()) return;
    await fetch(`/api/cards/${cardId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemContent: content, checklistId }),
    });
    setNewItemContent((prev) => ({ ...prev, [checklistId]: "" }));
    onUpdate();
  };

  const toggleItem = async (itemId: string, isCompleted: boolean) => {
    await fetch(`/api/cards/${cardId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, isCompleted: !isCompleted }),
    });
    onUpdate();
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/cards/${cardId}/checklist`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    onUpdate();
  };

  const deleteChecklist = async (checklistId: string) => {
    await fetch(`/api/cards/${cardId}/checklist`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklistId }),
    });
    onUpdate();
  };

  return (
    <div className="space-y-4">
      {checklists.map((cl) => {
        const completed = cl.items.filter((i) => i.isCompleted).length;
        const total = cl.items.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        return (
          <div key={cl.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {cl.title}
              </h4>
              <button onClick={() => deleteChecklist(cl.id)} className="text-xs text-gray-400 hover:text-red-500">Sil</button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{percent}%</span>
              <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${percent === 100 ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              {cl.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={() => toggleItem(item.id, item.isCompleted)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm flex-1 ${item.isCompleted ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}>
                    {item.content}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newItemContent[cl.id] || ""}
                onChange={(e) => setNewItemContent((prev) => ({ ...prev, [cl.id]: e.target.value }))}
                placeholder="Yeni oge ekle..."
                className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                onKeyDown={(e) => e.key === "Enter" && addItem(cl.id)}
              />
              <Button size="sm" onClick={() => addItem(cl.id)}>Ekle</Button>
            </div>
          </div>
        );
      })}

      {showAddChecklist ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newChecklistTitle}
            onChange={(e) => setNewChecklistTitle(e.target.value)}
            placeholder="Checklist basligi..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && addChecklist()}
          />
          <Button size="sm" onClick={addChecklist}>Ekle</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAddChecklist(false)}>Iptal</Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setShowAddChecklist(true)}>
          + Checklist Ekle
        </Button>
      )}
    </div>
  );
}
