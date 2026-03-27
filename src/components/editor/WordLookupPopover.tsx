import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Intent, Spinner } from '../index';
import { useToast } from '../../contexts/ToastContext';
import type { WiktionaryState } from '../../hooks/useWiktionary';
import './WordLookupPopover.css';

interface WordLookupPopoverProps {
  word: string;
  x: number;
  y: number;
  wiktionary: WiktionaryState;
  targetLangLabel: string;
  onPin: () => void;
  onClose: () => void;
}

export function WordLookupPopover({
  word, x, y, wiktionary, targetLangLabel, onPin, onClose,
}: WordLookupPopoverProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  // NOTE: onClose must be stable (useCallback) in the parent to avoid
  // re-adding these listeners on every render.
  // Close on click-outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Adjust position to keep popover in viewport
  const style: React.CSSProperties = {
    left: Math.max(4, Math.min(x, window.innerWidth - 300)),
    top: Math.max(4, Math.min(y, window.innerHeight - 300)),
  };

  function handleCopyTranslation(translationWord: string) {
    navigator.clipboard.writeText(translationWord).then(() => {
      showToast(t('toast.copied'), Intent.SUCCESS);
    });
  }

  const firstEntry = wiktionary.data?.entries[0];

  return (
    <div className="word-lookup-popover" style={style} ref={ref}>
      <div className="word-lookup-popover__header">
        <span className="word-lookup-popover__word">
          {word}
          {firstEntry && (
            <span className="word-lookup-popover__pos">{firstEntry.partOfSpeech}</span>
          )}
        </span>
        <div className="word-lookup-popover__controls">
          <Button minimal small icon="pin" title={t('lookup.pin')} onClick={onPin} />
          <Button minimal small icon="cross" title={t('actions.close')} onClick={onClose} />
        </div>
      </div>

      {wiktionary.status === 'loading' && (
        <div className="word-lookup-popover__status">
          <Spinner size={16} />
        </div>
      )}

      {wiktionary.status === 'error' && (
        <div className="word-lookup-popover__error">{wiktionary.error ?? t('toast.lookupError')}</div>
      )}

      {wiktionary.status === 'success' && !firstEntry && (
        <div className="word-lookup-popover__status">{t('lookup.noEntry')}</div>
      )}

      {wiktionary.status === 'success' && firstEntry && (
        <div className="word-lookup-popover__body">
          <ol className="word-lookup-popover__defs">
            {firstEntry.definitions.slice(0, 2).map((def, i) => (
              // Wiktionary API returns HTML in definition strings (links, bold, etc.).
              // en.wiktionary.org is a trusted source; this is intentionally unsanitized.
              <li key={i} data-n={i + 1}
                dangerouslySetInnerHTML={{ __html: def.definition }}
              />
            ))}
          </ol>

          {wiktionary.data!.translations.length > 0 && (
            <div className="word-lookup-popover__translations">
              <div className="word-lookup-popover__translations-label">
                {t('lookup.translations')}: {targetLangLabel}
              </div>
              <div>
                {wiktionary.data!.translations.slice(0, 8).map((w, i) => (
                  <span key={i}>
                    <span
                      className="word-lookup-popover__translation-word"
                      onClick={() => handleCopyTranslation(w)}
                      title={t('lookup.clickToCopy')}
                    >
                      {w}
                    </span>
                    {i < Math.min(7, wiktionary.data!.translations.length - 1) && ', '}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
