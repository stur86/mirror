# Anchor Drag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make ruler-bar lock point markers hoverable and click-to-grab/click-to-drop draggable, with a dimmed original and a bright ghost arrow following the cursor during drag.

**Architecture:** Hover/drag state lives in `RulerBar` as local React state. On drop, a new `updateLockingPoint` context function commits the change. `drawRuler` is extended with four new parameters to render hover highlights, dimmed originals, and ghost arrows. Interaction is handled via `onMouseMove`, `onMouseLeave`, and updated `onClick` / `onContextMenu` handlers.

**Tech Stack:** React 19, TypeScript, HTML Canvas 2D API.

---

## Context

Key files:
- `src/contexts/EditorSettingsContext.tsx` — add `updateLockingPoint`
- `src/components/editor/RulerBar.tsx` — extend `drawRuler`, add state and event handlers
- `src/components/editor/RulerBar.css` — add cursor classes

`lockingPoints` is always sorted by `sourceY`. `updateLockingPoint` must not change sort order, so it rejects any `y` that would invert the order of adjacent source-side lock points (translationY has no ordering constraint).

The hit-detection threshold for hover and grab is `8` px. The existing right-click threshold for removal is `10` px (keep as-is).

---

## Task 1: Add `updateLockingPoint` to EditorSettingsContext

**Files:**
- Modify: `src/contexts/EditorSettingsContext.tsx`

### Step 1: Add to the `EditorSettingsContextType` interface

Inside the `interface EditorSettingsContextType` block, after `abortLockCreation`, add:

```ts
  updateLockingPoint: (id: string, side: 'source' | 'translation', y: number) => void;
```

### Step 2: Add the implementation inside `EditorSettingsProvider`

After the `abortLockCreation` useCallback, add:

```ts
  const updateLockingPoint = useCallback((id: string, side: 'source' | 'translation', y: number) => {
    setLockingPoints(pts => {
      const idx = pts.findIndex(p => p.id === id);
      if (idx === -1) return pts;

      if (side === 'source') {
        // Reject if move would invert sort order with neighbours
        const prev = pts[idx - 1];
        const next = pts[idx + 1];
        if (prev && y <= prev.sourceY) return pts;
        if (next && y >= next.sourceY) return pts;
      }
      // translationY has no ordering constraint — always accept

      return pts.map((p, i) =>
        i === idx
          ? { ...p, [side === 'source' ? 'sourceY' : 'translationY']: y }
          : p,
      );
    });
  }, []);
```

### Step 3: Add to the provider value object

Inside the `<EditorSettingsContext.Provider value={{ ... }}>` object, add:

```ts
        updateLockingPoint,
```

### Step 4: Verify build

```bash
cd /home/gan_hope326/Projects/mirror && bun run build 2>&1 | tail -5
```
Expected: `✓ built in ...` with no TypeScript errors.

### Step 5: Commit

```bash
git add src/contexts/EditorSettingsContext.tsx
git commit -m "feat: add updateLockingPoint to EditorSettingsContext"
```

---

## Task 2: Extend `drawRuler` with hover/drag rendering

**Files:**
- Modify: `src/components/editor/RulerBar.tsx`

This task touches only the `DrawRulerOptions` interface, the `drawRuler` function, and the `redraw` useCallback / its call sites.

### Step 1: Extend `DrawRulerOptions`

Replace the existing `DrawRulerOptions` interface with:

```ts
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
  // Drag/hover rendering
  dragState: { lockId: string; side: 'source' | 'translation'; originalY: number } | null;
  ghostY: number | null;
  hoveredLockId: string | null;
  hoveredSide: 'source' | 'translation' | null;
}
```

### Step 2: Update `drawRuler` function signature and destructuring

Update the destructuring inside `drawRuler` to add the four new fields:

```ts
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
  dragState,
  ghostY,
  hoveredLockId,
  hoveredSide,
}: DrawRulerOptions) {
```

### Step 3: Replace the marker-drawing loop

Find the existing loop `// Draw lock point markers with per-point colors` and replace it (and the pending marker block) entirely with:

