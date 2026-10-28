#!/usr/bin/env node
// Regenerates every HunterX brand asset (app icons, splash, notification
// icon, store listing art, website icons and social images) from the master
// logo in assets/source/. Run with `npm run assets`. See ASSETS.md.
//
//   node scripts/generate-assets.mjs                  regenerate everything
//   node scripts/generate-assets.mjs --extract-master rebuild assets/source/logo.png
//                                                     from app_logo.png + splash cutouts
//
// The logo is only ever scaled uniformly and placed on black: never
// stretched, recoloured or redrawn. Silhouettes (monochrome, notification,
// Safari pinned tab) are the logo's own alpha mask filled with one colour.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import opentype from 'opentype.js';
import potrace from 'potrace';
import {
  BRAND, CAPTIONS, FONTS, IMAGES_DIR, PREVIEW, RAW_SCREENSHOTS_DIR, ROOT, SCREENSHOT_SETS,
  SOURCE_DIR, STORE_DIR, WEB_PUBLIC_DIR, r,
} from './assets.config.mjs';

const MASTER_SVG = path.join(SOURCE_DIR, 'logo.svg');
const MASTER_PNG = path.join(SOURCE_DIR, 'logo.png');
const MASTER_WORK_SIZE = 2048; // raster size an SVG master is rendered at

const PNG_OPTS = { compressionLevel: 9, adaptiveFiltering: true };
const warnings = [];
const written = [];
const warn = (msg) => { warnings.push(msg); console.warn(`  ! ${msg}`); };

// ---------------------------------------------------------------- helpers

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

async function save(pipeline, file) {
  ensureDir(path.dirname(file));
  await pipeline.png(PNG_OPTS).toFile(file);
  written.push(file);
}

function writeText(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text);
  written.push(file);
}

const rgbOf = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const blank = (w, h, hex, alpha = 1) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { ...rgbOf(hex), alpha } } });

// Flatten onto black and drop the alpha channel: 24-bit sRGB, no alpha.
const opaque = (buf, bg = BRAND.black) =>
  sharp(buf).flatten({ background: bg }).removeAlpha().toColourspace('srgb');

// ----------------------------------------------------------------- master

async function extractMaster() {
  // app_logo.png is the full logo (mark on a glass tile, 1024px, no alpha).
  // The splash animation's stroke + sword cutouts are the same art cut off
  // the tile at 768px. Their union, scaled back to 1024, is used as a mask
  // over the original pixels so the master keeps full 1024 detail.
  const images = r('assets/images');
  const union = await blank(768, 768, '#000000', 0)
    .composite([
      { input: path.join(images, 'splash/logo_stroke.png') },
      { input: path.join(images, 'splash/logo_sword.png') },
    ])
    .png()
    .toBuffer();
  const mask = await sharp(union).resize(1024, 1024, { kernel: 'lanczos3' }).png().toBuffer();
  ensureDir(SOURCE_DIR);
  await sharp(path.join(images, 'app_logo.png'))
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png(PNG_OPTS)
    .toFile(MASTER_PNG);
  console.log(`Wrote ${path.relative(ROOT, MASTER_PNG)}`);
}

