import { useEffect, useRef, useState } from 'react';
import {
  MdArrowBack, MdArrowForward, MdEmail, MdIosShare, MdOpenInNew, MdLightbulbOutline,
  MdCheckCircle, MdTimer, MdPhotoCamera, MdChatBubbleOutline, MdHelpOutline, MdSearch
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { getSubject } from '../subjects';
import { buildShareText, canShareNatively, mailtoUrl, nativeShare, whatsappUrl } from '../share';
import ObjectHeader from './ObjectHeader';
import SubjectCard from './SubjectCard';
import Curi, { CuriThinking } from './Curi';

const SWIPE_MIN_PX = 60; // a deliberate horizontal swipe, not a wobble while scrolling

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Sharing: WhatsApp and email are always visible (text only: a link cannot carry the photo).
 * "Más…" opens the system share sheet, which can attach the photo; only shown when the browser has it.
 */
function ShareBar({ t, objectName, subjectName, content, photo, onToast }) {
  const text = buildShareText({ objectName, subjectName, content, t });
  const title = `${objectName} · ${subjectName}`;

  const viaWhatsApp = () => {
    window.open(whatsappUrl(text), '_blank', 'noopener');
    onToast(t.openedWhatsApp, 'info');
  };

  const viaEmail = () => {
    window.open(mailtoUrl(`${title} — Curiocity`, text));
    onToast(t.openedMail, 'info');
  };

  const viaSystem = async () => {
    const result = await nativeShare({ title, text, imageDataUrl: photo });
    if (result === 'shared' || result === 'shared-text') onToast(t.shared);
  };

  return (
    <section className="share">
      <h3 className="section-title">{t.share}</h3>
      <div className="share__options">
        <button className="btn btn--outline" onClick={viaWhatsApp}><FaWhatsapp aria-hidden="true" /> {t.shareViaWhatsApp}</button>
        <button className="btn btn--outline" onClick={viaEmail}><MdEmail aria-hidden="true" /> {t.shareViaEmail}</button>
        {canShareNatively() && (
          <button className="btn btn--outline" onClick={viaSystem}><MdIosShare aria-hidden="true" /> {t.shareMore}</button>
        )}
      </div>
    </section>
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
 * After the challenge: what did the child observe? Every option is possible (no right answer), and
 * each one has a general, conditional explanation ("If…, it may be because…"). The child may change
 * their choice to read the others.
 */
function Observation({ t, observation, choice, onChoose, focusRef }) {
  return (
    <div className="observation reveal" ref={focusRef} tabIndex={-1}>
      <p id="observation-question" className="lesson-text observation__question">{observation.pregunta}</p>
      <p className="observation__hint">{t.observationHint}</p>
      <ul className="quiz observation__options" aria-labelledby="observation-question">
        {observation.opciones.map((option, i) => (
          <li key={i}>
            <button
              className={choice === i ? 'quiz__option observation__option observation__option--on' : 'quiz__option observation__option'}
              onClick={() => onChoose(i)}
              aria-pressed={choice === i}
            >
              <span className="lesson-text">{option.texto}</span>
            </button>
          </li>
        ))}
      </ul>
      {choice !== null && (
        <div key={choice} className="curi-say challenge__done reveal">
          <Curi state="done" size={64} />
          <p role="status" className="lesson-text observation__conclusion">{observation.opciones[choice].conclusion}</p>
        </div>
      )}
    </div>
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
  t, photo, objectName, subjectKey, nextSubjects = [], content, onBack, onSelectSubject, onRelatedObject, onToast, onTakePhoto
}) {
  const subject = getSubject(subjectKey);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [challengeDone, setChallengeDone] = useState(false);
  const [observed, setObserved] = useState(null); // option chosen in the observation question
  const [showIdeas, setShowIdeas] = useState(false);
  const cardRef = useRef(null);
  const revealRef = useRef(null); // what appears when its button goes away (observation, ideas) takes the focus
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

  useEffect(() => {
    revealRef.current?.focus({ preventScroll: true });
  }, [challengeDone, showIdeas]);

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
  const observation = !content.offline && content.reto_observacion;
  const ideas = (!content.offline && content.ideas_pregunta_final) || [];

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
        {challengeDone && observation && (
          <Observation t={t} observation={observation} choice={observed} onChoose={setObserved} focusRef={revealRef} />
        )}
        <div className="challenge__actions">
          {challengeDone && !observation && (
            <div className="curi-say challenge__done reveal">
              <Curi state="done" size={64} />
              <p role="status">{t.challengeCheer}</p>
            </div>
          )}
          {!challengeDone && (
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
        {!content.offline && <p className="think-pause">{t.thinkAMoment}</p>}
        {ideas.length > 0 && !showIdeas && (
          <button className="btn btn--outline" onClick={() => setShowIdeas(true)}>
            <MdLightbulbOutline aria-hidden="true" /> {t.showIdeas}
          </button>
        )}
        {ideas.length > 0 && showIdeas && (
          <div className="ideas reveal" ref={revealRef} tabIndex={-1}>
            <p className="ideas__intro">{t.ideasIntro}</p>
            <ul className="ideas__list">
              {ideas.map((idea, i) => <li key={i} className="lesson-text">{idea}</li>)}
            </ul>
          </div>
        )}
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

          {(content.objetos_relacionados.length > 0 || nextSubjects.length === 0) && (
            <section>
              <h3 className="section-title">{t.relatedObjects}</h3>
              {content.objetos_relacionados.length > 0 && (
                <div className="chips">
                  {content.objetos_relacionados.map(name => (
                    <button key={name} className="chip chip--button" onClick={() => onRelatedObject(name)}>{name}</button>
                  ))}
                </div>
              )}
              {nextSubjects.length === 0 && (
                <div className="another-photo">
                  <p>{t.exploreAnotherObject}</p>
                  <button className="btn btn--outline" onClick={onTakePhoto}>
                    <MdPhotoCamera aria-hidden="true" /> {t.takeAnotherPhoto}
                  </button>
                </div>
              )}
            </section>
          )}

          <ShareBar t={t} objectName={objectName} subjectName={t.subjects[subjectKey]} content={content} photo={photo} onToast={onToast} />

          {nextSubjects.length > 0 && (
            <section>
              <h3 className="section-title">{t.otherSubjects}</h3>
              <ul className="subject-list">
                {nextSubjects.map(({ key, hook }) => (
                  <li key={key}>
                    <SubjectCard t={t} subject={getSubject(key)} hook={hook} onSelect={onSelectSubject} />
                  </li>
                ))}
              </ul>
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
