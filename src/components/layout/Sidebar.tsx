"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface BoardItem {
  id: string;
  title: string;
  background: string;
}

interface TaskGroup {
  listId: string;
  listTitle: string;
  boardId: string;
  cards: { id: string; title: string; dueDate: string | null }[];
}

function SortableBoardItem({ board, isActive }: { board: BoardItem; isActive: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: board.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      <button
        {...attributes}
        {...listeners}
        className="p-1 opacity-0 group-hover:opacity-100 text-[var(--asana-sidebar-text)] hover:text-[var(--asana-sidebar-text-active)] cursor-grab active:cursor-grabbing transition-opacity shrink-0"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <Link
        href={`/board/${board.id}`}
        className={`flex-1 flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-[var(--asana-sidebar-active)] text-[var(--asana-sidebar-text-active)] font-medium"
            : "text-[var(--asana-sidebar-text)] hover:bg-[var(--asana-sidebar-hover)] hover:text-[var(--asana-sidebar-text-active)]"
        }`}
      >
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: board.background }}
        />
        <span className="truncate">{board.title}</span>
      </Link>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [tasks, setTasks] = useState<TaskGroup[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    fetch("/api/boards")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBoards(Array.isArray(data) ? data : []))
      .catch(() => setBoards([]));

    fetch("/api/my-tasks")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));
  }, [pathname]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = boards.findIndex((b) => b.id === active.id);
    const newIndex = boards.findIndex((b) => b.id === over.id);
    const newBoards = arrayMove(boards, oldIndex, newIndex);
    setBoards(newBoards);

    await fetch("/api/boards/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedBoardIds: newBoards.map((b) => b.id) }),
    });
  };

  const myTaskCount = tasks.reduce((sum, g) => sum + g.cards.length, 0);

  if (collapsed) {
    return (
      <aside className="w-[52px] bg-[var(--asana-sidebar)] min-h-[calc(100vh-3.5rem)] flex flex-col items-center py-4 hidden md:flex">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 text-[var(--asana-sidebar-text)] hover:text-[var(--asana-sidebar-text-active)] hover:bg-[var(--asana-sidebar-hover)] rounded-lg transition mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <Link
          href="/boards"
          className={`p-2 rounded-lg transition mb-1 ${
            pathname === "/boards"
              ? "bg-[var(--asana-sidebar-active)] text-[var(--asana-sidebar-text-active)]"
              : "text-[var(--asana-sidebar-text)] hover:bg-[var(--asana-sidebar-hover)]"
          }`}
          title="Home"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </Link>
        <Link
          href="/my-tasks"
          className={`p-2 rounded-lg transition mb-1 ${
            pathname === "/my-tasks"
              ? "bg-[var(--asana-sidebar-active)] text-[var(--asana-sidebar-text-active)]"
              : "text-[var(--asana-sidebar-text)] hover:bg-[var(--asana-sidebar-hover)]"
          }`}
          title="My Tasks"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </Link>
        <Link
          href="/inbox"
          className={`p-2 rounded-lg transition mb-1 ${
            pathname === "/inbox"
              ? "bg-[var(--asana-sidebar-active)] text-[var(--asana-sidebar-text-active)]"
              : "text-[var(--asana-sidebar-text)] hover:bg-[var(--asana-sidebar-hover)]"
          }`}
          title="Inbox"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </Link>
      </aside>
    );
  }

  return (
    <aside className="w-[240px] bg-[var(--asana-sidebar)] min-h-[calc(100vh-3.5rem)] flex flex-col hidden md:flex">
      {/* Top nav */}
      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--asana-sidebar-text)]">
            Navigation
          </span>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 text-[var(--asana-sidebar-text)] hover:text-[var(--asana-sidebar-text-active)] hover:bg-[var(--asana-sidebar-hover)] rounded transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <nav className="space-y-0.5 mt-2">
          <Link
            href="/boards"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/boards"
                ? "bg-[var(--asana-sidebar-active)] text-[var(--asana-sidebar-text-active)]"
                : "text-[var(--asana-sidebar-text)] hover:bg-[var(--asana-sidebar-hover)] hover:text-[var(--asana-sidebar-text-active)]"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </Link>

          <Link
            href="/my-tasks"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/my-tasks"
                ? "bg-[var(--asana-sidebar-active)] text-[var(--asana-sidebar-text-active)]"
                : "text-[var(--asana-sidebar-text)] hover:bg-[var(--asana-sidebar-hover)] hover:text-[var(--asana-sidebar-text-active)]"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            My Tasks
            {myTaskCount > 0 && (
              <span className="ml-auto bg-[var(--asana-accent)] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {myTaskCount}
              </span>
            )}
          </Link>

          <Link
            href="/inbox"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/inbox"
                ? "bg-[var(--asana-sidebar-active)] text-[var(--asana-sidebar-text-active)]"
                : "text-[var(--asana-sidebar-text)] hover:bg-[var(--asana-sidebar-hover)] hover:text-[var(--asana-sidebar-text-active)]"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            Inbox
          </Link>
        </nav>
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-[#424244]" />

      {/* Projects */}
      <div className="px-3 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--asana-sidebar-text)]">
            Projects
          </span>
          <Link
            href="/boards"
            className="p-1 text-[var(--asana-sidebar-text)] hover:text-[var(--asana-sidebar-text-active)] hover:bg-[var(--asana-sidebar-hover)] rounded transition"
            title="Create project"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Link>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={boards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <nav className="space-y-0.5">
              {boards.map((board) => (
                <SortableBoardItem
                  key={board.id}
                  board={board}
                  isActive={pathname === `/board/${board.id}`}
                />
              ))}
              {boards.length === 0 && (
                <p className="px-3 py-2 text-sm text-[var(--asana-sidebar-text)]">No projects yet</p>
              )}
            </nav>
          </SortableContext>
        </DndContext>
      </div>
    </aside>
  );
}
