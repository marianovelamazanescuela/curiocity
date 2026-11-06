import { useEffect, useRef, useState } from 'react';
import {
  MdArrowBack, MdArrowForward, MdShare, MdEmail, MdDownload, MdOpenInNew, MdLightbulbOutline,
  MdCheckCircle, MdTimer, MdPhotoCamera, MdChatBubbleOutline, MdHelpOutline, MdSearch
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { getSubject } from '../subjects';
import { buildShareText, downloadDataUrl, mailtoUrl, nativeShare, whatsappUrl } from '../share';
import ObjectHeader from './ObjectHeader';
import Curi, { CuriThinking } from './Curi';

const SWIPE_MIN_PX = 60; // a deliberate horizontal swipe, not a wobble while scrolling

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

const answerFeedback = (t, question, answer) =>
  answer === question.correcta ? t.correct : `${t.almost} ${question.opciones[question.correcta]}`;

/** Curiosity question with 3 options. The child answers before seeing any explanation. */
function Quiz({ t, question, answer, onAnswer }) {
  const answered = answer !== null;
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
        <div className="curi-say quiz__feedback reveal">
          <Curi state={answer === question.correcta ? 'correct' : 'almost'} size={64} />
          <p role="status">{answerFeedback(t, question, answer)}</p>
        </div>
      )}
    </>
  );
}

/**
 * The lesson as a sequence of cards, one idea each:
 * question → surprising fact → why → challenge → final (open question, links, related objects, sharing).
 * Offline content knows nothing true about the object, so it has no question or fact: 3 cards.
 */
function lessonCards(content) {
  if (content.offline) return ['why', 'challenge', 'final'];
  return [
    content.pregunta_inicial && 'question',
    content.dato_sorprendente && 'fact',
    'why',
    'challenge',
    'final'
  ].filter(Boolean);
}

