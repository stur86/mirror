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
  onExportTranslation: () => void;
}

export function Layout({
  children,
  onThemeToggle,
  isDark,
  onNewFile,
  onOpenProject,
  onLoadText,
  onSaveProject,
  onExportTranslation,
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
        onExportTranslation={onExportTranslation}
      />
      <main className="layout-main">
        {children}
      </main>
      <Footer />
    </div>
  );
}
