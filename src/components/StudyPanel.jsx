import { useEffect, useId, useState } from 'react';
import { PageNav } from './Page';
import {
  activateStudy, changeParticipant, clearStudyData, deactivateStudy, readStudyData, subscribeStudy
} from '../study';
import { changePin, checkPin, cleanParticipant, isValidPin, loadStudyConfig, MAX_PARTICIPANT } from '../study/config';
import { exportFile, exportName, summarize, toCSV, toJSON } from '../study/export';
import { studyTexts } from '../study/texts';

/** The adult code, before anything else. */
function PinGate({ s, backButton, onUnlock }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const helpId = useId();

  const submit = async e => {
    e.preventDefault();
    if (await checkPin(pin)) onUnlock();
    else {
      setWrong(true);
      setPin('');
    }
  };

  return (
    <section className="study">
      <PageNav left={backButton} />
      <h2 className="study__title">{s.title}</h2>
      <form className="study__form" onSubmit={submit}>
        <label className="kicker" htmlFor="study-pin">{s.pinTitle}</label>
        <input
          id="study-pin"
          className="study__input study__input--pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          aria-describedby={helpId}
          aria-invalid={wrong || undefined}
        />
        <p id={helpId} className="study__help" role={wrong ? 'alert' : undefined}>{wrong ? s.pinWrong : s.pinHelp}</p>
        <button className="btn btn--primary" type="submit" disabled={pin.length !== 4}>{s.enter}</button>
      </form>
    </section>
  );
}

