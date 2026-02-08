import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Navbar,
  NavbarGroup,
  NavbarHeading,
  NavbarDivider,
  Button,
  Menu,
  MenuItem,
  MenuDivider,
  Popover,
  Alignment,
} from './index';
import { AboutDialog } from './AboutDialog';

interface MenuBarProps {
  onThemeToggle: () => void;
  isDark: boolean;
  onNewFile: () => void;
  onOpenProject: () => void;
  onLoadText: () => void;
  onSaveProject: () => void;
  onExportTranslation: () => void;
}

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

export function MenuBar({
  onThemeToggle,
  isDark,
  onNewFile,
  onOpenProject,
  onLoadText,
  onSaveProject,
  onExportTranslation,
}: MenuBarProps) {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleExit = () => {
    if (isElectron) {
      window.close();
    }
  };

  const fileMenu = (
    <Menu>
      <MenuItem text={t('menu.newFile')} icon="document" onClick={onNewFile} />
      <MenuDivider />
      <MenuItem text={t('menu.openProject')} icon="folder-open" onClick={onOpenProject} />
      <MenuItem text={t('menu.loadText')} icon="document-open" onClick={onLoadText} />
      <MenuDivider />
      <MenuItem text={t('menu.saveProject')} icon="floppy-disk" onClick={onSaveProject} />
      <MenuItem text={t('menu.exportTranslation')} icon="export" onClick={onExportTranslation} />
      {isElectron && (
        <>
          <MenuDivider />
          <MenuItem text={t('menu.exit')} icon="log-out" onClick={handleExit} />
        </>
      )}
    </Menu>
  );

  const helpMenu = (
    <Menu>
      <MenuItem text={t('menu.about')} icon="info-sign" onClick={() => setAboutOpen(true)} />
    </Menu>
  );

  return (
    <>
      <Navbar className="menu-bar">
        <NavbarGroup align={Alignment.START}>
          <NavbarHeading>{t('app.name')}</NavbarHeading>
          <NavbarDivider />
          <Popover
            content={fileMenu}
            placement="bottom-start"
            minimal
            popoverClassName="menu-popover"
            portalContainer={document.body}
          >
            <Button variant="minimal" text={t('menu.file')} />
          </Popover>
          <Popover
            content={helpMenu}
            placement="bottom-start"
            minimal
            popoverClassName="menu-popover"
            portalContainer={document.body}
          >
            <Button variant="minimal" text={t('menu.help')} />
          </Popover>
        </NavbarGroup>
        <NavbarGroup align={Alignment.END}>
          <Button
            variant='minimal'
            icon={isDark ? 'flash' : 'moon'}
            onClick={onThemeToggle}
            aria-label={isDark ? t('settings.light') : t('settings.dark')}
          />
          {isElectron && (
            <Button
              variant="minimal"
              icon="cross"
              aria-label={t('actions.close')}
              onClick={() => window.close()}
              style={{ marginLeft: 8 }}
            />
          )}
        </NavbarGroup>
      </Navbar>
      <AboutDialog isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
