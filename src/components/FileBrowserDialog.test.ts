import { describe, test, expect } from 'bun:test';

// These helpers will live in FileBrowserDialog.tsx.
// Duplicate here for standalone testing; keep in sync with the component.
function joinPath(dir: string, name: string): string {
  if (dir.endsWith('/') || dir.endsWith('\\')) return dir + name;
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir}${sep}${name}`;
}

function splitPath(p: string): string[] {
  return p.split(/[/\\]/).filter(Boolean);
}

function isWindowsDrivePath(segments: string[]): boolean {
  return segments.length > 0 && /^[A-Za-z]:$/.test(segments[0]);
}

function pathUpTo(segments: string[], upTo: number): string {
  const parts = segments.slice(0, upTo + 1);
  if (isWindowsDrivePath(parts)) {
    return parts.length === 1 ? parts[0] + '\\' : parts.join('\\');
  }
  return '/' + parts.join('/');
}

function applyFilter(
  entries: Array<{ name: string; isDirectory: boolean }>,
  extensions: string[] | null,
): Array<{ name: string; isDirectory: boolean }> {
  if (!extensions) return entries;
  return entries.filter(
    (e) => e.isDirectory || extensions.some((ext) => e.name.toLowerCase().endsWith(ext)),
  );
}

describe('joinPath (POSIX)', () => {
  test('avoids double slash at root', () => {
    expect(joinPath('/', 'home')).toBe('/home');
  });
  test('adds separator normally', () => {
    expect(joinPath('/home/user', 'Documents')).toBe('/home/user/Documents');
  });
  test('no extra slash when dir already ends with /', () => {
    expect(joinPath('/home/', 'user')).toBe('/home/user');
  });
});

describe('joinPath (Windows)', () => {
  test('uses backslash separator when path already contains backslash', () => {
    expect(joinPath('C:\\Users\\simon', 'Documents')).toBe('C:\\Users\\simon\\Documents');
  });
  test('no extra separator when dir already ends with backslash', () => {
    expect(joinPath('C:\\', 'Users')).toBe('C:\\Users');
  });
  test('preserves backslash separator through multiple joins', () => {
    const step1 = joinPath('C:\\Users\\simon', 'Documents');
    const step2 = joinPath(step1, 'Projects');
    expect(step2).toBe('C:\\Users\\simon\\Documents\\Projects');
  });
});

describe('splitPath (POSIX)', () => {
  test('splits correctly', () => {
    expect(splitPath('/home/user/Documents')).toEqual(['home', 'user', 'Documents']);
  });
  test('handles root', () => {
    expect(splitPath('/')).toEqual([]);
  });
});

describe('splitPath (Windows)', () => {
  test('splits backslash-separated path', () => {
    expect(splitPath('C:\\Users\\simon')).toEqual(['C:', 'Users', 'simon']);
  });
  test('handles mixed separators', () => {
    expect(splitPath('C:\\Users\\simon/Documents')).toEqual(['C:', 'Users', 'simon', 'Documents']);
  });
});

describe('pathUpTo (POSIX)', () => {
  test('reconstructs path up to index', () => {
    const segs = ['home', 'user', 'Documents'];
    expect(pathUpTo(segs, 0)).toBe('/home');
    expect(pathUpTo(segs, 1)).toBe('/home/user');
    expect(pathUpTo(segs, 2)).toBe('/home/user/Documents');
  });
});

describe('pathUpTo (Windows)', () => {
  test('drive root alone gets trailing backslash', () => {
    expect(pathUpTo(['C:'], 0)).toBe('C:\\');
  });
  test('reconstructs Windows path up to index', () => {
    const segs = ['C:', 'Users', 'simon'];
    expect(pathUpTo(segs, 0)).toBe('C:\\');
    expect(pathUpTo(segs, 1)).toBe('C:\\Users');
    expect(pathUpTo(segs, 2)).toBe('C:\\Users\\simon');
  });
});

describe('applyFilter', () => {
  const entries = [
    { name: 'src', isDirectory: true },
    { name: 'file.mirror.json', isDirectory: false },
    { name: 'readme.txt', isDirectory: false },
  ];

  test('directories always pass through', () => {
    const result = applyFilter(entries, ['.mirror.json']);
    expect(result.find((e) => e.name === 'src')).toBeTruthy();
  });
  test('files filtered by extension', () => {
    const result = applyFilter(entries, ['.mirror.json']);
    expect(result.find((e) => e.name === 'file.mirror.json')).toBeTruthy();
    expect(result.find((e) => e.name === 'readme.txt')).toBeUndefined();
  });
  test('null filter passes all', () => {
    expect(applyFilter(entries, null)).toHaveLength(3);
  });
  test('case-insensitive extension match', () => {
    const mixed = [{ name: 'File.MIRROR.JSON', isDirectory: false }];
    expect(applyFilter(mixed, ['.mirror.json'])).toHaveLength(1);
  });
});
