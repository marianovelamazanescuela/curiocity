import { useEffect, useRef, useState } from 'react';
import {
  MdArrowBack, MdShare, MdEmail, MdDownload, MdOpenInNew, MdLightbulbOutline, MdVolumeUp, MdStop,
  MdCheckCircle, MdTimer, MdPhotoCamera, MdChatBubbleOutline
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { getSubject } from '../subjects';
import { buildShareText, downloadDataUrl, mailtoUrl, nativeShare, whatsappUrl } from '../share';
import ObjectHeader from './ObjectHeader';
import { useSpeech } from '../useSpeech';
import Curi, { CuriThinking } from './Curi';

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function ShareBar({ t, heading, content, photo, onToast }) {
  const [showOptions, setShowOptions] = useState(false);

  const savePhoto = () => {
    if (!photo) return;
    downloadDataUrl(photo, 'curiocity.jpg');
    onToast(t.imageDownloaded);
  };

  const share = async () => {
    const result = await nativeShare({ title: heading, text: buildShareText(heading, content, t), imageDataUrl: photo });
    if (result === 'shared') onToast(t.shared);
    else if (result === 'shared-text') {
      if (photo) downloadDataUrl(photo, 'curiocity.jpg');
      onToast(photo ? t.sharedTextOnly : t.shared);
    } else if (result === 'unsupported') setShowOptions(true);
  };

  const viaEmail = () => {
    window.open(mailtoUrl(`${heading} — Curiocity`, buildShareText(heading, content, t, { withAttachHint: Boolean(photo) })));
    onToast(t.openedMail, 'info');
  };

  const viaWhatsApp = () => {
    window.open(whatsappUrl(buildShareText(heading, content, t, { withAttachHint: Boolean(photo) })), '_blank', 'noopener');
    onToast(t.openedWhatsApp, 'info');
  };

  return (
    <div className="share">
      <button className="btn btn--primary btn--wide" onClick={share} aria-expanded={showOptions}>
        <MdShare aria-hidden="true" /> {t.share}
      </button>
      {showOptions && (
        <div className="share__options">
          <button className="btn btn--outline" onClick={viaEmail}><MdEmail aria-hidden="true" /> {t.shareViaEmail}</button>
          <button className="btn btn--outline" onClick={viaWhatsApp}><FaWhatsapp aria-hidden="true" /> {t.shareViaWhatsApp}</button>
          {photo && <button className="btn btn--outline" onClick={savePhoto}><MdDownload aria-hidden="true" /> {t.downloadImage}</button>}
        </div>
      )}
    </div>
  );
}

/** Curiosity question with 3 options. The child answers before seeing any explanation. */
function Quiz({ t, question, answer, onAnswer, feedbackRef }) {
  const answered = answer !== null;
  const right = question.opciones[question.correcta];
  return (
    <>
      <ul className="quiz">
        {question.opciones.map((option, i) => {
          let cls = 'quiz__option';
          if (answered && i === question.correcta) cls += ' quiz__option--correct';
          else if (answered && i === answer) cls += ' quiz__option--chosen';
          return (
            <li key={i}>
              <button className={cls} onClick={() => onAnswer(i)} disabled={answered} aria-pressed={answered ? i === answer : undefined}>
                <span className="lesson-text">{option}</span>
                {answered && i === question.correcta && <MdCheckCircle className="quiz__mark" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <div ref={feedbackRef} className="curi-say quiz__feedback reveal">
          <Curi state={answer === question.correcta ? 'correct' : 'almost'} size={64} />
          <p role="status">{answer === question.correcta ? t.correct : `${t.almost} ${right}`}</p>
        </div>
      )}
    </>
  );
}

// Interactive lesson: question → surprising fact + why → one-minute challenge → open question,
// then links, related objects and sharing. Offline content has no question, so it starts revealed.
export default function ContentView({
  t, photo, objectName, subjectKey, subjects, lang, ageGroup = '6-8', content, onBack, onSelectSubject, onRelatedObject, onToast, onTakePhoto
}) {
  const subject = getSubject(subjectKey);
  const heading = `${t.subjects[subjectKey]}: ${objectName}`;
  const [answer, setAnswer] = useState(null);
  const [challenge, setChallenge] = useState('pending'); // pending | done | skipped
  const speech = useSpeech(lang);
  const { stop } = speech;
  const feedbackRef = useRef(null);
  const finalRef = useRef(null);

  // Stop reading when the content changes (another subject or object).
  useEffect(() => () => stop(), [content, stop]);

  // Bring each newly revealed step into view (the sheet is small on phones).
  useEffect(() => {
    if (answer !== null) feedbackRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [answer]);
  useEffect(() => {
    if (challenge !== 'pending') finalRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [challenge]);

  if (!content) {
    return (
      <article className="content" style={{ '--subject': subject.color }}>
        <button className="link-btn" onClick={onBack}><MdArrowBack aria-hidden="true" /> {t.back}</button>
        <ObjectHeader photo={photo} objectName={objectName} photoAlt={t.capturedPhoto}>
          <span className="chip chip--subject"><subject.icon aria-hidden="true" /> {t.subjects[subjectKey]}</span>
        </ObjectHeader>
        <CuriThinking label={t.curiThinking} />
      </article>
    );
  }

  const question = content.pregunta_inicial;
  const revealed = !question || answer !== null;
  const finished = revealed && challenge !== 'pending';
  const finalText = content.offline ? content.otra_idea : content.para_seguir_pensando;

  const readAloud = () => {
    if (speech.speaking) return speech.stop();
    const parts = [];
    if (content.offline) parts.push(content.intro);
    if (question) parts.push(question.pregunta, ...question.opciones);
    if (revealed) {
      if (question) parts.push(answer === question.correcta ? t.correct : `${t.almost} ${question.opciones[question.correcta]}`);
      parts.push(content.dato_sorprendente, content.por_que, `${t.challenge}. ${content.reto}`);
    }
    if (finished && finalText) parts.push(finalText);
    speech.speak(parts.filter(Boolean));
  };

  return (
    <article className={`content lesson lesson--${ageGroup}`} style={{ '--subject': subject.color }}>
      <button className="link-btn" onClick={onBack}>
        <MdArrowBack aria-hidden="true" /> {t.back}
      </button>

      <ObjectHeader photo={photo} objectName={objectName} photoAlt={t.capturedPhoto}>
        <span className="chip chip--subject">
          <subject.icon aria-hidden="true" /> {t.subjects[subjectKey]}
        </span>
      </ObjectHeader>

      {content.conexion_debil && <p className="note">{t.weakLink}</p>}

      <section className="card card--subject">
        {question ? (
          <>
            <p className="card__kicker">{t.guessFirst}</p>
            <h3 className="card__title lesson-text lesson-text--title">{question.pregunta}</h3>
          </>
        ) : (
          <p className="card__lead lesson-text">{content.intro}</p>
        )}
        {speech.supported && (
          <button className="btn btn--outline btn--small card__listen" onClick={readAloud} aria-pressed={speech.speaking}>
            {speech.speaking ? <MdStop aria-hidden="true" /> : <MdVolumeUp aria-hidden="true" />}
            {speech.speaking ? t.stopListening : t.listen}
          </button>
        )}
        {question && <Quiz t={t} question={question} answer={answer} onAnswer={setAnswer} feedbackRef={feedbackRef} />}
      </section>

      {revealed && (
        <div className="reveal">
          {content.dato_sorprendente && (
            <section>
              <h3 className="section-title">{t.surprisingFact}</h3>
              <p className="facts__item">
                <MdLightbulbOutline className="facts__icon" aria-hidden="true" />
                <span className="lesson-text">{content.dato_sorprendente}</span>
              </p>
            </section>
          )}

          <section>
            {!content.offline && <h3 className="section-title">{t.why}</h3>}
            <div className="prose lesson-text">
              {String(content.por_que).split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>

          <section>
            <h3 className="section-title">{t.challenge}</h3>
            <div className="challenge">
              <MdTimer className="challenge__icon" aria-hidden="true" />
              <p className="challenge__text lesson-text">{content.reto}</p>
              {challenge === 'pending' ? (
                <div className="challenge__actions">
                  <button className="btn btn--primary" onClick={() => setChallenge('done')}>{t.challengeDone}</button>
                  <button className="btn btn--ghost" onClick={() => setChallenge('skipped')}>{t.challengeSkip}</button>
                </div>
              ) : (
                challenge === 'done' && (
                  <div className="curi-say challenge__done">
                    <Curi state="done" size={64} />
                    <p role="status">{t.challengeCheer}</p>
                  </div>
                )
              )}
              {challenge === 'done' && content.reto_foto && (
                <button className="btn btn--outline" onClick={onTakePhoto}>
                  <MdPhotoCamera aria-hidden="true" /> {t.takeAnotherPhoto}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {finished && (
        <div ref={finalRef} className="reveal">
          {finalText && (
            <section>
              <h3 className="section-title">{content.offline ? t.tryThis : t.keepThinking}</h3>
              <p className="think">
                <MdChatBubbleOutline className="think__icon" aria-hidden="true" />
                <span className="lesson-text">{finalText}</span>
              </p>
            </section>
          )}

          {content.enlaces.length > 0 && (
            <section>
              <h3 className="section-title">{t.recommendedResources}</h3>
              <ul className="links">
                {content.enlaces.map((link, i) => (
                  <li key={i}>
                    <a className="links__item" href={link.url} target="_blank" rel="noopener noreferrer">
                      <span>
                        <span className="links__title">{link.title || link.url}</span>
                        <span className="links__source">{link.source || hostnameOf(link.url)}</span>
                      </span>
                      <MdOpenInNew aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content.objetos_relacionados.length > 0 && (
            <section>
              <h3 className="section-title">{t.relatedObjects}</h3>
              <div className="chips">
                {content.objetos_relacionados.map(name => (
                  <button key={name} className="chip chip--button" onClick={() => onRelatedObject(name)}>{name}</button>
                ))}
              </div>
            </section>
          )}

          <ShareBar t={t} heading={heading} content={content} photo={photo} onToast={onToast} />

          {subjects.length > 1 && (
            <section>
              <h3 className="section-title">{t.otherSubjects}</h3>
              <div className="chips chips--scroll">
                {subjects.filter(s => s.key !== subjectKey).map(({ key, icon: Icon, color }) => (
                  <button key={key} className="chip chip--button chip--tinted" style={{ '--subject': color }} onClick={() => onSelectSubject(key)}>
                    <Icon aria-hidden="true" /> {t.subjects[key]}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </article>
  );
}
