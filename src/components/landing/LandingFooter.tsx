export function LandingFooter() {
  return (
    <footer className="footer">
      <div className="page">
        <div className="footer-brand" style={{ maxWidth: 520 }}>
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="MarkTasks" style={{ height: 40, width: "auto", display: "block" }} />
          </a>
          <p style={{ marginTop: 14 }}>
            MarkTasks is a simple and flexible task management software built for teams, freelancers,
            startups, and growing businesses that want to plan work without confusion. Instead of losing
            important tasks in chats, spreadsheets, emails, or different tools, MarkTasks brings your
            projects into one clear workspace where everything is easier to follow.
          </p>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MarkTasks. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
