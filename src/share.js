// Public URL included in shared messages. Defaults to wherever the app is running.
export const APP_URL = import.meta.env.VITE_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '');

/** Plain-text summary of a lesson for WhatsApp, email or the native share sheet. */
export function buildShareText(heading, content, t, { withAttachHint = false } = {}) {
  const parts = [`${t.shareIntro} ${APP_URL}`, heading];
  const q = content.pregunta_inicial;
  if (q) parts.push(`${q.pregunta}\n→ ${q.opciones[q.correcta]}`);
  if (content.dato_sorprendente) parts.push(content.dato_sorprendente);
  if (content.por_que) parts.push(content.por_que);
  if (content.reto) parts.push(`${t.challenge}: ${content.reto}`);
  if (content.para_seguir_pensando) parts.push(`${t.keepThinking}: ${content.para_seguir_pensando}`);
  if (withAttachHint) parts.push(t.shareAttachHint);
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

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Tries the native share sheet (with photo when supported).
 * Returns 'shared' | 'shared-text' | 'cancelled' | 'unsupported'.
 */
export async function nativeShare({ title, text, imageDataUrl }) {
  if (!navigator.share) return 'unsupported';
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
