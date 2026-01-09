/**
 * Simple icon generator using sharp.
 * Reads public/curiocity-logo.svg and generates PNG icons in public/icons/
 * Usage: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsInput = path.join(__dirname, '..', 'public', 'curiocity-icon.svg');
const splashInput = path.join(__dirname, '..', 'public', 'curiocity-logo.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 256, 512, 1024];
(async () => {
  try {
    for (const size of sizes) {
      const out = path.join(outDir, `icon-${size}x${size}.png`);
      await sharp(iconsInput)
        .resize(size, size, { fit: 'contain', background: { r: 250, g: 235, b: 217, alpha: 1 } })
        .png({ quality: 90 })
        .toFile(out);
      console.log('Written', out);
    }

    // Create an apple-touch-icon (180)
    const appleOut = path.join(outDir, `apple-touch-icon.png`);
    await sharp(iconsInput).resize(180, 180, { fit: 'contain', background: { r: 250, g: 235, b: 217, alpha: 1 } }).png().toFile(appleOut);
    console.log('Written', appleOut);

    // Create a large splash placeholder (2048x2732) using the full logo
    const splashOut = path.join(outDir, `splash-2048x2732.png`);
    await sharp(splashInput).resize(2048, 2048, { fit: 'contain', background: { r: 250, g: 235, b: 217, alpha: 1 } }).extend({ top: 364, bottom: 364, background: { r: 250, g: 235, b: 217, alpha: 1 } }).png().toFile(splashOut);
    console.log('Written', splashOut);

    console.log('All icons generated.');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
})();