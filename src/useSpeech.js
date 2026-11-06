import { useCallback, useEffect, useRef, useState } from 'react';

// Read-aloud with the browser's built-in voices (Web Speech API). Runs on the device:
// nothing is sent to any server. Useful for 6-7 year-olds who are still learning to read.

const VOICE_LOCALES = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };

export const speechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

// "Voice on" reads every lesson card aloud as it appears. Saved only on this device.
// Never chosen: on for 6–8 (many are still learning to read), off for 9–12.
const VOICE_KEY = 'curiocity_voice';

export function loadVoicePreference(ageGroup) {
  try {
    const saved = localStorage.getItem(VOICE_KEY);
    if (saved === 'on' || saved === 'off') return saved === 'on';
  } catch {
    // localStorage may be blocked (private mode); use the default
  }
  return ageGroup === '6-8';
}

export function saveVoicePreference(on) {
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
  } catch {
    // ignore: the choice just won't be remembered
  }
}

// Browsers only let a page speak after the person has interacted with it (autoplay policy).
// The lesson always opens after a tap (photo, subject), but we check anyway when the browser can tell.
export const hasUserInteracted = () =>
  typeof navigator === 'undefined' || !navigator.userActivation || navigator.userActivation.hasBeenActive;

function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  const locale = VOICE_LOCALES[lang] || lang;
  return voices.find(v => v.lang === locale) || voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang)) || null;
}

/**
 * speak(parts) reads an array of texts in order (one utterance each: some browsers cut
 * very long utterances). stop() cancels. Speech also stops when the component unmounts.
 */
export function useSpeech(lang) {
  const [speaking, setSpeaking] = useState(false);
  const runRef = useRef(0); // ignores callbacks from a cancelled run

  const stop = useCallback(() => {
    runRef.current += 1;
    if (speechSupported()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    parts => {
      if (!speechSupported()) return;
      window.speechSynthesis.cancel();
      const run = ++runRef.current;
      const texts = parts.map(p => String(p || '').trim()).filter(Boolean);
      if (!texts.length) return;

      const voice = pickVoice(lang);
      texts.forEach((text, i) => {
        const u = new window.SpeechSynthesisUtterance(text);
        u.lang = VOICE_LOCALES[lang] || lang;
        if (voice) u.voice = voice;
        u.rate = 0.92; // a little slower for children
        if (i === texts.length - 1) {
          u.onend = () => runRef.current === run && setSpeaking(false);
        }
        u.onerror = () => runRef.current === run && setSpeaking(false);
        window.speechSynthesis.speak(u);
      });
      setSpeaking(true);
    },
    [lang]
  );

  useEffect(() => stop, [stop]);

  return { speaking, speak, stop, supported: speechSupported() };
}
