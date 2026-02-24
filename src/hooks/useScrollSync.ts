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
  const activeLockIndexRef = useRef<number>(0);

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
      // Hold the guard for the entire animation duration
      applyingToRef.current = el;
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
          // Final frame — applyScrollTop clears the guard after one frame
          applyScrollTop(anim.element, anim.targetValue);
          animRef.current = null;
          rafRef.current = null;
          return;
        }

        // Direct write during animation — guard already set from startAnimation call
        anim.element.scrollTop = Math.max(
          0,
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
      scrollingPaneRef.current = null;
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
