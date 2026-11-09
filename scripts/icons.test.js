// @vitest-environment node
// The app icons (scripts/generate-icons.js): opaque everywhere, right size, and listed in the manifest.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

const ICONS = join(__dirname, '..', 'public', 'icons');
const pngs = readdirSync(ICONS).filter(f => f.endsWith('.png') && !f.startsWith('splash'));
const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'manifest.json'), 'utf8'));

describe('app icons', () => {
  it.each(pngs)('%s has no transparent pixel and the cream background in its corners', async file => {
    const img = sharp(join(ICONS, file));
    const { width, height, channels } = await img.metadata();
    expect(width).toBe(height);
    const match = file.match(/(\d+)x\d+/);
    if (match) expect(width).toBe(Number(match[1]));
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) throw new Error(`${file}: transparent pixel at ${(i - 3) / 4}`);
    }
    expect(channels).toBe(3); // no alpha channel at all
    const corner = [...data.subarray(0, 3)];
    expect(corner).toEqual([250, 235, 217]); // #faebd9
    expect(info.width).toBe(width);
  });

  it('the manifest lists the "any" icons and, as separate entries, the maskable ones', () => {
    const maskable = manifest.icons.filter(i => i.purpose === 'maskable').map(i => i.src);
    expect(maskable).toEqual(['icons/icon-maskable-192x192.png', 'icons/icon-maskable-512x512.png']);
    expect(manifest.icons.some(i => /any/.test(i.purpose || '') && /maskable/.test(i.purpose || ''))).toBe(false);
    for (const icon of manifest.icons) expect(pngs).toContain(icon.src.replace('icons/', ''));
  });

  it('the maskable icons keep the eyes inside the safe zone (central circle, 80 % of the width)', async () => {
    for (const size of [192, 512]) {
      const { data } = await sharp(join(ICONS, `icon-maskable-${size}x${size}.png`)).raw().toBuffer({ resolveWithObject: true });
      const r = (size * 0.8) / 2;
      const c = size / 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 3;
          const ink = data[i] < 200; // darker than the cream background
          if (ink && Math.hypot(x + 0.5 - c, y + 0.5 - c) > r) throw new Error(`ink outside the safe zone at ${x},${y} (${size})`);
        }
      }
    }
  });
});
