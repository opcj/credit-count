"use client";
import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Trash2,
  NotebookPen,
  MapPin,
} from "lucide-react";
import { dateLabel, rideSchema, type Ride, type Coaster } from "@/lib/domain";
import { deleteRide, updateRide } from "@/lib/rides";
import { friendlyError } from "@/lib/errors";
import { Button, EmptyState, Field, Modal, Notice } from "./ui";
import { useDialogSession } from "./use-dialog-session";

function EditRide({
  ride,
  coasters,
  done,
  onSaved,
}: {
  ride: Ride;
  coasters: Coaster[];
  done: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const values = {
      coaster_id: String(form.get("coaster_id")),
      ridden_on: String(form.get("ridden_on")),
      note: String(form.get("note")),
    };
    const parsed = rideSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateRide(ride.id, ride.revision, values);
      onSaved();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack-form">
      {error && (
        <Notice>
          {error}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => window.location.reload()}
          >
            Discard draft and reload latest
          </button>
        </Notice>
      )}
      <div className="field">
        <label htmlFor="edit-coaster">Coaster</label>
        <select
          id="edit-coaster"
          name="coaster_id"
          disabled={busy}
          defaultValue={ride.coaster_id}
        >
          {coasters
            .filter((c) => !c.archived_at || c.id === ride.coaster_id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.park}
                {c.archived_at ? " (archived)" : ""}
              </option>
            ))}
        </select>
      </div>
      <Field
        label="Date ridden"
        id="edit-date"
        name="ridden_on"
        disabled={busy}
        type="date"
        required
        defaultValue={ride.ridden_on}
        min="0001-01-01"
        max="9999-12-31"
      />
      <div className="field">
        <label htmlFor="edit-note">
          Your note{" "}
          <span className="optional">optional · up to 500 characters</span>
        </label>
        <textarea
          id="edit-note"
          name="note"
          disabled={busy}
          defaultValue={ride.note ?? ""}
          rows={4}
        />
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={done}>
          Cancel
        </Button>
        <Button type="submit" busy={busy}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
export function RideHistory({
  rides,
  count,
  page,
  coasters,
}: {
  rides: Ride[];
  count: number;
  page: number;
  coasters: Coaster[];
}) {
  const editor = useDialogSession<Ride>();
  const edit = editor.session;
  const [remove, setRemove] = useState<Ride | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const pages = Math.max(1, Math.ceil(count / 12));
  async function confirmDelete() {
    if (!remove) return;
    setError("");
    setBusy(true);
    try {
      await deleteRide(remove.id, remove.revision);
      setRemove(null);
      startTransition(() => {
        if (rides.length === 1 && page > 1)
          router.replace(`/rides?page=${page - 1}`);
        router.refresh();
      });
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {rides.length ? (
        <div className="card history-card">
          <div className="history-header">
            <h2>Your ride journal</h2>
            <span className="muted small-text">
              {count} {count === 1 ? "ride" : "rides"} remembered
            </span>
          </div>
          <ul className="history-list">
            {rides.map((ride) => (
              <li key={ride.id}>
                <div className="ride-date-tile" aria-hidden="true">
                  <strong>{Number(ride.ridden_on.slice(8))}</strong>
                  <span>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      timeZone: "UTC",
                    }).format(new Date(`${ride.ridden_on}T12:00:00Z`))}
                  </span>
                </div>
                <div className="ride-entry">
                  <div className="ride-entry-heading">
                    <h3>{ride.coaster.name}</h3>
                    {ride.coaster.archived_at && (
                      <span className="pill">Archived coaster</span>
                    )}
                  </div>
                  <p>
                    <MapPin size={12} aria-hidden="true" />
                    {ride.coaster.park}
                    <span aria-hidden="true">·</span>
                    <time dateTime={ride.ridden_on}>
                      {dateLabel(ride.ridden_on)}
                    </time>
                  </p>
                  {ride.note && <blockquote>{ride.note}</blockquote>}
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit ride on ${ride.coaster.name}`}
                    title="Edit ride"
                    disabled={refreshing}
                    onClick={() => editor.open(ride)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    aria-label={`Delete ride on ${ride.coaster.name}`}
                    title="Delete ride"
                    disabled={refreshing}
                    onClick={() => {
                      setError("");
                      setRemove(ride);
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="pagination">
            <span>
              Page {page} of {pages}
            </span>
            <div>
              {page > 1 && (
                <Link
                  className="button button-secondary"
                  href={`/rides?page=${page - 1}`}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  className="button button-secondary"
                  href={`/rides?page=${page + 1}`}
                >
                  Next
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<NotebookPen size={28} />}
            title="The first page is yours."
          >
            Your rides, notes, and favourite moments will live here.
          </EmptyState>
          <div className="empty-action">
            <Link href="/dashboard" className="button button-primary">
              Log your first ride <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
      <Modal
        open={!!edit}
        onOpenChange={(open) => {
          if (!open && edit) editor.close(edit);
        }}
        title="Edit this memory"
        description="Your totals and statistics update when you save."
      >
        {edit && (
          <EditRide
            key={edit.key}
            ride={edit.value}
            coasters={coasters}
            done={() => editor.close(edit)}
            onSaved={() => {
              editor.close(edit);
              startTransition(() => router.refresh());
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!remove}
        onOpenChange={(open) => {
          if (!open && !busy) setRemove(null);
        }}
        title="Remove this ride?"
        description={`This removes your ${remove?.coaster.name ?? ""} ride on ${remove ? dateLabel(remove.ridden_on) : ""}, including its note. Other rides stay in your journal.`}
      >
        {error && <Notice>{error}</Notice>}
        <div className="modal-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRemove(null)}
          >
            Keep ride
          </Button>
          <Button variant="danger" busy={busy} onClick={confirmDelete}>
            Delete ride
          </Button>
        </div>
      </Modal>
    </>
  );
}
