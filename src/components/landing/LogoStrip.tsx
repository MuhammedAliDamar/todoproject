export function LogoStrip() {
  const logos = [
    { name: "Northwind", mark: "◐" },
    { name: "Helios", mark: "✺" },
    { name: "Parallax", mark: "▲" },
    { name: "Forma", mark: "■" },
    { name: "Kepler", mark: "◇" },
    { name: "Arcline", mark: "◯" },
  ];
  return (
    <section className="logo-strip">
      <div className="page">
        <div className="logo-strip-label">
          Trusted by 12,000+ teams shipping daily
        </div>
        <div className="logo-row">
          {logos.map((l) => (
            <div key={l.name} className="logo-cell">
              <span style={{ marginRight: 8, fontSize: 18, opacity: 0.7 }}>
                {l.mark}
              </span>
              {l.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
