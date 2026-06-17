import Link from "next/link";
import { IconArrowRight, IconCheck, IconPlay } from "./Icons";

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid-bg" aria-hidden="true"></div>
      <div className="page hero-inner">
        <div className="eyebrow">
          <span className="eyebrow-chip">
            <span
              className="eyebrow-dot"
              style={{ display: "inline-block", marginRight: 6, verticalAlign: "middle" }}
            ></span>
            New
          </span>
          New workspace for boards, tasks and team planning
          <IconArrowRight size={12} style={{ marginLeft: 2, opacity: 0.6 }} />
        </div>

        <h1 className="headline">
          Plan your work.
          <br />
          <em>Stay on track.</em>
        </h1>

        <p className="lede">
          MarkTasks helps teams organize projects with simple boards, clear task
          lists and visual progress tracking — all in one focused workspace.
        </p>

        <div className="hero-ctas">
          <Link className="btn btn-accent btn-lg" href="/register">
            Start free — no card <IconArrowRight size={14} />
          </Link>
          <a className="btn btn-outline btn-lg" href="#product">
            <IconPlay size={12} /> See how it works
          </a>
        </div>

        <div className="hero-meta">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="check">
              <IconCheck size={9} sw={3} />
            </span>
            Free for teams of 10
          </span>
          <span className="hero-meta-dot"></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="check">
              <IconCheck size={9} sw={3} />
            </span>
            Boards, lists and cards
          </span>
          <span className="hero-meta-dot"></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="check">
              <IconCheck size={9} sw={3} />
            </span>
            No credit card required
          </span>
        </div>
      </div>
    </section>
  );
}
