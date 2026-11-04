import { AGE_GROUPS } from '../i18n';
import ObjectHeader from './ObjectHeader';

const AGE_LABEL_KEYS = { '6-8': 'age68', '9-12': 'age912' };

// subjects: the relevant subjects for this object, or undefined while they are being worked out.
export default function SubjectPicker({ t, photo, objectName, subjects, ageGroup, onAgeChange, onSelect, onWrongObject }) {
  return (
    <section>
      <ObjectHeader photo={photo} objectName={objectName} photoAlt={t.capturedPhoto} />
      <div className="age" role="radiogroup" aria-label={t.age}>
        <span className="age__label" aria-hidden="true">{t.age}</span>
        {AGE_GROUPS.map(age => (
          <button
            key={age}
            role="radio"
            aria-checked={ageGroup === age}
            className={ageGroup === age ? 'age__option age__option--on' : 'age__option'}
            onClick={() => onAgeChange(age)}
          >
            {t[AGE_LABEL_KEYS[age]]}
          </button>
        ))}
      </div>
      <h3 className="section-title section-title--center">{t.whatToDiscover}</h3>
      {subjects === undefined ? (
        <p className="skeleton__label center" role="status">{t.loading}</p>
      ) : (
        <ul className="subject-grid">
          {subjects.map(({ key, icon: Icon, color }) => (
            <li key={key}>
              <button className="subject-card" style={{ '--subject': color }} onClick={() => onSelect(key)}>
                <span className="subject-card__icon"><Icon aria-hidden="true" /></span>
                <span className="subject-card__label">{t.subjects[key]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {photo && (
        <div className="center">
          <button className="btn btn--ghost" onClick={onWrongObject}>{t.wrongObject}</button>
        </div>
      )}
    </section>
  );
}
