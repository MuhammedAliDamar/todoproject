"use client";

import { useState } from "react";
import {
  IconBoard,
  IconCalendar,
  IconCheck,
  IconFilter,
  IconLayers,
  IconList,
  IconMsg,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconStar,
  IconTimeline,
} from "./Icons";

type Status = "todo" | "in-progress" | "review" | "done";
type Priority = "high" | "medium" | "low";

type Task = {
  id: string;
  title: string;
  project: keyof typeof PROJECT_COLORS;
  assignees: string[];
  priority: Priority;
  status: Status;
  due: string;
  start: number;
  span: number;
  lane: number;
  comments: number;
  attachments: number;
  tag: string;
};

const TASKS: Task[] = [
  { id: "MT-184", title: "Onboarding checklist v3", project: "Growth", assignees: ["AK", "MS"], priority: "high", status: "in-progress", due: "May 14", start: 1, span: 5, lane: 0, comments: 4, attachments: 2, tag: "design" },
  { id: "MT-201", title: "Wire up Slack integration", project: "Platform", assignees: ["JP"], priority: "medium", status: "in-progress", due: "May 16", start: 3, span: 4, lane: 1, comments: 2, attachments: 0, tag: "eng" },
  { id: "MT-198", title: "Audit pricing page copy", project: "Marketing", assignees: ["RA", "MS", "AK"], priority: "low", status: "todo", due: "May 22", start: 7, span: 3, lane: 2, comments: 1, attachments: 1, tag: "copy" },
  { id: "MT-176", title: "API rate-limit policy", project: "Platform", assignees: ["TZ"], priority: "high", status: "review", due: "May 13", start: 0, span: 3, lane: 3, comments: 6, attachments: 1, tag: "eng" },
  { id: "MT-205", title: "Q3 OKR review prep", project: "Ops", assignees: ["EC"], priority: "medium", status: "todo", due: "May 28", start: 9, span: 4, lane: 4, comments: 0, attachments: 3, tag: "ops" },
  { id: "MT-167", title: "Migrate auth to Clerk", project: "Platform", assignees: ["JP", "TZ"], priority: "high", status: "done", due: "May 09", start: 4, span: 3, lane: 5, comments: 8, attachments: 0, tag: "eng" },
  { id: "MT-211", title: "Customer interviews — batch 04", project: "Research", assignees: ["AK"], priority: "medium", status: "todo", due: "May 25", start: 6, span: 5, lane: 6, comments: 3, attachments: 0, tag: "research" },
  { id: "MT-192", title: "Renew SOC 2 evidence", project: "Trust", assignees: ["EC", "TZ"], priority: "high", status: "review", due: "May 20", start: 8, span: 3, lane: 7, comments: 5, attachments: 4, tag: "ops" },
  { id: "MT-220", title: "Refactor board virtualization", project: "Platform", assignees: ["MS"], priority: "low", status: "review", due: "May 24", start: 5, span: 4, lane: 8, comments: 2, attachments: 0, tag: "eng" },
];

const PROJECT_COLORS = {
  Growth: "#ff5b1f",
  Platform: "#4f46e5",
  Marketing: "#0a7d5a",
  Ops: "#a16207",
  Research: "#9333ea",
  Trust: "#0369a1",
} as const;

const PRIORITY: Record<Priority, { label: string; color: string; bg: string }> = {
  high: { label: "P1", color: "#dc2626", bg: "#fee2e2" },
  medium: { label: "P2", color: "#a16207", bg: "#fef3c7" },
  low: { label: "P3", color: "#0a7d5a", bg: "#dcfce7" },
};

const STATUS_LANES: { id: Status; label: string; hint: string }[] = [
  { id: "todo", label: "Backlog", hint: "queued" },
  { id: "in-progress", label: "In progress", hint: "active" },
  { id: "review", label: "In review", hint: "blocked" },
  { id: "done", label: "Shipped", hint: "done" },
];

const AVATAR_COLORS: Record<string, string> = {
  AK: "#ff5b1f",
  MS: "#4f46e5",
  JP: "#0a7d5a",
  RA: "#a16207",
  TZ: "#9333ea",
  EC: "#0369a1",
};

