/** A one-line status message (import results, errors). */
export function Notice({ tone, children }: { tone: "ok" | "error"; children: string }) {
  return (
    <p
      role="status"
      className={
        tone === "ok"
          ? "pt-2 text-[10px] leading-relaxed text-green"
          : "pt-2 text-[10px] leading-relaxed text-danger"
      }
    >
      {children}
    </p>
  );
}

/** Result of an import/export action, rendered by `Notice`. */
export type NoticeState = { tone: "ok" | "error"; text: string } | null;
