import { describe, test, expect } from 'bun:test';

// Extract and test the pure sort/filter logic used by listDirectory.
// We test the logic in isolation — no RPC setup needed.
function sortAndFilter(
  entries: Array<{ name: string; isDirectory: boolean }>,
): Array<{ name: string; isDirectory: boolean }> {
  return entries
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

describe('listDirectory sort/filter logic', () => {
  test('directories come before files', () => {
    const input = [
      { name: 'zebra.txt', isDirectory: false },
      { name: 'alpha', isDirectory: true },
    ];
    const result = sortAndFilter(input);
    expect(result[0].name).toBe('alpha');
    expect(result[0].isDirectory).toBe(true);
    expect(result[1].name).toBe('zebra.txt');
  });

  test('dotfiles are excluded', () => {
    const input = [
      { name: '.hidden', isDirectory: false },
      { name: '.git', isDirectory: true },
      { name: 'visible.txt', isDirectory: false },
    ];
    const result = sortAndFilter(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('visible.txt');
  });

  test('entries within same type are sorted alphabetically', () => {
    const input = [
      { name: 'zebra', isDirectory: true },
      { name: 'alpha', isDirectory: true },
      { name: 'mango', isDirectory: true },
    ];
    expect(sortAndFilter(input).map((e) => e.name)).toEqual(['alpha', 'mango', 'zebra']);
  });

  test('mixed types: dirs first, each group alphabetical', () => {
    const input = [
      { name: 'notes.txt', isDirectory: false },
      { name: 'src', isDirectory: true },
      { name: 'abc.md', isDirectory: false },
      { name: 'docs', isDirectory: true },
    ];
    const result = sortAndFilter(input);
    expect(result.map((e) => e.name)).toEqual(['docs', 'src', 'abc.md', 'notes.txt']);
  });
});
