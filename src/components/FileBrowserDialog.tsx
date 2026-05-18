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
  return segments.length > 0 && /^[A-Za-z]:$/.test(segments[0]);
}

function pathUpTo(segments: string[], upTo: number): string {
  const parts = segments.slice(0, upTo + 1);
  if (isWindowsDrivePath(parts)) {
    // "C:" alone → "C:\"; "C:", "Users" → "C:\Users"
    return parts.length === 1 ? parts[0] + '\\' : parts.join('\\');
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

// ---- Component ---------------------------------------------------------------

export function FileBrowserDialog({
  isOpen,
  mode,
  title,
  suggestedName,
  filters,
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
  const [selectedFilter, setSelectedFilter] = useState<FileFilter | null>(filters?.[0] ?? null);
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
      return; // currentPath unchanged — user can still navigate via breadcrumb/sidebar
    }
    setCurrentPath(path);
    setEntries(result.entries);
  }, []);

  // On dialog open: fetch standard paths, then immediately list the home directory.
  // getStandardPaths must complete first to know the home path — but listDirectory
  // is fired as soon as home is known (no extra await between them).
  useEffect(() => {
    if (!isOpen) return;
    setFilename(suggestedName ?? '');
    setSelectedFilter(filters?.[0] ?? null);
    setIsCreatingFolder(false);
    setNewFolderName('');
    setNewFolderError(null);
    setListError(null);
    setConfirmError(null);
    setEntries([]);
    setIsLoading(true);

    nativeAPI!.getStandardPaths().then((paths) => {
      setStandardPaths(paths);
      // Fire listDirectory immediately after home is known
      nativeAPI!.listDirectory(paths.home).then((result) => {
        setIsLoading(false);
        if ('error' in result) {
          navigateTo('/'); // fallback to root
        } else {
          setCurrentPath(paths.home);
          setEntries(result.entries);
        }
      });
    });
  }, [isOpen, navigateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = useCallback(async (overridePath?: string) => {
    const fullPath = overridePath ?? joinPath(currentPath, filename);
    const resolvedFilename = fullPath.split('/').pop() ?? '';
    if (!resolvedFilename || isConfirming) return;
    setConfirmError(null);
    setIsConfirming(true);

    if (mode === 'save') {
      onConfirm({ path: fullPath });
      setIsConfirming(false);
      return;
    }

    // open mode: read file via RPC
    const result = await nativeAPI!.readFile(fullPath);
    setIsConfirming(false);
    if ('error' in result) {
      setConfirmError(result.error);
      return;
    }
    const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
    onConfirm({ path: fullPath, buffer: bytes.buffer });
  }, [filename, currentPath, mode, onConfirm, isConfirming]);

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
    // Refresh listing
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

  // Filter entries: open mode uses active filter; save mode shows all (files dimmed)
  const activeExtensions =
    mode === 'open' && selectedFilter ? selectedFilter.extensions : null;
  const visibleEntries = applyFilter(entries, activeExtensions);

  // Breadcrumb items derived from currentPath
  const segments = splitPath(currentPath);
  const breadcrumbItems = [
    {
      text: '🏠',
      onClick: standardPaths ? () => navigateTo(standardPaths.home) : undefined,
    },
    ...segments.map((seg, i) => ({
      text: seg,
      // Last segment is the current dir — no click needed
      onClick:
        i < segments.length - 1 ? () => navigateTo(pathUpTo(segments, i)) : undefined,
    })),
  ];

  const isActiveSidebar = (path: string) =>
    currentPath === path ||
    currentPath.startsWith(path + '/') ||
    currentPath.startsWith(path + '\\');

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
        {filters && filters.length > 0 && (
          <HTMLSelect
            value={selectedFilter?.label ?? '__all__'}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedFilter(
                val === '__all__' ? null : (filters.find((f) => f.label === val) ?? null),
              );
              if (mode === 'open') setFilename('');
            }}
            options={[
              ...filters.map((f) => ({ label: f.label, value: f.label })),
              { label: 'All files', value: '__all__' },
            ]}
          />
        )}
        {confirmError && <span className="fb-confirm-error">{confirmError}</span>}
        <Button intent="primary" disabled={!filename || isConfirming || isLoading} onClick={handleConfirm}>
          {mode === 'save' ? 'Save' : 'Open'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Dialog>
  );
}
