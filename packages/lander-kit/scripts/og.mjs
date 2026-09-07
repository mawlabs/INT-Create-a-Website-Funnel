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

const CHARCOAL = '#36393E';
const SUNSET = '#E76F51';
const WARMTH = '#F4A261';
const BG = '#FBF4EA'; // Paper (Menu du jour)

const fontBuf = readFileSync(join(kitRoot, 'assets', 'Satoshi-Black.ttf'));
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));
const boldBuf = readFileSync(join(kitRoot, 'assets', 'Satoshi-Bold.ttf'));
const bold = opentype.parse(boldBuf.buffer.slice(boldBuf.byteOffset, boldBuf.byteOffset + boldBuf.byteLength));
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

/**
 * Lay a line out glyph by glyph (opentype.js's own `letterSpacing` option yields NaN coordinates in v2),
 * with kerning and tracking as a fraction of the size. Returns SVG path markup and the advance.
 */
/** Transform a glyph's raw commands (font units) ourselves: opentype.js 2.0's getPath/toSVG emit NaN at some offsets. */
function glyphPathD(g, cx, cy, scale) {
  const fx = (v) => (cx + v * scale).toFixed(2);
  const fy = (v) => (cy - v * scale).toFixed(2);
  let d = '';
  for (const c of g.path.commands) {
    if (c.type === 'M') d += `M${fx(c.x)} ${fy(c.y)}`;
    else if (c.type === 'L') d += `L${fx(c.x)} ${fy(c.y)}`;
    else if (c.type === 'Q') d += `Q${fx(c.x1)} ${fy(c.y1)} ${fx(c.x)} ${fy(c.y)}`;
    else if (c.type === 'C') d += `C${fx(c.x1)} ${fy(c.y1)} ${fx(c.x2)} ${fy(c.y2)} ${fx(c.x)} ${fy(c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  if (/NaN/.test(d)) throw new Error(`og: glyph "${g.name}" has a non-finite coordinate`);
  return d;
}

function lineToSvg(face, text, x, y, size, color, tracking = 0) {
  const scale = size / face.unitsPerEm;
  const glyphs = face.stringToGlyphs(text);
  let cx = x;
  let out = '';
  glyphs.forEach((g, i) => {
    const d = glyphPathD(g, cx, y, scale);
    if (d) out += `<path d="${d}" fill="${color}"/>`;
    cx += (g.advanceWidth ?? 0) * scale;
    if (i < glyphs.length - 1) cx += face.getKerningValue(g, glyphs[i + 1]) * scale;
    cx += tracking * size;
  });
  return { svg: out, width: cx - x };
}

function measure(face, text, size, tracking = 0) {
  return lineToSvg(face, text, 0, 0, size, '#000', tracking).width;
}

function wrapFace(face, text, size, maxWidth, tracking) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (measure(face, test, size, tracking) > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function textPaths(text, x, y, size, maxWidth, color, lineHeight = 1.08, letterSpacing = 0, face = font) {
  const lines = wrapFace(face, text, size, maxWidth, letterSpacing);
  let out = '';
  let lastWidth = 0;
  lines.forEach((l, i) => {
    const r = lineToSvg(face, l, x, y + i * size * lineHeight, size, color, letterSpacing);
    out += r.svg;
    lastWidth = r.width;
  });
  return { svg: out, height: lines.length * size * lineHeight, lines: lines.length, lastWidth };
}

/** The C mark as SVG: charcoal square, "c" in Satoshi Black, Sunset dot. */
function markSvg(x, y, size, inverted = false) {
  const sq = inverted ? BG : CHARCOAL;
  const ink = inverted ? CHARCOAL : BG;
  const g = font.charToGlyph('c');
  const gs = (size * 0.45) / font.unitsPerEm;
  const bb = g.getBoundingBox();
  const cx = x + size / 2 - ((bb.x1 + bb.x2) / 2) * gs;
  const cy = y + size / 2 + ((bb.y1 + bb.y2) / 2) * gs;
  const glyph = `<path d="${glyphPathD(g, cx, cy, gs)}" fill="${ink}"/>`;
  const dot = size * 0.14;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${sq}"/>${glyph}<circle cx="${x + size + dot * 0.6 + dot / 2}" cy="${y + size - dot / 2 - size * 0.08}" r="${dot / 2}" fill="${SUNSET}"/>`;
}

async function ogImage({ h1, domain, outFile }) {
  const W = 1200, H = 630, PAD = 80;
  // H1 in Satoshi Black, at most 3 lines; the final period becomes the Sunset dot
  const text = h1.replace(/\.$/, '');
  let size = 76;
  let title;
  for (;;) {
    title = textPaths(text, PAD, 300, size, W - PAD * 2 - 40, CHARCOAL, 1.05, -0.025);
    if (title.lines <= 3 || size <= 48) break;
    size -= 4;
  }
  const lastY = 300 + (title.lines - 1) * size * 1.05;
  const period = lineToSvg(font, '.', PAD + title.lastWidth, lastY, size, SUNSET);
  const domainText = textPaths(domain, PAD + 56, H - PAD + 6, 26, W - PAD * 2, CHARCOAL, 1, 0, bold);
  const wmData = `data:image/png;base64,${wordmarkPng.toString('base64')}`;
  const wmW = 150;
  const wmH = Math.round((wordmarkMeta.height / wordmarkMeta.width) * wmW);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <circle cx="${W - 60}" cy="40" r="170" fill="${WARMTH}" opacity="0.28"/>
  ${markSvg(PAD, PAD, 64)}
  <rect x="${PAD}" y="${PAD + 64 + 3}" width="${64}" height="4" fill="${WARMTH}"/>
  ${title.svg}
  ${period.svg}
  ${markSvg(PAD, H - PAD - 34, 40)}
  ${domainText.svg}
  <rect x="${W - PAD - wmW - 16}" y="${H - PAD - wmH - 2}" width="${wmW + 16}" height="${wmH + 12}" fill="#F7FBFE"/>
  <image x="${W - PAD - wmW - 8}" y="${H - PAD - wmH + 4}" width="${wmW}" height="${wmH}" xlink:href="${wmData}"/>
</svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(outFile);
}

/** Favicon set: the C mark on paper. */
function iconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="${BG}"/>${markSvg(8, 12, 68)}</svg>`;
}
async function favicons() {
  writeFileSync(join(publicDir, 'favicon.svg'), iconSvg(100));
  await sharp(Buffer.from(iconSvg(96))).resize(48, 48).png().toFile(join(publicDir, 'favicon.png'));
  await sharp(Buffer.from(iconSvg(360))).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png'));
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