async function loadMaster() {
  let input;
  if (fs.existsSync(MASTER_SVG)) {
    input = await sharp(MASTER_SVG, { density: 600 })
      .resize(MASTER_WORK_SIZE, MASTER_WORK_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    console.log(`Master: ${path.relative(ROOT, MASTER_SVG)} (vector, rendered at ${MASTER_WORK_SIZE}px)`);
  } else if (fs.existsSync(MASTER_PNG)) {
    input = fs.readFileSync(MASTER_PNG);
    const { width, height } = await sharp(input).metadata();
    console.log(`Master: ${path.relative(ROOT, MASTER_PNG)} (raster, ${width}x${height})`);
    if (Math.max(width, height) < 2048) {
      warn(`Master is a ${width}px raster (no SVG, nothing >= 2048px exists). Outputs are capped at this detail; nothing is upscaled without a warning below.`);
    }
  } else {
    throw new Error('No master logo. Add assets/source/logo.svg or logo.png, or run with --extract-master.');
  }

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  // Bounding box of anything visible, then the mark is cropped to it.
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('Master logo is fully transparent.');
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const color = await sharp(data, { raw: info }).extract({ left: x0, top: y0, width: bw, height: bh }).png().toBuffer();

  // Farthest visible pixel from the box centre, for circular safe zones.
  const cx = (bw - 1) / 2;
  const cy = (bh - 1) / 2;
  let maxDist = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (data[((y + y0) * W + (x + x0)) * 4 + 3] > 48) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > maxDist) maxDist = d;
      }
    }
  }

  const silhouette = await buildSilhouette(data, W, x0, y0, bw, bh);
  console.log(`Mark: ${bw}x${bh}px, radial extent ${maxDist.toFixed(0)}px`);
  return { color, silhouette, bw, bh, maxDist };
}

// One-colour silhouette taken from the logo's own pixels: everything opaque
// and lighter than the logo's dark outline. Keeping the outlines as gaps
// keeps the sword readable against the X. Thin glow slivers and specks are
// removed, then it is filled white. Anti-aliasing comes back when it is
// scaled down.
const SILHOUETTE_MIN_LUMA = 45;

async function buildSilhouette(data, W, x0, y0, bw, bh) {
  const bin = Buffer.alloc(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = ((y + y0) * W + (x + x0)) * 4;
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      bin[y * bw + x] = data[i + 3] >= 128 && luma > SILHOUETTE_MIN_LUMA ? 255 : 0;
    }
  }
  // Morphological opening (erode, then dilate) via blur + threshold.
  const opened = await sharp(bin, { raw: { width: bw, height: bh, channels: 1 } })
    .blur(3.5).threshold(205).blur(3.5).threshold(40)
    .extractChannel(0).raw().toBuffer();
  if (opened.length !== bw * bh) throw new Error('silhouette mask has unexpected channel count');
  const solid = new Uint8Array(bw * bh);
  for (let i = 0; i < solid.length; i++) solid[i] = opened[i] ? 1 : 0;
  // Drop connected specks smaller than 0.5% of the mark's area.
  const label = new Int32Array(bw * bh).fill(-1);
  const sizes = [];
  const stack = [];
  for (let i = 0; i < solid.length; i++) {
    if (!solid[i] || label[i] !== -1) continue;
    const id = sizes.length;
    let count = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      count++;
      const px = p % bw, py = (p / bw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const q = ny * bw + nx;
        if (solid[q] && label[q] === -1) { label[q] = id; stack.push(q); }
      }
    }
    sizes.push(count);
  }
  const total = sizes.reduce((a, b) => a + b, 0);
  const out = Buffer.alloc(bw * bh * 4);
  for (let i = 0; i < solid.length; i++) {
    const keep = solid[i] && sizes[label[i]] >= total * 0.005;
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 255;
    out[i * 4 + 3] = keep ? 255 : 0;
  }
  return sharp(out, { raw: { width: bw, height: bh, channels: 4 } }).png().toBuffer();
}

// Uniformly scale the mark and centre it on a W x H transparent canvas.
//   fit.box    : longest side as a fraction of min(W, H)
//   fit.radius : farthest pixel within this fraction of min(W, H) from centre
//   fit.height : mark height in px
async function placeMark(mark, W, H, fit, { variant = 'color', cx = W / 2, cy = H / 2, label = '' } = {}) {
  const side = Math.min(W, H);
  let scale;
  if (fit.box) scale = (fit.box * side) / Math.max(mark.bw, mark.bh);
  else if (fit.radius) scale = (fit.radius * side) / mark.maxDist;
  else scale = fit.height / mark.bh;
  if (scale > 1.001) warn(`${label || `${W}x${H}`}: mark upscaled ${scale.toFixed(2)}x from master`);

  const w = Math.max(1, Math.round(mark.bw * scale));
  const h = Math.max(1, Math.round(mark.bh * scale));
  let src = variant === 'white' ? mark.silhouette : mark.color;
  let img = sharp(src).resize(w, h, { kernel: 'lanczos3' });
  if (variant === 'gray') {
    // Tinted iOS icon: luminance of the logo, re-attached to its own alpha.
    const alpha = await sharp(src).resize(w, h, { kernel: 'lanczos3' }).extractChannel(3).toBuffer();
    img = sharp(await img.removeAlpha().grayscale().toColourspace('srgb').toBuffer()).joinChannel(alpha);
  }
  const buf = await img.png().toBuffer();
  return blank(W, H, '#000000', 0)
    .composite([{ input: buf, left: Math.round(cx - w / 2), top: Math.round(cy - h / 2) }])
    .png()
    .toBuffer();
}

