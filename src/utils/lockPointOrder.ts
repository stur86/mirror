import type { LockingPoint } from '../contexts/EditorSettingsContext';

/**
 * Returns true if moving `id`'s `side` coordinate to `y` would
 * invert or collapse the sorted order of that side's coordinates
 * (i.e. y crosses or equals a neighbour's coordinate).
 * Returns false if the move is valid (or if the point is not found).
 */
export function wouldInvertOrder(
  pts: LockingPoint[],
  id: string,
  side: 'source' | 'translation',
  y: number,
): boolean {
  const key = side === 'source' ? 'sourceY' : 'translationY';
  const sorted = [...pts].sort((a, b) => {
    const d = a[key] - b[key];
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
  const sortedIdx = sorted.findIndex(p => p.id === id);
  if (sortedIdx === -1) return false;
  const prev = sorted[sortedIdx - 1];
  const next = sorted[sortedIdx + 1];
  if (prev && y <= prev[key]) return true;
  if (next && y >= next[key]) return true;
  return false;
}
