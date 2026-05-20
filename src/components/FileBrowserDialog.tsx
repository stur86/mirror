import { useState, useEffect, useCallback } from 'react';
import { Dialog, Breadcrumbs, InputGroup, HTMLSelect, Button, Spinner } from './index';
import { nativeAPI } from '../platform';
import './FileBrowserDialog.css';

export interface FileFilter {
  label: string;
  extensions: string[];
}

export interface FileBrowserResult {
  path: string;
  buffer?: ArrayBuffer; // open mode only
}

interface FileBrowserDialogProps {
  isOpen: boolean;
  mode: 'save' | 'open';
  title: string;
  suggestedName?: string;
  filters?: FileFilter[];
  defaultPath?: string;
  onConfirm: (result: FileBrowserResult) => void;
  onClose: () => void;
}

interface Entry {
  name: string;
  isDirectory: boolean;
}

// ---- Path utilities (Windows and POSIX) ----------------------------------------

function joinPath(dir: string, name: string): string {
  if (dir.endsWith('/') || dir.endsWith('\\')) return dir + name;
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir}${sep}${name}`;
}

function splitPath(p: string): string[] {
  return p.split(/[/\\]/).filter(Boolean);
}

function isWindowsDrivePath(segments: string[]): boolean {
  return segments.length > 0 && /^[A-Za-z]:$/.test(segments[0]!);
}

function pathUpTo(segments: string[], upTo: number): string {
  const parts = segments.slice(0, upTo + 1);
  if (isWindowsDrivePath(parts)) {
    return parts.length === 1 ? parts[0]! + '\\' : parts.join('\\');
  }
  return '/' + parts.join('/');
}

// ---- Entry filtering ----------------------------------------------------------

function applyFilter(entries: Entry[], extensions: string[] | null): Entry[] {
  if (!extensions) return entries;
  return entries.filter(
    (e) => e.isDirectory || extensions.some((ext) => e.name.toLowerCase().endsWith(ext)),
  );
}

// ---- Filter helpers -----------------------------------------------------------

// Sentinel label for the synthetic "All supported" option.
const ALL_SUPPORTED_LABEL = '__all_supported__';

function buildAllSupportedFilter(filters: FileFilter[]): FileFilter {
  const exts = [...new Set(filters.flatMap((f) => f.extensions))];
  return { label: ALL_SUPPORTED_LABEL, extensions: exts };
}

function filterDropdownLabel(filter: FileFilter): string {
  if (filter.label === ALL_SUPPORTED_LABEL) return 'All supported';
  const shown = filter.extensions.slice(0, 2).map((e) => `*${e}`).join(', ');
  const more = filter.extensions.length > 2 ? ', …' : '';
  return `${filter.label} (${shown}${more})`;
}

// Strip the first matching known extension from a filename.
function stripKnownExtension(name: string, allFilters: FileFilter[]): string {
  const lower = name.toLowerCase();
  for (const f of allFilters) {
    for (const ext of f.extensions) {
      if (lower.endsWith(ext.toLowerCase())) {
        return name.slice(0, -ext.length);
      }
    }
  }
  return name;
}

// Return filename with the given filter's primary extension applied.
function applyExtension(filename: string, filter: FileFilter, allFilters: FileFilter[]): string {
  const ext = filter.extensions[0];
  if (!ext) return filename;
  const base = stripKnownExtension(filename, allFilters);
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : base + ext;
}

// Compute the default selected filter for a given mode + filter list.
function defaultFilter(mode: 'save' | 'open', filters: FileFilter[] | undefined): FileFilter | null {
  if (!filters || filters.length === 0) return null;
  // Open mode with multiple groups: default to "All supported"
  if (mode === 'open' && filters.length > 1) return buildAllSupportedFilter(filters);
  return filters[0] ?? null;
}

// ---- Component ---------------------------------------------------------------

export function FileBrowserDialog({
  isOpen,
  mode,
  title,
  suggestedName,
  filters,
  defaultPath,
  onConfirm,
  onClose,
}: FileBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [standardPaths, setStandardPaths] = useState<{
    home: string;
    desktop: string;
    documents: string;
    downloads: string;
  } | null>(null);
  const [filename, setFilename] = useState(suggestedName ?? '');
  const [selectedFilter, setSelectedFilter] = useState<FileFilter | null>(() =>
    defaultFilter(mode, filters),
  );
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const navigateTo = useCallback(async (path: string) => {
    setIsLoading(true);
    setListError(null);
    const result = await nativeAPI!.listDirectory(path);
    setIsLoading(false);
    if ('error' in result) {
      setListError(result.error);
      return;
    }
    setCurrentPath(path);
    setEntries(result.entries);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const df = defaultFilter(mode, filters);
    // In save mode, apply the default filter's extension to the suggested name.
    const initName =
      mode === 'save' && df && df.label !== ALL_SUPPORTED_LABEL
        ? applyExtension(suggestedName ?? '', df, filters ?? [])
        : (suggestedName ?? '');
    setFilename(initName);
    setSelectedFilter(df);
    setIsCreatingFolder(false);
    setNewFolderName('');
    setNewFolderError(null);
    setListError(null);
    setConfirmError(null);
    setEntries([]);
    setIsLoading(true);

    nativeAPI!.getStandardPaths().then((paths) => {
      setStandardPaths(paths);
      const startDir = defaultPath ?? paths.home;
      nativeAPI!.listDirectory(startDir).then((result) => {
        setIsLoading(false);
        if ('error' in result) {
          navigateTo(paths.home);
        } else {
          setCurrentPath(startDir);
          setEntries(result.entries);
        }
      });
    });
  }, [isOpen, navigateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = useCallback((value: string) => {
    if (value === '__all__') {
      setSelectedFilter(null);
      // In open mode, clear the selected filename when switching filters.
      if (mode === 'open') setFilename('');
    } else if (value === ALL_SUPPORTED_LABEL) {
      setSelectedFilter(buildAllSupportedFilter(filters ?? []));
      if (mode === 'open') setFilename('');
    } else {
      const f = filters?.find((f) => f.label === value) ?? null;
      setSelectedFilter(f);
      if (mode === 'save' && f) {
        setFilename((prev) => applyExtension(prev, f, filters ?? []));
      }
      if (mode === 'open') setFilename('');
    }
  }, [mode, filters]);

  const handleConfirm = useCallback(async (overridePath?: string) => {
    let fullPath = overridePath ?? joinPath(currentPath, filename);
    const resolvedFilename = fullPath.split(/[/\\]/).pop() ?? '';
    if (!resolvedFilename || isConfirming) return;
    setConfirmError(null);
    setIsConfirming(true);

    if (mode === 'save') {
      // Enforce extension for specific (non-"All files") filters.
      if (selectedFilter && selectedFilter.label !== ALL_SUPPORTED_LABEL) {
        const lower = fullPath.toLowerCase();
        const hasExt = selectedFilter.extensions.some((e) => lower.endsWith(e.toLowerCase()));
        if (!hasExt && selectedFilter.extensions[0]) {
          fullPath = fullPath + selectedFilter.extensions[0];
        }
      }
      onConfirm({ path: fullPath });
      setIsConfirming(false);
      return;
    }

    // open mode: read file via Rust
    const result = await nativeAPI!.readFile(fullPath);
    setIsConfirming(false);
    if ('error' in result) {
      setConfirmError(result.error);
      return;
    }
    const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
    onConfirm({ path: fullPath, buffer: bytes.buffer });
  }, [filename, currentPath, mode, selectedFilter, onConfirm, isConfirming]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    const newPath = joinPath(currentPath, newFolderName.trim());
    const result = await nativeAPI!.createDirectory(newPath);
    if (!result.ok) {
      setNewFolderError('Could not create folder.');
      return;
    }
    setIsCreatingFolder(false);
    setNewFolderName('');
    setNewFolderError(null);
    const refreshed = await nativeAPI!.listDirectory(currentPath);
    if (!('error' in refreshed)) {
      setEntries(refreshed.entries);
    }
  }, [currentPath, newFolderName]);

  const cancelNewFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName('');
    setNewFolderError(null);
  }, []);

  // Active extensions for file-list filtering.
  const activeExtensions = mode === 'open' && selectedFilter ? selectedFilter.extensions : null;
  const visibleEntries = applyFilter(entries, activeExtensions);

  // Breadcrumbs
  const segments = splitPath(currentPath);
  const breadcrumbItems = [
    {
      text: '🏠',
      onClick: standardPaths ? () => navigateTo(standardPaths.home) : undefined,
    },
    ...segments.map((seg, i) => ({
      text: seg,
      onClick: i < segments.length - 1 ? () => navigateTo(pathUpTo(segments, i)) : undefined,
    })),
  ];

  const isActiveSidebar = (path: string) =>
    currentPath === path ||
    currentPath.startsWith(path + '/') ||
    currentPath.startsWith(path + '\\');

  // Build dropdown options.
  const filterOptions: Array<{ label: string; value: string }> = [];
  if (filters && filters.length > 0) {
    if (mode === 'open' && filters.length > 1) {
      filterOptions.push({ label: 'All supported', value: ALL_SUPPORTED_LABEL });
    }
    for (const f of filters) {
      filterOptions.push({ label: filterDropdownLabel(f), value: f.label });
    }
  }
  filterOptions.push({ label: 'All files (*)', value: '__all__' });

  const filterValue =
    selectedFilter === null
      ? '__all__'
      : selectedFilter.label === ALL_SUPPORTED_LABEL
      ? ALL_SUPPORTED_LABEL
      : selectedFilter.label;

  return (
    <Dialog
      className="fb-dialog"
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      canOutsideClickClose={false}
    >
      <div className="fb-body">
        {/* Sidebar */}
        <div className="fb-sidebar">
          <div className="fb-places-label">Places</div>
          {!standardPaths ? (
            <Spinner size={16} />
          ) : (
            [
              { label: '🏠 Home', path: standardPaths.home },
              { label: '🖥 Desktop', path: standardPaths.desktop },
              { label: '📄 Documents', path: standardPaths.documents },
              { label: '⬇ Downloads', path: standardPaths.downloads },
            ].map(({ label, path }) => (
              <div
                key={path}
                className={`fb-place-item${isActiveSidebar(path) ? ' fb-active' : ''}`}
                onClick={() => navigateTo(path)}
              >
                {label}
              </div>
            ))
          )}
        </div>

        {/* Main */}
        <div className="fb-main">
          <div className="fb-breadcrumb">
            <Breadcrumbs items={breadcrumbItems} />
          </div>

          <div className="fb-list">
            {isLoading ? (
              <div style={{ padding: 12 }}>
                <Spinner size={20} />
              </div>
            ) : listError ? (
              <div className="fb-list-error">{listError}</div>
            ) : visibleEntries.length === 0 ? (
              <div className="fb-list-message">
                {mode === 'open' ? 'No matching files.' : 'Empty folder.'}
              </div>
            ) : (
              visibleEntries.map((entry) => {
                const isDir = entry.isDirectory;
                const isSelected = entry.name === filename;
                const isDimmed = mode === 'save' && !isDir;
                return (
                  <div
                    key={entry.name}
                    className={`fb-entry${isSelected ? ' fb-selected' : ''}${isDimmed ? ' fb-dimmed' : ''}`}
                    onClick={() => {
                      if (isDir) {
                        navigateTo(joinPath(currentPath, entry.name));
                      } else if (!isDimmed) {
                        setFilename(entry.name);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isDir && !isDimmed) {
                        const fullPath = joinPath(currentPath, entry.name);
                        setFilename(entry.name);
                        handleConfirm(fullPath);
                      }
                    }}
                  >
                    {isDir ? '📁' : '📄'} {entry.name}
                  </div>
                );
              })
            )}
          </div>

          {/* New Folder — save mode only */}
          {mode === 'save' && (
            <div className="fb-new-folder-row">
              {!isCreatingFolder ? (
                <button
                  className="fb-new-folder-link"
                  onClick={() => {
                    setIsCreatingFolder(true);
                    setNewFolderError(null);
                  }}
                >
                  + New Folder
                </button>
              ) : (
                <>
                  <div className="fb-new-folder-input-row">
                    <InputGroup
                      small
                      autoFocus
                      value={newFolderName}
                      placeholder="Folder name"
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') cancelNewFolder();
                      }}
                    />
                    <Button small onClick={handleCreateFolder}>
                      Create
                    </Button>
                    <Button small minimal onClick={cancelNewFolder}>
                      ✕
                    </Button>
                  </div>
                  {newFolderError && (
                    <div className="fb-new-folder-error">{newFolderError}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fb-footer">
        <span className="fb-footer-label">{mode === 'save' ? 'Save as:' : 'Open:'}</span>
        <div className="fb-filename-field">
          <InputGroup
            fill
            value={filename}
            readOnly={mode === 'open'}
            onChange={(e) => {
              if (mode === 'save') setFilename(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filename) handleConfirm();
            }}
          />
        </div>
        <HTMLSelect
          value={filterValue}
          onChange={(e) => handleFilterChange(e.target.value)}
          options={filterOptions}
        />
        {confirmError && <span className="fb-confirm-error">{confirmError}</span>}
        <Button
          intent="primary"
          disabled={!filename || isConfirming || isLoading}
          onClick={() => handleConfirm()}
        >
          {mode === 'save' ? 'Save' : 'Open'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Dialog>
  );
}
