"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trophy, LockKeyhole } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { displayNameSchema, type Profile } from "@/lib/domain";
import { ConflictError, friendlyError } from "@/lib/errors";
import { Button, Field, Notice } from "./ui";

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.display_name);
  const [optIn, setOptIn] = useState(profile.leaderboard_opt_in);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Pick<
    Profile,
    "leaderboard_opt_in"
  > | null>(null);
  const [revision, setRevision] = useState(profile.revision);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSaved(null);
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const result = await browserClient()
        .from("profiles")
        .update({ display_name: parsed.data, leaderboard_opt_in: optIn })
        .eq("user_id", profile.user_id)
        .eq("revision", revision)
        .select("revision, leaderboard_opt_in")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new ConflictError();
      setRevision(result.data.revision);
      // Confirm the committed value, never an editable draft checkbox value.
      setSaved(result.data);
      router.refresh();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-layout">
      <form className="card settings-card stack-form" onSubmit={submit}>
        <div>
          <p className="eyebrow">MAKE YOURSELF AT HOME</p>
          <h2>Your profile</h2>
        </div>
        {error && (
          <Notice>
            {error}{" "}
            <button
              className="text-button"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload latest
            </button>
          </Notice>
        )}
        {saved && (
          <Notice kind="success">
            Your settings are saved.{" "}
            {saved.leaderboard_opt_in
              ? "Your name and credit count can appear on the leaderboard."
              : "You are off the public leaderboard."}
          </Notice>
        )}
        <Field
          id="settings-name"
          label="Display name"
          disabled={busy}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(null);
          }}
          required
          autoComplete="nickname"
          hint="Names don’t need to be unique. Choose something you’re comfortable sharing if you opt in."
        />
        <div className="settings-divider" />
        <div className="heading-with-icon">
          <Trophy size={21} aria-hidden="true" />
          <h3>A little friendly competition</h3>
        </div>
        <p className="muted">
          Join the public leaderboard with just your display name and unique
          credit count. Your rides, dates, and notes stay private.
        </p>
        <label className="consent-option">
          <input
            type="checkbox"
            disabled={busy}
            checked={optIn}
            onChange={(e) => {
              setOptIn(e.target.checked);
              setSaved(null);
            }}
          />
          <span>
            <strong>Show me on the leaderboard</strong>
            <small>
              You can leave at any time. Save your settings to apply the change.
            </small>
          </span>
        </label>
        <div className="settings-actions">
          <Button type="submit" busy={busy}>
            Save settings
          </Button>
        </div>
      </form>
      <aside className="privacy-card">
        <ShieldCheck size={30} aria-hidden="true" />
        <h3>
          Your adventures.
          <br />
          Your business.
        </h3>
        <p>
          Your journal is yours alone. Other enthusiasts and catalogue admins
          cannot see your individual rides or notes.
        </p>
        <div className="privacy-footer">
          <LockKeyhole size={16} aria-hidden="true" />
          Private always feels right.
        </div>
      </aside>
    </div>
  );
}
