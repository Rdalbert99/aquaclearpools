/**
 * Tiny registry of screens holding unsaved work. The app updater never reloads
 * while any screen is registered here, so a tech's in-progress visit is safe.
 */
const holders = new Set<string>();
const listeners = new Set<() => void>();

export function setUnsavedWork(id: string, dirty: boolean) {
  const had = holders.has(id);
  if (dirty) holders.add(id); else holders.delete(id);
  if (had !== dirty) listeners.forEach((l) => l());
}

export function hasUnsavedWork(): boolean {
  return holders.size > 0;
}

export function onUnsavedWorkChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Pure rule: apply a waiting update only when nothing is unsaved and the app is on screen. */
export function canAutoApplyUpdate(opts: { hasUnsaved: boolean; visible: boolean }): boolean {
  return !opts.hasUnsaved && opts.visible;
}
