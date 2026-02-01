import { useRef, useCallback, useEffect, type RefObject } from 'react';
import { useEditorSettings } from '../contexts/EditorSettingsContext';
import {
  useParagraphPositions,
  findParagraphAtPosition,
  type ParagraphPosition,
} from './useParagraphPositions';

interface ScrollSyncResult {
  sourcePositions: ParagraphPosition[];
  translationPositions: ParagraphPosition[];
  handleSourceScroll: () => void;
  handleTranslationScroll: () => void;
  recalculatePositions: () => void;
}

export function useScrollSync(
  sourceRef: RefObject<HTMLElement | null>,
  translationRef: RefObject<HTMLElement | null>,
  sourceDeps: unknown[] = [],
  translationDeps: unknown[] = []
): ScrollSyncResult {
  const { lockPositionPercent, scrollSyncEnabled } = useEditorSettings();

  // Track which pane is currently scrolling to prevent feedback loops
  const scrollingPaneRef = useRef<'source' | 'translation' | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const sourcePositions = useParagraphPositions(sourceRef, sourceDeps);
  const translationPositions = useParagraphPositions(translationRef, translationDeps);

  // Clear scrolling state after a delay
  const clearScrollingState = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      scrollingPaneRef.current = null;
    }, 50);
  }, []);

  const syncScroll = useCallback(
    (
      fromContainer: HTMLElement,
      toContainer: HTMLElement,
      fromPositions: ParagraphPosition[],
      toPositions: ParagraphPosition[]
    ) => {
      if (!scrollSyncEnabled) return;
      if (fromPositions.length === 0 || toPositions.length === 0) return;

      // Calculate the lock line position within the container
      const containerHeight = fromContainer.clientHeight;
      const lockLineY = (lockPositionPercent / 100) * containerHeight;

      // The absolute Y position in the document (accounting for scroll)
      const absoluteLockY = fromContainer.scrollTop + lockLineY;

      // Find which paragraph is at the lock line
      const { paragraph, offsetRatio } = findParagraphAtPosition(
        fromPositions,
        absoluteLockY
      );

      if (!paragraph) return;

      // Find the corresponding paragraph in the target pane
      const targetParagraph = toPositions[paragraph.index];
      if (!targetParagraph) {
        // If no corresponding paragraph, scroll to end if past the end
        if (paragraph.index >= toPositions.length) {
          const lastPara = toPositions[toPositions.length - 1];
          if (lastPara) {
            toContainer.scrollTop = lastPara.bottom - lockLineY;
          }
        }
        return;
      }

      // Calculate target scroll position
      // The target paragraph should be at the same lock line position
      const targetY = targetParagraph.top + offsetRatio * targetParagraph.height;
      const targetScrollTop = targetY - lockLineY;

      // Use RAF for smooth scrolling
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        toContainer.scrollTop = Math.max(0, targetScrollTop);
      });
    },
    [scrollSyncEnabled, lockPositionPercent]
  );

  const handleSourceScroll = useCallback(() => {
    if (!scrollSyncEnabled) return;
    if (scrollingPaneRef.current === 'translation') return;

    scrollingPaneRef.current = 'source';
    clearScrollingState();

    const sourceContainer = sourceRef.current;
    const translationContainer = translationRef.current;
    if (!sourceContainer || !translationContainer) return;

    syncScroll(
      sourceContainer,
      translationContainer,
      sourcePositions,
      translationPositions
    );
  }, [
    scrollSyncEnabled,
    sourceRef,
    translationRef,
    sourcePositions,
    translationPositions,
    syncScroll,
    clearScrollingState,
  ]);

  const handleTranslationScroll = useCallback(() => {
    if (!scrollSyncEnabled) return;
    if (scrollingPaneRef.current === 'source') return;

    scrollingPaneRef.current = 'translation';
    clearScrollingState();

    const sourceContainer = sourceRef.current;
    const translationContainer = translationRef.current;
    if (!sourceContainer || !translationContainer) return;

    syncScroll(
      translationContainer,
      sourceContainer,
      translationPositions,
      sourcePositions
    );
  }, [
    scrollSyncEnabled,
    sourceRef,
    translationRef,
    sourcePositions,
    translationPositions,
    syncScroll,
    clearScrollingState,
  ]);

  // Recalculate positions (exposed for manual triggering)
  const recalculatePositions = useCallback(() => {
    // This will trigger via the dependency arrays in useParagraphPositions
    // We just need to force a re-render of the positions
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return {
    sourcePositions,
    translationPositions,
    handleSourceScroll,
    handleTranslationScroll,
    recalculatePositions,
  };
}
