import { SUBJECTS, getSubject } from '../subjects';
import ObjectHeader from './ObjectHeader';
import { CuriThinking } from './Curi';

function SubjectCard({ t, subject, hook, onSelect }) {
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

function SubjectGrid({ t, subjects, onSelect }) {
  return (
    <ul className="subject-grid">
      {subjects.map(subject => (
        <li key={subject.key}>
          <SubjectCard t={t} subject={subject} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

// ranking: { featured: [{ key, hook }], others: [key] }; null = unknown (show all, no hooks);
// undefined = still being worked out.
export default function SubjectPicker({ t, photo, objectName, ranking, onSelect, onWrongObject }) {
  let subjects;
  if (ranking === undefined) {
    subjects = <CuriThinking label={t.curiThinking} />;
  } else if (ranking === null) {
    subjects = <SubjectGrid t={t} subjects={SUBJECTS} onSelect={onSelect} />;
  } else {
    const others = ranking.others.map(getSubject).filter(Boolean);
    subjects = (
      <>
        <ul className="subject-list">
          {ranking.featured.map(({ key, hook }) => (
            <li key={key}>
              <SubjectCard t={t} subject={getSubject(key)} hook={hook} onSelect={onSelect} />
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <details className="more-subjects">
            <summary className="more-subjects__toggle">{t.moreSubjects}</summary>
            <SubjectGrid t={t} subjects={others} onSelect={onSelect} />
          </details>
        )}
      </>
    );
  }

  return (
    <section>
      <ObjectHeader photo={photo} objectName={objectName} photoAlt={t.capturedPhoto} />
      <h3 className="section-title section-title--center">{t.whatToDiscover}</h3>
      {subjects}
      {photo && (
        <div className="center">
          <button className="btn btn--ghost" onClick={onWrongObject}>{t.wrongObject}</button>
        </div>
      )}
    </section>
  );
}
