export const PENDING_GROUP_KEY = 'pendingRecordingGroup';

export interface PendingGroup {
  id: string;
  name: string;
}

export function readPendingGroup(): PendingGroup | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_GROUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingGroup;
    if (!parsed?.id || !parsed?.name?.trim()) return null;
    return { id: parsed.id, name: parsed.name.trim() };
  } catch {
    return null;
  }
}

export function writePendingGroup(group: PendingGroup | null) {
  if (typeof window === 'undefined') return;
  if (!group) sessionStorage.removeItem(PENDING_GROUP_KEY);
  else sessionStorage.setItem(PENDING_GROUP_KEY, JSON.stringify(group));
}

export function pendingGroupTitle(): string | null {
  return readPendingGroup()?.name ?? null;
}
