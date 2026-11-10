// Objects found in a photo: [{ name, x, y, size }], with positions from 0 to 1 over the square photo
// (x, y: centre; size: largest side as a fraction of the photo's width). At most 4, never people.

export const MAX_OBJECTS = 4;

const clamp01 = v => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0.5);
const round = v => Math.round(v * 1000) / 1000;

/**
 * COCO-SSD predictions ({ class, score, bbox: [x, y, width, height] } in pixels) → objects.
 * Uses the real boxes: people out, one entry per class (the biggest), biggest first, at most 4.
 * person is true when there were people and nothing else to offer.
 */
export function objectsFromCoco(predictions, width, height = width) {
  const byClass = new Map();
  let sawPerson = false;
  for (const p of predictions || []) {
    if (!p || !Array.isArray(p.bbox)) continue;
    if (p.class === 'person') {
      sawPerson = true;
      continue;
    }
    const [bx, by, bw, bh] = p.bbox;
    const area = bw * bh;
    const prev = byClass.get(p.class);
    if (prev && prev.area >= area) continue;
    byClass.set(p.class, {
      area,
      object: {
        name: p.class,
        x: round(clamp01((bx + bw / 2) / width)),
        y: round(clamp01((by + bh / 2) / height)),
        size: round(clamp01(Math.max(bw, bh) / width))
      }
    });
  }
  const objects = [...byClass.values()].sort((a, b) => b.area - a.area).slice(0, MAX_OBJECTS).map(e => e.object);
  return { objects, person: objects.length === 0 && sawPerson };
}

/** The server's answer → objects (also accepts the old single `object` answer). */
export function objectsFromServer(data) {
  if (!data) return { objects: [], person: false };
  if (data.person === true) return { objects: [], person: true };
  const list = Array.isArray(data.objects) ? data.objects : [];
  const objects = list
    .filter(o => o && typeof o.name === 'string' && o.name.trim())
    .slice(0, MAX_OBJECTS)
    .map(o => ({ name: o.name.trim(), x: clamp01(o.x), y: clamp01(o.y), size: clamp01(o.size) }));
  if (!objects.length && typeof data.object === 'string' && data.object.trim()) {
    objects.push({ name: data.object.trim(), x: 0.5, y: 0.5, size: 0.5 });
  }
  return { objects, person: false };
}

// Ring diameter over the photo, as a fraction of its width (same as the CSS: clamp(52px, size * 85%, 70%)).
export const ringFraction = size => Math.min(Math.max(size * 0.85, 0.15), 0.7);

/**
 * True when two rings overlap a lot (centres closer than 60 % of the sum of their radii), as in a
 * crowded fruit bowl. Then the rings and their names would get in each other's way, so the chooser
 * shows only the photo and the buttons.
 */
export function ringsOverlap(objects) {
  const rings = objects.map(o => ({ x: o.x, y: o.y, r: ringFraction(o.size) / 2 }));
  return rings.some((a, i) => rings.slice(i + 1).some(b => Math.hypot(a.x - b.x, a.y - b.y) < 0.6 * (a.r + b.r)));
}