function Avatar({ id, size = 22, ring = true }: { id: string; size?: number; ring?: boolean }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: AVATAR_COLORS[id] || "#888",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 600,
        letterSpacing: "0.02em",
        boxShadow: ring ? "0 0 0 2px var(--surface)" : "none",
        flexShrink: 0,
      }}
    >
      {id}
    </span>
  );
}

function AvatarStack({ ids, size = 22 }: { ids: string[]; size?: number }) {
  return (
    <span style={{ display: "inline-flex" }}>
      {ids.map((id, i) => (
        <span key={id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar id={id} size={size} />
        </span>
      ))}
    </span>
  );
}

function ProjectDot({ name }: { name: keyof typeof PROJECT_COLORS }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: "var(--muted)",
        fontFamily: "var(--font-mono-landing)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 2,
          background: PROJECT_COLORS[name],
        }}
      />
      {name}
    </span>
  );
}

function PriorityChip({ priority }: { priority: Priority }) {
  const p = PRIORITY[priority];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderRadius: 5,
        background: p.bg,
        color: p.color,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "var(--font-mono-landing)",
      }}
    >
      {p.label}
    </span>
  );
}

function ToolbarBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      style={{
        background: "transparent",
        border: "1px solid transparent",
        padding: "5px 9px",
        borderRadius: 7,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        color: "var(--ink-2)",
        fontWeight: 500,
        cursor: "pointer",
        transition: "background .15s, border-color .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background =
          "color-mix(in srgb, var(--ink) 4%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon} {label}
    </button>
  );
}

function ViewToolbar({ count }: { count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 18px",
        borderBottom: "1px solid var(--line)",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 7,
            padding: "5px 10px",
            fontSize: 12,
            color: "var(--muted)",
            fontFamily: "var(--font-mono-landing)",
          }}
        >
          <IconSearch size={12} /> Search…
          <span
            style={{
              marginLeft: 14,
              padding: "1px 5px",
              borderRadius: 3,
              background: "color-mix(in srgb, var(--ink) 6%, transparent)",
              fontSize: 10,
            }}
          >
            ⌘K
          </span>
        </div>
        <ToolbarBtn icon={<IconFilter size={13} />} label="Filter" />
        <ToolbarBtn icon={<IconLayers size={13} />} label="Group: Status" />
        <ToolbarBtn icon={<IconStar size={13} />} label="My tasks" />
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono-landing)",
            color: "var(--muted)",
            marginLeft: 4,
          }}
        >
          {count} tasks
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <AvatarStack ids={["AK", "MS", "JP", "TZ"]} size={22} />
        <button
          style={{
            background: "var(--accent)",
            color: "var(--accent-ink)",
            border: 0,
            padding: "6px 11px",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
          }}
        >
          <IconPlus size={12} /> New task
        </button>
      </div>
    </div>
  );
}

function BoardView() {
  const [hover, setHover] = useState<string | null>(null);
  const grouped = STATUS_LANES.map((l) => ({
    ...l,
    tasks: TASKS.filter((t) => t.status === l.id),
  }));

  return (
    <div className="board-view">
      <ViewToolbar count={TASKS.length} />
      <div className="preview-board-grid">
        {grouped.map((lane) => (
          <div
            key={lane.id}
            style={{
              background: "color-mix(in srgb, var(--ink) 3%, transparent)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "2px 4px 6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 50,
                    background:
                      lane.id === "todo"
                        ? "#a8a8a0"
                        : lane.id === "in-progress"
                          ? "var(--accent)"
                          : lane.id === "review"
                            ? "#a16207"
                            : "#0a7d5a",
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {lane.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono-landing)",
                  }}
                >
                  {lane.tasks.length}
                </span>
              </div>
              <button
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--muted)",
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  cursor: "pointer",
                }}
                title="Add task"
              >
                <IconPlus size={14} />
              </button>
            </div>

            {lane.tasks.map((t) => (
              <div
                key={t.id}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "12px 12px 10px",
                  cursor: "grab",
                  boxShadow: hover === t.id ? "var(--shadow-md)" : "var(--shadow-sm)",
                  transform: hover === t.id ? "translateY(-1px)" : "none",
                  transition:
                    "transform .15s, box-shadow .15s, border-color .15s",
                  borderColor:
                    hover === t.id ? "var(--line-strong)" : "var(--line)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <ProjectDot name={t.project} />
                  <PriorityChip priority={t.priority} />
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    lineHeight: 1.3,
                    marginBottom: 12,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {t.title}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      color: "var(--muted)",
                      fontSize: 11,
                      fontFamily: "var(--font-mono-landing)",
                    }}
                  >
                    <span>{t.due}</span>
                    {t.comments > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <IconMsg size={11} /> {t.comments}
                      </span>
                    )}
                    {t.attachments > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <IconPaperclip size={11} /> {t.attachments}
                      </span>
                    )}
                  </div>
                  <AvatarStack ids={t.assignees} size={20} />
                </div>
              </div>
            ))}

            {lane.id === "in-progress" && (
              <button
                style={{
                  border: "1px dashed var(--line-strong)",
                  background: "transparent",
                  borderRadius: 10,
                  padding: "10px 12px",
                  color: "var(--muted)",
                  fontSize: 13,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <IconPlus size={13} /> Add task
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; color: string; bg: string }> = {
    todo: {
      label: "Backlog",
      color: "#52524b",
      bg: "color-mix(in srgb, var(--ink) 7%, transparent)",
    },
    "in-progress": {
      label: "In progress",
      color: "var(--accent)",
      bg: "var(--accent-soft)",
    },
    review: { label: "Review", color: "#a16207", bg: "#fef3c7" },
    done: { label: "Done", color: "#0a7d5a", bg: "#dcfce7" },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 5,
        background: s.bg,
        color: s.color,
        fontSize: 11,
        fontWeight: 500,
        width: "fit-content",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 50,
          background: "currentColor",
        }}
      />
      {s.label}
    </span>
  );
}

