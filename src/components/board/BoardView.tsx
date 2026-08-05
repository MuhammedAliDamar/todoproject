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
import ListView from "./ListView";
import TaskDetailPanel from "./TaskDetailPanel";
import MemberList from "./MemberList";
import SlackSettings from "./SlackSettings";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

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

interface BoardData {
  id: string;
  title: string;
  background: string;
  userId: string;
  slackToken: string | null;
  slackChannelId: string | null;
  slackChannelName: string | null;
  slackTeamName: string | null;
  labels: { id: string; name: string; color: string }[];
  members: { id: string; role: string; user: { id: string; name: string; email: string; avatar?: string | null } }[];
  lists: ListData[];
}

interface BoardViewProps {
  boardId: string;
}

export default function BoardView({ boardId }: BoardViewProps) {
  const { user } = useAuth();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showSlack, setShowSlack] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [boardTitle, setBoardTitle] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");

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

  const handleAddCard = async (listId: string, title: string) => {
    await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, listId }),
    });
    fetchBoard();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-[var(--asana-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--asana-text-secondary)] text-sm">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-[var(--asana-text-secondary)]">Project not found</p>
      </div>
    );
  }

  const filteredLists = board.lists.map((list) => ({
    ...list,
    cards: list.cards.filter((card) => {
      const matchSearch = !search || card.title.toLowerCase().includes(search.toLowerCase());
      const matchLabel = !filterLabel || card.labels.some((cl) => cl.label.id === filterLabel);
      return matchSearch && matchLabel;
    }),
  }));

  const isOwner =
    !!user &&
    (board.userId === user.id ||
      board.members.some((m) => m.role === "OWNER" && m.user.id === user.id));

  const canInvite =
    isOwner ||
    (!!user && board.members.some((m) => m.role === "MEMBER" && m.user.id === user.id));

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-[var(--asana-bg)] dark:bg-[var(--asana-bg)]">
      {/* Project header */}
      <div className="bg-[var(--asana-bg-white)] dark:bg-[var(--asana-bg-white)] border-b border-[var(--asana-border)] px-6 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: board.background }} />
            {editingTitle ? (
              <input
                value={boardTitle}
                onChange={(e) => setBoardTitle(e.target.value)}
                onBlur={updateBoardTitle}
                onKeyDown={(e) => e.key === "Enter" && updateBoardTitle()}
                className="text-xl font-semibold bg-transparent border-b-2 border-[var(--asana-accent)] outline-none text-[var(--asana-text)] dark:text-white px-1"
                autoFocus
              />
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                className="text-xl font-semibold text-[var(--asana-text)] dark:text-white cursor-pointer hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded px-1 transition"
              >
                {board.title}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowSlack(true)}>
              {board.slackChannelId ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[var(--asana-green)] rounded-full" />
                  Slack
                </span>
              ) : "Slack"}
            </Button>

            <Button size="sm" variant="ghost" onClick={() => setShowMembers(true)}>
              Members ({board.members.length})
            </Button>
          </div>
        </div>

        {/* View switcher & filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                viewMode === "list"
                  ? "bg-[var(--asana-bg)] dark:bg-[#1a1a1a] text-[var(--asana-text)] dark:text-white"
                  : "text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                viewMode === "board"
                  ? "bg-[var(--asana-bg)] dark:bg-[#1a1a1a] text-[var(--asana-text)] dark:text-white"
                  : "text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Board
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--asana-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter..."
                className="w-40 pl-8 pr-3 py-1.5 text-sm bg-[var(--asana-bg)] dark:bg-[#1a1a1a] border border-[var(--asana-border)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--asana-accent)] text-[var(--asana-text)] dark:text-white placeholder-[var(--asana-text-secondary)]"
              />
            </div>

            {/* Label filter */}
            {board.labels.length > 0 && (
              <select
                value={filterLabel || ""}
                onChange={(e) => setFilterLabel(e.target.value || null)}
                className="text-sm bg-[var(--asana-bg)] dark:bg-[#1a1a1a] border border-[var(--asana-border)] rounded-lg px-2 py-1.5 outline-none text-[var(--asana-text)] dark:text-white"
              >
                <option value="">All Labels</option>
                {board.labels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "list" ? (
          <div className="h-full overflow-y-auto">
            <ListView
              lists={filteredLists}
              onCardClick={(cardId) => setSelectedCardId(cardId)}
              onAddCard={handleAddCard}
            />
          </div>
        ) : (
          <div className="h-full overflow-x-auto p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 h-full items-start">
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
                  <div className="bg-[var(--asana-bg-white)] dark:bg-[#3a3b3d] rounded-lg shadow-xl border border-[var(--asana-border)] p-3 w-64 opacity-90 rotate-2">
                    <p className="text-sm text-[var(--asana-text)] dark:text-white font-medium">{activeCard.title}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>

      {/* Task Detail Panel (right side) */}
      {selectedCardId && (
        <TaskDetailPanel
          cardId={selectedCardId}
          boardLabels={board.labels}
          boardMembers={board.members.map((m) => m.user)}
          isOwner={isOwner}
          onClose={() => setSelectedCardId(null)}
          onUpdate={fetchBoard}
        />
      )}

      {showSlack && (
        <SlackSettings
          boardId={board.id}
          slackConnected={!!board.slackToken}
          slackChannelId={board.slackChannelId}
          slackChannelName={board.slackChannelName}
          slackTeamName={board.slackTeamName}
          onClose={() => setShowSlack(false)}
          onUpdate={fetchBoard}
        />
      )}

      {showMembers && (
        <MemberList
          boardId={board.id}
          members={board.members}
          isOwner={isOwner}
          canInvite={canInvite}
          onClose={() => setShowMembers(false)}
          onUpdate={fetchBoard}
        />
      )}
    </div>
  );
}
