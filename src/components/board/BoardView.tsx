"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import List from "./List";
import AddList from "./AddList";
import CardDetail from "./CardDetail";
import MemberList from "./MemberList";
import SearchBar from "@/components/shared/SearchBar";
import Button from "@/components/ui/Button";

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
  _count: { attachments: number; checklists: number };
}

interface ListData {
  id: string;
  title: string;
  position: number;
  cards: CardData[];
}

interface BoardData {
  id: string;
  title: string;
  background: string;
  userId: string;
  labels: { id: string; name: string; color: string }[];
  members: { id: string; role: string; user: { id: string; name: string; email: string; avatar?: string | null } }[];
  lists: ListData[];
}

interface BoardViewProps {
  boardId: string;
}

export default function BoardView({ boardId }: BoardViewProps) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [boardTitle, setBoardTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}`);
      if (res.ok) {
        const data = await res.json();
        setBoard(data);
        setBoardTitle(data.title);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const findListByCardId = (cardId: string): ListData | undefined => {
    return board?.lists.find((list) => list.cards.some((c) => c.id === cardId));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const list = findListByCardId(active.id as string);
    const card = list?.cards.find((c) => c.id === active.id);
    if (card) setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !board) return;

    const activeList = findListByCardId(active.id as string);
    let overList = findListByCardId(over.id as string);

    // If over is a list (droppable), not a card
    if (!overList) {
      overList = board.lists.find((l) => l.id === over.id);
    }

    if (!activeList || !overList || activeList.id === overList.id) return;

    setBoard((prev) => {
      if (!prev) return prev;
      const newLists = prev.lists.map((l) => ({ ...l, cards: [...l.cards] }));
      const sourceList = newLists.find((l) => l.id === activeList.id)!;
      const destList = newLists.find((l) => l.id === overList.id)!;

      const cardIndex = sourceList.cards.findIndex((c) => c.id === active.id);
      const [movedCard] = sourceList.cards.splice(cardIndex, 1);
      movedCard.listId = destList.id;

      const overIndex = destList.cards.findIndex((c) => c.id === over.id);
      if (overIndex >= 0) {
        destList.cards.splice(overIndex, 0, movedCard);
      } else {
        destList.cards.push(movedCard);
      }

      return { ...prev, lists: newLists };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || !board) return;

    const activeList = findListByCardId(active.id as string);
    let overList = findListByCardId(over.id as string);
    if (!overList) {
      overList = board.lists.find((l) => l.id === over.id);
    }

    if (!activeList || !overList) return;

    if (activeList.id === overList.id) {
      // Reorder within same list
      const oldIndex = activeList.cards.findIndex((c) => c.id === active.id);
      const newIndex = activeList.cards.findIndex((c) => c.id === over.id);

      if (oldIndex !== newIndex && newIndex >= 0) {
        const newCards = arrayMove(activeList.cards, oldIndex, newIndex);
        setBoard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            lists: prev.lists.map((l) =>
              l.id === activeList.id ? { ...l, cards: newCards } : l
            ),
          };
        });
      }
    }

    // Save the new position to the server
    const card = overList.cards.find((c) => c.id === active.id);
    if (card) {
      const cardIndex = overList.cards.indexOf(card);
      await fetch(`/api/cards/${active.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId: overList.id,
          position: cardIndex,
        }),
      });
    }
  };

  const updateBoardTitle = async () => {
    if (boardTitle.trim() && boardTitle !== board?.title) {
      await fetch(`/api/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: boardTitle }),
      });
      fetchBoard();
    }
    setEditingTitle(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-gray-500">Yükleniyor...</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-gray-500">Board bulunamadı</p>
      </div>
    );
  }

  // Filter cards
  const filteredLists = board.lists.map((list) => ({
    ...list,
    cards: list.cards.filter((card) => {
      const matchSearch = !search || card.title.toLowerCase().includes(search.toLowerCase());
      const matchLabel = !filterLabel || card.labels.some((cl) => cl.label.id === filterLabel);
      return matchSearch && matchLabel;
    }),
  }));

  return (
    <div
      className="h-[calc(100vh-3.5rem)] flex flex-col"
      style={{ backgroundColor: board.background }}
    >
      {/* Board header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20">
        <div className="flex items-center gap-3">
          {editingTitle ? (
            <input
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              onBlur={updateBoardTitle}
              onKeyDown={(e) => e.key === "Enter" && updateBoardTitle()}
              className="text-lg font-bold bg-white/20 text-white px-2 py-1 rounded outline-none"
              autoFocus
            />
          ) : (
            <h2
              onClick={() => setEditingTitle(true)}
              className="text-lg font-bold text-white cursor-pointer hover:bg-white/10 px-2 py-1 rounded"
            >
              {board.title}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-48">
            <SearchBar value={search} onChange={setSearch} placeholder="Kart ara..." />
          </div>

          {/* Label filter */}
          <select
            value={filterLabel || ""}
            onChange={(e) => setFilterLabel(e.target.value || null)}
            className="text-sm bg-white/20 text-white border-none rounded-lg px-3 py-2 outline-none"
          >
            <option value="" className="text-gray-800">Tüm Etiketler</option>
            {board.labels.map((l) => (
              <option key={l.id} value={l.id} className="text-gray-800">
                {l.name}
              </option>
            ))}
          </select>

          <Button size="sm" variant="secondary" onClick={() => setShowMembers(true)}>
            Üyeler ({board.members.length})
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full items-start">
            {filteredLists.map((list) => (
              <List
                key={list.id}
                id={list.id}
                title={list.title}
                cards={list.cards}
                onRefresh={fetchBoard}
                onCardClick={(cardId) => setSelectedCardId(cardId)}
                onDelete={fetchBoard}
              />
            ))}
            <AddList boardId={board.id} onAdd={fetchBoard} />
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-3 w-64 opacity-90 rotate-3">
                <p className="text-sm text-gray-800 dark:text-gray-100 font-medium">{activeCard.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Card Detail Modal */}
      {selectedCardId && (
        <CardDetail
          cardId={selectedCardId}
          boardLabels={board.labels}
          onClose={() => setSelectedCardId(null)}
          onUpdate={fetchBoard}
        />
      )}

      {/* Members Modal */}
      {showMembers && (
        <MemberList
          boardId={board.id}
          members={board.members}
          isOwner={board.members.some(
            (m) => m.role === "OWNER" && m.user.id === board.userId
          )}
          onClose={() => setShowMembers(false)}
          onUpdate={fetchBoard}
        />
      )}
    </div>
  );
}
