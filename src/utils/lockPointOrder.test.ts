import { describe, it, expect } from 'bun:test';
import { wouldInvertOrder } from './lockPointOrder';
import type { LockingPoint } from '../contexts/EditorSettingsContext';

function lp(id: string, sourceY: number, translationY: number): LockingPoint {
  return { id, sourceY, translationY, colorIndex: 0 };
}

describe('wouldInvertOrder', () => {
  const pts = [lp('a', 0, 0), lp('b', 500, 600), lp('c', 1000, 1200)];

  it('returns false for a valid move within bounds', () => {
    expect(wouldInvertOrder(pts, 'b', 'source', 600)).toBe(false);
  });

  it('returns true when move would cross the next point', () => {
    expect(wouldInvertOrder(pts, 'b', 'source', 1000)).toBe(true);
  });

  it('returns true when move would cross the previous point', () => {
    expect(wouldInvertOrder(pts, 'b', 'source', 0)).toBe(true);
  });

  it('returns false for the first point moving freely downward', () => {
    expect(wouldInvertOrder(pts, 'a', 'source', 400)).toBe(false);
  });

  it('returns false for the last point moving freely upward', () => {
    expect(wouldInvertOrder(pts, 'c', 'source', 600)).toBe(false);
  });

  it('works for translationY side', () => {
    expect(wouldInvertOrder(pts, 'b', 'translation', 1200)).toBe(true);
    expect(wouldInvertOrder(pts, 'b', 'translation', 800)).toBe(false);
  });

  it('returns false for unknown id', () => {
    expect(wouldInvertOrder(pts, 'z', 'source', 999)).toBe(false);
  });

  it('returns false when there is only one lock point (no neighbours to cross)', () => {
    const single = [lp('a', 500, 600)];
    expect(wouldInvertOrder(single, 'a', 'source', 0)).toBe(false);
    expect(wouldInvertOrder(single, 'a', 'source', 9999)).toBe(false);
  });
});
