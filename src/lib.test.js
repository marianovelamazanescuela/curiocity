import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations, detectUserLanguage } from './i18n';
import { SUBJECTS, nextSubjects } from './subjects';
import { buildFallbackContent } from './fallbackContent';
import { buildShareText } from './share';
import { removeOldSettings } from './oldSettings';

describe('translations', () => {
  const keysOf = obj => Object.keys(obj).sort();

  it('every language has exactly the same keys as English', () => {
    for (const lang of Object.keys(translations)) {
      expect(keysOf(translations[lang]), lang).toEqual(keysOf(translations.en));
      expect(keysOf(translations[lang].subjects), lang).toEqual(keysOf(translations.en.subjects));
    }
  });

  it('has a label for every subject', () => {
    for (const lang of Object.keys(translations)) {
      for (const { key } of SUBJECTS) expect(translations[lang].subjects[key], `${lang}.${key}`).toBeTruthy();
    }
  });
});

describe('detectUserLanguage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('uses the first supported browser language', () => {
    vi.stubGlobal('navigator', { languages: ['it-IT', 'fr-FR', 'en'], language: 'it-IT' });
    expect(detectUserLanguage()).toBe('fr');
  });

  it('prefers a saved choice', () => {
    localStorage.setItem('curiocity_lang', 'de');
    expect(detectUserLanguage()).toBe('de');
  });
});

describe('buildFallbackContent', () => {
  it('produces localized offline content for every language and subject', () => {
    for (const lang of Object.keys(translations)) {
      for (const { key } of SUBJECTS) {
        const c = buildFallbackContent(key, lang);
        expect(c.offline).toBe(true);
        expect(c.intro && c.por_que && c.reto && c.otra_idea, `${lang}.${key}`).toBeTruthy();
        expect(c.enlaces).toEqual([]);
      }
    }
  });

  it('has no quiz or fact: offline nothing true is known about the object', () => {
    const c = buildFallbackContent('historia', 'es');
    expect(c.pregunta_inicial).toBeNull();
    expect(c.dato_sorprendente).toBeNull();
  });
});

describe('nextSubjects', () => {
  const ranking = {
    featured: [{ key: 'biologia', hook: 'b' }, { key: 'historia', hook: 'h' }, { key: 'artes', hook: 'a' }],
    others: ['matematicas', 'lengua', 'geologia', 'musica']
  };

  it('offers only the other featured subjects, with their hook, never the weaker ones', () => {
    expect(nextSubjects(ranking, 'biologia')).toEqual([{ key: 'historia', hook: 'h' }, { key: 'artes', hook: 'a' }]);
    expect(nextSubjects(ranking, 'musica').map(s => s.key)).toEqual(['biologia', 'historia', 'artes']);
  });

  it('leaves out the subjects already seen for this object', () => {
    expect(nextSubjects(ranking, 'biologia', ['historia', 'biologia'])).toEqual([{ key: 'artes', hook: 'a' }]);
    expect(nextSubjects(ranking, 'artes', ['biologia', 'historia', 'artes'])).toEqual([]);
  });

  it('offers none when there is no ranking (server unavailable)', () => {
    expect(nextSubjects(null, 'biologia')).toEqual([]);
  });
});

describe('buildShareText', () => {
  const content = {
    pregunta_inicial: { pregunta: '¿Pregunta?', opciones: ['a', 'b', 'c'], correcta: 1 },
    dato_sorprendente: 'Dato', por_que: 'Porque', reto: 'Cuenta', para_seguir_pensando: '¿Y si…?'
  };

  it('includes the answer, the challenge and never a base64 image', () => {
    const text = buildShareText('Historia: Farola', content, translations.es, { withAttachHint: true });
    expect(text).toContain(translations.es.shareIntro);
    expect(text).toContain('¿Pregunta?\n→ b');
    expect(text).toContain('Reto de un minuto: Cuenta');
    expect(text).toContain(translations.es.shareAttachHint);
    expect(text).not.toContain('base64');
  });
});

describe('removeOldSettings', () => {
  it('deletes the voice and age settings of earlier versions, and keeps the rest', () => {
    localStorage.setItem('curiocity_voice', 'on');
    localStorage.setItem('curiocity_age', '9-12');
    localStorage.setItem('curiocity_history', '[]');
    removeOldSettings();
    expect(localStorage.getItem('curiocity_voice')).toBeNull();
    expect(localStorage.getItem('curiocity_age')).toBeNull();
    expect(localStorage.getItem('curiocity_history')).toBe('[]');
    localStorage.clear();
  });
});
