import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations, detectUserLanguage } from './i18n';
import { SUBJECTS } from './subjects';
import { buildFallbackContent } from './fallbackContent';
import { buildShareText } from './share';

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
  it('produces localized content for every language and subject', () => {
    for (const lang of Object.keys(translations)) {
      for (const { key } of SUBJECTS) {
        const c = buildFallbackContent('Manzana', key, translations[lang].subjects[key], lang);
        expect(c.title).toContain(translations[lang].subjects[key]);
        expect(c.text).toContain('Manzana');
        expect(c.funFacts.length).toBeGreaterThan(0);
        expect(c.links).toEqual([]);
      }
    }
  });
});

describe('buildShareText', () => {
  const content = { title: 'T', text: 'Intro', explanation: 'Exp', funFacts: ['uno', 'dos'] };

  it('includes the content, fun facts and never a base64 image', () => {
    const text = buildShareText(content, translations.es, { withAttachHint: true });
    expect(text).toContain(translations.es.shareIntro);
    expect(text).toContain('• uno\n• dos');
    expect(text).toContain(translations.es.shareAttachHint);
    expect(text).not.toContain('base64');
  });
});
