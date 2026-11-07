// Public URL included in shared messages. Defaults to wherever the app is running.
export const APP_URL = import.meta.env.VITE_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Plain-text summary of a lesson for WhatsApp, email or the system share sheet:
 * object · subject, the question with its right answer, the surprising fact and the Curiocity brand.
 * Offline content has no question or fact (nothing true is known about the object): just the heading.
 */
export function buildShareText({ objectName, subjectName, content, t }) {
  const parts = [`${objectName} · ${subjectName}`];
  const q = content.pregunta_inicial;
  if (q) parts.push(`${q.pregunta}\n→ ${q.opciones[q.correcta]}`);
  if (content.dato_sorprendente) parts.push(content.dato_sorprendente);
  parts.push(`${t.shareIntro} ${APP_URL}`.trim());
  return parts.join('\n\n');
}

export function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** The system share sheet exists (most phones; few desktop browsers). */
export const canShareNatively = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Opens the system share sheet, with the photo when the browser can attach files.
 * It is the only way to share the photo: WhatsApp and email links can only carry text.
 * Returns 'shared' | 'shared-text' | 'cancelled' | 'unsupported'.
 */
export async function nativeShare({ title, text, imageDataUrl }) {
  if (!canShareNatively()) return 'unsupported';
  try {
    if (imageDataUrl && navigator.canShare) {
      const files = [dataUrlToFile(imageDataUrl, 'curiocity.jpg')];
      if (navigator.canShare({ files })) {
        await navigator.share({ title, text, files });
        return 'shared';
      }
    }
    await navigator.share({ title, text });
    return 'shared-text';
  } catch (err) {
    return err && err.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

export const mailtoUrl = (subject, body) =>
  `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const whatsappUrl = text => `https://wa.me/?text=${encodeURIComponent(text)}`;
