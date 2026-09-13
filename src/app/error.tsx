"use client";
import { Button, Notice } from "@/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-error">
      <p className="eyebrow">A BUMP IN THE TRACK</p>
      <h1>Let’s try that again.</h1>
      <Notice>
        We couldn’t load this page. Check your connection and try again.
      </Notice>
      <Button onClick={reset}>Reload page</Button>
    </div>
  );
}
