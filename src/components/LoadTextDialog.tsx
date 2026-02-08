import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogBody, DialogFooter, Button, RadioGroup, Radio } from './index';

interface LoadTextDialogProps {
  isOpen: boolean;
  fileName: string;
  onConfirm: (side: 'source' | 'translation') => void;
  onClose: () => void;
}

export function LoadTextDialog({ isOpen, fileName, onConfirm, onClose }: LoadTextDialogProps) {
  const { t } = useTranslation();
  const [side, setSide] = useState<'source' | 'translation'>('source');

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('editor.loadTextTitle')}
    >
      <DialogBody>
        <p>{t('editor.loadTextPrompt', { fileName })}</p>
        <RadioGroup
          selectedValue={side}
          onChange={(e) => setSide((e.target as HTMLInputElement).value as 'source' | 'translation')}
        >
          <Radio label={t('editor.loadAsSource')} value="source" />
          <Radio label={t('editor.loadAsTranslation')} value="translation" />
        </RadioGroup>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button text={t('actions.cancel')} onClick={onClose} />
            <Button
              text={t('actions.confirm')}
              intent="primary"
              onClick={() => onConfirm(side)}
            />
          </>
        }
      />
    </Dialog>
  );
}