```ts
  // Draw lock point markers with per-point colors
  for (let i = 0; i < lockingPoints.length; i++) {
    const lp = lockingPoints[i]!;
    const y = side === 'source' ? lp.sourceY : lp.translationY;
    const isBeingDragged = dragState?.lockId === lp.id && dragState?.side === side;
    const isHovered = hoveredLockId === lp.id && hoveredSide === side && !isBeingDragged;
    const color = getLockPointColor(lp.colorIndex, i === activeLockIndex, isDarkTheme);

    if (isBeingDragged) {
      // Draw dimmed at original position
      ctx.globalAlpha = 0.35;
      drawArrow(y, color);
      ctx.globalAlpha = 1;
    } else {
      drawArrow(y, color);
      if (isHovered) {
        // Subtle white overlay to brighten the hovered marker
        ctx.globalAlpha = 0.25;
        drawArrow(y, '#ffffff');
        ctx.globalAlpha = 1;
      }
    }
  }

  // Draw ghost arrow during drag (same side as grabbed marker only)
  if (dragState?.side === side && ghostY !== null) {
    const draggedLp = lockingPoints.find(lp => lp.id === dragState.lockId);
    if (draggedLp) {
      const ghostColor = getLockPointColor(draggedLp.colorIndex, true, isDarkTheme);
      drawArrow(ghostY, ghostColor);
    }
  }

  // Draw pending marker on the side that was clicked
  if (pendingSide === side && pendingY !== null) {
    const pendingColor = getLockPointColor(nextColorIndex, true, isDarkTheme);
    drawPendingArrow(pendingY, pendingColor);
  }
```

### Step 4: Add local state and update `redraw` deps

Inside `RulerBar`, add state declarations after the existing refs:

```ts
  // Drag/hover state (local — not committed to context until drop)
  const [dragState, setDragState] = useState<{
    lockId: string;
    side: 'source' | 'translation';
    originalY: number;
  } | null>(null);
  const [ghostY, setGhostY] = useState<number | null>(null);
  const [hoveredLock, setHoveredLock] = useState<{
    id: string;
    side: 'source' | 'translation';
  } | null>(null);
```

Add `useState` to the React import at the top of the file:
```ts
import { useRef, useEffect, useCallback, useState, type RefObject } from 'react';
```

### Step 5: Update `redraw` to pass new params

In the `redraw` useCallback, add `dragState, ghostY, hoveredLock` to the dependency array and to both `drawRuler` call sites:

```ts
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
        dragState,
        ghostY,
        hoveredLockId: hoveredLock?.id ?? null,
        hoveredSide: hoveredLock?.side ?? null,
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
        dragState,
        ghostY,
        hoveredLockId: hoveredLock?.id ?? null,
        hoveredSide: hoveredLock?.side ?? null,
      });
    }
  }, [
    sourceContainerRef, translationContainerRef,
    lockingPoints, activeLockIndex,
    pendingLockSide, pendingLockY,
    dragState, ghostY, hoveredLock,
  ]);
```

### Step 6: Verify build

```bash
cd /home/gan_hope326/Projects/mirror && bun run build 2>&1 | tail -5
```
Expected: `✓ built in ...` with no TypeScript errors.

### Step 7: Commit

```bash
git add src/components/editor/RulerBar.tsx
git commit -m "feat: extend drawRuler with hover highlight and drag ghost rendering"
```

---

## Task 3: Add interaction handlers, CSS cursors, and wire up JSX

**Files:**
- Modify: `src/components/editor/RulerBar.tsx`
- Modify: `src/components/editor/RulerBar.css`

### Step 1: Add `updateLockingPoint` to the context destructure in `RulerBar`

In the `useEditorSettings()` destructure, add:

```ts
    updateLockingPoint,
```

### Step 2: Add the `GRAB_THRESHOLD` constant near the top of the file

After the existing constants (`TICK_INTERVAL`, etc.), add:

```ts
const GRAB_THRESHOLD = 8; // px — distance within which a click/hover hits a marker
```

### Step 3: Add `handleRulerMouseMove`

