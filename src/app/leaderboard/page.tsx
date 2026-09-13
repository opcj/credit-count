import Link from "next/link";
import { ArrowRight, ShieldCheck, Ticket, Globe2 } from "lucide-react";
import { serverClient } from "@/lib/supabase/server";
import { Brand, TrackArt, JoyDoodles } from "@/components/brand";
import { Leaderboard } from "@/components/leaderboard";
export const dynamic = "force-dynamic";
export const metadata = { title: "The community leaderboard" };
export default async function LeaderboardPage() {
  const db = await serverClient();
  const [
    { data, error },
    {
      data: { user },
    },
  ] = await Promise.all([
    db.rpc("get_leaderboard", { p_limit: 21, p_offset: 0 }),
    db.auth.getUser(),
  ]);
  return (
    <div className="public-page">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="public-header">
        <Brand />
        <nav aria-label="Public navigation">
          {user ? (
            <Link className="button button-primary" href="/dashboard">
              Your ride pass <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link className="text-link" href="/sign-up">
                Create an account
              </Link>
              <Link
                className="button button-primary public-login"
                href="/sign-in"
              >
                Sign in <ArrowRight size={16} />
              </Link>
            </>
          )}
        </nav>
      </header>
      <main id="main">
        <section className="public-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-dot" />
              FOR THE “ONE MORE RIDE” PEOPLE
            </p>
            <h1>
              More loops.
              <br />
              <em>More whoops.</em>
            </h1>
            <p>
              That stomach-drop feeling? Collect it. Log every coaster, keep
              every re-ride, and find your people along the way.
            </p>
            <Link
              className="button button-primary hero-cta"
              href={user ? "/dashboard" : "/sign-in"}
            >
              {user ? "Open your ride pass" : "Sign in to your ride pass"}
              <ArrowRight size={18} />
            </Link>
            <div className="hero-caption">
              <ShieldCheck size={16} aria-hidden="true" />
              Your rides stay private. Sharing your count is up to you.
            </div>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <JoyDoodles />
            <span className="illustration-label">PLEASE KEEP YOUR HANDS…</span>
            <strong className="poster-title">
              Actually,
              <br />
              hands up!
            </strong>
            <span className="poster-stamp">
              100%
              <br />
              <small>PURE THRILL</small>
            </span>
            <TrackArt />
            <div className="illustration-caption">
              <span>EST. FOR THE OBSESSED</span>
              <span>★ ★ ★</span>
            </div>
          </div>
        </section>
        <div className="public-benefits">
          <span>
            <Ticket size={19} aria-hidden="true" />
            <strong>ONE COASTER. ONE CREDIT.</strong> Every re-ride remembered.
          </span>
          <span>
            <Globe2 size={19} aria-hidden="true" />
            BIG DROPS. SMALL WORLD. GOOD COMPANY.
          </span>
        </div>
        <Leaderboard initialRows={error ? null : data} />
        <section className="community-note">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <h3>A shared count. A private journal.</h3>
            <p>
              Only enthusiasts who choose to join appear here. Ride histories,
              dates, and notes are always private—even from catalogue admins.
            </p>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <Brand />
        <span>Made for the ride. And the people who love it.</span>
        <Link href={user ? "/settings" : "/sign-in"}>
          {user ? "Manage your privacy" : "Sign in to your journal"}{" "}
          <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
