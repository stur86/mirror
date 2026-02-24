# Anchor Drag Design — 2026-02-24

## Goal

Make lock point markers in the ruler bar click-to-grab, drag, and click-to-drop, with visual hover feedback and ghost-preview during drag. Each side's marker is an independent handle — dragging the source arrow changes only `sourceY`; dragging the translation arrow changes only `translationY`.

## Interaction Model

**Hover:**
- `mousemove` over a ruler div computes content-Y and checks distance to each marker on that side
- Within ~8px of a marker → `cursor: pointer` on the div; marker renders with a subtle highlight tint

**Grab (click-to-grab):**
- `click` near a marker → enter drag mode
- Stores `{ lockId, side, originalY }`
- If a two-step lock creation was pending, it is aborted

**During drag (mousemove):**
- `ghostY` = cursor content-Y, clamped between adjacent lock points' Y values on the same side (prevents order inversion)
- Canvas redraws each frame showing:
  - Grabbed marker **dimmed** at `originalY`
  - Bright ghost arrow at `ghostY`
- Cursor: `grabbing`

**Drop (click while in drag mode):**
- Commits `ghostY` as the new Y for the grabbed side via `updateLockingPoint`
- Exits drag mode

**Cancel (right-click while in drag mode):**
- Clears drag state; lock point unchanged

## State

All drag/hover state is local to `RulerBar` — nothing in context until drop.

```ts
dragState: { lockId: string; side: 'source' | 'translation'; originalY: number } | null
ghostY: number | null          // cursor content-Y during drag
hoveredLock: { id: string; side: 'source' | 'translation' } | null
```

## Rendering Changes (`drawRuler`)

Two new parameters:

| Parameter | Effect |
|---|---|
| `dragState + ghostY` | Renders grabbed marker dimmed at `originalY`; renders bright ghost arrow at `ghostY` |
| `hoveredLock` | Renders matching marker with a lighter/glow tint |

Cursor class on ruler div:
- Hovering a marker, no drag → `cursor: pointer`
- In drag mode → `cursor: grabbing`
- Otherwise → default

## Context Changes (`EditorSettingsContext`)

One new function:

```ts
updateLockingPoint(id: string, side: 'source' | 'translation', y: number): void
```

**Logic:**
1. Find the lock point and its immediate neighbours in the sorted array
2. If the new `y` would invert order with either neighbour → **reject (no-op)**
3. Otherwise → update `sourceY` or `translationY` in place; no re-sort needed

No `activeLockIndex` adjustment — array order is guaranteed unchanged.

## Files Touched

| File | Change |
|---|---|
| `src/contexts/EditorSettingsContext.tsx` | Add `updateLockingPoint` |
| `src/components/editor/RulerBar.tsx` | Add hover/drag state; update `drawRuler` signature and call sites; update event handlers |
| `src/components/editor/RulerBar.css` | Cursor styles for hover/drag states |
