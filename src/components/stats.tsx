import {
  ArrowUpRight,
  Globe2,
  Factory,
  Layers3,
  Repeat2,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { countryName, type Stats } from "@/lib/domain";

export function HeadlineStats({ stats }: { stats: Stats }) {
  return (
    <div className="dispatch-counters">
      <section className="dispatch-count">
        <div className="stat-eyebrow">
          <Ticket size={17} aria-hidden="true" />
          COASTER CREDITS
        </div>
        <div className="credit-number" data-testid="total-credits">
          {stats.total_credits}
        </div>
        <p>One coaster. One credit.</p>
      </section>
      <section className="dispatch-count">
        <div className="stat-eyebrow">
          <Repeat2 size={17} aria-hidden="true" />
          TOTAL RIDES
        </div>
        <div className="ride-number" data-testid="total-rides">
          {stats.total_rides}
        </div>
        <Link href="/rides" className="text-link">
          Every lap remembered <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
export function BreakdownStats({ stats }: { stats: Stats }) {
  const groups = [
    {
      title: "Across the world",
      subtitle: "Credits by country",
      icon: Globe2,
      values: stats.by_country,
      format: countryName,
    },
    {
      title: "The makers",
      subtitle: "Credits by manufacturer",
      icon: Factory,
      values: stats.by_manufacturer,
      format: (v: string) => v,
    },
    {
      title: "Your kind of thrill",
      subtitle: "Credits by coaster type",
      icon: Layers3,
      values: stats.by_type,
      format: (v: string) => v[0].toUpperCase() + v.slice(1),
    },
  ];
  return (
    <div className="stats-grid">
      {groups.map(({ title, subtitle, icon: Icon, values, format }) => (
        <section key={title} className="card breakdown-card">
          <div className="card-icon">
            <Icon size={20} aria-hidden="true" />
          </div>
          <h3>{title}</h3>
          <p className="card-subtitle">{subtitle}</p>
          {values.length ? (
            <>
              <ul className="breakdown-list">
                {values.slice(0, 4).map(({ label, count }) => (
                  <li key={label}>
                    <div>
                      <span>{format(label)}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="bar-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${(count / Math.max(...values.map((v) => v.count))) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {values.length > 4 && (
                <details className="breakdown-more">
                  <summary>View all {values.length} categories</summary>
                  <ul className="breakdown-list">
                    {values.slice(4).map(({ label, count }) => (
                      <li key={label}>
                        <div>
                          <span>{format(label)}</span>
                          <strong>{count}</strong>
                        </div>
                        <div className="bar-track" aria-hidden="true">
                          <span
                            style={{
                              width: `${(count / Math.max(...values.map((v) => v.count))) * 100}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className="chart-empty">Your first ride starts the story.</p>
          )}
        </section>
      ))}
    </div>
  );
}
