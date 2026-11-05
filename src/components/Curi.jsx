// Curi, the Curiocity mascot: just the two eyes of the logo (public/curiocity-icon.svg),
// the "O" eye and the "C" eye with their elliptical pupils, plus a mouth. No body.
// Redrawn with strokes (same thin ink line as the brand) so each part can change with the state.
//
// The mouth is ALWAYS one continuous stroke with round caps, never dashed. Every mouth uses the
// same path commands (M … Q …) so the browser can morph one into another with CSS (`d`).
//
// Curi is decorative (aria-hidden): the message for screen readers is in the text beside it.

const CURI_STATES = ['idle', 'thinking', 'correct', 'almost', 'done'];

const INK = '#1d1d1b'; // --ink
const LINE = 1.6; // close to the logo's line (~1.5 units)

// Mouth for each state: start point, control point, end point (a quadratic curve).
// Below the eyes, centred between them (x ≈ 23.2).
const MOUTHS = {
  idle: 'M 17.5 43 Q 23.2 47 28.9 43', // soft smile
  thinking: 'M 20 44.5 Q 23.5 44.5 27 44.5', // short and straight
  correct: 'M 13.5 41.5 Q 23.2 51.5 32.9 41.5', // wide smile
  almost: 'M 19 44 Q 24.5 47 29.5 41.8', // small, lopsided, but turned up: encouragement
  done: 'M 13.5 41.5 Q 23.2 51.5 32.9 41.5' // wide smile (with a wink)
};

// Happy closed eyes (∩) for "correct", and the wink of the C eye for "done".
const ARC_O = 'M 3.6 21 Q 10.3 9 17 21';
const ARC_C = 'M 30.5 21 Q 37.2 9 43.9 21';

export default function Curi({ state = 'idle', size = 72, className = '' }) {
  const s = CURI_STATES.includes(state) ? state : 'idle';
  const mouth = MOUTHS[s];
  return (
    <svg
      className={`curi curi--${s} ${className}`.trim()}
      data-state={s}
      viewBox="-3 -3 53 57"
      width={size}
      height={(size * 57) / 53}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke={INK}
      strokeWidth={LINE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* "O" eye */}
      <g className="curi__eye curi__eye--o">
        <g className="curi__open">
          <rect x="0.8" y="0.8" width="19" height="34" rx="9.5" ry="10.5" />
          <ellipse className="curi__pupil" cx="14.49" cy="17.44" rx="3.72" ry="5.93" fill={INK} stroke="none" />
        </g>
        <path className="curi__arc" d={ARC_O} />
      </g>

      {/* "C" eye: open on the right, like the C of the logo */}
      <g className="curi__eye curi__eye--c">
        <g className="curi__open">
          <path d="M 45.6 10.4 C 45.6 4.2 42.2 0.8 37.2 0.8 C 31.2 0.8 28 4.2 28 11.2 V 24.4 C 28 31.4 31.2 34.8 37.2 34.8 C 42.6 34.8 45.6 31.6 45.6 26" />
          <ellipse className="curi__pupil" cx="41.58" cy="17.44" rx="3.72" ry="5.93" fill={INK} stroke="none" />
        </g>
        <path className="curi__arc" d={ARC_C} />
      </g>

      {/* Mouth: a single continuous line. `d` is also set in CSS so it morphs between states. */}
      <path className="curi__mouth" d={mouth} style={{ d: `path('${mouth}')` }} />
    </svg>
  );
}

// While something is being prepared (subjects, lesson): Curi thinking, with the message as text for screen readers.
export function CuriThinking({ label }) {
  return (
    <div className="curi-say curi-say--stack" role="status">
      <Curi state="thinking" size={84} />
      <p className="curi-say__text">{label}</p>
    </div>
  );
}
