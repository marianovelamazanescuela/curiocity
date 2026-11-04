import { useCallback, useEffect, useRef, useState } from 'react';

// Read-aloud with the browser's built-in voices (Web Speech API). Runs on the device:
// nothing is sent to any server. Useful for 6-7 year-olds who are still learning to read.

const VOICE_LOCALES = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };

export const speechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

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
