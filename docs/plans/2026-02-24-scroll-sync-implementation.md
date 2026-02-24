# Scroll Sync Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken segment-based scroll sync with a simple constant-offset algorithm and 120ms smoothstep easing on lock transitions.

**Architecture:** On each scroll event, find the topmost visible lock point in the scrolling pane's viewport and apply `targetScrollTop = lp.toY - (lp.fromY - scrollTop)` to the synced pane. When the active lock changes, a 120ms rAF animation with smoothstep easing bridges the discontinuity. Any new user scroll cancels the animation immediately.

**Tech Stack:** React 19, TypeScript, rAF (no extra dependencies).

---

## Context

Key files:
- `src/hooks/useScrollSync.ts` — full rewrite
- `src/contexts/EditorSettingsContext.tsx` — remove two nav functions
- `CLAUDE.md` — update scroll sync description

`lockingPoints` are kept sorted by `sourceY` in `EditorSettingsContext`. `activeLockIndex` in context is used by both `RulerBar.tsx` (visual highlight) and `TranslationEditor.tsx` (mute ranges) — it must stay, but is now set by the hook when the active lock changes rather than driving the hook's behaviour.

---

## Task 1: Remove nav functions from EditorSettingsContext

**Files:**
- Modify: `src/contexts/EditorSettingsContext.tsx`

### Step 1: Remove the two functions from the interface and implementation

In `EditorSettingsContextType` interface (line ~34), delete these two lines:
```ts
  navigateToNextLock: () => void;
  navigateToPrevLock: () => void;
```

Delete the `navigateToNextLock` implementation (lines ~72–77):
```ts
  const navigateToNextLock = useCallback(() => {
    setLockingPoints(pts => {
      setActiveLockIndexState(prev => Math.min(prev + 1, pts.length - 1));
      return pts;
    });
  }, []);
```

Delete the `navigateToPrevLock` implementation (lines ~79–81):
```ts
  const navigateToPrevLock = useCallback(() => {
    setActiveLockIndexState(prev => Math.max(prev - 1, 0));
  }, []);
```

Remove `navigateToNextLock` and `navigateToPrevLock` from the provider `value` object (lines ~172–175).

### Step 2: Verify TypeScript compiles

```bash
cd /home/gan_hope326/Projects/mirror && bun run typecheck
```
Expected: no errors (useScrollSync.ts currently imports these — it will error until Task 2 is done, so skip typecheck until after Task 2).

### Step 3: Commit

```bash
git add src/contexts/EditorSettingsContext.tsx
git commit -m "refactor: remove navigateToNextLock/Prev from EditorSettingsContext"
```

---

## Task 2: Rewrite useScrollSync.ts

**Files:**
- Modify: `src/hooks/useScrollSync.ts`

Replace the entire file with the following implementation. Read it carefully before applying — every detail is load-bearing.

### Step 1: Write the new implementation

Replace the full contents of `src/hooks/useScrollSync.ts` with:

