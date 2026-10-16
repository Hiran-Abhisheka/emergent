/** Browser file helpers (download / read). No external dependencies. */

/** Triggers a download of `text` as `filename`. */
export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next task so the navigation has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Reads a picked file as UTF-8 text. */
export function readFileText(file: File): Promise<string> {
  return file.text();
}