export default function ContentView({
  t, photo, objectName, subjectKey, subjects, content, onBack, onSelectSubject, onRelatedObject, onToast, onTakePhoto
}) {
  const subject = getSubject(subjectKey);
  const heading = `${t.subjects[subjectKey]}: ${objectName}`;
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [challengeDone, setChallengeDone] = useState(false);
  const cardRef = useRef(null);
  const movedRef = useRef(false); // focus moves only after the child changes card, not on first render
  const swipeRef = useRef(null);

  // The new card takes the keyboard and screen-reader focus, and comes into view.
  useEffect(() => {
    if (!movedRef.current) return;
    const card = cardRef.current;
    if (!card) return;
    card.focus({ preventScroll: true });
    card.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [index]);

  const header = (
    <>
      <button className="link-btn" onClick={onBack}>
        <MdArrowBack aria-hidden="true" /> {t.back}
      </button>
      <ObjectHeader photo={photo} objectName={objectName} photoAlt={t.capturedPhoto}>
        <span className="chip chip--subject">
          <subject.icon aria-hidden="true" /> {t.subjects[subjectKey]}
        </span>
      </ObjectHeader>
    </>
  );

  if (!content) {
    return (
      <article className="content lesson" style={{ '--subject': subject.color }}>
        {header}
        <CuriThinking label={t.curiThinking} />
      </article>
    );
  }

  const cards = lessonCards(content);
  const current = cards[Math.min(index, cards.length - 1)];
  const question = content.pregunta_inicial;
  const isLast = index === cards.length - 1;
  const canAdvance = !isLast && !(current === 'question' && answer === null);
  const finalText = content.offline ? content.otra_idea : content.para_seguir_pensando;

  const progress = t.cardProgress.replace('{n}', index + 1).replace('{total}', cards.length);

  const goTo = next => {
    if (next < 0 || next >= cards.length) return;
    movedRef.current = true;
    setIndex(next);
  };
  const goNext = () => canAdvance && goTo(index + 1);
  const goPrevious = () => goTo(index - 1);

  // Optional swipe (the buttons are always there). Only clear horizontal swipes count,
  // so scrolling the sheet up and down never changes card by accident.
  const onTouchStart = e => {
    const touch = e.touches[0];
    swipeRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = e => {
    const start = swipeRef.current;
    const touch = e.changedTouches[0];
    swipeRef.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) goNext();
    else goPrevious();
  };

  const titleId = `card-title-${current}`;

  let body;
  if (current === 'question') {
    body = (
      <>
        <p className="card__kicker"><MdHelpOutline aria-hidden="true" /> {t.guessFirst}</p>
        <h3 id={titleId} className="card__title lesson-text lesson-text--title">{question.pregunta}</h3>
        <Quiz t={t} question={question} answer={answer} onAnswer={setAnswer} />
      </>
    );
  } else if (current === 'fact') {
    body = (
      <>
        <h3 id={titleId} className="card__kicker"><MdLightbulbOutline aria-hidden="true" /> {t.surprisingFact}</h3>
        <p className="lesson-text lesson-text--big">{content.dato_sorprendente}</p>
      </>
    );
  } else if (current === 'why') {
    body = (
      <>
        <h3 id={titleId} className="card__kicker">
          {content.offline ? <MdSearch aria-hidden="true" /> : <MdHelpOutline aria-hidden="true" />}
          {content.offline ? t.investigate : t.why}
        </h3>
        {content.offline && <p className="lesson-text card__intro">{content.intro}</p>}
        <div className="prose lesson-text">
          {String(content.por_que).split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </>
    );
  } else if (current === 'challenge') {
    body = (
      <>
        <h3 id={titleId} className="card__kicker"><MdTimer aria-hidden="true" /> {t.challenge}</h3>
        <p className="lesson-text challenge__text">{content.reto}</p>
        <div className="challenge__actions">
          {challengeDone ? (
            <div className="curi-say challenge__done reveal">
              <Curi state="done" size={64} />
              <p role="status">{t.challengeCheer}</p>
            </div>
          ) : (
            <button className="btn btn--primary" onClick={() => setChallengeDone(true)}>
              <MdCheckCircle aria-hidden="true" /> {t.challengeDone}
            </button>
          )}
          {challengeDone && content.reto_foto && (
            <button className="btn btn--outline" onClick={onTakePhoto}>
              <MdPhotoCamera aria-hidden="true" /> {t.takeAnotherPhoto}
            </button>
          )}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <h3 id={titleId} className="card__kicker">
          <MdChatBubbleOutline aria-hidden="true" /> {content.offline ? t.tryThis : t.keepThinking}
        </h3>
        {finalText && <p className="lesson-text lesson-text--big">{finalText}</p>}
      </>
    );
  }

  return (
    <article className="content lesson" style={{ '--subject': subject.color }}>
      {header}

      <div className="lesson__bar">
        <ol className="dots" aria-hidden="true">
          {cards.map((card, i) => (
            <li key={card} className={i === index ? 'dots__dot dots__dot--on' : i < index ? 'dots__dot dots__dot--done' : 'dots__dot'} />
          ))}
        </ol>
        <p id="lesson-progress" className="visually-hidden">{progress}</p>
      </div>

      <section
        key={current}
        ref={cardRef}
        className={`lesson-card lesson-card--${current}`}
        tabIndex={-1}
        aria-labelledby={`lesson-progress ${titleId}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {body}
      </section>

      {isLast && (
        <div className="lesson__end reveal">
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

      <div className="lesson-nav">
        {current === 'question' && answer === null && (
          <p id="answer-hint" className="lesson-nav__hint">{t.answerToContinue}</p>
        )}
        <div className="lesson-nav__buttons">
          <button className="btn btn--outline lesson-nav__btn" onClick={goPrevious} disabled={index === 0}>
            <MdArrowBack aria-hidden="true" /> {t.previous}
          </button>
          {!isLast && (
            <button
              className="btn btn--primary lesson-nav__btn"
              onClick={goNext}
              disabled={!canAdvance}
              aria-describedby={canAdvance ? undefined : 'answer-hint'}
            >
              {t.next} <MdArrowForward aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