```ts
import { useRef, useEffect, useCallback } from 'react';
import { useEditorSettings } from '../contexts/EditorSettingsContext';
import type { RefObject } from 'react';
import type { LockingPoint } from '../contexts/EditorSettingsContext';

const EASE_DURATION = 120; // ms

/** Smoothstep sigmoid: S-curve on t ∈ [0, 1]. */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Find the active lock point for the scrolling pane.
 *
 * Returns the topmost lock point still visible in the viewport
 * (smallest fromY that is >= scrollTop and <= scrollTop + viewportH).
 * If all lock points are above the viewport, returns the nearest one above
 * (largest fromY that is < scrollTop).
 * Falls back to the first lock point if the array is non-empty.
 */
function findActiveLock(
  lockingPoints: LockingPoint[],
  fromKey: 'sourceY' | 'translationY',
  scrollTop: number,
  viewportH: number,
): { lp: LockingPoint; index: number } | null {
  if (lockingPoints.length === 0) return null;

  // Pass 1: topmost visible (smallest fromY in [scrollTop, scrollTop + viewportH])
  let bestVisible: LockingPoint | null = null;
  let bestVisibleIdx = -1;
  for (let i = 0; i < lockingPoints.length; i++) {
    const lp = lockingPoints[i]!;
    const y = lp[fromKey];
    if (y >= scrollTop && y <= scrollTop + viewportH) {
      if (bestVisible === null || y < bestVisible[fromKey]) {
        bestVisible = lp;
        bestVisibleIdx = i;
      }
    }
  }
  if (bestVisible !== null) return { lp: bestVisible, index: bestVisibleIdx };

  // Pass 2: nearest above (largest fromY < scrollTop)
  let bestAbove: LockingPoint | null = null;
  let bestAboveIdx = -1;
  for (let i = 0; i < lockingPoints.length; i++) {
    const lp = lockingPoints[i]!;
    const y = lp[fromKey];
    if (y < scrollTop) {
      if (bestAbove === null || y > bestAbove[fromKey]) {
        bestAbove = lp;
        bestAboveIdx = i;
      }
    }
  }
  if (bestAbove !== null) return { lp: bestAbove, index: bestAboveIdx };

  // Fallback: first lock point
  return { lp: lockingPoints[0]!, index: 0 };
}

/**
 * Constant-offset scroll sync.
 *
 * On each scroll event from either pane, finds the topmost visible lock point
 * and applies: targetScrollTop = lp.toY - (lp.fromY - scrollTop).
 *
 * When the active lock changes, a 120ms smoothstep animation bridges the
 * discontinuity. Any new user scroll cancels the animation immediately.
 *
 * Attaches its own scroll listeners — returns void.
 */
export function useScrollSync(
  sourceRef: RefObject<HTMLElement | null>,
  translationRef: RefObject<HTMLElement | null>,
): void {
  const { scrollSyncEnabled, lockingPoints, setActiveLockIndex } = useEditorSettings();

  // Which element are we currently writing to programmatically?
  // Scroll events on that element are feedback — ignore them.
  const applyingToRef = useRef<HTMLElement | null>(null);

  // Which pane is the user actively scrolling?
  // Prevents the synced pane from becoming the "driving" pane.
  const scrollingPaneRef = useRef<'source' | 'translation' | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Animation state
  const rafRef = useRef<number | null>(null);
  const animRef = useRef<{
    startTime: number;
    startValue: number;
    targetValue: number;
    element: HTMLElement;
  } | null>(null);

  // Last active lock index seen (for change detection, not React state)
  const activeLockIndexRef = useRef<number>(-1);

  /** Cancel any in-flight rAF animation. */
  const cancelAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    animRef.current = null;
  }, []);

  /**
   * Write a value directly to an element's scrollTop, marking it as
   * programmatic so its scroll event is ignored.
   */
  const applyScrollTop = useCallback((el: HTMLElement, value: number) => {
    applyingToRef.current = el;
    el.scrollTop = Math.max(0, value);
    // Clear the guard after one frame (scroll event has fired by then)
    requestAnimationFrame(() => {
      if (applyingToRef.current === el) applyingToRef.current = null;
    });
  }, []);

  /** Start a smoothstep animation from `from` to `to` on `el`. */
  const startAnimation = useCallback(
    (el: HTMLElement, from: number, to: number) => {
      cancelAnimation();
      animRef.current = {
        startTime: performance.now(),
        startValue: from,
        targetValue: to,
        element: el,
      };

      const tick = () => {
        const anim = animRef.current;
        if (!anim) return;

        const elapsed = performance.now() - anim.startTime;
        const t = elapsed / EASE_DURATION;

        if (t >= 1) {
          applyScrollTop(anim.element, anim.targetValue);
          animRef.current = null;
          rafRef.current = null;
          return;
        }

        applyScrollTop(
          anim.element,
          anim.startValue + smoothstep(t) * (anim.targetValue - anim.startValue),
        );
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [cancelAnimation, applyScrollTop],
  );

  /** Core sync logic called on every user scroll event. */
  const handleScroll = useCallback(
    (fromSide: 'source' | 'translation') => {
      if (!scrollSyncEnabled) return;

      const sourceEl = sourceRef.current;
      const translationEl = translationRef.current;
      if (!sourceEl || !translationEl) return;
      if (lockingPoints.length === 0) return;

      const fromEl = fromSide === 'source' ? sourceEl : translationEl;
      const toEl = fromSide === 'source' ? translationEl : sourceEl;
      const fromKey = fromSide === 'source' ? 'sourceY' : 'translationY';
      const toKey = fromSide === 'source' ? 'translationY' : 'sourceY';

      const scrollTop = fromEl.scrollTop;
      const viewportH = fromEl.clientHeight;

      const result = findActiveLock(lockingPoints, fromKey, scrollTop, viewportH);
      if (!result) return;

      const { lp, index } = result;
      const targetScrollTop = lp[toKey] - (lp[fromKey] - scrollTop);

      const lockChanged = index !== activeLockIndexRef.current;
      activeLockIndexRef.current = index;

      if (lockChanged) {
        // Notify context so RulerBar and mute ranges update
        setActiveLockIndex(index);
        // Animate the discontinuity away
        startAnimation(toEl, toEl.scrollTop, targetScrollTop);
      } else if (animRef.current !== null) {
        // User scrolled again before animation finished — cancel and apply directly
        cancelAnimation();
        applyScrollTop(toEl, targetScrollTop);
      } else {
        applyScrollTop(toEl, targetScrollTop);
      }
    },
    [
      scrollSyncEnabled,
      sourceRef,
      translationRef,
      lockingPoints,
      setActiveLockIndex,
      startAnimation,
      cancelAnimation,
      applyScrollTop,
    ],
  );

  // Attach / detach scroll listeners
  useEffect(() => {
    const sourceEl = sourceRef.current;
    const translationEl = translationRef.current;
    if (!sourceEl || !translationEl) return;
    if (!scrollSyncEnabled) return;

    const clearScrollingState = () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollingPaneRef.current = null;
      }, 50);
    };

    const onSourceScroll = () => {
      // Ignore if we programmatically set source scrollTop
      if (applyingToRef.current === sourceEl) return;
      // Ignore if user is actively scrolling translation
      if (scrollingPaneRef.current === 'translation') return;
      scrollingPaneRef.current = 'source';
      clearScrollingState();
      handleScroll('source');
    };

    const onTranslationScroll = () => {
      // Ignore if we programmatically set translation scrollTop
      if (applyingToRef.current === translationEl) return;
      // Ignore if user is actively scrolling source
      if (scrollingPaneRef.current === 'source') return;
      scrollingPaneRef.current = 'translation';
      clearScrollingState();
      handleScroll('translation');
    };

    sourceEl.addEventListener('scroll', onSourceScroll, { passive: true });
    translationEl.addEventListener('scroll', onTranslationScroll, { passive: true });

    return () => {
      sourceEl.removeEventListener('scroll', onSourceScroll);
      translationEl.removeEventListener('scroll', onTranslationScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [sourceRef, translationRef, scrollSyncEnabled, handleScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation();
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [cancelAnimation]);
}
```

