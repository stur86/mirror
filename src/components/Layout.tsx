import type { ReactNode } from 'react';
import { MenuBar } from './MenuBar';
import { Footer } from './Footer';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
  onThemeToggle: () => void;
  isDark: boolean;
}

export function Layout({ children, onThemeToggle, isDark }: LayoutProps) {
  return (
    <div className="layout">
      <MenuBar onThemeToggle={onThemeToggle} isDark={isDark} />
      <main className="layout-main">
        {children}
      </main>
      <Footer />
    </div>
  );
}
