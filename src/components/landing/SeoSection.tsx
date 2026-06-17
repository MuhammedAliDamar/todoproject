export function SeoSection() {
  return (
    <section className="section" id="about-marktasks">
      <div className="page" style={{ maxWidth: 820 }}>
        <h2
          style={{
            fontSize: "clamp(24px, 3vw, 34px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 20,
          }}
        >
          Simple Task Management Software for Organized Teams
        </h2>
        <div
          style={{
            display: "grid",
            gap: 18,
            color: "var(--muted)",
            fontSize: 16,
            lineHeight: 1.75,
          }}
        >
          <p>
            With MarkTasks, you can create project boards, organize tasks into lists, assign work to
            team members, set priorities, and track progress from start to finish. Whether you are
            planning a marketing campaign, managing client work, building a product roadmap, or
            organizing daily operations, MarkTasks helps you see what needs to be done, who is
            responsible, and what is already completed.
          </p>
          <p>
            The platform is designed around visual task boards, making it easy to move tasks through
            different stages such as To Do, In Progress, Review, and Completed. This simple
            board-based workflow gives your team a clear view of every project without making the
            process complicated. You can use MarkTasks for personal planning, team collaboration,
            project tracking, content planning, sprint management, and everyday task organization.
          </p>
          <p>
            A good project management tool should not slow your team down. MarkTasks focuses on
            speed, clarity, and ease of use, so you can spend less time managing tools and more time
            completing real work. Clean boards, organized task cards, and a focused workspace help
            teams stay aligned, reduce missed deadlines, and improve productivity.
          </p>
          <p>
            If you are looking for an easy way to manage tasks, plan projects, and keep your team
            organized, MarkTasks gives you everything you need in one simple workspace. Create your
            first board, add your tasks, and start building a more organized workflow today.
          </p>
        </div>
      </div>
    </section>
  );
}
