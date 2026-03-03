"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Card from "./Card";
import AddCard from "./AddCard";

interface CardData {
  id: string;
  title: string;
  coverColor?: string | null;
  dueDate?: string | null;
  position: number;
  labels: { label: { id: string; name: string; color: string } }[];
  _count: { attachments: number; checklists: number };
}

interface ListProps {
  id: string;
  title: string;
  cards: CardData[];
  onRefresh: () => void;
  onCardClick: (cardId: string) => void;
  onDelete: () => void;
}

export default function List({ id, title, cards, onRefresh, onCardClick, onDelete }: ListProps) {
  const [editing, setEditing] = useState(false);
  const [listTitle, setListTitle] = useState(title);
  const [showMenu, setShowMenu] = useState(false);

  const { setNodeRef } = useDroppable({ id, data: { type: "list" } });

  const updateTitle = async () => {
    if (listTitle.trim() && listTitle !== title) {
      await fetch(`/api/lists/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: listTitle }),
      });
      onRefresh();
    }
    setEditing(false);
  };

  const deleteList = async () => {
    if (!confirm("Bu listeyi silmek istediginize emin misiniz?")) return;
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    onDelete();
  };

  return (
    <div className="flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-xl shadow-sm flex flex-col max-h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between p-3 pb-1">
        {editing ? (
          <input
            value={listTitle}
            onChange={(e) => setListTitle(e.target.value)}
            onBlur={updateTitle}
            onKeyDown={(e) => e.key === "Enter" && updateTitle()}
            className="font-semibold text-sm bg-white dark:bg-gray-700 px-2 py-1 rounded border border-blue-500 outline-none flex-1 text-gray-900 dark:text-white"
            autoFocus
          />
        ) : (
          <h3
            onClick={() => setEditing(true)}
            className="font-semibold text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:text-gray-900 dark:hover:text-white flex-1 px-1"
          >
            {title}
          </h3>
        )}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition text-gray-500 dark:text-gray-400"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-20 w-36">
              <button
                onClick={() => { deleteList(); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Listeyi Sil
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[2rem]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card
              key={card.id}
              id={card.id}
              title={card.title}
              coverColor={card.coverColor}
              labels={card.labels}
              dueDate={card.dueDate}
              _count={card._count}
              onClick={() => onCardClick(card.id)}
            />
          ))}
        </SortableContext>
      </div>

      <div className="p-2 pt-0">
        <AddCard listId={id} onAdd={onRefresh} />
      </div>
    </div>
  );
}
