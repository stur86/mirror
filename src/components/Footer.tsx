import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Layout.css';

interface FooterProps {
  autosaveEnabled: boolean;
  lastSavedAt: Date | null;
  onToggleAutosave: () => void;
}

export function Footer({ autosaveEnabled, lastSavedAt, onToggleAutosave }: FooterProps) {
  const { t } = useTranslation();
  // Tick every 30s so the "X min ago" label stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!autosaveEnabled || !lastSavedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [autosaveEnabled, lastSavedAt]);

  const getAutosaveLabel = () => {
    if (!autosaveEnabled) return t('footer.autosaveOff');
    if (!lastSavedAt) return t('footer.autosaveOn');
    const minutesAgo = Math.floor((Date.now() - lastSavedAt.getTime()) / 60_000);
    const time = minutesAgo < 1 ? t('footer.justNow') : t('footer.minutesAgo', { n: minutesAgo });
    return t('footer.autosaved', { time });
  };

  return (
    <footer className="layout-footer">
      <span className="footer-left">
        {t('app.name')}
      </span>
      <span className="footer-right">
        <button className="autosave-btn" onClick={onToggleAutosave}>
          {getAutosaveLabel()}
        </button>
        <span className="footer-sep" aria-hidden>·</span>
        {t('app.version', { version: __APP_VERSION__ })}
      </span>
    </footer>
  );
}
