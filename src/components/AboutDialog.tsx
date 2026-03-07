import { useTranslation } from 'react-i18next';
import { Dialog, DialogBody, DialogFooter, Button } from './index';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('about.title')}
      icon="info-sign"
    >
      <DialogBody>
        <p><strong>{t('app.name')}</strong></p>
        <p>{t('about.description')}</p>
        <p>{t('app.version', { version: __APP_VERSION__ })}</p>
        <p className="bp6-text-muted">{t('about.license')}</p>
      </DialogBody>
      <DialogFooter
        actions={
          <Button onClick={onClose}>{t('actions.close')}</Button>
        }
      />
    </Dialog>
  );
}
