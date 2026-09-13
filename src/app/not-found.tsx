import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-error">
      <p className="eyebrow">OFF THE TRACK</p>
      <h1>This page took a detour.</h1>
      <p className="muted">There’s still plenty to discover.</p>
      <Link className="button button-primary" href="/dashboard">
        Back to your overview
      </Link>
    </main>
  );
}
