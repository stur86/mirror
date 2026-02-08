import { useRef, useEffect, useCallback, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../index';
import { useEditorSettings } from '../../contexts/EditorSettingsContext';
import type { LockingPoint } from '../../contexts/EditorSettingsContext';
import { getLockPointColor, LOCK_POINT_COLOR_COUNT } from '../../constants/lockPointColors';
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

interface DrawRulerOptions {
  canvas: HTMLCanvasElement;
  contentHeight: number;
  side: 'source' | 'translation';
  lockingPoints: LockingPoint[];
  activeLockIndex: number;
  isDarkTheme: boolean;
  pendingSide: 'source' | 'translation' | null;
  pendingY: number | null;
  nextColorIndex: number;
}

function drawRuler({
  canvas,
  contentHeight,
  side,
  lockingPoints,
  activeLockIndex,
  isDarkTheme,
  pendingSide,
  pendingY,
  nextColorIndex,
}: DrawRulerOptions) {
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

  // Draw filled arrow-shaped locking point marker
  const drawArrow = (y: number, color: string) => {
    const halfH = ARROW_HEIGHT / 2;
    ctx.fillStyle = color;
    ctx.beginPath();

    if (side === 'source') {
      const bodyLeft = 0;
      const bodyRight = ARROW_BODY_WIDTH;
      const tipX = bodyRight + ARROW_TIP_WIDTH;
      ctx.moveTo(bodyLeft, y - halfH);
      ctx.lineTo(bodyRight, y - halfH);
      ctx.lineTo(tipX, y);
      ctx.lineTo(bodyRight, y + halfH);
      ctx.lineTo(bodyLeft, y + halfH);
    } else {
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

  // Draw dashed-outline arrow for pending marker
  const drawPendingArrow = (y: number, color: string) => {
    const halfH = ARROW_HEIGHT / 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();

    if (side === 'source') {
      const bodyLeft = 0;
      const bodyRight = ARROW_BODY_WIDTH;
      const tipX = bodyRight + ARROW_TIP_WIDTH;
      ctx.moveTo(bodyLeft, y - halfH);
      ctx.lineTo(bodyRight, y - halfH);
      ctx.lineTo(tipX, y);
      ctx.lineTo(bodyRight, y + halfH);
      ctx.lineTo(bodyLeft, y + halfH);
    } else {
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
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Draw lock point markers with per-point colors
  for (let i = 0; i < lockingPoints.length; i++) {
    const lp = lockingPoints[i]!;
    const y = side === 'source' ? lp.sourceY : lp.translationY;
    const color = getLockPointColor(lp.colorIndex, i === activeLockIndex, isDarkTheme);
    drawArrow(y, color);
  }

  // Draw pending marker on the side that was clicked
  if (pendingSide === side && pendingY !== null) {
    const pendingColor = getLockPointColor(nextColorIndex, true, isDarkTheme);
    drawPendingArrow(pendingY, pendingColor);
  }
}

export function RulerBar({ sourceContainerRef, translationContainerRef }: RulerBarProps) {
  const { t } = useTranslation();
  const {
    scrollSyncEnabled,
    toggleScrollSync,
    lockingPoints,
    activeLockIndex,
    pendingLockSide,
    pendingLockY,
    removeLockingPoint,
    beginLockCreation,
    completeLockCreation,
    abortLockCreation,
  } = useEditorSettings();

  const sourceRulerRef = useRef<HTMLDivElement>(null);
  const translationRulerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const translationCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const isDarkTheme = document.body.classList.contains('bp6-dark');

  // Next color index for the pending marker preview
  // This should match what addLockingPoint will assign
  const nextColorIndex = lockingPoints.length % LOCK_POINT_COLOR_COUNT;

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

    const dark = document.body.classList.contains('bp6-dark');
    const colorIdx = lockingPoints.length % LOCK_POINT_COLOR_COUNT;

    if (sourceCanvas) {
      const height = sourceContainer ? sourceContainer.scrollHeight : 0;
      drawRuler({
        canvas: sourceCanvas,
        contentHeight: height,
        side: 'source',
        lockingPoints,
        activeLockIndex,
        isDarkTheme: dark,
        pendingSide: pendingLockSide,
        pendingY: pendingLockY,
        nextColorIndex: colorIdx,
      });
    }

    if (translationCanvas) {
      const height = translationContainer ? translationContainer.scrollHeight : 0;
      drawRuler({
        canvas: translationCanvas,
        contentHeight: height,
        side: 'translation',
        lockingPoints,
        activeLockIndex,
        isDarkTheme: dark,
        pendingSide: pendingLockSide,
        pendingY: pendingLockY,
        nextColorIndex: colorIdx,
      });
    }
  }, [sourceContainerRef, translationContainerRef, lockingPoints, activeLockIndex, pendingLockSide, pendingLockY]);

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

  // Two-step lock creation: click handling
  const handleRulerClick = useCallback(
    (side: 'source' | 'translation', e: React.MouseEvent<HTMLDivElement>) => {
      const rulerDiv = side === 'source' ? sourceRulerRef.current : translationRulerRef.current;
      if (!rulerDiv) return;

      const rect = rulerDiv.getBoundingClientRect();
      const visualY = e.clientY - rect.top;
      const clickContentY = visualY + rulerDiv.scrollTop;

      if (pendingLockSide === null) {
        // No pending — start creation on this side
        beginLockCreation(side, clickContentY);
      } else if (pendingLockSide === side) {
        // Same side as pending — reposition the pending marker
        beginLockCreation(side, clickContentY);
      } else {
        // Opposite side — complete the pair
        completeLockCreation(clickContentY);
      }
    },
    [pendingLockSide, beginLockCreation, completeLockCreation],
  );

  // Right-click: abort pending or remove nearby lock point
  const handleRulerContextMenu = useCallback(
    (side: 'source' | 'translation', e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();

      if (pendingLockSide !== null) {
        // Abort pending creation
        abortLockCreation();
        return;
      }

      // Remove nearby lock point
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
        removeLockingPoint(closest.lp.id);
      }
    },
    [lockingPoints, removeLockingPoint, pendingLockSide, abortLockCreation],
  );

  // Determine cursor classes for pending state
  const sourceRulerClass = `ruler-half ruler-half--source${pendingLockSide === 'translation' ? ' ruler-half--pending-target' : ''}`;
  const translationRulerClass = `ruler-half ruler-half--translation${pendingLockSide === 'source' ? ' ruler-half--pending-target' : ''}`;

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
          className={sourceRulerClass}
          onClick={(e) => handleRulerClick('source', e)}
          onContextMenu={(e) => handleRulerContextMenu('source', e)}
        >
          <canvas ref={sourceCanvasRef} />
        </div>
        <div
          ref={translationRulerRef}
          className={translationRulerClass}
          onClick={(e) => handleRulerClick('translation', e)}
          onContextMenu={(e) => handleRulerContextMenu('translation', e)}
        >
          <canvas ref={translationCanvasRef} />
        </div>
      </div>
    </div>
  );
}
