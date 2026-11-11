// The camera's "Estudio · LINCE-47" badge (study version only, loaded lazily by App).
// Small and quiet; tapping it opens the details page with the backup export.
import { studyTexts } from './texts';

export default function StudyBadge({ lang, code, onPress, disabled }) {
  const s = studyTexts[lang] || studyTexts.en;
  return (
    <button className="camera__study" onClick={onPress} aria-label={s.badgeLabel(code)} disabled={disabled}>
      {s.badge} · {code}
    </button>
  );
}
