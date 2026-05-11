import Link from "next/link";
import { IconArrowRight } from "./Icons";

export function FinalCTA() {
  return (
    <section className="cta-wrap">
      <div className="page">
        <div className="cta">
          <div className="cta-inner">
            <h2>
              Make your tools <em>disappear.</em>
            </h2>
            <p>
              Spin up a workspace in 60 seconds. Import your existing
              projects, invite your team, ship your roadmap by Friday.
            </p>
            <div
              style={{
                display: "inline-flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <Link className="btn btn-accent btn-lg" href="/register">
                Start free <IconArrowRight size={14} />
              </Link>
              <a
                className="btn btn-lg"
                href="#"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "var(--bg)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                Book a demo
              </a>
            </div>
            <div
              style={{
                marginTop: 28,
                display: "inline-flex",
                alignItems: "center",
                gap: 18,
                color: "rgba(250,250,249,0.5)",
                fontSize: 12,
                fontFamily: "var(--font-mono-landing)",
              }}
            >
              <span>NO CREDIT CARD</span>
              <span
                style={{
                  width: 3,
                  height: 3,
                  background: "currentColor",
                  borderRadius: 50,
                  opacity: 0.5,
                }}
              ></span>
              <span>14-DAY PRO TRIAL</span>
              <span
                style={{
                  width: 3,
                  height: 3,
                  background: "currentColor",
                  borderRadius: 50,
                  opacity: 0.5,
                }}
              ></span>
              <span>CANCEL ANYTIME</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
