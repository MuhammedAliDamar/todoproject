"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/date";

interface CardData {
  id: string;
  title: string;
  description?: string | null;
  coverColor?: string | null;
  dueDate?: string | null;
  position: number;
  listId: string;
  labels: { label: { id: string; name: string; color: string } }[];
  checklists: { id: string; items: { isCompleted: boolean }[] }[];
  assignees: { user: { id: string; name: string; avatar?: string | null } }[];
  _count: { attachments: number; checklists: number };
}

interface ListData {
  id: string;
  title: string;
  position: number;
  cards: CardData[];
}

interface ListViewProps {
  lists: ListData[];
  onCardClick: (cardId: string) => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
}

function SectionGroup({ list, onCardClick, onAddCard }: { list: ListData; onCardClick: (id: string) => void; onAddCard: (listId: string, title: string) => Promise<void> }) {
  const [collapsed, setCollapsed] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAdd = async () => {
    if (!newTaskTitle.trim()) return;
    await onAddCard(list.id, newTaskTitle);
    setNewTaskTitle("");
    setAddingTask(false);
  };

  const completedCount = list.cards.reduce((sum, card) => {
    const total = card.checklists.reduce((s, cl) => s + cl.items.length, 0);
    const done = card.checklists.reduce((s, cl) => s + cl.items.filter((i) => i.isCompleted).length, 0);
    return sum + (total > 0 && done === total ? 1 : 0);
  }, 0);

  return (
    <div className="mb-1">
      {/* Section header */}
      <div className="section-header flex items-center gap-2 py-2 px-4 sticky top-0 bg-[var(--asana-bg-white)] dark:bg-[var(--asana-bg-white)] z-10">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-0.5 hover:bg-gray-100 dark:hover:bg-[#3a3b3d] rounded transition"
        >
          <svg
            className={`w-4 h-4 text-[var(--asana-text-secondary)] transition-transform ${collapsed ? "-rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-[var(--asana-text)] dark:text-white">{list.title}</h3>
        <span className="text-xs text-[var(--asana-text-secondary)]">
          {list.cards.length} {list.cards.length === 1 ? "task" : "tasks"}
          {completedCount > 0 && ` · ${completedCount} completed`}
        </span>
      </div>

      {/* Task rows */}
      {!collapsed && (
        <div>
          {list.cards.map((card) => {
            const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();
            return (
              <div
                key={card.id}
                onClick={() => onCardClick(card.id)}
                className="task-row flex items-center gap-3 px-4 py-2.5 border-b border-[var(--asana-border)] cursor-pointer group"
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="w-[18px] h-[18px] rounded-full border-2 border-gray-300 dark:border-gray-500 hover:border-[var(--asana-green)] flex items-center justify-center shrink-0 transition"
                >
                  <svg className="w-3 h-3 text-transparent group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </button>

                {/* Task name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--asana-text)] dark:text-white truncate">{card.title}</span>
                    {card.labels.length > 0 && (
                      <div className="flex gap-1 shrink-0">
                        {card.labels.slice(0, 2).map((cl) => (
                          <Badge key={cl.label.id} color={cl.label.color} name={cl.label.name} size="sm" />
                        ))}
                        {card.labels.length > 2 && (
                          <span className="text-xs text-[var(--asana-text-secondary)]">+{card.labels.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignee */}
                <div className="w-8 shrink-0 flex justify-center">
                  {card.assignees.length > 0 ? (
                    <Avatar name={card.assignees[0].user.name} src={card.assignees[0].user.avatar} size="sm" />
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 opacity-0 group-hover:opacity-100 transition" />
                  )}
                </div>

                {/* Due date */}
                <div className="w-24 shrink-0 text-right">
                  {card.dueDate && (
                    <span className={`text-xs ${isOverdue ? "text-[var(--asana-accent)] font-medium" : "text-[var(--asana-text-secondary)]"}`}>
                      {formatDate(card.dueDate)}
                    </span>
                  )}
                </div>

                {/* Indicators */}
                <div className="w-16 shrink-0 flex items-center justify-end gap-2">
                  {card._count.attachments > 0 && (
                    <span className="text-xs text-[var(--asana-text-secondary)] flex items-center gap-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {card._count.attachments}
                    </span>
                  )}
                  {card._count.checklists > 0 && (
                    <svg className="w-3.5 h-3.5 text-[var(--asana-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add task row */}
          {addingTask ? (
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--asana-border)]">
              <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300 shrink-0" />
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") { setAddingTask(false); setNewTaskTitle(""); }
                }}
                onBlur={() => { if (!newTaskTitle.trim()) setAddingTask(false); }}
                placeholder="Write a task name..."
                className="flex-1 text-sm bg-transparent outline-none text-[var(--asana-text)] dark:text-white placeholder-[var(--asana-text-secondary)]"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingTask(true)}
              className="w-full text-left px-4 py-2 text-sm text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white transition flex items-center gap-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add task...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ListView({ lists, onCardClick, onAddCard }: ListViewProps) {
  return (
    <div className="bg-[var(--asana-bg-white)] dark:bg-[var(--asana-bg-white)] min-h-full">
      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 border-b-2 border-[var(--asana-border)] text-xs font-medium text-[var(--asana-text-secondary)] uppercase tracking-wider sticky top-0 bg-[var(--asana-bg-white)] dark:bg-[var(--asana-bg-white)] z-20">
        <div className="w-[18px] shrink-0" />
        <div className="flex-1">Task name</div>
        <div className="w-8 shrink-0 text-center">Assignee</div>
        <div className="w-24 shrink-0 text-right">Due date</div>
        <div className="w-16 shrink-0" />
      </div>

      {/* Sections */}
      {lists.map((list) => (
        <SectionGroup key={list.id} list={list} onCardClick={onCardClick} onAddCard={onAddCard} />
      ))}

      {lists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--asana-text-secondary)]">
          <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No tasks yet. Add a list and start creating tasks.</p>
        </div>
      )}
    </div>
  );
}
