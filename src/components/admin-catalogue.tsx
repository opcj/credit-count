"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Combine,
  Search,
  ShieldCheck,
} from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { coasterSchema, countryName, type Coaster } from "@/lib/domain";
import { ConflictError, friendlyError } from "@/lib/errors";
import { Button, EmptyState, Field, Modal, Notice } from "./ui";
import { useDialogSession } from "./use-dialog-session";

function CatalogueForm({
  coaster,
  done,
  onSaved,
}: {
  coaster: Coaster | null;
  done: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = coasterSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const db = browserClient();
      if (coaster) {
        const result = await db
          .from("coasters")
          .update(parsed.data)
          .eq("id", coaster.id)
          .eq("revision", coaster.revision)
          .select("id")
          .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new ConflictError();
      } else {
        const { error } = await db.from("coasters").insert(parsed.data);
        if (error) throw error;
      }
      onSaved();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack-form">
      {error && <Notice>{error}</Notice>}
      <Field
        id="coaster-name"
        name="name"
        disabled={busy}
        label="Coaster name"
        defaultValue={coaster?.name}
        required
      />
      <Field
        id="coaster-park"
        name="park"
        disabled={busy}
        label="Park"
        defaultValue={coaster?.park}
        required
      />
      <div className="form-columns">
        <Field
          id="coaster-country"
          name="country_code"
          disabled={busy}
          label="Country code"
          placeholder="GB"
          defaultValue={coaster?.country_code}
          required
          minLength={2}
          maxLength={2}
          hint="Two letters: GB, US, DE, FR…"
        />
        <div className="field">
          <label htmlFor="coaster-type">Coaster type</label>
          <select
            id="coaster-type"
            name="type"
            disabled={busy}
            defaultValue={coaster?.type ?? "steel"}
          >
            <option value="steel">Steel</option>
            <option value="wooden">Wooden</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
      </div>
      <Field
        id="coaster-manufacturer"
        name="manufacturer"
        disabled={busy}
        label="Manufacturer"
        defaultValue={coaster?.manufacturer}
        required
        hint="Use the same name as existing entries by this manufacturer."
      />
      <Field
        id="coaster-source"
        name="source_url"
        disabled={busy}
        label="Reference URL (optional)"
        type="url"
        placeholder="https://…"
        defaultValue={coaster?.source_url ?? ""}
      />
      <div className="modal-actions">
        <Button variant="secondary" onClick={done}>
          Cancel
        </Button>
        <Button type="submit" busy={busy}>
          {coaster ? "Save coaster" : "Add coaster"}
        </Button>
      </div>
    </form>
  );
}
type Action = {
  kind: "archive" | "restore" | "delete" | "merge";
  coaster: Coaster;
};
export function AdminCatalogue({ coasters }: { coasters: Coaster[] }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("active");
  const editor = useDialogSession<Coaster | "new">();
  const editing = editor.session;
  const [action, setAction] = useState<Action | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const results = coasters.filter(
    (c) =>
      `${c.name} ${c.park}`.toLowerCase().includes(query.toLowerCase()) &&
      (scope === "all" ||
        (scope === "archived" ? !!c.archived_at : !c.archived_at)),
  );
  const targetCoaster = coasters.find((c) => c.id === target);
  function begin(kind: Action["kind"], coaster: Coaster) {
    setError("");
    setTarget("");
    setAction({ kind, coaster });
  }
  async function confirm() {
    if (!action) return;
    setBusy(true);
    setError("");
    const { kind, coaster } = action;
    const db = browserClient();
    try {
      if (kind === "merge") {
        if (!targetCoaster) {
          setError("Choose the canonical coaster to keep.");
          return;
        }
        const { error } = await db.rpc("merge_coasters", {
          p_source_id: coaster.id,
          p_target_id: targetCoaster.id,
          p_source_revision: coaster.revision,
          p_target_revision: targetCoaster.revision,
        });
        if (error) throw error;
      } else {
        const result =
          kind === "delete"
            ? await db
                .from("coasters")
                .delete()
                .eq("id", coaster.id)
                .eq("revision", coaster.revision)
                .select("id")
                .maybeSingle()
            : await db
                .from("coasters")
                .update({
                  archived_at:
                    kind === "archive" ? new Date().toISOString() : null,
                })
                .eq("id", coaster.id)
                .eq("revision", coaster.revision)
                .select("id")
                .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new ConflictError();
      }
      setAction(null);
      startTransition(() => router.refresh());
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  const description =
    action?.kind === "merge"
      ? "Move all ride references to the correct entry, then remove this duplicate. Every individual ride and note is preserved. This cannot be automatically undone."
      : action?.kind === "archive"
        ? "Remove this coaster from active browsing and new ride logging. Existing rides and earned credits are preserved. You can restore it later."
        : action?.kind === "restore"
          ? "Make this coaster available for browsing and new rides again. Existing histories are unchanged."
          : "Permanently remove this unused catalogue entry. If it has ride history, deletion is blocked; archive it instead.";
  return (
    <>
      <div className="admin-callout">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          You look after the catalogue. Everyone’s personal ride journal stays
          private.
        </p>
      </div>
      <div className="card admin-card">
        <div className="admin-toolbar">
          <div className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search managed coasters"
              placeholder="Search a coaster or park…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Catalogue status"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="active">Active coasters</option>
            <option value="archived">Archived coasters</option>
            <option value="all">All coasters</option>
          </select>
          <Button disabled={refreshing} onClick={() => editor.open("new")}>
            <Plus size={17} />
            Add coaster
          </Button>
        </div>
        {results.length ? (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>COASTER / PARK</th>
                  <th>COUNTRY</th>
                  <th>TYPE</th>
                  <th>MANUFACTURER</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <small>
                        {c.park}
                        {c.archived_at ? " · Archived" : ""}
                      </small>
                    </td>
                    <td>{countryName(c.country_code)}</td>
                    <td>
                      <span className={`type-badge type-${c.type}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="manufacturer-cell">{c.manufacturer}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="Edit"
                          disabled={refreshing}
                          aria-label={`Edit ${c.name}`}
                          onClick={() => editor.open(c)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          title={c.archived_at ? "Restore" : "Archive"}
                          disabled={refreshing}
                          aria-label={`${c.archived_at ? "Restore" : "Archive"} ${c.name}`}
                          onClick={() =>
                            begin(c.archived_at ? "restore" : "archive", c)
                          }
                        >
                          {c.archived_at ? (
                            <ArchiveRestore size={16} />
                          ) : (
                            <Archive size={16} />
                          )}
                        </button>
                        <button
                          className="icon-button"
                          title="Merge duplicate"
                          disabled={refreshing}
                          aria-label={`Merge ${c.name}`}
                          onClick={() => begin("merge", c)}
                        >
                          <Combine size={16} />
                        </button>
                        <button
                          className="icon-button danger-icon"
                          title="Delete unused entry"
                          disabled={refreshing}
                          aria-label={`Delete ${c.name}`}
                          onClick={() => begin("delete", c)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Search />} title="No matching coasters">
            Try a different name or catalogue status.
          </EmptyState>
        )}
        <div className="admin-table-footer">
          {results.length} catalogue{" "}
          {results.length === 1 ? "entry" : "entries"} · Changes apply to the
          shared collection.
        </div>
      </div>
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && editing) editor.close(editing);
        }}
        title={
          editing?.value === "new" ? "Add a coaster" : "Edit catalogue details"
        }
        description="Keep names and manufacturers consistent so everyone’s credits are comparable."
      >
        {editing && (
          <CatalogueForm
            key={editing.key}
            coaster={editing.value === "new" ? null : editing.value}
            done={() => editor.close(editing)}
            onSaved={() => {
              editor.close(editing);
              startTransition(() => router.refresh());
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
        title={`${action ? action.kind[0].toUpperCase() + action.kind.slice(1) : ""} ${action?.coaster.name ?? ""}?`}
        description={description}
      >
        {error && <Notice>{error}</Notice>}
        {action?.kind === "merge" && (
          <>
            <div className="field">
              <label htmlFor="merge-target">Canonical coaster to keep</label>
              <select
                id="merge-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose the correct entry…</option>
                {coasters
                  .filter((c) => c.id !== action.coaster.id && !c.archived_at)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.park}
                    </option>
                  ))}
              </select>
            </div>
            {targetCoaster && (
              <div className="merge-comparison">
                <div>
                  <small>REMOVE DUPLICATE</small>
                  <strong>{action.coaster.name}</strong>
                  <p>{action.coaster.park}</p>
                </div>
                <div>
                  <small>KEEP CANONICAL</small>
                  <strong>{targetCoaster.name}</strong>
                  <p>{targetCoaster.park}</p>
                </div>
              </div>
            )}
          </>
        )}
        <div className="modal-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setAction(null)}
          >
            Cancel
          </Button>
          <Button
            busy={busy}
            variant={
              action?.kind === "delete" || action?.kind === "merge"
                ? "danger"
                : "primary"
            }
            disabled={action?.kind === "merge" && !target}
            onClick={confirm}
          >
            {action?.kind === "merge"
              ? "Merge and preserve rides"
              : action?.kind === "delete"
                ? "Delete permanently"
                : action?.kind === "archive"
                  ? "Archive coaster"
                  : "Restore coaster"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
