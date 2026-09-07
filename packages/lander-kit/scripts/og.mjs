/**
 * Build-time generation of OG images (brief §8.7) and the favicon set, from the site's own copy and the kit's
 * brand assets. Run from a site directory: `node ../../packages/lander-kit/scripts/og.mjs`.
 * Text is converted to SVG paths with opentype.js, so no system font configuration is needed.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const kitRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = process.cwd();
const publicDir = join(siteRoot, 'public');
mkdirSync(publicDir, { recursive: true });

const POWER_BLUE = '#264653';
const SUNSET = '#E76F51';
const BG = '#F7FBFE';

const fontBuf = readFileSync(join(kitRoot, 'assets', 'Satoshi-Bold.ttf'));
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));
const wordmarkPng = readFileSync(join(kitRoot, 'assets', 'maw-wordmark-dark.png'));
const wordmarkMeta = await sharp(wordmarkPng).metadata();

function wrap(text, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.getAdvanceWidth(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textPaths(text, x, y, size, maxWidth, color, lineHeight = 1.08, letterSpacing = 0) {
  const lines = wrap(text, size, maxWidth);
  let out = '';
  lines.forEach((l, i) => {
    const p = font.getPath(l, x, y + i * size * lineHeight, size, { letterSpacing });
    p.fill = color;
    out += p.toSVG(2);
  });
  return { svg: out, height: lines.length * size * lineHeight };
}

async function ogImage({ h1, domain, outFile }) {
  const W = 1200, H = 630, PAD = 80;
  const wmW = 300;
  const wmH = Math.round((wordmarkMeta.height / wordmarkMeta.width) * wmW);
  const wmData = `data:image/png;base64,${wordmarkPng.toString('base64')}`;
  // fit the H1: shrink until it takes at most 3 lines
  let size = 72;
  let title;
  for (;;) {
    title = textPaths(h1, PAD, 330, size, W - PAD * 2, POWER_BLUE, 1.08, -0.01);
    if (title.height <= size * 1.08 * 3 + 1 || size <= 48) break;
    size -= 4;
  }
  const domainText = textPaths(domain, PAD, H - PAD + 10, 30, W - PAD * 2, POWER_BLUE);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <image x="${PAD - 20}" y="${PAD - 30}" width="${wmW}" height="${wmH}" xlink:href="${wmData}"/>
  <rect x="${PAD}" y="${PAD + wmH - 10}" width="${W - PAD * 2}" height="4" fill="${SUNSET}"/>
  ${title.svg}
  ${domainText.svg}
</svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(outFile);
}

/** Icon mark traced from the brand PNG: two right triangles. */
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 946 946">
  <path fill="${SUNSET}" d="M290 75h363L290 400zM290 532v338h363z"/>
</svg>`;

async function favicons() {
  writeFileSync(join(publicDir, 'favicon.svg'), ICON_SVG.replace('<svg ', '<svg width="946" height="946" '));
  await sharp(Buffer.from(ICON_SVG)).resize(48, 48).png().toFile(join(publicDir, 'favicon.png'));
  const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 946 946"><rect width="946" height="946" fill="${BG}"/><path fill="${SUNSET}" d="M290 75h363L290 400zM290 532v338h363z"/></svg>`;
  await sharp(Buffer.from(touch)).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png'));
}

const domain = JSON.parse(readFileSync(join(siteRoot, 'package.json'), 'utf8')).name.replace(/-ca$/, '.ca');
for (const locale of ['en', 'fr']) {
  const file = join(siteRoot, 'src', 'i18n', `${locale}.json`);
  if (!existsSync(file)) continue;
  const copy = JSON.parse(readFileSync(file, 'utf8'));
  const h1 = copy?.home?.hero?.h1 ?? copy?.siteName ?? domain;
  await ogImage({ h1, domain: copy?.siteName ?? domain, outFile: join(publicDir, `og-${locale}.png`) });
  console.log(`og: wrote public/og-${locale}.png`);
}
await favicons();
console.log('og: wrote favicon.svg, favicon.png, apple-touch-icon.png');
