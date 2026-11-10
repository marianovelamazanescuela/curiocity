import { IconChevronRight } from './icons';

/**
 * One subject as a list row: a circle in the subject's tint with its icon, the name and, for the
 * subjects featured by the ranking, its one-line hook; a chevron on the right.
 */
export default function SubjectRow({ t, subject, hook, onSelect }) {
  const { key, icon: Icon, color } = subject;
  return (
    <button className="subject-row" style={{ '--subject': color }} onClick={() => onSelect(key)}>
      <span className="subject-row__icon"><Icon aria-hidden="true" /></span>
      <span className="subject-row__text">
        <span className="subject-row__label">{t.subjects[key]}</span>
        {hook && <span className="subject-row__hook">{hook}</span>}
      </span>
      <span className="subject-row__chevron"><IconChevronRight /></span>
    </button>
  );
}

/** Subjects as rows separated by fine lines. `items`: [{ key, hook? }] */
export function SubjectList({ t, items, onSelect, getSubject }) {
  return (
    <ul className="subject-list">
      {items.map(({ key, hook }) => (
        <li key={key}>
          <SubjectRow t={t} subject={getSubject(key)} hook={hook} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}
