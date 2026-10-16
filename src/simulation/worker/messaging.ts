import type { WorkerEvent } from "../worker-messages";

/**
 * Minimal worker global typing. Declared locally instead of adding
 * `"WebWorker"` to tsconfig `lib`, which would make `self` a duplicate
 * identifier alongside the DOM lib (see docs/DECISIONS.md D-308).
 */
interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

const ctx = self as unknown as WorkerScope;

/** Posts an event to the client, optionally transferring buffers. */
export function post(event: WorkerEvent, transfer?: Transferable[]): void {
  if (transfer === undefined) {
    ctx.postMessage(event);
  } else {
    ctx.postMessage(event, transfer);
  }
}

/** Installs the worker's single inbound message handler. */
export function onMessage(handler: (event: MessageEvent) => void): void {
  ctx.onmessage = handler;
}
