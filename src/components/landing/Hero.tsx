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
          AI agents that close your tickets while you sleep
          <IconArrowRight size={12} style={{ marginLeft: 2, opacity: 0.6 }} />
        </div>

        <h1 className="headline">
          Stop juggling tools.
          <br />
          <em>Always FREE.</em>
        </h1>

        <p className="lede">
          marktasks is the calm, fast project tracker that replaces Asana,
          Jira and a dozen browser tabs — one workspace for boards, sprints,
          docs and roadmaps.
        </p>

        <div className="hero-ctas">
          <Link className="btn btn-accent btn-lg" href="/register">
            Start free — no card <IconArrowRight size={14} />
          </Link>
          <a className="btn btn-outline btn-lg" href="#product">
            <IconPlay size={12} /> Watch 90-sec tour
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
            Import from Asana in 3 clicks
          </span>
          <span className="hero-meta-dot"></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="check">
              <IconCheck size={9} sw={3} />
            </span>
            SOC 2 Type II
          </span>
        </div>
      </div>
    </section>
  );
}
