import { SUBJECTS, getSubject } from '../subjects';
import { SubjectList } from './SubjectRow';
import { CuriThinking } from './Curi';
import { CircleButton, PageNav } from './Page';
import { IconCamera, IconChevronDown, IconChevronLeft } from './icons';

/** The child's photo in a circle inside a fine ring, like the camera viewfinder (brand eyes if none). */
export function PhotoRing({ photo, alt }) {
  return (
    <div className="photo-ring">
      <div className="photo-ring__photo">
        {photo ? <img src={photo} alt={alt} /> : <img className="photo-ring__eyes" src="/curiocity-icon.svg" alt="" aria-hidden="true" />}
      </div>
    </div>
  );
}

// ranking: { featured: [{ key, hook }], others: [key] }; null = unknown (show all, no hooks);
// undefined = still being worked out.
// "volver a la cámara" (left) and "hacer otra foto" (right) both go back to the camera: the right
// one is the "wrong object" recovery, named as such for screen readers. When the photo had several
// objects, the left one goes back to choosing ("volver a los objetos").
export default function SubjectPicker({ t, photo, objectName, ranking, onSelect, onBackToCamera, onWrongObject, backLabel = t.backToCamera }) {
  let subjects;
  if (ranking === undefined) {
    subjects = <CuriThinking label={t.curiThinking} />;
  } else if (ranking === null) {
    subjects = <SubjectList t={t} items={SUBJECTS} onSelect={onSelect} getSubject={getSubject} />;
  } else {
    const others = ranking.others.filter(getSubject).map(key => ({ key }));
    subjects = (
      <>
        <SubjectList t={t} items={ranking.featured.filter(f => getSubject(f.key))} onSelect={onSelect} getSubject={getSubject} />
        {others.length > 0 && (
          <details className="more-subjects">
            <summary className="more-subjects__toggle">
              {t.moreSubjects} <IconChevronDown />
            </summary>
            <SubjectList t={t} items={others} onSelect={onSelect} getSubject={getSubject} />
          </details>
        )}
      </>
    );
  }

  return (
    <section className="subjects">
      <PageNav
        left={<CircleButton label={backLabel} onClick={onBackToCamera}><IconChevronLeft /></CircleButton>}
        right={<CircleButton label={photo ? t.wrongObjectRetake : t.takeAnotherPhoto} onClick={onWrongObject}><IconCamera /></CircleButton>}
      >
        <PhotoRing photo={photo} alt={t.capturedPhoto} />
      </PageNav>
      <p className="found">{t.youFound}</p>
      <h2 className="object-name">{objectName}</h2>
      <h3 className="subjects__question">{t.whereToLook}</h3>
      {subjects}
    </section>
  );
}
