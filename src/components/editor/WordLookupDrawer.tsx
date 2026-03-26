import { useTranslation } from 'react-i18next';
import { Button, Intent } from '../index';
import { useToast } from '../../contexts/ToastContext';
import type { WiktionaryState } from '../../hooks/useWiktionary';
import './WordLookupDrawer.css';

interface WordLookupDrawerProps {
  word: string;
  wiktionary: WiktionaryState;
  targetLangLabel: string;
  onClose: () => void;
}

export function WordLookupDrawer({ word, wiktionary, targetLangLabel, onClose }: WordLookupDrawerProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  function handleCopyTranslation(w: string) {
    navigator.clipboard.writeText(w).then(() => {
      showToast(t('toast.copied'), Intent.SUCCESS);
    });
  }

  return (
    <div className="word-lookup-drawer">
      <div className="word-lookup-drawer__header">
        <span className="word-lookup-drawer__word">{word}</span>
        <span className="word-lookup-drawer__source">en.wiktionary.org</span>
        <Button
          className="word-lookup-drawer__close"
          minimal small icon="cross"
          title={t('actions.close')}
          onClick={onClose}
        />
      </div>

      {wiktionary.status === 'loading' && (
        <div className="word-lookup-drawer__status">{t('lookup.loading')}</div>
      )}

      {wiktionary.status === 'error' && (
        <div className="word-lookup-drawer__error">{wiktionary.error ?? t('toast.lookupError')}</div>
      )}

      {wiktionary.status === 'success' && wiktionary.data && (
        <div className="word-lookup-drawer__body">
          <div className="word-lookup-drawer__entries">
            {wiktionary.data.entries.length === 0 && (
              <p style={{ color: 'var(--bp6-dark-text-muted, #8f99a8)' }}>{t('lookup.noEntry')}</p>
            )}
            {wiktionary.data.entries.map((entry, ei) => (
              <div key={ei} className="word-lookup-drawer__entry">
                <div className="word-lookup-drawer__pos">{entry.partOfSpeech}</div>
                <ol className="word-lookup-drawer__defs">
                  {entry.definitions.map((def, di) => (
                    <li key={di}>
                      {/* Wiktionary definitions contain trusted HTML (wiki markup rendered server-side) */}
                      <span dangerouslySetInnerHTML={{ __html: def.definition }} />
                      {def.examples.map((ex, xi) => (
                        <div key={xi} className="word-lookup-drawer__example"
                          dangerouslySetInnerHTML={{ __html: ex }}
                        />
                      ))}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {wiktionary.data.translations.length > 0 && (
            <div className="word-lookup-drawer__translations">
              <div className="word-lookup-drawer__translations-label">
                {targetLangLabel}
              </div>
              {wiktionary.data.translations.map((w, i) => (
                <span
                  key={i}
                  className="word-lookup-drawer__translation-word"
                  onClick={() => handleCopyTranslation(w)}
                  title={t('lookup.clickToCopy')}
                >
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