function ListView() {
  const rows = TASKS;
  const cols = "minmax(0, 1fr) 110px 110px 90px 130px 90px";
  return (
    <div>
      <ViewToolbar count={rows.length} />
      <div
        className="preview-list"
        style={{
          margin: "16px 18px 22px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflowX: "auto",
        }}
      >
        <div
          className="preview-list-row"
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            fontSize: 11,
            fontFamily: "var(--font-mono-landing)",
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "10px 16px",
            borderBottom: "1px solid var(--line)",
            background: "color-mix(in srgb, var(--ink) 2%, transparent)",
          }}
        >
          <span>Task</span>
          <span>Project</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Assignees</span>
          <span style={{ textAlign: "right" }}>Due</span>
        </div>
        {rows.map((t, i) => (
          <div
            key={t.id}
            className="preview-list-row"
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              alignItems: "center",
              padding: "12px 16px",
              borderBottom:
                i === rows.length - 1 ? 0 : "1px solid var(--line)",
              fontSize: 13,
              transition: "background .15s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "color-mix(in srgb, var(--ink) 2%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  border: "1.5px solid var(--line-strong)",
                  background: t.status === "done" ? "var(--accent)" : "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {t.status === "done" && <IconCheck size={10} sw={3} />}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                {t.id}
              </span>
              <span
                style={{
                  fontWeight: 500,
                  letterSpacing: "-0.005em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: t.status === "done" ? "line-through" : "none",
                  color: t.status === "done" ? "var(--muted)" : "var(--ink)",
                }}
              >
                {t.title}
              </span>
            </div>
            <ProjectDot name={t.project} />
            <StatusPill status={t.status} />
            <PriorityChip priority={t.priority} />
            <AvatarStack ids={t.assignees} size={20} />
            <span
              style={{
                textAlign: "right",
                color: "var(--muted)",
                fontFamily: "var(--font-mono-landing)",
                fontSize: 12,
              }}
            >
              {t.due}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineView() {
  const WEEKS = 14;
  const days = Array.from({ length: WEEKS }, (_, i) => i);
  const dayLabels = [
    "May 09",
    "May 11",
    "May 13",
    "May 15",
    "May 17",
    "May 19",
    "May 21",
  ];

  return (
    <div>
      <ViewToolbar count={TASKS.length} />
      <div
        className="preview-timeline"
        style={{
          margin: "16px 18px 22px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflowX: "auto",
          position: "relative",
        }}
      >
        <div
          className="preview-tl-row"
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            borderBottom: "1px solid var(--line)",
            background: "color-mix(in srgb, var(--ink) 2%, transparent)",
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              fontSize: 11,
              fontFamily: "var(--font-mono-landing)",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Task
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
              position: "relative",
            }}
          >
            {dayLabels.map((d, i) => (
              <div
                key={i}
                style={{
                  gridColumn: `${i * 2 + 1} / span 2`,
                  padding: "10px 0",
                  textAlign: "center",
                  fontSize: 11,
                  fontFamily: "var(--font-mono-landing)",
                  color: "var(--muted)",
                  borderLeft: i === 0 ? "0" : "1px solid var(--line)",
                }}
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          {TASKS.map((t, i) => (
            <div
              key={t.id}
              className="preview-tl-row"
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                borderBottom:
                  i === TASKS.length - 1 ? 0 : "1px solid var(--line)",
                alignItems: "center",
                minHeight: 38,
              }}
            >
              <div
                style={{
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "-0.005em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  borderRight: "1px solid var(--line)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 2,
                    background: PROJECT_COLORS[t.project],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.title}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
                  position: "relative",
                  height: 38,
                }}
              >
                {days.map((d) => (
                  <div
                    key={d}
                    style={{
                      borderLeft:
                        d === 0
                          ? "0"
                          : "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
                      height: "100%",
                    }}
                  />
                ))}
                <div
                  style={{
                    position: "absolute",
                    top: 9,
                    height: 20,
                    left: `calc(${t.start} * (100% / ${WEEKS}))`,
                    width: `calc(${t.span} * (100% / ${WEEKS}) - 4px)`,
                    background:
                      t.status === "done"
                        ? "color-mix(in srgb, #0a7d5a 18%, var(--surface))"
                        : t.status === "review"
                          ? "color-mix(in srgb, #a16207 18%, var(--surface))"
                          : `color-mix(in srgb, ${PROJECT_COLORS[t.project]} 18%, var(--surface))`,
                    borderLeft: `3px solid ${PROJECT_COLORS[t.project]}`,
                    borderRadius: 5,
                    padding: "0 8px",
                    fontSize: 11,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--ink)",
                    cursor: "grab",
                    transition: "transform .15s, box-shadow .15s",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <Avatar id={t.assignees[0]} size={14} ring={false} />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "var(--font-mono-landing)",
                      fontSize: 10,
                    }}
                  >
                    {t.id}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `calc(180px + ((100% - 180px) / 14) * 4)`,
              width: 0,
              borderLeft: "1.5px dashed var(--accent)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -8,
                left: -22,
                fontSize: 9,
                fontFamily: "var(--font-mono-landing)",
                background: "var(--accent)",
                color: "#fff",
                padding: "1px 6px",
                borderRadius: 3,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              TODAY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductPreview() {
  const [tab, setTab] = useState<"board" | "list" | "timeline" | "calendar">(
    "board",
  );
  const tabs = [
    { id: "board" as const, label: "Board", Icon: IconBoard, count: TASKS.length },
    { id: "list" as const, label: "List", Icon: IconList, count: TASKS.length },
    { id: "timeline" as const, label: "Timeline", Icon: IconTimeline, count: TASKS.length },
    { id: "calendar" as const, label: "Calendar", Icon: IconCalendar, count: TASKS.length, soon: true },
  ];

  return (
    <div className="preview-frame">
      <div className="preview-chrome">
        <div className="traffic">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="url-pill">
          <svg
            className="lock"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          app.marktasks.com/workspace/acme/q2-launch
        </div>
        <div style={{ flex: 1 }}></div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--muted)",
            fontSize: 11,
            fontFamily: "var(--font-mono-landing)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 50,
              background: "#0a7d5a",
            }}
          ></span>
          12 online
        </div>
      </div>

      <div className="preview-tabs">
        {tabs.map((t) => {
          const I = t.Icon;
          return (
            <button
              key={t.id}
              className={`preview-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => !t.soon && setTab(t.id)}
              style={t.soon ? { opacity: 0.5, cursor: "not-allowed" } : {}}
            >
              <I size={14} />
              {t.label}
              {t.soon ? (
                <span
                  className="count"
                  style={{
                    background: "transparent",
                    border: "1px dashed var(--line-strong)",
                    color: "var(--muted)",
                  }}
                >
                  soon
                </span>
              ) : (
                <span className="count">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="preview-body">
        {tab === "board" && <BoardView />}
        {tab === "list" && <ListView />}
        {tab === "timeline" && <TimelineView />}
      </div>
    </div>
  );
}
