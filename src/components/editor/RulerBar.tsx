import { useRef, useEffect, useCallback, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../index';
import { useEditorSettings } from '../../contexts/EditorSettingsContext';
import type { LockingPoint } from '../../contexts/EditorSettingsContext';
import './RulerBar.css';

interface RulerBarProps {
  sourceContainerRef: RefObject<HTMLElement | null>;
  translationContainerRef: RefObject<HTMLElement | null>;
}

const TICK_INTERVAL = 27; // approximate line-height in px
const MINOR_TICK_LENGTH = 4;
const MAJOR_TICK_LENGTH = 10;
const MAJOR_EVERY = 5;
const CANVAS_WIDTH = 24;
const ARROW_HEIGHT = 10;
const ARROW_BODY_WIDTH = 14;
const ARROW_TIP_WIDTH = 8;

function drawRuler(
  canvas: HTMLCanvasElement,
  contentHeight: number,
  side: 'source' | 'translation',
  lockingPoints: LockingPoint[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = CANVAS_WIDTH;
  const height = Math.max(contentHeight, 1);

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  // Read CSS custom properties from the canvas's computed style
  const computedStyle = getComputedStyle(canvas);
  const bgColor = computedStyle.getPropertyValue('--ruler-bg').trim() || '#111111';
  const tickColor = computedStyle.getPropertyValue('--ruler-tick-color').trim() || 'rgba(255,255,255,0.5)';
  const majorTickColor = computedStyle.getPropertyValue('--ruler-tick-major-color').trim() || 'rgba(255,255,255,0.75)';
  const lockingColor = computedStyle.getPropertyValue('--ruler-locking-point-color').trim() || '#9d7acc';

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Tick marks
  const numTicks = Math.floor(height / TICK_INTERVAL);
  for (let i = 1; i <= numTicks; i++) {
    const y = i * TICK_INTERVAL;
    const isMajor = i % MAJOR_EVERY === 0;
    const tickLen = isMajor ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH;

    ctx.strokeStyle = isMajor ? majorTickColor : tickColor;
    ctx.lineWidth = isMajor ? 1.5 : 1;
    ctx.beginPath();

    if (side === 'source') {
      ctx.moveTo(width, y);
      ctx.lineTo(width - tickLen, y);
    } else {
      ctx.moveTo(0, y);
      ctx.lineTo(tickLen, y);
    }
    ctx.stroke();
  }

  // Draw arrow-shaped locking point markers
  const drawArrow = (y: number, color: string) => {
    const halfH = ARROW_HEIGHT / 2;
    ctx.fillStyle = color;
    ctx.beginPath();

    if (side === 'source') {
      // Arrow pointing right =>
      const bodyLeft = 0;
      const bodyRight = ARROW_BODY_WIDTH;
      const tipX = bodyRight + ARROW_TIP_WIDTH;
      ctx.moveTo(bodyLeft, y - halfH);
      ctx.lineTo(bodyRight, y - halfH);
      ctx.lineTo(tipX, y);
      ctx.lineTo(bodyRight, y + halfH);
      ctx.lineTo(bodyLeft, y + halfH);
    } else {
      // Arrow pointing left <=
      const bodyRight = width;
      const bodyLeft = width - ARROW_BODY_WIDTH;
      const tipX = bodyLeft - ARROW_TIP_WIDTH;
      ctx.moveTo(bodyRight, y - halfH);
      ctx.lineTo(bodyLeft, y - halfH);
      ctx.lineTo(tipX, y);
      ctx.lineTo(bodyLeft, y + halfH);
      ctx.lineTo(bodyRight, y + halfH);
    }

    ctx.closePath();
    ctx.fill();
  };

  for (const lp of lockingPoints) {
    const y = side === 'source' ? lp.sourceY : lp.translationY;
    drawArrow(y, lockingColor);
  }
}

export function RulerBar({ sourceContainerRef, translationContainerRef }: RulerBarProps) {
  const { t } = useTranslation();
  const {
    scrollSyncEnabled,
    toggleScrollSync,
    lockingPoints,
    addLockingPoint,
    removeLockingPoint,
  } = useEditorSettings();

  const sourceRulerRef = useRef<HTMLDivElement>(null);
  const translationRulerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const translationCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync ruler scroll with editor pane scroll
  useEffect(() => {
    const sourceContainer = sourceContainerRef.current;
    const sourceRuler = sourceRulerRef.current;
    if (!sourceContainer || !sourceRuler) return;

    const onScroll = () => {
      sourceRuler.scrollTop = sourceContainer.scrollTop;
    };
    sourceContainer.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => sourceContainer.removeEventListener('scroll', onScroll);
  }, [sourceContainerRef]);

  useEffect(() => {
    const translationContainer = translationContainerRef.current;
    const translationRuler = translationRulerRef.current;
    if (!translationContainer || !translationRuler) return;

    const onScroll = () => {
      translationRuler.scrollTop = translationContainer.scrollTop;
    };
    translationContainer.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => translationContainer.removeEventListener('scroll', onScroll);
  }, [translationContainerRef]);

  // Draw/redraw canvases
  const redraw = useCallback(() => {
    const sourceContainer = sourceContainerRef.current;
    const translationContainer = translationContainerRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    const translationCanvas = translationCanvasRef.current;

    if (sourceCanvas) {
      const height = sourceContainer ? sourceContainer.scrollHeight : 0;
      drawRuler(sourceCanvas, height, 'source', lockingPoints);
    }

    if (translationCanvas) {
      const height = translationContainer ? translationContainer.scrollHeight : 0;
      drawRuler(translationCanvas, height, 'translation', lockingPoints);
    }
  }, [sourceContainerRef, translationContainerRef, lockingPoints]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Observe scroll height changes via ResizeObserver
  useEffect(() => {
    const sourceContainer = sourceContainerRef.current;
    const translationContainer = translationContainerRef.current;

    const observer = new ResizeObserver(() => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(redraw);
    });

    if (sourceContainer) {
      const inner = sourceContainer.querySelector('.ProseMirror') ?? sourceContainer;
      observer.observe(inner);
    }
    if (translationContainer) {
      const inner = translationContainer.querySelector('.ProseMirror') ?? translationContainer;
      observer.observe(inner);
    }

    return () => {
      observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [sourceContainerRef, translationContainerRef, redraw]);

  // Click on a ruler: create a lock point pair immediately.
  // The clicked side's Y = click position in content.
  // The other side's Y = whatever content position is currently at
  // the same visual level on the other pane.
  const handleRulerClick = useCallback(
    (side: 'source' | 'translation', e: React.MouseEvent<HTMLDivElement>) => {
      const sourceContainer = sourceContainerRef.current;
      const translationContainer = translationContainerRef.current;
      const rulerDiv = side === 'source' ? sourceRulerRef.current : translationRulerRef.current;
      if (!sourceContainer || !translationContainer || !rulerDiv) return;

      const rect = rulerDiv.getBoundingClientRect();
      const visualY = e.clientY - rect.top; // visual position from viewport top of ruler
      const clickContentY = visualY + rulerDiv.scrollTop; // content Y on clicked side

      // The other side: whatever content is at the same visual Y
      const otherContainer = side === 'source' ? translationContainer : sourceContainer;
      const otherContentY = otherContainer.scrollTop + visualY;

      const sourceY = side === 'source' ? clickContentY : otherContentY;
      const translationY = side === 'translation' ? clickContentY : otherContentY;

      addLockingPoint(sourceY, translationY);
    },
    [sourceContainerRef, translationContainerRef, addLockingPoint],
  );

  // Right-click: remove a nearby locking point
  const handleRulerContextMenu = useCallback(
    (side: 'source' | 'translation', e: React.MouseEvent<HTMLDivElement>) => {
      const rulerDiv = side === 'source' ? sourceRulerRef.current : translationRulerRef.current;
      if (!rulerDiv) return;

      const rect = rulerDiv.getBoundingClientRect();
      const clickY = e.clientY - rect.top + rulerDiv.scrollTop;

      const threshold = 10;
      const closest = lockingPoints.reduce<{ lp: LockingPoint | null; dist: number }>(
        (best, lp) => {
          const y = side === 'source' ? lp.sourceY : lp.translationY;
          const dist = Math.abs(y - clickY);
          if (dist < best.dist) return { lp, dist };
          return best;
        },
        { lp: null, dist: threshold + 1 },
      );

      if (closest.lp && closest.dist <= threshold) {
        e.preventDefault();
        removeLockingPoint(closest.lp.id);
      }
    },
    [lockingPoints, removeLockingPoint],
  );

  return (
    <div className="ruler-column">
      <div className="ruler-column__header">
        <Button
          minimal
          small
          icon={scrollSyncEnabled ? 'link' : 'unlink'}
          onClick={toggleScrollSync}
          title={scrollSyncEnabled ? t('editor.scrollSyncOn') : t('editor.scrollSyncOff')}
        />
      </div>
      <div className="ruler-column__body">
        <div
          ref={sourceRulerRef}
          className="ruler-half ruler-half--source"
          onClick={(e) => handleRulerClick('source', e)}
          onContextMenu={(e) => handleRulerContextMenu('source', e)}
        >
          <canvas ref={sourceCanvasRef} />
        </div>
        <div
          ref={translationRulerRef}
          className="ruler-half ruler-half--translation"
          onClick={(e) => handleRulerClick('translation', e)}
          onContextMenu={(e) => handleRulerContextMenu('translation', e)}
        >
          <canvas ref={translationCanvasRef} />
        </div>
      </div>
    </div>
  );
}