After `handleRulerClick`, add:

```ts
  const handleRulerMouseMove = useCallback(
    (side: 'source' | 'translation', e: React.MouseEvent<HTMLDivElement>) => {
      // Ignore mouse on the opposite side during drag
      if (dragState && dragState.side !== side) return;

      const rulerDiv = side === 'source' ? sourceRulerRef.current : translationRulerRef.current;
      if (!rulerDiv) return;

      const rect = rulerDiv.getBoundingClientRect();
      const contentY = e.clientY - rect.top + rulerDiv.scrollTop;

      if (dragState?.side === side) {
        // Update ghost Y — clamped between adjacent lock points on this side
        const idx = lockingPoints.findIndex(lp => lp.id === dragState.lockId);
        if (idx !== -1) {
          const key = side === 'source' ? 'sourceY' : 'translationY';
          const prev = lockingPoints[idx - 1];
          const next = lockingPoints[idx + 1];
          const minY = prev ? prev[key] + 1 : 0;
          const maxY = next ? next[key] - 1 : Number.MAX_SAFE_INTEGER;
          setGhostY(Math.max(minY, Math.min(maxY, contentY)));
        }
        return;
      }

      // Hover detection
      let closest: { id: string; dist: number } | null = null;
      for (const lp of lockingPoints) {
        const y = side === 'source' ? lp.sourceY : lp.translationY;
        const dist = Math.abs(y - contentY);
        if (dist <= GRAB_THRESHOLD && (!closest || dist < closest.dist)) {
          closest = { id: lp.id, dist };
        }
      }
      setHoveredLock(closest ? { id: closest.id, side } : null);
    },
    [dragState, lockingPoints],
  );
```

### Step 4: Add `handleRulerMouseLeave`

After `handleRulerMouseMove`, add:

```ts
  const handleRulerMouseLeave = useCallback(() => {
    // Keep hover cleared; during drag, ghost position is maintained via ghostY state
    if (!dragState) setHoveredLock(null);
  }, [dragState]);
```

### Step 5: Replace `handleRulerClick` with the updated version

Replace the existing `handleRulerClick` implementation with:

```ts
  const handleRulerClick = useCallback(
    (side: 'source' | 'translation', e: React.MouseEvent<HTMLDivElement>) => {
      const rulerDiv = side === 'source' ? sourceRulerRef.current : translationRulerRef.current;
      if (!rulerDiv) return;

      const rect = rulerDiv.getBoundingClientRect();
      const clickContentY = e.clientY - rect.top + rulerDiv.scrollTop;

      // Drop: clicking on the dragged side commits the ghost position
      if (dragState?.side === side) {
        if (ghostY !== null) {
          updateLockingPoint(dragState.lockId, side, ghostY);
        }
        setDragState(null);
        setGhostY(null);
        return;
      }

      // Ignore clicks on the opposite side while a drag is active
      if (dragState) return;

      // Grab: clicking within threshold of an existing marker enters drag mode
      const fromKey = side === 'source' ? 'sourceY' : 'translationY';
      let grabTarget: LockingPoint | null = null;
      let grabDist = GRAB_THRESHOLD + 1;
      for (const lp of lockingPoints) {
        const dist = Math.abs(lp[fromKey] - clickContentY);
        if (dist < grabDist) {
          grabTarget = lp;
          grabDist = dist;
        }
      }

      if (grabTarget && grabDist <= GRAB_THRESHOLD) {
        // Abort any pending two-step creation
        if (pendingLockSide !== null) abortLockCreation();
        setDragState({ lockId: grabTarget.id, side, originalY: grabTarget[fromKey] });
        setGhostY(grabTarget[fromKey]);
        return;
      }

      // Existing two-step creation logic (no marker nearby)
      if (pendingLockSide === null) {
        beginLockCreation(side, clickContentY);
      } else if (pendingLockSide === side) {
        beginLockCreation(side, clickContentY);
      } else {
        completeLockCreation(clickContentY);
      }
    },
    [
      dragState, ghostY, lockingPoints, pendingLockSide,
      updateLockingPoint, abortLockCreation, beginLockCreation, completeLockCreation,
    ],
  );
```

