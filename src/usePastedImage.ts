import { useEffect, useRef, type RefObject } from "react";

/** Attach an image from the clipboard while the dialog that contains `owner` is the one on top. */
export function usePastedImage(owner: RefObject<HTMLElement | null>, attach: (file: File) => void) {
  const latest = useRef(attach);
  latest.current = attach;
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const dialog = owner.current?.closest('[role="dialog"]');
      const top = [...document.querySelectorAll('[role="dialog"]')].at(-1);
      if (!dialog || dialog !== top) return;
      const file = [...(event.clipboardData?.files ?? [])].find(({ type }) => type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      latest.current(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}
