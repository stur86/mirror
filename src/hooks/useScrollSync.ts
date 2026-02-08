import { useRef, useEffect, useCallback } from 'react';
import { useEditorSettings } from '../contexts/EditorSettingsContext';
import type { RefObject } from 'react';

/** Focus line at ~33% of viewport height (clamped if not enough content above). */
const FOCUS_LINE_RATIO = 0.33;
/** Upper boundary of the focus region (25% of viewport). */
const FOCUS_REGION_TOP = 0.25;
/** Lower boundary of the focus region (75% of viewport). */
const FOCUS_REGION_BOTTOM = 0.75;

/**
 * Segment-based scroll sync.
 *
 * - When sync is enabled, the active lock point is "hooked" at a focus line
 *   (~33% from top) in both panes.
 * - Within a segment the user scrolls freely; both panes sync proportionally.
 * - When the segment boundary crosses the focus region, the next/prev lock
 *   point is activated.
 * - Attaches its own scroll listeners — returns void.
 */
export function useScrollSync(
  sourceRef: RefObject<HTMLElement | null>,
  translationRef: RefObject<HTMLElement | null>,
): void {
  const {
    scrollSyncEnabled,
    lockingPoints,
    activeLockIndex,
    setActiveLockIndex,
    navigateToNextLock,
    navigateToPrevLock,
  } = useEditorSettings();

  // Prevent feedback loops during programmatic scrolling
  const isSnapping = useRef(false);
  const rafRef = useRef<number | null>(null);
  // Track which pane the user is actively scrolling
  const scrollingPaneRef = useRef<'source' | 'translation' | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  /**
   * Snap both panes so that the active lock point sits at the focus line.
   */
  const snapToActiveLock = useCallback(
    (index?: number) => {
      const sourceEl = sourceRef.current;
      const translationEl = translationRef.current;
      if (!sourceEl || !translationEl) return;
      if (lockingPoints.length === 0) return;

      const idx = index ?? activeLockIndex;
      const lp = lockingPoints[idx];
      if (!lp) return;

      const viewportH = sourceEl.clientHeight;
      // Focus line position in viewport pixels
      const focusLine = Math.min(viewportH * FOCUS_LINE_RATIO, lp.sourceY);
      const focusLineTranslation = Math.min(viewportH * FOCUS_LINE_RATIO, lp.translationY);

      isSnapping.current = true;

      sourceEl.scrollTop = Math.max(0, lp.sourceY - focusLine);
      translationEl.scrollTop = Math.max(0, lp.translationY - focusLineTranslation);

      // Release snapping flag after a frame so scroll events settle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isSnapping.current = false;
        });
      });
    },
    [sourceRef, translationRef, lockingPoints, activeLockIndex],
  );

  // Snap when activeLockIndex changes
  useEffect(() => {
    if (!scrollSyncEnabled) return;
    snapToActiveLock();
  }, [activeLockIndex, scrollSyncEnabled, snapToActiveLock]);

  /**
   * Handle user scroll within the active segment.
   * Proportionally syncs the other pane and navigates to next/prev lock when
   * the segment boundary crosses the focus region.
   */
  const handleScroll = useCallback(
    (fromSide: 'source' | 'translation') => {
      if (!scrollSyncEnabled) return;
      if (isSnapping.current) return;

      const sourceEl = sourceRef.current;
      const translationEl = translationRef.current;
      if (!sourceEl || !translationEl) return;
      if (lockingPoints.length === 0) return;

      const fromEl = fromSide === 'source' ? sourceEl : translationEl;
      const toEl = fromSide === 'source' ? translationEl : sourceEl;

      const lp = lockingPoints[activeLockIndex];
      if (!lp) return;

      const fromKey = fromSide === 'source' ? 'sourceY' : 'translationY';
      const toKey = fromSide === 'source' ? 'translationY' : 'sourceY';

      const viewportH = fromEl.clientHeight;

      // Current segment boundaries (from active LP to next LP)
      const nextLp = lockingPoints[activeLockIndex + 1];
      const segStartFrom = lp[fromKey];
      const segEndFrom = nextLp ? nextLp[fromKey] : fromEl.scrollHeight;

      const segStartTo = lp[toKey];
      const segEndTo = nextLp ? nextLp[toKey] : toEl.scrollHeight;

      // Where the active LP currently sits visually
      const lpVisualY = segStartFrom - fromEl.scrollTop;

      // Check navigation triggers
      // Scrolling down: segment end crosses the focus region top (25% line)
      if (nextLp) {
        const segEndVisualY = segEndFrom - fromEl.scrollTop;
        if (segEndVisualY < viewportH * FOCUS_REGION_TOP) {
          navigateToNextLock();
          return;
        }
      }

      // Scrolling up: segment start crosses the focus region bottom (75% line)
      if (activeLockIndex > 0) {
        if (lpVisualY > viewportH * FOCUS_REGION_BOTTOM) {
          navigateToPrevLock();
          return;
        }
      }

      // Proportional sync within the segment
      const segLengthFrom = segEndFrom - segStartFrom;
      const segLengthTo = segEndTo - segStartTo;

      if (segLengthFrom > 0) {
        // How far into the segment are we on the "from" side
        const progress = (fromEl.scrollTop - (segStartFrom - viewportH * FOCUS_LINE_RATIO)) /
          (segLengthFrom > viewportH ? segLengthFrom : viewportH);
        const clampedProgress = Math.max(0, Math.min(1, progress));

        const toStart = segStartTo - viewportH * FOCUS_LINE_RATIO;
        const toRange = segLengthTo > viewportH ? segLengthTo : viewportH;
        const targetScrollTop = toStart + clampedProgress * toRange;

        isSnapping.current = true;
        toEl.scrollTop = Math.max(0, targetScrollTop);
        requestAnimationFrame(() => {
          isSnapping.current = false;
        });
      }
    },
    [
      scrollSyncEnabled,
      sourceRef,
      translationRef,
      lockingPoints,
      activeLockIndex,
      navigateToNextLock,
      navigateToPrevLock,
    ],
  );

  // Attach scroll listeners
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
      if (scrollingPaneRef.current === 'translation') return;
      scrollingPaneRef.current = 'source';
      clearScrollingState();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => handleScroll('source'));
    };

    const onTranslationScroll = () => {
      if (scrollingPaneRef.current === 'source') return;
      scrollingPaneRef.current = 'translation';
      clearScrollingState();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => handleScroll('translation'));
    };

    sourceEl.addEventListener('scroll', onSourceScroll, { passive: true });
    translationEl.addEventListener('scroll', onTranslationScroll, { passive: true });

    return () => {
      sourceEl.removeEventListener('scroll', onSourceScroll);
      translationEl.removeEventListener('scroll', onTranslationScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sourceRef, translationRef, scrollSyncEnabled, handleScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
