import { useEffect, useRef, useState } from 'react';
import Curi from './Curi';
import { CircleButton } from './Page';
import { IconArrowLeft, IconArrowRight } from './icons';
import { getSubject } from '../subjects';

const SCREENS = ['hola', 'foto', 'asignaturas'];
const SWIPE_MIN_PX = 60; // same as the lesson: a deliberate horizontal swipe, not a wobble while scrolling
const LEAF = getSubject('biologia').color; // the leaf in the viewfinder takes the Biology tint

/**
 * Screen 2's drawing: the camera as the child will see it (sharp circle with a fine ring, blurred
 * surroundings, the shutter below) with a leaf inside. Decorative: the text says everything.
 */
function ViewfinderArt() {
  return (
    <svg className="guide-art guide-art--camera" viewBox="0 0 150 200" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="guide-art-screen">
          <rect x="1" y="1" width="148" height="198" rx="22" />
        </clipPath>
      </defs>
      <rect className="guide-art__screen" x="1" y="1" width="148" height="198" rx="22" />
      {/* blurred surroundings, kept inside the screen */}
      <g clipPath="url(#guide-art-screen)">
        <circle className="guide-art__blur" cx="26" cy="34" r="22" />
        <circle className="guide-art__blur" cx="128" cy="150" r="26" />
        <circle className="guide-art__blur" cx="122" cy="30" r="14" />
      </g>
      {/* the viewfinder: sharp circle and its fine ring */}
      <circle className="guide-art__ring" cx="75" cy="88" r="52" />
      <circle className="guide-art__lens" cx="75" cy="88" r="47" />
      {/* a leaf */}
      <path
        className="guide-art__ink"
        style={{ fill: LEAF }}
        d="M 52 112 C 50 84 66 64 100 60 C 102 92 86 112 52 112 Z"
      />
      <path className="guide-art__ink" d="M 46 118 L 52 112 C 66 98 80 82 94 66" />
      <path className="guide-art__ink" d="M 64 99 L 63 88 M 74 89 L 74 77 M 84 78 L 85 69 M 66 97 L 77 98 M 76 87 L 87 88" />
      {/* shutter */}
      <circle className="guide-art__ring" cx="75" cy="170" r="15" />
      <circle className="guide-art__shutter" cx="75" cy="170" r="10.5" />
    </svg>
  );
}

/** Screen 3's drawing: three subject rows, as on the subjects page. Decorative. */
function SubjectsArt({ t }) {
  return (
    <ul className="guide-subjects" aria-hidden="true">
      {['biologia', 'historia', 'musica'].map(key => {
        const { icon: Icon, color } = getSubject(key);
        return (
          <li key={key} className="guide-subjects__row" style={{ '--subject': color }}>
            <span className="subject-row__icon"><Icon /></span>
            <span className="subject-row__label">{t.subjects[key]}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Welcome guide with Curi, shown the first time (and again from "¿Cómo funciona?" in the history).
 * Three screens with the lesson's progress segments and bottom navigation; "Saltar" at the top.
 * `from`: 'inicio' (first opening) or 'como_funciona'. `onFinish` gets what the study version
 * records: { resultado: 'terminada'|'saltada', pantalla (name of the last screen), pantallas_vistas, duracion_ms, desde }.
 */
export default function Guide({ t, from = 'inicio', onFinish }) {
  const g = t.guide;
  const [index, setIndex] = useState(0);
  const startRef = useRef(0);
  const seenRef = useRef(1);
  const cardRef = useRef(null);
  const movedRef = useRef(false); // focus moves only after the child changes screen
  const swipeRef = useRef(null);
  const isLast = index === SCREENS.length - 1;

  // The clock starts when the guide appears (it is mounted only once the splash has gone).
  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  const finish = resultado =>
    // `pantalla` is the screen's name: in the study it becomes its own column, which takes names, not numbers
    onFinish({ resultado, pantalla: SCREENS[index], pantallas_vistas: seenRef.current, duracion_ms: Date.now() - startRef.current, desde: from });

  // Escape skips the guide (the page does not close it on its own, so the mark is always saved).
  // Registered again after each render, so it always knows the current screen.
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') finish('saltada');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // The new screen takes the keyboard and screen-reader focus.
  useEffect(() => {
    if (!movedRef.current) return;
    cardRef.current?.focus({ preventScroll: true });
    cardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [index]);

  const goTo = next => {
    if (next < 0 || next >= SCREENS.length) return;
    seenRef.current = Math.max(seenRef.current, next + 1);
    movedRef.current = true;
    setIndex(next);
  };
  const goNext = () => (isLast ? finish('terminada') : goTo(index + 1));

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
    if (dx < 0 && !isLast) goTo(index + 1);
    if (dx > 0) goTo(index - 1);
  };

  const screen = SCREENS[index];
  const titleId = `guide-title-${screen}`;
  const progress = g.progress.replace('{n}', index + 1).replace('{total}', SCREENS.length);

  let body;
  if (screen === 'hola') {
    body = (
      <>
        <div className="guide-card__art">
          <Curi state="idle" size={150} />
        </div>
        <h2 id={titleId} className="guide-card__title">{g.helloTitle}</h2>
        <p className="guide-card__text">{g.helloText}</p>
      </>
    );
  } else if (screen === 'foto') {
    body = (
      <>
        <div className="guide-card__art guide-card__art--row">
          <ViewfinderArt />
          <Curi state="idle" size={92} look="left" className="guide-card__curi" />
        </div>
        <h2 id={titleId} className="guide-card__title">{g.photoTitle}</h2>
        <p className="guide-card__text">{g.photoText}</p>
        <ul className="guide-card__rules">
          {g.photoRules.map(rule => <li key={rule}>{rule}</li>)}
        </ul>
      </>
    );
  } else {
    body = (
      <>
        <div className="guide-card__art guide-card__art--row">
          <SubjectsArt t={t} />
          <Curi state="done" size={92} className="guide-card__curi" />
        </div>
        <h2 id={titleId} className="guide-card__title">{g.subjectsTitle}</h2>
        <p className="guide-card__text">{g.subjectsText}</p>
        {/* Only the first time: the browser asks for the camera right after "¡Vamos!" */}
        {from === 'inicio' && <p className="guide-card__note">{g.cameraNote}</p>}
      </>
    );
  }

  return (
    <article className="guide">
      <div className="guide__top">
        {!isLast && (
          <button className="guide__skip" onClick={() => finish('saltada')}>{g.skip}</button>
        )}
      </div>

      <div className="lesson__bar">
        <ol className="progress" aria-hidden="true" style={{ '--cards': SCREENS.length }}>
          {SCREENS.map((s, i) => (
            <li key={s} className={i <= index ? 'progress__step progress__step--done' : 'progress__step'} />
          ))}
        </ol>
        <p id="guide-progress" className="visually-hidden">{progress}</p>
      </div>

      <section
        key={screen}
        ref={cardRef}
        className={`guide-card guide-card--${screen}`}
        tabIndex={-1}
        aria-labelledby={`guide-progress ${titleId}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {body}
      </section>

      <div className="lesson-nav">
        <div className="lesson-nav__buttons">
          {index > 0 && (
            <CircleButton big label={t.previous} onClick={() => goTo(index - 1)}>
              <IconArrowLeft />
            </CircleButton>
          )}
          <button className="btn btn--primary lesson-nav__next" onClick={goNext}>
            {isLast ? g.go : <>{t.next} <IconArrowRight /></>}
          </button>
        </div>
      </div>
    </article>
  );
}
