# Scroll Sync Redesign — 2026-02-24

## Problem

The existing segment-based scroll sync (`useScrollSync.ts`) has multiple bugs causing erratic, jerky behaviour:

1. **Broken proportional formula** — normalises segment progress using `max(segLength, viewportH)` independently on each side, causing the synced pane to scroll well past its segment end when the two sides have different segment lengths.
2. **Snap inconsistency near top** — `snapToActiveLock` clamps `scrollTop` to 0 for near-top lock points, but the progress formula uses the unclamped value, producing a nonzero progress at scrollTop=0.
3. **Hard snaps on lock transition** — changing `activeLockIndex` immediately teleports both panes to a calculated position via `snapToActiveLock`, which feels jarring.

## Chosen Approach: Constant-Offset with rAF Easing

Replace the segment/focus-line/snap machinery with the algorithm originally specified in `CLAUDE.md`.

### Algorithm

On each scroll event from either pane:

1. **Find active lock** — the topmost lock point whose content-Y ≤ `scrollTop` + `viewportHeight` on the scrolling pane (i.e. visible or not yet scrolled past). If all lock points are above the viewport (all `fromY < scrollTop`), use the one with the largest `fromY` (nearest above).

2. **Compute target**:
   ```
   targetScrollTop = lp.toY - (lp.fromY - scrollTop)
   ```
   where `fromY` / `toY` are the lock's coordinate on the scrolling / synced pane respectively.

3. **Apply**:
   - Same active lock as last event → set synced pane `scrollTop` directly.
   - Active lock changed → cancel any in-flight animation, start 120ms smoothstep ease from current `scrollTop` to `targetScrollTop`.
   - New scroll event during animation → cancel animation, apply `targetScrollTop` instantly.

### Easing

rAF loop with smoothstep: `f(t) = t² × (3 − 2t)`, duration 120ms.

### Feedback-Loop Prevention

- `isApplying` ref: set to `true` before any programmatic `scrollTop` write (direct or animation tick), cleared after one frame. The synced pane's scroll listener ignores events while `isApplying` is true.
- `scrollingPaneRef`: tracks which pane the user is actively scrolling (reset 50ms after last user scroll event). Prevents the synced pane's scroll listener from becoming the "driving" pane.

## State Changes

### `EditorSettingsContext.tsx`
- **Remove**: `navigateToNextLock`, `navigateToPrevLock` (no longer needed — active lock is computed locally per scroll event in the hook).
- **Keep**: `activeLockIndex` + `setActiveLockIndex` — still used by `RulerBar` to visually highlight the active lock marker. The hook calls `setActiveLockIndex` only when the active lock changes (infrequent; no per-frame React re-renders).

### `useScrollSync.ts`
- Full rewrite. Remove: `FOCUS_LINE_RATIO`, `FOCUS_REGION_TOP`, `FOCUS_REGION_BOTTOM`, `snapToActiveLock`, all segment calculations.
- Add: active lock finder, constant-offset formula, rAF animation loop.

### `RulerBar.tsx`
- No changes. Already consumes `activeLockIndex` purely for visual highlighting.

### `CLAUDE.md`
- Minor wording update to remove references to segment/focus-line behaviour.

## Files Touched

| File | Change |
|------|--------|
| `src/hooks/useScrollSync.ts` | Full rewrite |
| `src/contexts/EditorSettingsContext.tsx` | Remove nav functions |
| `CLAUDE.md` | Update scroll sync description |
