import { useRef, useCallback, useEffect, type RefObject } from 'react';
import { useEditorSettings } from '../contexts/EditorSettingsContext';
import type { LockingPoint } from '../contexts/EditorSettingsContext';

interface ScrollSyncResult {
  handleSourceScroll: () => void;
  handleTranslationScroll: () => void;
}

/**
 * Find the active locking point for the scrolling pane.
 *
 * The active point is the topmost locking point whose Y (on the scrolling
 * side) is still within the visible viewport.  When no point is visible
 * (all have scrolled above), use the last one above the viewport – this
 * keeps a constant offset once you scroll past all anchors.
 */
function findActiveLockingPoint(
  scrollTop: number,
  viewportHeight: number,
  side: 'source' | 'translation',
  points: LockingPoint[],
): LockingPoint {
  const key = side === 'source' ? 'sourceY' : 'translationY';
  const sorted = [...points].sort((a, b) => a[key] - b[key]);

  // Topmost visible: smallest Y that is >= scrollTop and <= scrollTop + viewportHeight
  const topmostVisible = sorted.find(
    lp => lp[key] >= scrollTop && lp[key] <= scrollTop + viewportHeight,
  );
  if (topmostVisible) return topmostVisible;

  // All above viewport: use the one closest from above (largest Y < scrollTop)
  const above = sorted.filter(lp => lp[key] < scrollTop);
  if (above.length > 0) return above[above.length - 1]!;

  // All below viewport (shouldn't happen with the origin default): use the first
  return sorted[0]!;
}

export function useScrollSync(
  sourceRef: RefObject<HTMLElement | null>,
  translationRef: RefObject<HTMLElement | null>,
): ScrollSyncResult {
  const { scrollSyncEnabled, lockingPoints } = useEditorSettings();

  // Prevent feedback loops: track which pane is driving the scroll
  const scrollingPaneRef = useRef<'source' | 'translation' | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearScrollingState = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      scrollingPaneRef.current = null;
    }, 50);
  }, []);

  const syncScroll = useCallback(
    (
      fromContainer: HTMLElement,
      toContainer: HTMLElement,
      fromSide: 'source' | 'translation',
    ) => {
      if (!scrollSyncEnabled || lockingPoints.length === 0) return;

      const activeLp = findActiveLockingPoint(
        fromContainer.scrollTop,
        fromContainer.clientHeight,
        fromSide,
        lockingPoints,
      );

      const fromKey = fromSide === 'source' ? 'sourceY' : 'translationY';
      const toKey = fromSide === 'source' ? 'translationY' : 'sourceY';

      // Visual Y of the active lock point inside the scrolling pane's viewport
      const visualY = activeLp[fromKey] - fromContainer.scrollTop;

      // Scroll the other pane so its corresponding point sits at the same visual Y
      const targetScrollTop = activeLp[toKey] - visualY;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        toContainer.scrollTop = Math.max(0, targetScrollTop);
      });
    },
    [scrollSyncEnabled, lockingPoints],
  );

  const handleSourceScroll = useCallback(() => {
    if (!scrollSyncEnabled) return;
    if (scrollingPaneRef.current === 'translation') return;

    scrollingPaneRef.current = 'source';
    clearScrollingState();

    const sourceContainer = sourceRef.current;
    const translationContainer = translationRef.current;
    if (!sourceContainer || !translationContainer) return;

    syncScroll(sourceContainer, translationContainer, 'source');
  }, [scrollSyncEnabled, sourceRef, translationRef, syncScroll, clearScrollingState]);

  const handleTranslationScroll = useCallback(() => {
    if (!scrollSyncEnabled) return;
    if (scrollingPaneRef.current === 'source') return;

    scrollingPaneRef.current = 'translation';
    clearScrollingState();

    const sourceContainer = sourceRef.current;
    const translationContainer = translationRef.current;
    if (!sourceContainer || !translationContainer) return;

    syncScroll(translationContainer, sourceContainer, 'translation');
  }, [scrollSyncEnabled, sourceRef, translationRef, syncScroll, clearScrollingState]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { handleSourceScroll, handleTranslationScroll };
}
