import type { WorkerCommand, WorkerEvent } from "@/simulation/worker-messages";

export type { SnapshotData } from "@/hooks/simulation-types";

export type SimStatus = "booting" | "running" | "paused" | "error";

type Event<K extends WorkerEvent["type"]> = Extract<WorkerEvent, { type: K }>;

export interface SimulationClientHandlers {
  onWorld(event: Event<"WORLD">): void;
  onStatus(event: Event<"STATUS">): void;
  onSnapshot(event: Event<"SNAPSHOT">): void;
  onStats(event: Event<"STATS">): void;
  onInspection(event: Event<"INSPECTION">): void;
  onSavedState(event: Event<"SAVED_STATE">): void;
  onError(event: Event<"ERROR">): void;
}

export interface SimulationClient {
  post(command: WorkerCommand, transfer?: Transferable[]): void;
  terminate(): void;
}

/**
 * Creates the simulation worker and funnels its events to typed handlers. The
 * worker URL is resolved by Vite, which emits the worker as a separate ES
 * bundle (see vite.config.ts `worker.format`).
 */
export function createSimulationClient(handlers: SimulationClientHandlers): SimulationClient {
  const worker = new Worker(new URL("../simulation/simulation.worker.ts", import.meta.url), {
    type: "module",
  });
  let terminated = false;

  worker.addEventListener("message", (event: MessageEvent<WorkerEvent>) => {
    const message = event.data;
    switch (message.type) {
      case "WORLD":
        handlers.onWorld(message);
        break;
      case "STATUS":
        handlers.onStatus(message);
        break;
      case "SNAPSHOT":
        handlers.onSnapshot(message);
        break;
      case "STATS":
        handlers.onStats(message);
        break;
      case "INSPECTION":
        handlers.onInspection(message);
        break;
      case "SAVED_STATE":
        handlers.onSavedState(message);
        break;
      case "ERROR":
        handlers.onError(message);
        break;
    }
  });

  worker.addEventListener("error", (event: ErrorEvent) => {
    handlers.onError({ type: "ERROR", message: event.message || "worker crashed" });
  });

  return {
    post(command, transfer) {
      if (terminated) return;
      if (transfer === undefined) worker.postMessage(command);
      else worker.postMessage(command, transfer);
    },
    terminate() {
      terminated = true;
      worker.terminate();
    },
  };
}
