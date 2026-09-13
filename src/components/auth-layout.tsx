import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Ticket, ShieldCheck, Globe2 } from "lucide-react";
import { Brand, TrackArt } from "./brand";
export function AuthLayout({
  children,
  signup = false,
}: {
  children: ReactNode;
  signup?: boolean;
}) {
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-copy">
          <p className="eyebrow">FOR THE LOVE OF THE RIDE</p>
          <h1>
            The queue
            <br />
            <em>was worth it.</em>
          </h1>
          <p>
            The first drop. The fifth re-ride. That one impossible loop. Keep
            the rides you can’t stop talking about.
          </p>
          <TrackArt className="auth-track" />
          <div className="auth-benefits">
            <span>
              <Ticket size={18} />
              Count unique coasters
            </span>
            <span>
              <Globe2 size={18} />
              Explore your collection
            </span>
            <span>
              <ShieldCheck size={18} />
              Private by default
            </span>
          </div>
        </div>
        <small>One coaster. One credit. Every ride counts.</small>
      </aside>
      <section className="auth-panel">
        <Link href="/leaderboard" className="back-link">
          <ArrowLeft size={16} />
          Back to the community
        </Link>
        <div className="auth-panel-inner">
          <p className="eyebrow">
            {signup ? "ADMIT ONE THRILL SEEKER" : "YOUR RIDE PASS IS WAITING"}
          </p>
          <h2>
            {signup ? "Let the adventure begin." : "Back for another ride?"}
          </h2>
          <p className="page-intro">
            {signup
              ? "A few details, and you’re on the track."
              : "Sign in to pick up where you left off."}
          </p>
          {children}
        </div>
        <p className="auth-footer">Made for enthusiasts. Made for you.</p>
      </section>
    </main>
  );
}
