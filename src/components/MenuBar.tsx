import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatShortcut } from '../contexts/KeyboardShortcutsContext';
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
  onSaveProjectAs: () => void;
  onExportTranslation: () => void;
  onPreferences: () => void;
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
  onSaveProjectAs,
  onExportTranslation,
  onPreferences,
}: MenuBarProps) {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    const unsub = window.electronAPI!.onFullscreenChange(setIsFullscreen);
    return unsub;
  }, []);

  const handleExit = () => {
    if (isElectron) {
      window.close();
    }
  };

  const ShortcutLabel = ({ label }: { label: string }) => (
    <span style={{ opacity: 0.5, fontSize: '0.85em' }}>{label}</span>
  );

  const fileMenu = (
    <Menu>
      <MenuItem
        text={t('menu.newFile')}
        icon="document"
        onClick={onNewFile}
        labelElement={<ShortcutLabel label={formatShortcut('n')} />}
      />
      <MenuDivider />
      <MenuItem
        text={t('menu.openProject')}
        icon="folder-open"
        onClick={onOpenProject}
        labelElement={<ShortcutLabel label={formatShortcut('o')} />}
      />
      <MenuItem text={t('menu.loadText')} icon="document-open" onClick={onLoadText} />
      <MenuDivider />
      <MenuItem
        text={t('menu.saveProject')}
        icon="floppy-disk"
        onClick={onSaveProject}
        labelElement={<ShortcutLabel label={formatShortcut('s')} />}
      />
      <MenuItem
        text={t('menu.saveProjectAs')}
        icon="floppy-disk"
        onClick={onSaveProjectAs}
        labelElement={<ShortcutLabel label={formatShortcut('s', true)} />}
      />
      <MenuItem
        text={t('menu.exportTranslation')}
        icon="export"
        onClick={onExportTranslation}
        labelElement={<ShortcutLabel label={formatShortcut('e')} />}
      />
      <MenuDivider />
      <MenuItem text={t('menu.preferences')} icon="cog" onClick={onPreferences} />
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
            <>
              <Button
                variant="minimal"
                icon={isFullscreen ? 'minimize' : 'maximize'}
                aria-label={isFullscreen ? t('actions.exitFullscreen') : t('actions.fullscreen')}
                onClick={() => window.electronAPI!.toggleFullscreen()}
                style={{ marginLeft: 4 }}
              />
              <Button
                variant="minimal"
                icon="cross"
                aria-label={t('actions.close')}
                onClick={() => window.close()}
                style={{ marginLeft: 4 }}
              />
            </>
          )}
        </NavbarGroup>
      </Navbar>
      <AboutDialog isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
