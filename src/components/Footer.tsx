import { useTranslation } from 'react-i18next';
import './Layout.css';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="layout-footer">
      <span className="footer-left">
        {t('app.name')}
      </span>
      <span className="footer-right">
        {t('app.version', { version: '0.1.0' })}
      </span>
    </footer>
  );
}