// --------------------------------------------------------------- text/svg

const fontCache = {};
const font = (key) => (fontCache[key] ??= opentype.loadSync(FONTS[key]));

// Text as SVG paths so output does not depend on installed system fonts.
function textPath(fontKey, text, x, baseline, size, fill) {
  const d = font(fontKey).getPath(text, x, baseline, size).toPathData(2);
  return `<path d="${d}" fill="${fill}"/>`;
}
const textWidth = (fontKey, text, size) => font(fontKey).getAdvanceWidth(text, size);

// "HunterX" with the X in brand orange, matching the website wordmark.
// Per-glyph paths keep the font's kerning between "r" and "X".
function wordmark(x, baseline, size) {
  const glyphs = font('black').getPaths(BRAND.name, x, baseline, size);
  return glyphs.map((g, i) =>
    `<path d="${g.toPathData(2)}" fill="${i === glyphs.length - 1 ? BRAND.orange : BRAND.white}"/>`).join('');
}
const wordmarkWidth = (size) => textWidth('black', 'HunterX', size);

function svg(W, H, body, defs = '') {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`);
}

// Black backdrop with an orange glow, used by every marketing image.
function backdrop(W, H, { glowX = 0.82, glowY = 0.12, glowR = 0.75 } = {}) {
  const defs = `<radialGradient id="glow" cx="${glowX}" cy="${glowY}" r="${glowR}">
      <stop offset="0" stop-color="${BRAND.orange}" stop-opacity="0.34"/>
      <stop offset="0.55" stop-color="${BRAND.orange}" stop-opacity="0.06"/>
      <stop offset="1" stop-color="${BRAND.orange}" stop-opacity="0"/>
    </radialGradient>`;
  return { defs, body: `<rect width="${W}" height="${H}" fill="${BRAND.black}"/><rect width="${W}" height="${H}" fill="url(#glow)"/>` };
}

// ------------------------------------------------------------- app icons

async function appIcons(mark) {
  console.log('\nApp icons (assets/images)');
  const S = 1024;

  // iOS / App Store icon: opaque, square (iOS applies its own mask).
  const iconMark = await placeMark(mark, S, S, { box: 0.7 }, { label: 'icon.png' });
  const icon = await opaque(iconMark).toBuffer();
  await save(sharp(icon), path.join(IMAGES_DIR, 'icon.png'));

  // iOS 18 dark and tinted appearances.
  await save(sharp(iconMark), path.join(IMAGES_DIR, 'icon-dark.png'));
  const tinted = await placeMark(mark, S, S, { box: 0.7 }, { variant: 'gray', label: 'icon-tinted.png' });
  await save(opaque(tinted), path.join(IMAGES_DIR, 'icon-tinted.png'));

  // Android adaptive layers: artwork inside the centre 66% circle.
  await save(sharp(await placeMark(mark, S, S, { radius: 0.33 }, { label: 'adaptive foreground' })),
    path.join(IMAGES_DIR, 'adaptive-icon-foreground.png'));
  await save(sharp(await placeMark(mark, S, S, { radius: 0.33 }, { variant: 'white', label: 'adaptive monochrome' })),
    path.join(IMAGES_DIR, 'adaptive-icon-monochrome.png'));

  // Splash: Android 12+ crops the icon to a 192dp circle of a 288dp area.
  await save(sharp(await placeMark(mark, S, S, { radius: 192 / 288 / 2 }, { label: 'splash-icon' })),
    path.join(IMAGES_DIR, 'splash-icon.png'));

  // Notification small icon: white on transparent, 22dp live area of 24dp.
  await save(sharp(await placeMark(mark, 96, 96, { box: 22 / 24 }, { variant: 'white' })),
    path.join(IMAGES_DIR, 'notification-icon.png'));

  // Expo web favicon.
  await save(sharp(await faviconTile(mark, 48)), path.join(IMAGES_DIR, 'favicon.png'));
  return { icon };
}

// Small browser icon: rounded black tile, mark nearly edge to edge so it
// still reads at 16px.
async function faviconTile(mark, size) {
  const rx = Math.round(size * 0.2);
  const tile = svg(size, size, `<rect width="${size}" height="${size}" rx="${rx}" fill="${BRAND.black}"/>`);
  const m = await placeMark(mark, size, size, { box: 0.86 });
  return sharp(tile).composite([{ input: m }]).png().toBuffer();
}

// ---------------------------------------------------------- social cards

// Logo left, wordmark + tagline right, orange rule along the bottom.
async function socialCard(mark, W, H, { url } = {}) {
  const { defs, body } = backdrop(W, H);
  const markH = Math.round(H * 0.62);
  const gap = Math.round(H * 0.07);
  const wmSize = Math.round(H * 0.2);
  const tagSize = Math.round(H * 0.064);
  const markW = Math.round(mark.bw * (markH / mark.bh));
  const textW = Math.max(wordmarkWidth(wmSize), textWidth('medium', BRAND.tagline, tagSize));
  const left = Math.round((W - (markW + gap + textW)) / 2);
  const textX = left + markW + gap;
  const mid = H / 2;
  let text = wordmark(textX, mid + wmSize * 0.12, wmSize)
    + textPath('medium', BRAND.tagline, textX, mid + wmSize * 0.12 + tagSize * 1.9, tagSize, BRAND.muted);
  if (url) text += textPath('bold', url, textX, mid + wmSize * 0.12 + tagSize * 3.6, tagSize * 0.8, BRAND.orange);
  const rule = `<rect y="${H - Math.round(H * 0.018)}" width="${W}" height="${Math.round(H * 0.018)}" fill="${BRAND.orange}"/>`;
  const placed = await placeMark(mark, W, H, { height: markH }, { cx: left + markW / 2, cy: mid, label: `${W}x${H} card` });
  const base = await sharp(svg(W, H, body + rule + text, defs)).png().toBuffer();
  return opaque(await sharp(base).composite([{ input: placed }]).png().toBuffer());
}

// ------------------------------------------------------------ store art

async function storeAssets(mark, icon) {
  console.log('\nStore listing (assets/store)');
  await save(sharp(icon), path.join(STORE_DIR, 'apple/app-store-icon-1024.png'));
  // Play wants a 32-bit PNG: RGBA, but every pixel opaque, not pre-rounded.
  await save(sharp(icon).resize(512, 512, { kernel: 'lanczos3' }).ensureAlpha(1),
    path.join(STORE_DIR, 'google/play-icon-512.png'));
  await save(await socialCard(mark, 1024, 500), path.join(STORE_DIR, 'google/feature-graphic-1024x500.png'));
  await screenshots();
}

function wrapWords(text, fontKey, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(fontKey, next, size) > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Caption line with the highlighted words in orange.
function captionLine(line, highlight, x, baseline, size) {
  const hl = new Set((highlight || '').toLowerCase().split(/\s+/).filter(Boolean));
  let out = '';
  let cursor = x;
  const words = line.split(' ');
  words.forEach((word, i) => {
    const bare = word.toLowerCase().replace(/[^a-z0-9']/g, '');
    out += textPath('black', word, cursor, baseline, size, hl.has(bare) ? BRAND.orange : BRAND.white);
    cursor += textWidth('black', word + (i < words.length - 1 ? ' ' : ''), size);
  });
  return out;
}

async function frameScreenshot(rawFile, W, H, caption) {
  const raw = sharp(rawFile).rotate();
  const { width: rw, height: rh } = await raw.metadata();
  const pad = Math.round(W * 0.07);
  const capSize = Math.round(W * 0.075);
  const lines = caption?.title ? wrapWords(caption.title, 'black', capSize, W - pad * 2) : [];
  const capTop = Math.round(H * 0.06);
  const capBlock = lines.length ? capTop + lines.length * capSize * 1.18 + H * 0.045 : H * 0.06;

  // Device sized to the screenshot's own aspect ratio: no stretching.
  const bezel = Math.round(W * 0.022);
  const availH = H - capBlock - H * 0.04;
  const availW = W - pad * 2;
  let screenW = availW - bezel * 2;
  let screenH = screenW * (rh / rw);
  if (screenH + bezel * 2 > availH) { screenH = availH - bezel * 2; screenW = screenH * (rw / rh); }
  screenW = Math.round(screenW); screenH = Math.round(screenH);
  const devW = screenW + bezel * 2;
  const devH = screenH + bezel * 2;
  const devX = Math.round((W - devW) / 2);
  const devY = Math.round(capBlock);
  const devR = Math.round(devW * 0.11);
  const scrR = Math.max(0, devR - bezel);

  const { defs, body } = backdrop(W, H, { glowX: 0.5, glowY: 0.62, glowR: 0.55 });
  const capSvg = lines.map((l, i) => {
    const lw = textWidth('black', l, capSize);
    return captionLine(l, caption.highlight, (W - lw) / 2, capTop + capSize * (i + 0.9) * 1.18, capSize);
  }).join('');
  const device = `<rect x="${devX}" y="${devY}" width="${devW}" height="${devH}" rx="${devR}" fill="#0A0A0A" stroke="${BRAND.white}" stroke-opacity="0.22" stroke-width="${Math.max(2, Math.round(W * 0.003))}"/>`
    + `<rect x="${devX - 2}" y="${devY - 2}" width="${devW + 4}" height="${devH + 4}" rx="${devR + 2}" fill="none" stroke="${BRAND.orange}" stroke-opacity="0.55" stroke-width="2"/>`;
  const base = await sharp(svg(W, H, body + device + capSvg, defs)).png().toBuffer();

  const mask = svg(screenW, screenH, `<rect width="${screenW}" height="${screenH}" rx="${scrR}" fill="#fff"/>`);
  const screen = await raw.resize(screenW, screenH, { fit: 'fill', kernel: 'lanczos3' }) // same aspect, so fill == contain
    .ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return opaque(await sharp(base).composite([{ input: screen, left: devX + bezel, top: devY + bezel }]).png().toBuffer());
}

async function screenshots() {
  ensureDir(RAW_SCREENSHOTS_DIR);
  const raws = fs.readdirSync(RAW_SCREENSHOTS_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  const captions = fs.existsSync(CAPTIONS) ? JSON.parse(fs.readFileSync(CAPTIONS, 'utf8')) : {};
  for (const set of SCREENSHOT_SETS) {
    const dir = path.join(STORE_DIR, set.dir);
    ensureDir(dir);
    // Clear stale frames so removed raws do not linger in the upload set.
    for (const f of fs.readdirSync(dir)) if (/\.png$/i.test(f)) fs.rmSync(path.join(dir, f));
  }
  if (!raws.length) {
    warn('No raw screenshots in assets/store/raw/: store screenshots not generated (see assets/store/raw/README.md).');
    return;
  }
  for (const set of SCREENSHOT_SETS) {
    if (raws.length < set.min) warn(`${set.dir}: ${raws.length} raw screenshot(s), store needs at least ${set.min}.`);
    for (const [i, file] of raws.slice(0, set.max).entries()) {
      // Raws are already numbered (01-home.png); prefix only when they aren't.
      const base = file.replace(/\.(png|jpe?g)$/i, '');
      const name = `${/^\d+-/.test(base) ? base : `${String(i + 1).padStart(2, '0')}-${base}`}.png`;
      const out = await frameScreenshot(path.join(RAW_SCREENSHOTS_DIR, file), set.width, set.height, captions[file]);
      await save(out, path.join(STORE_DIR, set.dir, name));
    }
    if (raws.length > set.max) warn(`${set.dir}: only the first ${set.max} raw screenshots are used.`);
  }
}

// --------------------------------------------------------------- website

function ico(entries) {
  // ICO container holding PNG images (supported by every current browser).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(png.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

const traceSvg = (buf, opts) => new Promise((resolve, reject) =>
  potrace.trace(buf, opts, (err, out) => (err ? reject(err) : resolve(out))));

async function webAssets(mark, icon) {
  if (!fs.existsSync(path.dirname(WEB_PUBLIC_DIR))) {
    warn(`Website project not found at ${path.dirname(WEB_PUBLIC_DIR)}: web assets skipped (set WEB_PUBLIC_DIR).`);
    return;
  }
  console.log(`\nWebsite (${path.relative(ROOT, WEB_PUBLIC_DIR)})`);
  const out = (f) => path.join(WEB_PUBLIC_DIR, f);

  const fav = {};
  for (const s of [16, 32, 48]) fav[s] = await sharp(await faviconTile(mark, s)).png(PNG_OPTS).toBuffer();
  ensureDir(WEB_PUBLIC_DIR);
  fs.writeFileSync(out('favicon.ico'), ico([16, 32, 48].map((size) => ({ size, png: fav[size] }))));
  written.push(out('favicon.ico'));
  await save(sharp(fav[16]), out('favicon-16x16.png'));
  await save(sharp(fav[32]), out('favicon-32x32.png'));

  // icon.svg: the raster logo can't be honestly vectorised, so the SVG
  // embeds it on the same rounded black tile.
  const svgMark = await sharp(await placeMark(mark, 192, 192, { box: 0.86 })).png(PNG_OPTS).toBuffer();
  writeText(out('icon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 192 192">`
    + `<rect width="192" height="192" rx="38" fill="${BRAND.black}"/>`
    + `<image width="192" height="192" href="data:image/png;base64,${svgMark.toString('base64')}"/></svg>\n`);

  await save(sharp(icon).resize(180, 180, { kernel: 'lanczos3' }), out('apple-touch-icon.png'));
  await save(sharp(icon).resize(192, 192, { kernel: 'lanczos3' }), out('android-chrome-192x192.png'));
  await save(sharp(icon).resize(512, 512, { kernel: 'lanczos3' }), out('android-chrome-512x512.png'));
  await save(opaque(await placeMark(mark, 512, 512, { radius: 0.4 }, { label: 'maskable' })), out('maskable-512x512.png'));

  // Safari pinned tab: traced from the logo's own silhouette, one colour.
  // potrace traces dark shapes, so feed it the inverted alpha mask.
  const alphaMask = await sharp(await placeMark(mark, 512, 512, { box: 0.9 }, { variant: 'white' }))
    .extractChannel(3).negate().png().toBuffer();
  let pinned = await traceSvg(alphaMask, { color: '#000000', background: 'transparent', threshold: 128, turdSize: 20, optTolerance: 0.4 });
  pinned = pinned
    .replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">')
    .replace(/\s+stroke="none"/g, '');
  writeText(out('safari-pinned-tab.svg'), `${pinned.trim()}\n`);

  writeText(out('site.webmanifest'), `${JSON.stringify({
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: BRAND.black,
    background_color: BRAND.black,
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2)}\n`);

  await save(await socialCard(mark, 1200, 630, { url: 'hunterx.co.in' }), out('og-image.png'));
  await save(await socialCard(mark, 1200, 600, { url: 'hunterx.co.in' }), out('twitter-image.png'));
}

