import type { ReactElement } from "react";
import { cloneElement } from "react";
import {
  IconBolt,
  IconBrain,
  IconLayers,
  IconLink,
  IconLock,
  IconMsg,
  IconTimeline,
} from "./Icons";

function MiniBoard() {
  return (
    <div style={{ display: "flex", gap: 4, padding: 10, height: "100%" }}>
      {[2, 3, 1].map((n, c) => (
        <div
          key={c}
          style={{
            flex: 1,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 5,
            padding: 5,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              height: 6,
              background: "var(--line-strong)",
              borderRadius: 2,
              width: "60%",
            }}
          ></div>
          {Array.from({ length: n }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 16,
                background: "var(--bg)",
                borderRadius: 3,
                borderLeft: `2px solid ${
                  c === 1 && i === 0 ? "var(--accent)" : "var(--line-strong)"
                }`,
              }}
            ></div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniTimeline() {
  const bars = [
    { left: 4, width: 30, color: "var(--accent)" },
    { left: 20, width: 40, color: "#4f46e5" },
    { left: 38, width: 25, color: "#0a7d5a" },
    { left: 55, width: 35, color: "#a16207" },
  ];
  return (
    <div
      style={{
        padding: "12px 10px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            height: 12,
            background: "var(--bg)",
            borderRadius: 3,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${b.left}%`,
              width: `${b.width}%`,
              top: 0,
              bottom: 0,
              background: `color-mix(in srgb, ${b.color} 25%, var(--surface))`,
              borderLeft: `2px solid ${b.color}`,
              borderRadius: 3,
            }}
          ></div>
        </div>
      ))}
    </div>
  );
}

function MiniAutomation() {
  const items = [
    { label: "When", color: "var(--ink)" },
    { label: "PR merged", color: "#4f46e5", filled: true },
    { label: "→", plain: true },
    { label: "move to", color: "var(--ink)" },
    { label: "Shipped", color: "var(--accent)", filled: true },
  ];
  return (
    <div
      style={{
        padding: 12,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {items.map((b, i) =>
        b.plain ? (
          <span
            key={i}
            style={{
              color: "var(--muted)",
              fontFamily: "var(--font-mono-landing)",
              fontSize: 11,
            }}
          >
            {b.label}
          </span>
        ) : (
          <span
            key={i}
            style={{
              padding: "3px 7px",
              borderRadius: 5,
              fontSize: 10,
              background: b.filled
                ? `color-mix(in srgb, ${b.color} 14%, transparent)`
                : "transparent",
              color: b.color,
              border: b.filled
                ? `1px solid color-mix(in srgb, ${b.color} 35%, transparent)`
                : "1px solid var(--line)",
              fontWeight: 500,
              fontFamily: "var(--font-mono-landing)",
            }}
          >
            {b.label}
          </span>
        ),
      )}
    </div>
  );
}

function SmallFeat({
  icon,
  title,
  body,
}: {
  icon: ReactElement<{ size?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: "color-mix(in srgb, var(--ink) 5%, transparent)",
          color: "var(--ink)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        {cloneElement(icon, { size: 15 })}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 4,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
        {body}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="section" id="features">
      <div className="page">
        <div className="section-eyebrow">Built for momentum</div>
        <h2 className="section-title">
          Every view your team needs. <em>Nothing they don&apos;t.</em>
        </h2>
        <p className="section-sub">
          One source of truth. Switch between Board, List and Timeline
          without losing context, filters or focus.
        </p>

        <div className="feat-grid">
          <div className="feat">
            <div className="feat-icon">
              <IconLayers />
            </div>
            <h3>Six views, one workspace</h3>
            <p>
              Board, list, timeline, calendar, docs and dashboards — all
              reading from the same tasks. No more &quot;where does this
              live?&quot;
            </p>
            <div className="feat-vis">
              <MiniBoard />
            </div>
          </div>
          <div className="feat">
            <div className="feat-icon">
              <IconBolt />
            </div>
            <h3>Automations that ship work</h3>
            <p>
              If-this-then-that rules across PRs, Slack, mail and forms. Set
              up a sprint flow in 60 seconds — without a project manager.
            </p>
            <div className="feat-vis">
              <MiniAutomation />
            </div>
          </div>
          <div className="feat">
            <div className="feat-icon">
              <IconTimeline />
            </div>
            <h3>Roadmaps that stay honest</h3>
            <p>
              Drag a task on the timeline, watch dependencies move with it.
              Forecasts update live so leadership sees the real shape.
            </p>
            <div className="feat-vis">
              <MiniTimeline />
            </div>
          </div>
        </div>

        <div className="feat-grid-secondary">
          <SmallFeat
            icon={<IconBrain />}
            title="AI standups"
            body="Draft updates from your activity."
          />
          <SmallFeat
            icon={<IconLink />}
            title="50+ integrations"
            body="GitHub, Slack, Linear, Figma."
          />
          <SmallFeat
            icon={<IconLock />}
            title="SOC 2 & SSO"
            body="SAML, SCIM, audit logs."
          />
          <SmallFeat
            icon={<IconMsg />}
            title="Inline comments"
            body="Resolve threads inside tasks."
          />
        </div>
      </div>
    </section>
  );
}
