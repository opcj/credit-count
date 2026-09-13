"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import clsx from "clsx";
import { useRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

export function Button({
  children,
  className,
  busy,
  variant = "primary",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      className={clsx("button", `button-${variant}`, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  hint,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Notice({
  children,
  kind = "error",
}: {
  children: ReactNode;
  kind?: "error" | "success" | "info";
}) {
  const Icon = kind === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={clsx("notice", `notice-${kind}`)}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal-content"
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = opener.current;
            if (target?.isConnected && !target.matches(":disabled"))
              target.focus();
            else document.getElementById("main")?.focus();
          }}
        >
          <Dialog.Title className="modal-title">{title}</Dialog.Title>
          <Dialog.Description className="muted modal-description">
            {description}
          </Dialog.Description>
          {children}
          <Dialog.Close
            className="icon-button modal-close"
            aria-label="Close dialog"
          >
            <X size={20} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
