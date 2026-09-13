"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Trophy, RefreshCw } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import type { LeaderboardRow } from "@/lib/domain";
import { Button, EmptyState, Notice } from "./ui";

export const LEADERBOARD_PAGE_SIZE = 20;
export function Leaderboard({
  initialRows,
}: {
  initialRows: LeaderboardRow[] | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("Connecting");
  const [failed, setFailed] = useState(false);
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    const db = browserClient();
    let disposed = false,
      generation = 0,
      connected = false,
      readFailed = false,
      lastRead = Date.now();
    let request: AbortController | undefined;
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    async function fetchRows() {
      if (disposed || document.hidden) return;
      const current = ++generation;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const { data, error } = await db
          .rpc("get_leaderboard", {
            p_limit: LEADERBOARD_PAGE_SIZE + 1,
            p_offset: page * LEADERBOARD_PAGE_SIZE,
          })
          .abortSignal(controller.signal);
        if (disposed || current !== generation) return;
        if (error) throw error;
        lastRead = Date.now();
        readFailed = false;
        setFailed(false);
        setRows(data);
        setStatus(connected ? "Live" : "Periodic updates");
      } catch {
        if (disposed || current !== generation) return;
        readFailed = true;
        setFailed(true);
        setRows(null);
        setStatus("Unable to refresh");
      } finally {
        clearTimeout(timeout);
      }
    }
    function invalidate() {
      if (disposed) return;
      // In-flight responses from before a privacy event are no longer authoritative.
      generation++;
      request?.abort();
      setRows(null);
      setStatus("Refreshing");
      if (!scheduled)
        scheduled = setTimeout(() => {
          scheduled = undefined;
          void fetchRows();
        }, 200);
    }
    const channel = db
      .channel("credit-count:leaderboard", { config: { private: false } })
      .on("broadcast", { event: "leaderboard_changed" }, invalidate)
      .subscribe((state) => {
        if (disposed) return;
        connected = state === "SUBSCRIBED";
        if (connected) {
          void fetchRows();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state)) {
          // HTTP reads remain authoritative when the optional refresh channel fails.
          // Do not interrupt a read or hide a fresh result during socket retries.
          if (!readFailed)
            setStatus((current) =>
              current === "Live" ? "Periodic updates" : current,
            );
        }
      });
    const poll = setInterval(() => {
      if (!document.hidden) void fetchRows();
    }, 15_000);
    const freshness = setInterval(() => {
      if (!document.hidden && Date.now() - lastRead > 30_000) {
        setRows(null);
        if (!readFailed) setStatus("Refreshing");
      }
    }, 1000);
    const onFocus = () => {
      if (!document.hidden) {
        if (Date.now() - lastRead > 30_000) setRows(null);
        void fetchRows();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    reload.current = () => {
      void fetchRows();
    };
    void fetchRows();
    return () => {
      disposed = true;
      generation++;
      request?.abort();
      clearTimeout(scheduled);
      clearInterval(poll);
      clearInterval(freshness);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      void db.removeChannel(channel);
    };
  }, [page]);
  const visible = rows?.slice(0, LEADERBOARD_PAGE_SIZE);
  function move(delta: number) {
    setRows(null);
    setStatus("Loading");
    setPage((current) => current + delta);
  }
  return (
    <section className="card leaderboard-card" aria-label="Public leaderboard">
      <div className="leaderboard-heading">
        <div>
          <p className="eyebrow">THE PEOPLE WHO ALWAYS GO AGAIN</p>
          <h2>The big scream league.</h2>
        </div>
        <span className="live-status" role="status">
          <span
            className={status === "Live" ? "tiny-dot" : "tiny-dot inactive-dot"}
          />
          {status}
        </span>
      </div>
      {failed && (
        <div className="leaderboard-notice">
          <Notice>
            We couldn’t refresh the leaderboard.{" "}
            <button className="text-button" onClick={() => reload.current()}>
              Try again
            </button>
          </Notice>
        </div>
      )}
      {status === "Periodic updates" && !failed && (
        <div className="leaderboard-notice">
          <span>Updates every 15 seconds. </span>
          <button className="text-button" onClick={() => reload.current()}>
            Refresh now
          </button>
        </div>
      )}
      {visible ? (
        visible.length ? (
          <div className="table-scroll">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th scope="col" className="rank-column">
                    <span className="sr-only">Rank</span>
                  </th>
                  <th scope="col">ENTHUSIAST</th>
                  <th scope="col">CREDITS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={`${page}:${index}:${row.display_name}`}>
                    <td>
                      <span
                        className={`rank ${page === 0 && index < 3 ? `rank-${index + 1}` : ""}`}
                      >
                        {page * LEADERBOARD_PAGE_SIZE + index + 1}
                      </span>
                    </td>
                    <td>
                      <div className="leader-name">
                        <span
                          className={`leader-avatar avatar-color-${index % 4}`}
                          aria-hidden="true"
                        >
                          {row.display_name.slice(0, 1).toUpperCase()}
                        </span>
                        <strong>{row.display_name}</strong>
                      </div>
                    </td>
                    <td className="leader-count">{row.credit_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Trophy size={30} />}
            title={
              page ? "You’ve reached the end." : "The first spot is waiting."
            }
          >
            {page
              ? "Head back to the previous page to see the community."
              : "Opt in from your settings to share your credit count with the community."}
          </EmptyState>
        )
      ) : (
        <div className="leaderboard-loading" role="status">
          <RefreshCw className="spin" size={23} aria-hidden="true" />
          <p>
            {status === "Reconnecting"
              ? "Reconnecting to the community…"
              : "Getting the latest credit counts…"}
          </p>
          <small>We’ll show the latest collection as soon as it’s ready.</small>
        </div>
      )}
      <div className="pagination">
        <span>Unique coasters. Shared enthusiasm.</span>
        <div>
          {page > 0 && (
            <Button variant="secondary" onClick={() => move(-1)}>
              <ArrowLeft size={15} />
              Previous
            </Button>
          )}
          {rows && rows.length > LEADERBOARD_PAGE_SIZE && (
            <Button variant="secondary" onClick={() => move(1)}>
              Next
              <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
