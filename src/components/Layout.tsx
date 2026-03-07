import type { ReactNode } from 'react';
import { MenuBar } from './MenuBar';
import { Footer } from './Footer';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
  onThemeToggle: () => void;
  isDark: boolean;
  onNewFile: () => void;
  onOpenProject: () => void;
  onLoadText: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onExportTranslation: () => void;
  onPreferences: () => void;
  autosaveEnabled: boolean;
  lastSavedAt: Date | null;
  onToggleAutosave: () => void;
}

export function Layout({
  children,
  onThemeToggle,
  isDark,
  onNewFile,
  onOpenProject,
  onLoadText,
  onSaveProject,
  onSaveProjectAs,
  onExportTranslation,
  onPreferences,
  autosaveEnabled,
  lastSavedAt,
  onToggleAutosave,
}: LayoutProps) {
  return (
    <div className="layout">
      <MenuBar
        onThemeToggle={onThemeToggle}
        isDark={isDark}
        onNewFile={onNewFile}
        onOpenProject={onOpenProject}
        onLoadText={onLoadText}
        onSaveProject={onSaveProject}
        onSaveProjectAs={onSaveProjectAs}
        onExportTranslation={onExportTranslation}
        onPreferences={onPreferences}
      />
      <main className="layout-main">
        {children}
      </main>
      <Footer
        autosaveEnabled={autosaveEnabled}
        lastSavedAt={lastSavedAt}
        onToggleAutosave={onToggleAutosave}
      />
    </div>
  );
}