### Step 2: Verify TypeScript compiles

```bash
cd /home/gan_hope326/Projects/mirror && bun run typecheck
```
Expected: no errors.

### Step 3: Commit

```bash
git add src/hooks/useScrollSync.ts
git commit -m "feat: replace segment scroll sync with constant-offset + smoothstep easing"
```

---

## Task 3: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

### Step 1: Replace the scroll sync algorithm description

Find the **Scroll sync algorithm** bullet list in `CLAUDE.md` (under `### Ruler Bar & Locking Points`) and replace it with:

```markdown
**Scroll sync algorithm** (`useScrollSync.ts`):
- The user scrolls freely on whichever pane the mouse hovers
- On each scroll event, the **active lock point** is the topmost lock point still visible in the scrolling pane's viewport (content-Y ≥ scrollTop and ≤ scrollTop + viewportH). If all lock points are above the viewport, the nearest one above is used
- The other pane is scrolled so its lock coordinate matches: `targetScrollTop = lp.toY - (lp.fromY - scrollTop)`
- When the active lock changes (different lock becomes topmost), a 120ms smoothstep animation bridges the discontinuity on the synced pane; any new scroll event cancels it immediately
- Toggle sync on/off with the lock button in the ruler header
```

### Step 2: Commit

```bash
git add CLAUDE.md
git commit -m "docs: update scroll sync algorithm description in CLAUDE.md"
```

---

## Task 4: Manual testing

No automated test framework is set up. Verify behaviour manually with `bun run dev`.

### Scenario A — Basic sync
1. Open the app. Add enough text to both panes to make them scrollable.
2. Enable scroll sync (link icon in ruler header).
3. Scroll the source pane slowly. The translation pane should track smoothly with no jumps.
4. Scroll the translation pane. Source should track equally smoothly.

### Scenario B — Lock point transition
1. Add a second lock point (click source ruler, then translation ruler).
2. Scroll slowly past the first lock point in the source pane.
3. When the first lock point scrolls off the top of the viewport, observe the translation pane: it should animate smoothly (not jump) to the new offset position over ~120ms.
4. Scroll quickly past the boundary — the transition should cancel and the synced pane should snap instantly.

### Scenario C — Near-top behaviour
1. With only the default origin lock at (0, 0), scroll both panes to the very top (scrollTop = 0).
2. Enable sync. Scroll down — both panes should track in lockstep with no initial jump.

### Scenario D — Sync toggle
1. Scroll both panes to different positions.
2. Enable scroll sync. Verify there is no jarring snap (the panes stay where they are; sync takes effect gradually as you scroll).
3. Disable sync. Scroll each pane independently. No cross-pane movement.

### Scenario E — Active lock highlight
1. With multiple lock points, scroll so different locks enter/leave the viewport.
2. Verify the ruler bar arrow changes highlight colour to match the currently active lock.
