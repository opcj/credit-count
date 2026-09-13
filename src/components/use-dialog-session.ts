"use client";

import { useRef, useState } from "react";

type DialogSession<T> = { key: number; value: T };

/** Opening a record again starts a new draft, even when its ID/revision match. */
export function useDialogSession<T>() {
  const nextKey = useRef(0);
  const [session, setSession] = useState<DialogSession<T> | null>(null);
  function open(value: T) {
    setSession({ key: ++nextKey.current, value });
  }
  function close(finished: DialogSession<T>) {
    // A completion from an unmounted form must not dismiss a newer draft.
    setSession((current) => (current === finished ? null : current));
  }
  return { session, open, close };
}