### Step 6: Replace `handleRulerContextMenu` with the updated version

Replace the existing `handleRulerContextMenu` implementation with:

```ts
  const handleRulerContextMenu = useCallback(
    (side: 'source' | 'translation', e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();

      // Cancel drag if active
      if (dragState) {
        setDragState(null);
        setGhostY(null);
        return;
      }

      // Abort pending two-step creation
      if (pendingLockSide !== null) {
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
    [dragState, lockingPoints, removeLockingPoint, pendingLockSide, abortLockCreation],
  );
```

### Step 7: Replace cursor class logic and update JSX

Replace the two `const ...RulerClass = ...` lines with helper functions:

```ts
  const getSourceRulerClass = () => {
    const base = 'ruler-half ruler-half--source';
    if (dragState?.side === 'source') return base + ' ruler-half--dragging';
    if (hoveredLock?.side === 'source') return base + ' ruler-half--hoverable';
    if (pendingLockSide === 'translation') return base + ' ruler-half--pending-target';
    return base;
  };

  const getTranslationRulerClass = () => {
    const base = 'ruler-half ruler-half--translation';
    if (dragState?.side === 'translation') return base + ' ruler-half--dragging';
    if (hoveredLock?.side === 'translation') return base + ' ruler-half--hoverable';
    if (pendingLockSide === 'source') return base + ' ruler-half--pending-target';
    return base;
  };
```

Update the ruler divs in the JSX to use the new class functions and add the new event handlers:

```tsx
        <div
          ref={sourceRulerRef}
          className={getSourceRulerClass()}
          onClick={(e) => handleRulerClick('source', e)}
          onContextMenu={(e) => handleRulerContextMenu('source', e)}
          onMouseMove={(e) => handleRulerMouseMove('source', e)}
          onMouseLeave={handleRulerMouseLeave}
        >
          <canvas ref={sourceCanvasRef} />
        </div>
        <div
          ref={translationRulerRef}
          className={getTranslationRulerClass()}
          onClick={(e) => handleRulerClick('translation', e)}
          onContextMenu={(e) => handleRulerContextMenu('translation', e)}
          onMouseMove={(e) => handleRulerMouseMove('translation', e)}
          onMouseLeave={handleRulerMouseLeave}
        >
          <canvas ref={translationCanvasRef} />
        </div>
```

### Step 8: Add CSS cursor classes

Append to `src/components/editor/RulerBar.css`:

```css
.ruler-half--hoverable {
  cursor: pointer;
}

.ruler-half--dragging {
  cursor: grabbing;
}
```

### Step 9: Verify build

```bash
cd /home/gan_hope326/Projects/mirror && bun run build 2>&1 | tail -5
```
Expected: `✓ built in ...` with no TypeScript errors.

### Step 10: Commit

```bash
git add src/components/editor/RulerBar.tsx src/components/editor/RulerBar.css
git commit -m "feat: click-to-grab/drop anchor drag with hover highlight and ghost preview"
```

---

## Task 4: Manual testing

Run `bun run dev` and verify:

**Hover:**
- Move cursor over a lock point marker → cursor becomes pointer
- Marker brightens slightly
- Move away → cursor returns to crosshair, marker returns to normal

**Grab:**
- Click near a marker → cursor becomes grabbing, original dims to ~35% opacity, ghost appears at same position
- If a two-step creation was pending, it is aborted

**Drag:**
- Move mouse over the ruler (same side as grabbed marker) → ghost arrow follows cursor
- Ghost is clamped: cannot pass adjacent lock points on the same side

**Drop:**
- Click again on the same ruler → ghost disappears, lock point updates to new position
- Scroll sync immediately reflects new correspondence

**Cancel:**
- Right-click during grab → drag mode exits, original lock point unchanged, marker returns to normal opacity

**Interaction with existing features:**
- Right-click on a marker (not in drag mode) → still removes it
- Click away from markers (not in drag mode) → still creates new lock points (two-step)
- Scroll sync continues to work correctly after dragging a lock point
