"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Check, ArrowRight, MapPin } from "lucide-react";
import {
  countryName,
  localToday,
  rideSchema,
  type Coaster,
} from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import { saveRide } from "@/lib/rides";
import { Button, Field, Notice } from "./ui";

const subscribe = () => () => {};
export function RideComposer({
  coasters,
  initialCoasterId = "",
  onSaved,
}: {
  coasters: Coaster[];
  initialCoasterId?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const today = useSyncExternalStore(
    subscribe,
    () => localToday(),
    () => "",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialCoasterId);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAttempt, setPendingAttempt] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const attempt = useRef<string | null>(null);
  const chosen = coasters.find((c) => c.id === selected);
  const results = coasters
    .filter(
      (c) =>
        !c.archived_at &&
        `${c.name} ${c.park}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .slice(0, 4);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSuccess("");
    const values = { coaster_id: selected, ridden_on: date || today, note };
    const parsed = rideSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    attempt.current ??= crypto.randomUUID();
    setPendingAttempt(true);
    try {
      await saveRide(attempt.current, values);
      setSuccess(`${chosen?.name ?? "Your ride"} added to your journal.`);
      attempt.current = null;
      setPendingAttempt(false);
      setNote("");
      setSelected("");
      setQuery("");
      router.refresh();
      onSaved?.();
    } catch (error) {
      // A database rejection is definitive. Network failures may have committed.
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        typeof error.code === "string" &&
        error.code &&
        error.code !== "23505"
      ) {
        attempt.current = null;
        setPendingAttempt(false);
      }
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="ride-composer">
      {error && <Notice>{error}</Notice>}
      {error && pendingAttempt && (
        <p className="muted small-text">
          Retry this ride to confirm whether it saved. Its details are held
          until the result is confirmed.
        </p>
      )}
      {success && <Notice kind="success">{success}</Notice>}
      <div className="field">
        <label htmlFor="ride-search">Find your coaster</label>
        <div className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            id="ride-search"
            type="search"
            placeholder="Search a coaster or park…"
            value={query}
            autoComplete="off"
            disabled={busy || pendingAttempt}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected("");
              setSuccess("");
            }}
          />
        </div>
      </div>
      {chosen ? (
        <div className="selected-coaster">
          <span className="selected-icon">
            <Check size={18} aria-hidden="true" />
          </span>
          <div>
            <strong>{chosen.name}</strong>
            <small>
              {chosen.park} · {countryName(chosen.country_code)}
            </small>
          </div>
          <button
            type="button"
            className="text-button"
            disabled={busy || pendingAttempt}
            onClick={() => setSelected("")}
          >
            Change
          </button>
        </div>
      ) : (
        <ul className="search-results" aria-label="Matching coasters">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.id)}
                aria-label={`Select ${c.name}, ${c.park}`}
              >
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    <MapPin size={11} aria-hidden="true" />
                    {c.park} · {countryName(c.country_code)}
                  </small>
                </span>
                <Plus size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
          {!results.length && (
            <li className="no-results">
              No coasters found. Try a different name or park.
            </li>
          )}
        </ul>
      )}
      <div className="composer-details">
        <Field
          id="ride-date"
          label="Date ridden"
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          required
          disabled={busy || pendingAttempt}
          value={date || today}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="field">
          <label htmlFor="ride-note">
            A little memory <span className="optional">optional</span>
          </label>
          <input
            id="ride-note"
            disabled={busy || pendingAttempt}
            value={note}
            placeholder="Front row. Worth the wait."
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <div className="composer-bottom">
        <small>First time or fiftieth, log every ride.</small>
        <Button
          type="submit"
          busy={busy}
          disabled={!chosen || !(date || today)}
        >
          {busy ? "Saving ride…" : "Log this ride"}
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