function Summary({ s, eventos }) {
  const rows = summarize(eventos);
  if (!rows.length) return <p className="study__help">{s.noData}</p>;
  return (
    <div className="study__table-wrap">
      <table className="study__table">
        <thead>
          <tr>
            <th scope="col">{s.colParticipant}</th>
            <th scope="col">{s.colPhotos}</th>
            <th scope="col">{s.colLessons}</th>
            <th scope="col">{s.colAnswers}</th>
            <th scope="col">{s.colChallenges}</th>
            <th scope="col">{s.colMinutes}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.participante}>
              <th scope="row">{r.participante}</th>
              <td>{r.fotos}</td>
              <td>{r.lecciones} / {r.completadas}</td>
              <td>{r.aciertos} / {r.preguntas}</td>
              <td>{r.retos}</td>
              <td>{r.minutos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Study panel, for adults only (opened with a 3-second press on the logo's eyes, behind a 4-digit
 * code): switch the study mode on or off, change participant, see a summary, export, delete and
 * change the code. Nothing here sends data anywhere: exporting hands the file to the adult.
 */
export default function StudyPanel({ lang, backButton, onToast }) {
  const s = studyTexts[lang] || studyTexts.en;
  const [unlocked, setUnlocked] = useState(false);
  const [config, setConfig] = useState(loadStudyConfig);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [data, setData] = useState({ eventos: [], lecciones: [] });
  const [version, setVersion] = useState(0);
  const [deleteStep, setDeleteStep] = useState(0);
  const [pins, setPins] = useState({ a: '', b: '' });
  const [pinError, setPinError] = useState(false);
  const codeHelpId = useId();

  useEffect(() => subscribeStudy(setConfig), []);
  useEffect(() => {
    if (!unlocked) return undefined;
    let cancelled = false;
    readStudyData()
      .then(d => !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [unlocked, version, config]);

  if (!unlocked) return <PinGate s={s} backButton={backButton} onUnlock={() => setUnlocked(true)} />;

  const submitCode = e => {
    e.preventDefault();
    if (!cleanParticipant(code)) {
      setCodeError(true);
      return;
    }
    if (config.active) changeParticipant(code);
    else activateStudy(code);
    setCode('');
    setCodeError(false);
  };

  const download = async kind => {
    const fresh = await readStudyData();
    const name = `${exportName()}.${kind}`;
    const result =
      kind === 'csv' ? await exportFile(name, toCSV(fresh.eventos), 'text/csv') : await exportFile(name, toJSON(fresh), 'application/json');
    if (result !== 'cancelled') onToast(`${s.exported}: ${name}`);
  };

  const deleteAll = async () => {
    await clearStudyData();
    setDeleteStep(0);
    setVersion(v => v + 1);
    onToast(s.deleted);
  };

  const savePin = async e => {
    e.preventDefault();
    if (!isValidPin(pins.a) || pins.a !== pins.b) {
      setPinError(true);
      return;
    }
    await changePin(pins.a);
    setPins({ a: '', b: '' });
    setPinError(false);
    onToast(s.pinChanged);
  };

  const digits = v => v.replace(/\D/g, '').slice(0, 4);

  return (
    <section className="study">
      <PageNav left={backButton} />
      <h2 className="study__title">{s.title}</h2>
      <p className="study__status" role="status">
        <span className={config.active ? 'study__dot study__dot--on' : 'study__dot'} aria-hidden="true" />
        {config.active ? `${s.statusOn} · ${s.currentParticipant}: ${config.participant}` : s.statusOff}
      </p>
      <p className="study__help">{s.privacy}</p>

      <form className="study__form" onSubmit={submitCode}>
        <label className="kicker" htmlFor="study-participant">{s.participantLabel}</label>
        <input
          id="study-participant"
          className="study__input"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={MAX_PARTICIPANT + 4}
          value={code}
          onChange={e => setCode(e.target.value)}
          aria-describedby={codeHelpId}
          aria-invalid={codeError || undefined}
        />
        <p id={codeHelpId} className="study__help" role={codeError ? 'alert' : undefined}>{codeError ? s.participantInvalid : s.participantHelp}</p>
        <button className="btn btn--primary" type="submit">{config.active ? s.changeParticipant : s.activate}</button>
      </form>
      {config.active && (
        <button className="btn btn--outline study__block" onClick={deactivateStudy}>{s.deactivate}</button>
      )}

      <h3 className="kicker study__section">{s.summary}</h3>
      <Summary s={s} eventos={data.eventos} />

      <h3 className="kicker study__section">{s.export}</h3>
      <div className="study__buttons">
        <button className="btn btn--outline" onClick={() => download('csv')}>{s.exportCSV}</button>
        <button className="btn btn--outline" onClick={() => download('json')}>{s.exportJSON}</button>
      </div>

      <h3 className="kicker study__section">{s.deleteData}</h3>
      {deleteStep === 0 && (
        <button className="btn btn--outline" onClick={() => setDeleteStep(1)}>{s.deleteData}</button>
      )}
      {deleteStep > 0 && (
        <div className="study__confirm" role="alert">
          <p>{deleteStep === 1 ? s.deleteConfirm1 : s.deleteConfirm2}</p>
          <div className="study__buttons">
            <button className="btn btn--outline" onClick={() => setDeleteStep(0)}>{s.cancel}</button>
            {deleteStep === 1 ? (
              <button className="btn btn--primary" onClick={() => setDeleteStep(2)}>{s.deleteContinue}</button>
            ) : (
              <button className="btn btn--primary" onClick={deleteAll}>{s.deleteFinal}</button>
            )}
          </div>
        </div>
      )}

      <h3 className="kicker study__section">{s.changePin}</h3>
      <form className="study__form" onSubmit={savePin}>
        <label className="study__label" htmlFor="study-pin-a">{s.newPin}</label>
        <input id="study-pin-a" className="study__input study__input--pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4}
          value={pins.a} onChange={e => setPins(p => ({ ...p, a: digits(e.target.value) }))} />
        <label className="study__label" htmlFor="study-pin-b">{s.repeatPin}</label>
        <input id="study-pin-b" className="study__input study__input--pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4}
          value={pins.b} onChange={e => setPins(p => ({ ...p, b: digits(e.target.value) }))} />
        {pinError && <p className="study__help" role="alert">{s.pinMismatch}</p>}
        <button className="btn btn--outline" type="submit">{s.savePin}</button>
      </form>
    </section>
  );
}
