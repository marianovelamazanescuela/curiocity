import { CircleButton, PageNav } from './Page';
import { IconCamera, IconChevronLeft } from './icons';

// Where the name tag goes so it stays inside the photo: under the ring, or above it near the bottom,
// and aligned to the side near the left or right edge.
function labelPlacement({ x, y }) {
  const vertical = y > 0.78 ? 'above' : 'below';
  const horizontal = x < 0.22 ? 'start' : x > 0.78 ? 'end' : 'center';
  return `chooser__label--${vertical} chooser__label--${horizontal}`;
}

/**
 * Several objects in the photo: the child chooses which one to explore. The photo fills the width,
 * with a cream ring over each object (positions are approximate) and its name in a small tag; under
 * it, the same objects as large buttons. The buttons are the accessible way: the rings are hidden
 * from screen readers and out of the keyboard order, so nothing is announced twice.
 * objects: [{ name, x, y, size }] with positions from 0 to 1 over the square photo.
 */
export default function ObjectChooser({ t, photo, objects, onChoose, onBackToCamera, onRetake }) {
  return (
    <section className="chooser">
      <PageNav
        left={<CircleButton label={t.backToCamera} onClick={onBackToCamera}><IconChevronLeft /></CircleButton>}
        right={<CircleButton label={t.takeAnotherPhoto} onClick={onRetake}><IconCamera /></CircleButton>}
      />
      <div className="chooser__photo">
        {photo && <img src={photo} alt={t.capturedPhoto} />}
        {objects.map((o, i) => (
          <button
            key={o.name}
            type="button"
            className="chooser__marker"
            style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, '--size': o.size, '--delay': `${i * 0.06}s` }}
            onClick={() => onChoose(o)}
            tabIndex={-1}
            aria-hidden="true"
          >
            <span className="chooser__ring" />
            <span className={`chooser__label object-name-text ${labelPlacement(o)}`}>{o.name}</span>
          </button>
        ))}
      </div>
      <h2 className="chooser__question">{t.whatToExplore}</h2>
      <ul className="chooser__list">
        {objects.map(o => (
          <li key={o.name}>
            <button type="button" className="btn btn--outline chooser__option" onClick={() => onChoose(o)}>
              <span className="object-name-text">{o.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
