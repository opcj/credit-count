import Link from "next/link";
import { ArrowRight, Sparkles, Heart, Ticket } from "lucide-react";
import { getCatalogue, getHistory, getStats, requireViewer } from "@/lib/data";
import { dateLabel } from "@/lib/domain";
import { RideComposer } from "@/components/ride-composer";
import { HeadlineStats, BreakdownStats } from "@/components/stats";
import { TrackArt, JoyDoodles } from "@/components/brand";

export const metadata = { title: "Your overview" };
export default async function Dashboard() {
  const [viewer, coasters, stats, history] = await Promise.all([
    requireViewer(),
    getCatalogue(),
    getStats(),
    getHistory(1, 3),
  ]);
  return (
    <>
      <div className="overview-heading">
        <p className="eyebrow">
          Back in the front row, {viewer.profile.display_name.split(" ")[0]}.
        </p>
        <span>YOUR PERSONAL RIDE JOURNAL</span>
      </div>
      <section className="ride-scene">
        <header className="scene-heading">
          <p className="scene-kicker">
            <Sparkles size={14} aria-hidden="true" /> A little airtime. A lot of
            joy.
          </p>
          <h1>
            More airtime.
            <br />
            <em>More stories.</em>
          </h1>
          <p className="scene-intro">
            Big drops. Happy screams. Another one for the collection.
          </p>
        </header>
        <div className="scene-illustration" aria-hidden="true">
          <JoyDoodles />
          <TrackArt className="scene-track" />
          <span className="scene-sticker">Wheee!</span>
          <span className="scene-caption">Hands up. Happy place.</span>
        </div>
      </section>
      <div className="dispatch-layout">
        <section className="logger-card dispatch-station">
          <div className="station-sign">
            <span>RIDE LOG</span>
            <span>PLATFORM 01 ↘</span>
          </div>
          <div className="section-heading">
            <div className="heading-with-icon">
              <span className="icon-tile">
                <Ticket size={21} aria-hidden="true" />
              </span>
              <div>
                <h2>Just got off a ride?</h2>
                <p>Find it. Log it. Go again.</p>
              </div>
            </div>
          </div>
          <RideComposer coasters={coasters} />
          <p className="station-privacy">
            {viewer.profile.leaderboard_opt_in
              ? "Your credit count is on the leaderboard. Ride details stay private."
              : "Your ride log is private. Just you and the memories."}
          </p>
        </section>
        <div className="collection-summary">
          <section
            className="collection-pass"
            aria-label="Your collection totals"
          >
            <div className="collection-heading">
              <span>YOUR RIDE PASS</span>
              <Ticket size={18} aria-hidden="true" />
            </div>
            <HeadlineStats stats={stats} />
          </section>
          <section className="card favourite-card">
            <div className="heading-with-icon">
              <Heart size={20} aria-hidden="true" />
              <h3>Worth another lap</h3>
            </div>
            {stats.most_ridden ? (
              <>
                <p className="favourite-name">{stats.most_ridden.name}</p>
                <p className="muted">{stats.most_ridden.park}</p>
                <span className="pill">
                  {stats.most_ridden.rides}{" "}
                  {stats.most_ridden.rides === 1 ? "ride" : "rides"} and
                  counting
                </span>
              </>
            ) : (
              <div className="favourite-empty">
                <Sparkles size={26} aria-hidden="true" />
                <p>A favourite is waiting to happen.</p>
                <small>Log a ride to meet your most-ridden coaster.</small>
              </div>
            )}
          </section>
        </div>
      </div>
      <div className="section-heading standalone">
        <div>
          <p className="eyebrow">BEEN THERE. SCREAMED THAT.</p>
          <h2>The ground you’ve covered.</h2>
        </div>
        <span className="muted small-text">Every coaster counts once.</span>
      </div>
      <BreakdownStats stats={stats} />
      <section className="card recent-card">
        <div className="section-heading">
          <h3>Fresh from your journal</h3>
          <Link href="/rides" className="text-link">
            View all <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {history.rides.length ? (
          <ul className="recent-list">
            {history.rides.map((ride) => (
              <li key={ride.id}>
                <div>
                  <strong>{ride.coaster.name}</strong>
                  <small>{ride.coaster.park}</small>
                </div>
                <time dateTime={ride.ridden_on}>
                  {dateLabel(ride.ridden_on)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="chart-empty">
            Your adventures will appear here after your first ride.
          </p>
        )}
      </section>
    </>
  );
}
