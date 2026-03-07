import { describe, it, expect } from 'bun:test';
import { findActiveLock, computeTargetScrollTop } from './useScrollSync';
import type { LockingPoint } from '../contexts/EditorSettingsContext';

function lp(id: string, sourceY: number, translationY: number): LockingPoint {
  return { id, sourceY, translationY, colorIndex: 0 };
}

describe('findActiveLock', () => {
  const points = [lp('a', 0, 0), lp('b', 500, 600), lp('c', 1000, 1200)];

  it('returns null for empty array', () => {
    expect(findActiveLock([], 'sourceY', 0, 800)).toBeNull();
  });

  it('returns topmost visible lock when multiple are in viewport', () => {
    // viewport 400-1200 (scrollTop=400, viewportH=800) — 'b' (500) and 'c' (1000) visible
    const result = findActiveLock(points, 'sourceY', 400, 800);
    expect(result?.lp.id).toBe('b'); // b has smaller sourceY
    expect(result?.index).toBe(1);
  });

  it('returns nearest-above when all locks are above viewport', () => {
    // scrollTop=1100, viewportH=800 — only 'a' (0), 'b' (500) are above
    const result = findActiveLock(points, 'sourceY', 1100, 800);
    expect(result?.lp.id).toBe('c'); // c is nearest above (1000 < 1100)
  });

  it('falls back to first lock when list is non-empty and all below', () => {
    const result = findActiveLock(points, 'sourceY', 0, 10);
    // 'a' at sourceY=0 is within [0, 10] — visible
    expect(result?.lp.id).toBe('a');
  });

  it('works with translationY key', () => {
    const result = findActiveLock(points, 'translationY', 550, 800);
    // translationY: a=0, b=600 (in viewport 550-1350), c=1200 (also in viewport)
    expect(result?.lp.id).toBe('b'); // b.translationY=600 is smallest in viewport
  });
});

describe('computeTargetScrollTop', () => {
  it('returns toY when scrollTop equals fromY (lock is at top of viewport)', () => {
    expect(computeTargetScrollTop(500, 600, 500)).toBe(600);
  });

  it('offsets proportionally when scrolled past lock', () => {
    // scrollTop=600, fromY=500 → scrolled 100 past lock
    // toY=600 → target = 600 - (500 - 600) = 700
    expect(computeTargetScrollTop(500, 600, 600)).toBe(700);
  });

  it('handles scrollTop=0 with origin lock at 0,0', () => {
    expect(computeTargetScrollTop(0, 0, 0)).toBe(0);
  });

  it('handles negative result correctly (pane is scrolled above lock)', () => {
    // scrollTop=100, fromY=500 → target = 600 - (500-100) = 200
    expect(computeTargetScrollTop(500, 600, 100)).toBe(200);
  });
});
