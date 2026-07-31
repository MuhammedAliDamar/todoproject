"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { formatDate } from "@/lib/date";

interface CardLabel {
  label: { id: string; name: string; color: string };
}

interface CardAssignee {
  user: { id: string; name: string; avatar?: string | null };
}

interface CardProps {
  id: string;
  title: string;
  coverColor?: string | null;
  labels: CardLabel[];
  assignees: CardAssignee[];
  dueDate?: string | null;
  _count: { attachments: number; checklists: number };
  onClick: () => void;
}

export default function Card({ id, title, coverColor, labels, assignees, dueDate, _count, onClick }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "card" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = dueDate && new Date(dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-lg border border-[var(--asana-border)] hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer group shadow-sm hover:shadow transition"
    >
      {coverColor && (
        <div className="h-2 rounded-t-lg" style={{ backgroundColor: coverColor }} />
      )}
      <div className="p-3">
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {labels.map((cl) => (
              <Badge key={cl.label.id} color={cl.label.color} name={cl.label.name} size="sm" />
            ))}
          </div>
        )}

        <p className="text-sm text-[var(--asana-text)] dark:text-white font-medium">{title}</p>

        <div className="flex items-center gap-3 mt-2">
          {dueDate && (
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-[var(--asana-accent)]" : "text-[var(--asana-text-secondary)]"}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(dueDate)}
            </span>
          )}
          {_count.checklists > 0 && (
            <svg className="w-3.5 h-3.5 text-[var(--asana-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )}
          {_count.attachments > 0 && (
            <span className="text-xs text-[var(--asana-text-secondary)] flex items-center gap-0.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {_count.attachments}
            </span>
          )}

          {assignees.length > 0 && (
            <div className="flex items-center -space-x-1.5 ml-auto">
              {assignees.slice(0, 3).map((a) => (
                <div key={a.user.id} className="ring-2 ring-[var(--asana-bg-white)] dark:ring-[#2e2f31] rounded-full">
                  <Avatar name={a.user.name} src={a.user.avatar} size="sm" />
                </div>
              ))}
              {assignees.length > 3 && (
                <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 ring-2 ring-[var(--asana-bg-white)] dark:ring-[#2e2f31] flex items-center justify-center text-[10px] font-medium text-[var(--asana-text-secondary)]">
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
