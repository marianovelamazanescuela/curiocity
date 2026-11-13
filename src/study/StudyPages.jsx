// Pages of the study version, loaded only there (App imports this file lazily, and only when STUDY):
// - welcome: the first time, "Apunta este código" with the participant code in big letters;
// - sheet: tapping the camera's "Estudio · CODE" badge, with the backup export;
// - reset: /?reiniciar-estudio, for the researcher (password, send what is pending, new code).

import { useEffect, useId, useState } from 'react';
import { PageNav } from '../components/Page';
import Curi from '../components/Curi';
import { ensureParticipant, exportBackup, markCodeSeen, pendingCount, resetParticipant, studyParticipant, subscribeStudy } from './index';
import { studyTexts } from './texts';

function Welcome({ s, onStart }) {
  const [code, setCode] = useState(studyParticipant);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (code) return undefined;
    let alive = true;
    ensureParticipant()
      .then(value => alive && setCode(value))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [code, attempt]);

  const start = () => {
    markCodeSeen();
    onStart();
  };

  if (!code) {
    return (
      <section className="message study">
        <Curi state={failed ? 'idle' : 'thinking'} size={72} />
        <p className="message__text" role="status">{failed ? s.noCode : s.gettingCode}</p>
        {failed && (
          <button
            className="btn btn--primary"
            onClick={() => {
              setFailed(false);
              setAttempt(n => n + 1);
            }}
          >
            {s.retry}
          </button>
        )}
      </section>
    );
  }
  return (
    <section className="message study study--welcome">
      <Curi state="done" size={72} />
      <h2 className="message__title">{s.welcomeTitle}</h2>
      <p className="study__code" aria-label={code.split('').join(' ')}>{code}</p>
      <p className="message__text">{s.welcomeText}</p>
      <button className="btn btn--primary" onClick={start}>{s.start}</button>
    </section>
  );
}

function Details({ s, backButton, onToast }) {
  const [pending, setPending] = useState(null);
  useEffect(() => {
    let alive = true;
    const update = () => pendingCount().then(n => alive && setPending(n));
    update();
    const unsubscribe = subscribeStudy(update);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const exportCopy = async () => {
    const result = await exportBackup();
    if (result === 'downloaded' || result === 'shared') onToast(s.exportBackup);
  };

  return (
    <section className="message study">
      <PageNav left={backButton} />
      <h2 className="message__title">{s.sheetTitle}</h2>
      <p className="kicker study__label">{s.codeLabel}</p>
      <p className="study__code study__code--small">{studyParticipant()}</p>
      <p className="message__text" role="status">{pending === null ? '' : s.pending(pending)}</p>
      <button className="study__link" onClick={exportCopy}>{s.exportBackup}</button>
      <p className="study__note">{s.exportNote}</p>
    </section>
  );
}

function Reset({ s, backButton, onNewCode }) {
  const inputId = useId();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async e => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    const result = await resetParticipant(password);
    setBusy(false);
    if (result.ok) {
      setPassword('');
      onNewCode();
      return;
    }
    setError(result.reason === 'password' ? s.wrongPassword : result.reason === 'pending' ? s.stillPending(result.left) : s.offline);
  };

  return (
    <section className="message study">
      <PageNav left={backButton} />
      <h2 className="message__title">{s.resetTitle}</h2>
      <p className="message__text">{s.resetText}</p>
      <form className="study__form" onSubmit={submit}>
        <label htmlFor={inputId} className="kicker">{s.password}</label>
        <input
          id={inputId}
          className="study__input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={busy}
        />
        <button className="btn btn--primary" type="submit" disabled={busy || !password}>
          {busy ? s.resetting : s.resetButton}
        </button>
      </form>
      {error && <p className="study__error" role="alert">{error}</p>}
    </section>
  );
}

/** view: 'welcome' | 'sheet' | 'reset'. onDone goes back to the camera. */
export default function StudyPages({ view, lang, backButton, onDone, onToast, onViewChange }) {
  const s = studyTexts[lang] || studyTexts.en;
  if (view === 'reset') return <Reset s={s} backButton={backButton} onNewCode={() => onViewChange('welcome')} />;
  if (view === 'sheet') return <Details s={s} backButton={backButton} onToast={onToast} />;
  return <Welcome s={s} onStart={onDone} />;
}
