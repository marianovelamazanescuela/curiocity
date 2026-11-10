import { useEffect, useRef, useState } from 'react';
import { MdMailOutline, MdIosShare, MdLightbulbOutline, MdCheck } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { getSubject } from '../subjects';
import { buildShareText, canShareNatively, mailtoUrl, nativeShare, whatsappUrl } from '../share';
import { SubjectList } from './SubjectRow';
import Curi, { CuriThinking } from './Curi';
import { CircleButton, PageNav } from './Page';
import { IconArrowLeft, IconArrowRight, IconCamera, IconClose, IconOpen } from './icons';

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
      <h3 className="kicker">{t.share}</h3>
      <div className="share__options">
        <button className="btn btn--outline" onClick={viaWhatsApp}><FaWhatsapp aria-hidden="true" /> {t.shareViaWhatsApp}</button>
        <button className="btn btn--outline" onClick={viaEmail}><MdMailOutline aria-hidden="true" /> {t.shareViaEmail}</button>
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
                {answered && i === question.correcta && <MdCheck className="quiz__mark" aria-hidden="true" />}
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
 * After the challenge, whether the child found it or not: "what you could discover", a general and
 * true explanation (the AI does not see the object). Without it, a short kind message.
 * Nothing here sounds like failing: "No lo he encontrado" gets the same explanation, with Curi calm.
 */
function ChallengeResult({ t, result, discovery, focusRef }) {
  const found = result === 'done';
  if (!discovery) {
    return (
      <div className="curi-say challenge__done reveal">
        <Curi state={found ? 'done' : 'idle'} size={64} />
        <p role="status">{found ? t.challengeCheer : t.notFoundCheer}</p>
      </div>
    );
  }
  return (
    <div className="discovery reveal" ref={focusRef} tabIndex={-1} role="status">
      <Curi state={found ? 'done' : 'idle'} size={64} />
      <div>
        <p className="kicker discovery__title">{t.whatYouCouldDiscover}</p>
        <p className="lesson-text discovery__text">{discovery}</p>
      </div>
    </div>
  );
}

/**
 * The lesson as a sequence of screens, one idea each:
 * question → surprising fact → why → challenge → final question (with ideas) →
 * "Sigue explorando" (other subjects, related objects, encyclopedia links, sharing).
 * Offline content knows nothing true about the object, so it has no question or fact: 4 screens.
 */
function lessonCards(content) {
  if (content.offline) return ['why', 'challenge', 'final', 'explore'];
  return [
    content.pregunta_inicial && 'question',
    content.dato_sorprendente && 'fact',
    'why',
    'challenge',
    'final',
    'explore'
  ].filter(Boolean);
}

