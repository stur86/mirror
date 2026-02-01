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
}

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

export function MenuBar({ onThemeToggle, isDark }: MenuBarProps) {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleNewFile = () => {
    // TODO: Implement new file
    console.log('New file');
  };

  const handleLoadFile = () => {
    // TODO: Implement load file
    console.log('Load file');
  };

  const handleExit = () => {
    if (isElectron) {
      window.close();
    }
  };

  const fileMenu = (
    <Menu>
      <MenuItem text={t('menu.newFile')} icon="document" onClick={handleNewFile} />
      <MenuItem text={t('menu.loadFile')} icon="folder-open" onClick={handleLoadFile} />
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
            usePortal={false}
            popoverClassName="menu-popover"
          >
            <Button variant="minimal" text={t('menu.file')} />
          </Popover>
          <Popover
            content={helpMenu}
            placement="bottom-start"
            minimal
            usePortal={false}
            popoverClassName="menu-popover"
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
        </NavbarGroup>
      </Navbar>
      <AboutDialog isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
