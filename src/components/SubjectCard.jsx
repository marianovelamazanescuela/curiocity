/** A subject button: icon, name and, for the subjects featured by the ranking, its one-line hook. */
export default function SubjectCard({ t, subject, hook, onSelect }) {
  const { key, icon: Icon, color } = subject;
  return (
    <button className={hook ? 'subject-card subject-card--featured' : 'subject-card'} style={{ '--subject': color }} onClick={() => onSelect(key)}>
      <span className="subject-card__icon"><Icon aria-hidden="true" /></span>
      <span className="subject-card__text">
        <span className="subject-card__label">{t.subjects[key]}</span>
        {hook && <span className="subject-card__hook">{hook}</span>}
      </span>
    </button>
  );
}
