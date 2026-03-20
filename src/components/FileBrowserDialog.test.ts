import { describe, test, expect } from 'bun:test';

// These helpers will live in FileBrowserDialog.tsx.
// Duplicate here for standalone testing; keep in sync with the component.
function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`;
}
function splitPath(p: string): string[] {
  return p.split('/').filter(Boolean);
}
function pathUpTo(segments: string[], upTo: number): string {
  return '/' + segments.slice(0, upTo + 1).join('/');
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

describe('joinPath', () => {
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

describe('splitPath', () => {
  test('splits correctly', () => {
    expect(splitPath('/home/user/Documents')).toEqual(['home', 'user', 'Documents']);
  });
  test('handles root', () => {
    expect(splitPath('/')).toEqual([]);
  });
});

describe('pathUpTo', () => {
  test('reconstructs path up to index', () => {
    const segs = ['home', 'user', 'Documents'];
    expect(pathUpTo(segs, 0)).toBe('/home');
    expect(pathUpTo(segs, 1)).toBe('/home/user');
    expect(pathUpTo(segs, 2)).toBe('/home/user/Documents');
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
