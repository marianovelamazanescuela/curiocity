import { useState } from 'react';
import { MdLockOutline } from 'react-icons/md';
import Curi from './Curi';

function formatDate(iso, lang) {
  try {
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
}

export default function HistoryView({ t, lang, entries, onOpen, onClear }) {
  // Two taps to clear, so a child can't wipe the history by accident.
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="history">
      <h2 className="history__title">{t.history}</h2>

      {entries.length === 0 ? (
        <div className="curi-say curi-say--stack history__empty">
          <Curi state="idle" size={84} />
          <p>{t.historyEmpty}</p>
        </div>
      ) : (
        <ul className="history__list">
          {entries.map(entry => (
            <li key={entry.id}>
              <button className="history__item" onClick={() => onOpen(entry)}>
                <img className="history__thumb" src={entry.thumb} alt="" />
                <span className="history__text">
                  <span className="history__name">{entry.object}</span>
                  <span className="history__date">{formatDate(entry.date, lang)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="history__privacy">
        <MdLockOutline aria-hidden="true" /> {t.historyPrivacy}
      </p>

      {entries.length > 0 && (
        <div className="center">
          <button
            className={`btn ${confirming ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => {
              if (confirming) {
                onClear();
                setConfirming(false);
              } else setConfirming(true);
            }}
            onBlur={() => setConfirming(false)}
          >
            {confirming ? t.confirmClear : t.clearHistory}
          </button>
        </div>
      )}
    </section>
  );
}
