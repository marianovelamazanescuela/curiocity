/**
 * App icon generator (sharp).
 * Reads public/curiocity-icon.svg (the "eyes" of the logo) and writes the PNG icons to public/icons/.
 * Usage: npm run generate-icons
 *
 * Every icon is a fully opaque cream square (#faebd9) with the eyes centred, so that:
 * - Android can crop it into a circle or a rounded square without cutting the eyes;
 * - the black eyes are visible on a dark wallpaper, and iOS has no transparency to fill with black.
 *
 * Eyes width, as a share of the icon width:
 * - normal icons ("any"), apple-touch-icon and 1024: 60 % (20 % margin on each side);
 * - favicons (16, 32, 48): 80 % (10 % margin), with a slightly thicker line so it does not vanish;
 * - maskable icons (192, 512): 50 %, inside the safe zone (the central circle, 80 % of the width).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconSvgPath = path.join(__dirname, '..', 'public', 'curiocity-icon.svg');
const splashInput = path.join(__dirname, '..', 'public', 'curiocity-logo.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const CREAM = { r: 250, g: 235, b: 217 };
const INK = '#1d1d1b';
const SVG_W = 46.91; // viewBox of curiocity-icon.svg
const SVG_H = 35.64;

const NORMAL = 0.6;
const FAVICON = 0.8;
const MASKABLE = 0.5;
// Extra outline (in SVG units) for the favicons: the logo line is ~1.5 units wide, which would be
// ~0.4 px at 16 px. The extra outline makes it about 1 px at 16 px and 1.4 px at 32 px.
const FAVICON_EXTRA_STROKE = { 16: 2.0, 32: 1.1, 48: 0.6 };

const iconSvg = fs.readFileSync(iconSvgPath, 'utf8');

/** The eyes SVG, optionally with an extra ink outline (and a viewBox widened by half of it). */
function eyesSvg(extraStroke = 0) {
  if (!extraStroke) return Buffer.from(iconSvg);
  const pad = extraStroke / 2;
  return Buffer.from(
    iconSvg
      .replace(/viewBox="[^"]*"/, `viewBox="${-pad} ${-pad} ${SVG_W + extraStroke} ${SVG_H + extraStroke}"`)
      .replace(/fill: #1d1d1b;/, `fill: ${INK}; stroke: ${INK}; stroke-width: ${extraStroke}px; stroke-linejoin: round;`)
  );
}

/** One square PNG: cream background everywhere, eyes `fraction` of the width, centred, no alpha. */
async function makeIcon(size, fraction, out, extraStroke = 0) {
  const width = Math.round(size * fraction);
  const svgWidth = SVG_W + extraStroke;
  // Render the SVG sharply at (at least) twice the target size, then scale down.
  const density = Math.min(Math.ceil((72 * width * 2) / svgWidth), 5000);
  const eyes = await sharp(eyesSvg(extraStroke), { density }).resize({ width }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: CREAM } })
    .composite([{ input: eyes, gravity: 'center' }])
    .flatten({ background: CREAM })
    .removeAlpha()
    .png()
    .toFile(out);
  console.log('Written', path.relative(process.cwd(), out));
}

(async () => {
  try {
    for (const size of [16, 32, 48]) {
      await makeIcon(size, FAVICON, path.join(outDir, `icon-${size}x${size}.png`), FAVICON_EXTRA_STROKE[size]);
    }
    for (const size of [72, 96, 128, 144, 152, 180, 192, 256, 512, 1024]) {
      await makeIcon(size, NORMAL, path.join(outDir, `icon-${size}x${size}.png`));
    }
    await makeIcon(180, NORMAL, path.join(outDir, 'apple-touch-icon.png'));
    for (const size of [192, 512]) {
      await makeIcon(size, MASKABLE, path.join(outDir, `icon-maskable-${size}x${size}.png`));
    }

    // Splash (unchanged): the full logo on cream, 2048x2732.
    const splashOut = path.join(outDir, 'splash-2048x2732.png');
    if (process.argv.includes('--splash')) {
      await sharp(splashInput)
        .resize(2048, 2048, { fit: 'contain', background: { ...CREAM, alpha: 1 } })
        .extend({ top: 342, bottom: 342, background: { ...CREAM, alpha: 1 } })
        .png()
        .toFile(splashOut);
      console.log('Written', path.relative(process.cwd(), splashOut));
    }

    console.log('All icons generated.');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
})();
