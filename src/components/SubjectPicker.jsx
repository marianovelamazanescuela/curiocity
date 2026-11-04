import ObjectHeader from './ObjectHeader';

// subjects: the relevant subjects for this object, or undefined while they are being worked out.
export default function SubjectPicker({ t, photo, objectName, subjects, onSelect, onWrongObject }) {
  return (
    <section>
      <ObjectHeader photo={photo} objectName={objectName} photoAlt={t.capturedPhoto} />
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
