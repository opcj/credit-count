"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
  safeNext,
} from "@/lib/domain";
import { Button, Field, Notice } from "./ui";

export function AuthForm({
  mode,
  next = "/dashboard",
  initialError = false,
}: {
  mode: "sign-in" | "sign-up" | "reset";
  next?: string;
  initialError?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    initialError
      ? "That confirmation link expired or could not be verified. Please sign in or request a new email."
      : "",
  );
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("display_name") ?? "");
    if (mode !== "reset" && !emailSchema.safeParse(email).success) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode !== "sign-in" && !passwordSchema.safeParse(password).success) {
      setError("Use a password between 10 and 128 characters.");
      return;
    }
    if (mode === "sign-up" && !displayNameSchema.safeParse(name).success) {
      setError("Choose a display name between 1 and 50 characters.");
      return;
    }
    setBusy(true);
    try {
      const db = browserClient();
      if (mode === "sign-up") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          setError(
            error.code === "over_email_send_rate_limit"
              ? "Please wait a moment before requesting another email."
              : "We couldn’t create that account. Check your details or try signing in.",
          );
          return;
        }
        if (data.session) window.location.replace("/dashboard");
        else
          setMessage(
            "Check your email to confirm your account, then come back and start your journal.",
          );
      } else if (mode === "reset") {
        const { error } = await db.auth.updateUser({ password });
        if (error) {
          setError(
            "We couldn’t update your password. Request a fresh recovery email and try again.",
          );
          return;
        }
        setMessage("Password updated. You can return to your journal.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) {
          setError(
            error.code === "email_not_confirmed"
              ? "Please confirm your email before signing in. Your confirmation link is in your inbox."
              : "That email and password didn’t work. Check your details and try again.",
          );
          return;
        }
        // A full navigation drops all state belonging to any previous identity.
        window.location.replace(safeNext(next));
      }
    } catch {
      setError("We couldn’t connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function recover(email: string) {
    if (busy) return;
    setError("");
    setMessage("");
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError("Enter your email above, then request a recovery link.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await browserClient().auth.resetPasswordForEmail(
        parsed.data,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        },
      );
      if (error) throw error;
      setMessage(
        "If that address has an account, a recovery link is on its way. Check your inbox.",
      );
    } catch {
      setError(
        "We couldn’t request a recovery email. Please try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack-form auth-form" onSubmit={submit}>
      {error && <Notice>{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      {mode === "sign-up" && (
        <Field
          id="display-name"
          name="display_name"
          label="What should we call you?"
          placeholder="Your display name"
          autoComplete="nickname"
          required
        />
      )}
      {mode !== "reset" && (
        <Field
          id="email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      )}
      <div className="field">
        <label htmlFor="password">
          {mode === "reset" ? "New password" : "Password"}
        </label>
        <div className="password-field">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "sign-in" ? 1 : 10}
            maxLength={128}
            placeholder={
              mode === "sign-in" ? "Your password" : "At least 10 characters"
            }
          />
          <button
            type="button"
            className="icon-button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <Button type="submit" busy={busy} className="auth-submit">
        {mode === "sign-up"
          ? "Start your collection"
          : mode === "reset"
            ? "Update password"
            : "Welcome back"}
        <ArrowRight size={17} aria-hidden="true" />
      </Button>
      {mode === "sign-in" && (
        <button
          className="text-button recovery-button"
          type="button"
          disabled={busy}
          onClick={(e) => {
            const form = e.currentTarget.form;
            if (form)
              void recover(String(new FormData(form).get("email") ?? ""));
          }}
        >
          Forgot your password? Send a recovery link
        </button>
      )}
      {mode === "sign-up" && (
        <p className="auth-privacy">
          Your ride history is always private. You decide if your name and
          credit count join the leaderboard.
        </p>
      )}
      <p className="auth-switch">
        {mode === "sign-up" ? (
          <>
            Already collecting? <Link href="/sign-in">Sign in</Link>
          </>
        ) : mode === "sign-in" ? (
          <>
            New to the ride? <Link href="/sign-up">Create an account</Link>
          </>
        ) : (
          <Link href="/dashboard">Back to your journal</Link>
        )}
      </p>
    </form>
  );
}