// --------------------------------------------------------------- preview

function previewHtml() {
  const rel = (p) => path.relative(path.dirname(PREVIEW), p).split(path.sep).join('/');
  const img = (f) => rel(path.join(IMAGES_DIR, f));
  const web = (f) => rel(path.join(WEB_PUBLIC_DIR, f));
  const store = (f) => rel(path.join(STORE_DIR, f));
  const o = BRAND.orange;
  // Android launchers show the centre 72dp of the 108dp adaptive layers,
  // so the layer is drawn at 150% and clipped to each launcher shape.
  const adaptive = (shape, label) => `<figure><div class="adaptive ${shape}"><img src="${img('adaptive-icon-foreground.png')}"></div><figcaption>${label}</figcaption></figure>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HunterX icon preview</title>
<style>
  :root { color-scheme: dark; --o: ${o}; }
  body { margin: 0; padding: 32px 16px 64px; background: #0b0b0c; color: #eee; font: 14px/1.4 -apple-system, system-ui, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 22px; } h2 { font-size: 15px; color: var(--o); margin: 36px 0 12px; text-transform: uppercase; letter-spacing: .06em; }
  .row { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-end; }
  figure { margin: 0; text-align: center; } figcaption { margin-top: 8px; color: #999; font-size: 12px; }
  .ios { width: 120px; height: 120px; border-radius: 26.5px; overflow: hidden; }
  .ios img, .sq img { width: 100%; height: 100%; display: block; }
  .sq { width: 120px; height: 120px; outline: 1px dashed #444; }
  .adaptive { width: 120px; height: 120px; overflow: hidden; position: relative; background: ${BRAND.black}; box-shadow: 0 0 0 1px #333; }
  .adaptive img { position: absolute; width: 150%; height: 150%; left: -25%; top: -25%; }
  .circle { border-radius: 50%; } .rounded { border-radius: 16%; } .square { border-radius: 0; }
  .squircle { border-radius: 0; clip-path: path('M60 0C14 0 0 14 0 60s14 60 60 60 60-14 60-60S106 0 60 0Z'); }
  .safe { position: relative; } .safe::after { content: ''; position: absolute; inset: 20px; border-radius: 50%; outline: 1px dashed var(--o); }
  .themed { width: 120px; height: 120px; border-radius: 50%; background: #d7e3ff; position: relative; overflow: hidden; }
  .themed.dark { background: #1f2a3d; }
  .themed i { position: absolute; inset: -25%; background: #1b3a66; -webkit-mask: url(${img('adaptive-icon-monochrome.png')}) center/contain no-repeat; mask: url(${img('adaptive-icon-monochrome.png')}) center/contain no-repeat; }
  .themed.dark i { background: #b8ccff; }
  .thumb img { display: block; border-radius: 22.5%; }
  .bar { width: 320px; height: 32px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 8px; font-weight: 600; }
  .bar.light { background: #f2f2f2; color: #111; } .bar.dark { background: #111; color: #fff; border: 1px solid #333; }
  .bar i { width: 24px; height: 24px; background: currentColor; -webkit-mask: url(${img('notification-icon.png')}) center/contain no-repeat; mask: url(${img('notification-icon.png')}) center/contain no-repeat; }
  .shade { width: 360px; padding: 12px 14px; border-radius: 16px; background: #1d1d20; display: flex; gap: 12px; align-items: center; }
  .shade .badge { width: 32px; height: 32px; border-radius: 50%; background: var(--o); display: grid; place-items: center; }
  .shade .badge i { width: 20px; height: 20px; background: #fff; -webkit-mask: url(${img('notification-icon.png')}) center/contain no-repeat; mask: url(${img('notification-icon.png')}) center/contain no-repeat; }
  .wide img { max-width: 100%; height: auto; border: 1px solid #222; }
</style></head><body><main>
<h1>HunterX icon preview</h1>
<p>Generated by <code>npm run assets</code>. Check that nothing important is cropped in any shape.</p>

<h2>iOS</h2>
<div class="row">
  <figure><div class="ios"><img src="${img('icon.png')}"></div><figcaption>iOS rounded square</figcaption></figure>
  <figure><div class="ios"><img src="${img('icon-dark.png')}" style="background:#1c1c1e"></div><figcaption>iOS dark</figcaption></figure>
  <figure><div class="ios"><img src="${img('icon-tinted.png')}"></div><figcaption>iOS tinted (source)</figcaption></figure>
  <figure><div class="sq"><img src="${img('icon.png')}"></div><figcaption>Square (App Store file)</figcaption></figure>
  <figure class="thumb"><img src="${img('icon.png')}" width="60" height="60"><figcaption>60px</figcaption></figure>
  <figure class="thumb"><img src="${img('icon.png')}" width="29" height="29"><figcaption>29px</figcaption></figure>
</div>

<h2>Android adaptive icon</h2>
<div class="row">
  ${adaptive('circle', 'Circle')}
  ${adaptive('squircle', 'Squircle')}
  ${adaptive('rounded', 'Rounded square')}
  ${adaptive('square', 'Square')}
  <figure><div class="adaptive circle safe"><img src="${img('adaptive-icon-foreground.png')}"></div><figcaption>66% safe zone</figcaption></figure>
  <figure><div class="themed"><i></i></div><figcaption>Themed (light)</figcaption></figure>
  <figure><div class="themed dark"><i></i></div><figcaption>Themed (dark)</figcaption></figure>
</div>

<h2>Splash (Android 12+ 192dp circle)</h2>
<div class="row">
  <figure><div class="adaptive circle" style="width:192px;height:192px"><img src="${img('splash-icon.png')}"></div><figcaption>Android 12+ crop</figcaption></figure>
  <figure><div class="sq" style="width:200px;height:200px;background:#000"><img src="${img('splash-icon.png')}"></div><figcaption>iOS, 200px wide on black</figcaption></figure>
</div>

<h2>Notification icon</h2>
<div class="row">
  <figure><div class="bar light"><i></i>9:41</div><figcaption>Light status bar</figcaption></figure>
  <figure><div class="bar dark"><i></i>9:41</div><figcaption>Dark status bar</figcaption></figure>
  <figure><div class="shade"><span class="badge"><i></i></span><span>HunterX · Your streak is on the line</span></div><figcaption>Shade (accent colour)</figcaption></figure>
</div>

<h2>Web</h2>
<div class="row">
  <figure class="thumb"><img src="${web('favicon-16x16.png')}" width="16" height="16" style="border-radius:0"><figcaption>16px</figcaption></figure>
  <figure class="thumb"><img src="${web('favicon-32x32.png')}" width="32" height="32" style="border-radius:0"><figcaption>32px</figcaption></figure>
  <figure class="thumb"><img src="${web('apple-touch-icon.png')}" width="90" height="90"><figcaption>apple-touch-icon</figcaption></figure>
  <figure><div class="adaptive circle" style="background:none"><img src="${web('maskable-512x512.png')}" style="width:125%;height:125%;left:-12.5%;top:-12.5%"></div><figcaption>Maskable (80% circle)</figcaption></figure>
  <figure><img src="${web('safari-pinned-tab.svg')}" width="64" height="64" style="background:#fff;border-radius:8px;padding:6px"><figcaption>Safari pinned tab</figcaption></figure>
</div>
<div class="row wide" style="margin-top:24px">
  <figure><img src="${web('og-image.png')}" width="600"><figcaption>og-image 1200x630</figcaption></figure>
  <figure><img src="${store('google/feature-graphic-1024x500.png')}" width="512"><figcaption>Play feature graphic 1024x500</figcaption></figure>
</div>
</main></body></html>
`;
}

// ------------------------------------------------------------------- main

async function main() {
  if (process.argv.includes('--extract-master')) {
    await extractMaster();
    return;
  }
  const mark = await loadMaster();
  const { icon } = await appIcons(mark);
  await storeAssets(mark, icon);
  await webAssets(mark, icon);
  writeText(PREVIEW, previewHtml());

  console.log(`\nWrote ${written.length} files.`);
  for (const f of written) console.log(`  ${path.relative(ROOT, f)}`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log('\nNext: npm run assets:verify');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
