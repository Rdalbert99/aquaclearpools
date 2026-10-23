/**
 * Local, on-device draft of an unfinished service visit so a reload, crash or
 * app update never loses readings. Cleared only after the visit saves.
 */
export const VISIT_DRAFT_VERSION = 1;
export const VISIT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type VisitDraft<T = Record<string, unknown>> = {
  v: number;
  clientId: string;
  savedAt: number;
  data: T;
};

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const storage = (): KV | null => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

export const visitDraftKey = (clientId: string) => `acp_visit_draft:${clientId}`;

export function saveVisitDraft<T>(clientId: string, data: T, now = Date.now(), kv: KV | null = storage()) {
  if (!kv) return;
  try {
    const draft: VisitDraft<T> = { v: VISIT_DRAFT_VERSION, clientId, savedAt: now, data };
    kv.setItem(visitDraftKey(clientId), JSON.stringify(draft));
  } catch { /* storage full or blocked */ }
}

export function loadVisitDraft<T>(clientId: string, now = Date.now(), kv: KV | null = storage()): VisitDraft<T> | null {
  if (!kv) return null;
  try {
    const raw = kv.getItem(visitDraftKey(clientId));
    if (!raw) return null;
    const d = JSON.parse(raw) as VisitDraft<T>;
    if (d?.v !== VISIT_DRAFT_VERSION || d.clientId !== clientId) return null;
    if (now - d.savedAt > VISIT_DRAFT_MAX_AGE_MS) { kv.removeItem(visitDraftKey(clientId)); return null; }
    return d;
  } catch { return null; }
}

export function clearVisitDraft(clientId: string, kv: KV | null = storage()) {
  try { kv?.removeItem(visitDraftKey(clientId)); } catch { /* ignore */ }
}
