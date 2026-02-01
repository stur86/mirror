import { useState, useCallback, useEffect, type RefObject } from 'react';

export interface ParagraphPosition {
  index: number;
  top: number;
  bottom: number;
  height: number;
  element: Element;
}

const BLOCK_SELECTOR = '.ProseMirror > p, .ProseMirror > h1, .ProseMirror > h2, .ProseMirror > h3, .ProseMirror > h4, .ProseMirror > h5, .ProseMirror > h6, .ProseMirror > blockquote, .ProseMirror > ul, .ProseMirror > ol, .ProseMirror > pre, .ProseMirror > hr';

export function useParagraphPositions(
  containerRef: RefObject<HTMLElement | null>,
  deps: unknown[] = []
): ParagraphPosition[] {
  const [positions, setPositions] = useState<ParagraphPosition[]>([]);

  const calculatePositions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const paragraphs = container.querySelectorAll(BLOCK_SELECTOR);
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;

    const newPositions: ParagraphPosition[] = [];

    paragraphs.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      // Convert to positions relative to the scroll container
      const top = rect.top - containerRect.top + scrollTop;
      const height = rect.height;
      const bottom = top + height;

      newPositions.push({
        index,
        top,
        bottom,
        height,
        element,
      });
    });

    setPositions(newPositions);
  }, [containerRef]);

  // Recalculate on mount and when dependencies change
  useEffect(() => {
    calculatePositions();
  }, [calculatePositions, ...deps]);

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => {
      calculatePositions();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePositions]);

  return positions;
}

export function findParagraphAtPosition(
  positions: ParagraphPosition[],
  yPosition: number
): { paragraph: ParagraphPosition | null; offsetRatio: number } {
  if (positions.length === 0) {
    return { paragraph: null, offsetRatio: 0 };
  }

  // Find the paragraph that contains the yPosition
  for (const para of positions) {
    if (yPosition >= para.top && yPosition < para.bottom) {
      const offsetRatio = (yPosition - para.top) / para.height;
      return { paragraph: para, offsetRatio };
    }
  }

  // If above all paragraphs, return first
  const firstPara = positions[0];
  if (firstPara && yPosition < firstPara.top) {
    return { paragraph: firstPara, offsetRatio: 0 };
  }

  // If below all paragraphs, return last
  const lastPara = positions[positions.length - 1];
  return { paragraph: lastPara ?? null, offsetRatio: 1 };
}
