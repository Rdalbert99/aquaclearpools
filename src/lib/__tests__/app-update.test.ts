import { describe, it, expect } from 'vitest';
import { canAutoApplyUpdate, setUnsavedWork, hasUnsavedWork } from '../unsaved-work';
import { saveVisitDraft, loadVisitDraft, clearVisitDraft, VISIT_DRAFT_MAX_AGE_MS } from '../visit-draft';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe('app update safety', () => {
  it('never auto-updates while a form has unsaved changes', () => {
    expect(canAutoApplyUpdate({ hasUnsaved: true, visible: true })).toBe(false);
  });
  it('updates when nothing is unsaved and the app is on screen', () => {
    expect(canAutoApplyUpdate({ hasUnsaved: false, visible: true })).toBe(true);
    expect(canAutoApplyUpdate({ hasUnsaved: false, visible: false })).toBe(false);
  });
  it('tracks unsaved work per screen', () => {
    setUnsavedWork('visit', true);
    expect(hasUnsavedWork()).toBe(true);
    setUnsavedWork('visit', false);
    expect(hasUnsavedWork()).toBe(false);
  });
});

describe('visit draft', () => {
  it('restores unsaved readings after reload', () => {
    const kv = mem();
    saveVisitDraft('c1', { ph: 7.6, ch: 325 }, 1000, kv);
    expect(loadVisitDraft<{ ph: number }>('c1', 2000, kv)?.data.ph).toBe(7.6);
  });
  it('is gone after a successful save clears it', () => {
    const kv = mem();
    saveVisitDraft('c1', { ph: 7.6 }, 1000, kv);
    clearVisitDraft('c1', kv);
    expect(loadVisitDraft('c1', 2000, kv)).toBeNull();
  });
  it('does not restore another pool\'s draft or a stale one', () => {
    const kv = mem();
    saveVisitDraft('c1', { ph: 7.6 }, 0, kv);
    expect(loadVisitDraft('c2', 1, kv)).toBeNull();
    expect(loadVisitDraft('c1', VISIT_DRAFT_MAX_AGE_MS + 1, kv)).toBeNull();
  });
});
