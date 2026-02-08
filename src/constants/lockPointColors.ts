/** 8-color cycling palette for lock point markers. */

interface ColorVariant {
  vivid: string;
  muted: string;
}

interface ThemeColors {
  dark: ColorVariant;
  light: ColorVariant;
}

const PALETTE: ThemeColors[] = [
  // 0 - red
  { dark: { vivid: '#ef4444', muted: '#7f1d1d' }, light: { vivid: '#dc2626', muted: '#fca5a5' } },
  // 1 - amber
  { dark: { vivid: '#f59e0b', muted: '#78350f' }, light: { vivid: '#d97706', muted: '#fcd34d' } },
  // 2 - green
  { dark: { vivid: '#22c55e', muted: '#14532d' }, light: { vivid: '#16a34a', muted: '#86efac' } },
  // 3 - teal
  { dark: { vivid: '#14b8a6', muted: '#134e4a' }, light: { vivid: '#0d9488', muted: '#5eead4' } },
  // 4 - blue
  { dark: { vivid: '#3b82f6', muted: '#1e3a5f' }, light: { vivid: '#2563eb', muted: '#93c5fd' } },
  // 5 - violet
  { dark: { vivid: '#8b5cf6', muted: '#3b1f7a' }, light: { vivid: '#7c3aed', muted: '#c4b5fd' } },
  // 6 - magenta
  { dark: { vivid: '#ec4899', muted: '#831843' }, light: { vivid: '#db2777', muted: '#f9a8d4' } },
  // 7 - coral
  { dark: { vivid: '#f97316', muted: '#7c2d12' }, light: { vivid: '#ea580c', muted: '#fdba74' } },
];

export const LOCK_POINT_COLOR_COUNT = PALETTE.length;

export function getLockPointColor(
  colorIndex: number,
  isActive: boolean,
  isDark: boolean,
): string {
  const safeIndex = (colorIndex ?? 0) % PALETTE.length;
  const entry = PALETTE[safeIndex < 0 ? 0 : safeIndex]!;
  const theme = isDark ? entry.dark : entry.light;
  return isActive ? theme.vivid : theme.muted;
}
