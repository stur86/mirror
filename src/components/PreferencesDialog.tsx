import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogBody, DialogFooter, Button, Switch } from './index';

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  autosaveEnabled: boolean;
  autosaveIntervalMinutes: number;
  onChange: (prefs: { autosaveEnabled: boolean; autosaveIntervalMinutes: number }) => void;
}

export function PreferencesDialog({
  isOpen,
  onClose,
  autosaveEnabled,
  autosaveIntervalMinutes,
  onChange,
}: PreferencesDialogProps) {
  const { t } = useTranslation();
  const [localEnabled, setLocalEnabled] = useState(autosaveEnabled);
  const [localInterval, setLocalInterval] = useState(autosaveIntervalMinutes);

  // Sync local state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLocalEnabled(autosaveEnabled);
      setLocalInterval(autosaveIntervalMinutes);
    }
  }, [isOpen, autosaveEnabled, autosaveIntervalMinutes]);

  const handleSave = () => {
    onChange({ autosaveEnabled: localEnabled, autosaveIntervalMinutes: localInterval });
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} title={t('preferences.title')} onClose={onClose} icon="cog">
      <DialogBody>
        <Switch
          checked={localEnabled}
          label={t('preferences.enableAutosave')}
          onChange={(e) => setLocalEnabled((e.target as HTMLInputElement).checked)}
        />
        {localEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span>{t('preferences.intervalPrefix')}</span>
            <input
              type="number"
              min={1}
              max={60}
              value={localInterval}
              onChange={(e) => setLocalInterval(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
              style={{ width: 56, padding: '2px 6px', textAlign: 'center' }}
              className="bp6-input"
            />
            <span>{t('preferences.intervalSuffix')}</span>
          </div>
        )}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button intent="primary" onClick={handleSave}>{t('actions.save')}</Button>
            <Button onClick={onClose}>{t('actions.cancel')}</Button>
          </>
        }
      />
    </Dialog>
  );
}
