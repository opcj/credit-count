export default function Loading() {
  return (
    <div aria-label="Loading your page" role="status" className="page-loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-hero" />
      <div className="stats-grid">
        {[1, 2, 3].map((n) => (
          <div className="skeleton skeleton-card" key={n} />
        ))}
      </div>
      <span className="sr-only">Loading your page…</span>
    </div>
  );
}