export default function ContentView({
  t, photo, objectName, subjectKey, nextSubjects = [], content, onBack, onSelectSubject, onRelatedObject, onToast, onTakePhoto
}) {
  const subject = getSubject(subjectKey);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [challengeResult, setChallengeResult] = useState(null); // null | 'done' | 'notFound'
  const [showIdeas, setShowIdeas] = useState(false);
  const cardRef = useRef(null);
  const revealRef = useRef(null); // what appears when its button goes away (discovery, ideas) takes the focus
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
  }, [challengeResult, showIdeas]);

  // Top: the pill (the only place with the subject's colour), centred, and the X, which leaves the
  // lesson and goes back to the subjects.
  const header = (
    <PageNav right={<CircleButton label={t.closeLesson} onClick={onBack}><IconClose /></CircleButton>}>
      <h2 className="lesson-pill">
        <span className="object-name-text">{objectName}</span> · {t.subjects[subjectKey]}
      </h2>
    </PageNav>
  );

  if (!content) {
    return (
      <article className="lesson" style={{ '--subject': subject.color }}>
        {header}
        <div className="lesson__loading">
          <CuriThinking label={t.curiThinking} />
        </div>
      </article>
    );
  }

  const cards = lessonCards(content);
  const current = cards[Math.min(index, cards.length - 1)];
  const question = content.pregunta_inicial;
  const isLast = index === cards.length - 1;
  const canAdvance = !isLast && !(current === 'question' && answer === null);
  const finalText = content.offline ? content.otra_idea : content.para_seguir_pensando;
  // Old lessons may still carry reto_observacion (phase 3): it is simply ignored.
  const discovery = (!content.offline && typeof content.reto_descubrimiento === 'string' && content.reto_descubrimiento.trim()) || null;
  const ideas = (!content.offline && content.ideas_pregunta_final) || [];

  const progress = t.cardProgress.replace('{n}', index + 1).replace('{total}', cards.length);

  const goTo = next => {
    if (next < 0 || next >= cards.length) return;
    movedRef.current = true;
    setIndex(next);
  };
  const goNext = () => canAdvance && goTo(index + 1);
  // On the first screen, "Anterior" goes back to the subjects.
  const goPrevious = () => (index === 0 ? onBack() : goTo(index - 1));

  // Optional swipe (the buttons are always there). Only clear horizontal swipes count,
  // so scrolling the page up and down never changes card by accident.
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
        <p className="kicker">{t.guessFirst}</p>
        <h3 id={titleId} className="card__title lesson-text lesson-text--title">{question.pregunta}</h3>
        <Quiz t={t} question={question} answer={answer} onAnswer={setAnswer} />
      </>
    );
  } else if (current === 'fact') {
    body = (
      <>
        <Curi state="idle" size={64} />
        <h3 id={titleId} className="kicker">{t.didYouKnow}</h3>
        <p className="lesson-text lesson-text--read">{content.dato_sorprendente}</p>
      </>
    );
  } else if (current === 'why') {
    body = (
      <>
        <Curi state="thinking" size={64} />
        <h3 id={titleId} className="kicker">{content.offline ? t.investigate : t.why}</h3>
        {content.offline && <p className="lesson-text lesson-text--read card__intro">{content.intro}</p>}
        <div className="prose lesson-text lesson-text--read">
          {String(content.por_que).split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </>
    );
  } else if (current === 'challenge') {
    body = (
      <>
        <h3 id={titleId} className="kicker">{t.challenge}</h3>
        <p className="lesson-text challenge__text">{content.reto}</p>
        {challengeResult && (
          <ChallengeResult t={t} result={challengeResult} discovery={discovery} focusRef={revealRef} />
        )}
        <div className="challenge__actions">
          {!challengeResult && (
            <>
              <button className="btn btn--primary" onClick={() => setChallengeResult('done')}>
                {t.challengeDone}
              </button>
              <button className="btn btn--outline" onClick={() => setChallengeResult('notFound')}>
                {t.notFound}
              </button>
            </>
          )}
          {challengeResult && content.reto_foto && (
            <button className="btn btn--outline" onClick={onTakePhoto}>
              <IconCamera /> {t.takeAnotherPhoto}
            </button>
          )}
        </div>
      </>
    );
  } else if (current === 'final') {
    body = (
      <>
        <h3 id={titleId} className="kicker">{content.offline ? t.tryThis : t.keepThinking}</h3>
        {finalText && <p className="lesson-text lesson-text--title final__question">{finalText}</p>}
        {!content.offline && <p className="think-pause">{t.thinkAMoment}</p>}
        {ideas.length > 0 && !showIdeas && (
          <button className="btn btn--outline" onClick={() => setShowIdeas(true)}>
            <MdLightbulbOutline aria-hidden="true" /> {t.showIdeas}
          </button>
        )}
        {ideas.length > 0 && showIdeas && (
          <div className="ideas reveal" ref={revealRef} tabIndex={-1}>
            <p className="kicker ideas__intro">{t.ideasIntro}</p>
            <ul className="ideas__list">
              {ideas.map((idea, i) => <li key={i} className="lesson-text">{idea}</li>)}
            </ul>
          </div>
        )}
      </>
    );
  } else {
    // "Sigue explorando": other featured subjects, related objects, encyclopedias and sharing.
    body = (
      <>
        <Curi state="done" size={64} />
        <h3 id={titleId} className="explore__title">{t.relatedObjects}</h3>

        {nextSubjects.length > 0 && (
          <section className="explore__section">
            <h4 className="kicker">{t.otherSubjects}</h4>
            <SubjectList t={t} items={nextSubjects} onSelect={onSelectSubject} getSubject={getSubject} />
          </section>
        )}

        {(content.objetos_relacionados.length > 0 || nextSubjects.length === 0) && (
          <section className="explore__section">
            <h4 className="kicker">{t.otherObjects}</h4>
            {content.objetos_relacionados.length > 0 && (
              <div className="chips">
                {content.objetos_relacionados.map(name => (
                  <button key={name} className="chip chip--button" onClick={() => onRelatedObject(name)}>{name}</button>
                ))}
              </div>
            )}
            {/* No other subject left (or no ranking): invite to photograph another object
                ("Hacer otra foto" is the main button at the bottom). */}
            {nextSubjects.length === 0 && <p className="another-photo">{t.exploreAnotherObject}</p>}
          </section>
        )}

        {content.enlaces.length > 0 && (
          <section className="explore__section">
            <h4 className="kicker">{t.recommendedResources}</h4>
            <ul className="links">
              {content.enlaces.map((link, i) => (
                <li key={i}>
                  <a className="links__item" href={link.url} target="_blank" rel="noopener noreferrer">
                    <span>
                      <span className="links__title">{link.title || link.url}</span>
                      <span className="links__source">{link.source || hostnameOf(link.url)}</span>
                    </span>
                    <IconOpen />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ShareBar t={t} objectName={objectName} subjectName={t.subjects[subjectKey]} content={content} photo={photo} onToast={onToast} />
      </>
    );
  }

  return (
    <article className="lesson" style={{ '--subject': subject.color }}>
      {header}

      <div className="lesson__bar">
        <ol className="progress" aria-hidden="true" style={{ '--cards': cards.length }}>
          {cards.map((card, i) => (
            <li key={card} className={i <= index ? 'progress__step progress__step--done' : 'progress__step'} />
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

      {/* Bottom, on every screen: "Anterior" (circle; on the first screen it goes back to the subjects)
          and, on the right, "Siguiente", the hint while the question waits for an answer, or
          "Hacer otra foto" on the last screen. */}
      <div className="lesson-nav">
        <div className="lesson-nav__buttons">
          <CircleButton big label={index === 0 ? t.backToSubjects : t.previous} onClick={goPrevious}>
            <IconArrowLeft />
          </CircleButton>
          {current === 'question' && answer === null && (
            <p id="answer-hint" className="lesson-nav__hint">{t.answerToContinue}</p>
          )}
          {canAdvance && (
            <button className="btn btn--primary lesson-nav__next" onClick={goNext}>
              {t.next} <IconArrowRight />
            </button>
          )}
          {isLast && (
            <button className="btn btn--primary lesson-nav__next" onClick={onTakePhoto}>
              <IconCamera /> {t.takeAnotherPhoto}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
