import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { StatsSample } from "@/simulation/types";
import type { ExperimentRecord } from "@/simulation/experiments/record";
import type { SerializedWorld } from "@/simulation/storage/state";

export const DB_NAME = "emergent-lab";
export const DB_VERSION = 1;

/** Reserved id for the rolling autosave slot (kept out of the manual list). */
export const AUTOSAVE_ID = "autosave";

/** Small, listable header for a save slot. The bulky world blob lives apart. */
export interface SaveMeta {
  id: string;
  name: string;
  createdAt: number;
  tick: number;
  population: number;
  seed: number;
  /** Number of stats samples stored with the slot. */
  samples: number;
}

interface SaveDataRecord {
  id: string;
  world: SerializedWorld;
  history: StatsSample[];
}

interface LabSchema extends DBSchema {
  saveMeta: { key: string; value: SaveMeta; indexes: { createdAt: number } };
  saveData: { key: string; value: SaveDataRecord };
  experiments: { key: string; value: ExperimentRecord; indexes: { createdAt: number } };
}

let dbPromise: Promise<IDBPDatabase<LabSchema>> | null = null;

/** IndexedDB is absent in some embeds and private modes; the UI degrades. */
export function isPersistenceSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function getDb(): Promise<IDBPDatabase<LabSchema>> {
  if (dbPromise === null) {
    dbPromise = openDB<LabSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("saveMeta")) {
          db.createObjectStore("saveMeta", { keyPath: "id" }).createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("saveData")) {
          db.createObjectStore("saveData", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("experiments")) {
          db.createObjectStore("experiments", { keyPath: "id" }).createIndex(
            "createdAt",
            "createdAt",
          );
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Save slots
// ---------------------------------------------------------------------------

/** All manual save slots, newest first. Reads only the small meta store. */
export async function listSaves(): Promise<SaveMeta[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("saveMeta", "createdAt");
  return all.filter((meta) => meta.id !== AUTOSAVE_ID).reverse();
}

export async function readAutosave(): Promise<SaveMeta | null> {
  const db = await getDb();
  return (await db.get("saveMeta", AUTOSAVE_ID)) ?? null;
}

export async function readSaveWorld(
  id: string,
): Promise<{ world: SerializedWorld; history: StatsSample[] } | null> {
  const db = await getDb();
  const record = await db.get("saveData", id);
  return record === undefined ? null : { world: record.world, history: record.history };
}

/** Writes the meta header and the world blob in one atomic transaction. */
export async function writeSave(
  meta: SaveMeta,
  world: SerializedWorld,
  history: readonly StatsSample[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["saveMeta", "saveData"], "readwrite");
  await Promise.all([
    tx.objectStore("saveMeta").put(meta),
    tx.objectStore("saveData").put({ id: meta.id, world, history: history.map((s) => ({ ...s })) }),
    tx.done,
  ]);
}

export async function deleteSave(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["saveMeta", "saveData"], "readwrite");
  await Promise.all([tx.objectStore("saveMeta").delete(id), tx.objectStore("saveData").delete(id), tx.done]);
}

export async function clearSaves(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["saveMeta", "saveData"], "readwrite");
  await Promise.all([
    tx.objectStore("saveMeta").clear(),
    tx.objectStore("saveData").clear(),
    tx.done,
  ]);
}

// ---------------------------------------------------------------------------
// Experiment library
// ---------------------------------------------------------------------------

/** Raw stored records; callers validate with `parseExperimentRecord`. */
export async function listStoredExperiments(): Promise<unknown[]> {
  const db = await getDb();
  return db.getAllFromIndex("experiments", "createdAt");
}

export async function putExperiment(record: ExperimentRecord): Promise<void> {
  const db = await getDb();
  await db.put("experiments", record);
}

export async function deleteStoredExperiment(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("experiments", id);
}

/** Replaces the whole stored library with `records` in one transaction. */
export async function replaceStoredExperiments(records: readonly ExperimentRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("experiments", "readwrite");
  const store = tx.objectStore("experiments");
  await store.clear();
  for (const record of records) await store.put(record);
  await tx.done;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
}

/** Best-effort storage estimate; `null` when the browser will not say. */
export async function estimateUsage(): Promise<StorageUsage | null> {
  if (typeof navigator === "undefined" || navigator.storage?.estimate === undefined) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { usedBytes: estimate.usage ?? 0, quotaBytes: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}
