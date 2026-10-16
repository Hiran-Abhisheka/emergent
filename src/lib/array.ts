/** Small generic array helpers (pure). */

/**
 * Returns at most `maxPoints` evenly spaced items, always including the first
 * and the last. Used to keep charts cheap without changing their shape.
 */
export function downsample<T>(items: readonly T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) return [...items];
  const step = (items.length - 1) / (maxPoints - 1);
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(items[Math.round(i * step)]);
  return out;
}
