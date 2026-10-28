#!/usr/bin/env node
// Checks every generated brand asset against store and platform rules:
// dimensions, format, byte limits, alpha present/absent, sRGB, white-only
// silhouettes and safe zones. Also checks the resolved Expo config and,
// when ios/ or android/ exist (after `npx expo prebuild`), the native files.
// Prints a table and exits 1 on any FAIL. Run with `npm run assets:verify`.
//
//   --release   missing store screenshots fail instead of showing PENDING

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import {
  BRAND, ROOT, SCREENSHOT_SETS, SPECS, STORE_DIR, WEB_PUBLIC_DIR, r, specPath,
} from './assets.config.mjs';

const RELEASE = process.argv.includes('--release');
const rows = [];
const add = (file, size, bytes, status, note = '') => rows.push({ file, size, bytes, status, note });

async function inspect(file) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { meta, data, info };
}

// Returns a list of problems for one raster image.
async function checkRaster(file, spec) {
  const problems = [];
  const { meta, data, info } = await inspect(file);
  if (spec.format && meta.format !== spec.format) problems.push(`format ${meta.format}, want ${spec.format}`);
  if (spec.w && (meta.width !== spec.w || meta.height !== spec.h)) problems.push(`size ${meta.width}x${meta.height}, want ${spec.w}x${spec.h}`);
  if (meta.space !== 'srgb') problems.push(`colour space ${meta.space}, want srgb`);
  if (meta.icc) {
    const desc = (await sharp(file).metadata()).icc.toString('latin1');
    if (!/srgb/i.test(desc)) problems.push('embedded ICC profile is not sRGB');
  }

  const px = info.width * info.height;
  let transparent = 0;
  let nonWhite = 0;
  for (let i = 0; i < px; i++) {
    const a = data[i * 4 + 3];
    if (a < 255) transparent++;
    if (spec.white && a > 0 && (data[i * 4] < 250 || data[i * 4 + 1] < 250 || data[i * 4 + 2] < 250)) nonWhite++;
  }
  if (spec.alpha === 'none' && meta.hasAlpha) problems.push('has an alpha channel (must be opaque RGB)');
  if (spec.alpha === 'opaque') {
    if (meta.channels !== 4) problems.push(`${meta.channels * 8}-bit, want 32-bit RGBA`);
    if (transparent) problems.push(`${transparent} transparent pixels (must be fully opaque)`);
  }
  if (spec.alpha === 'required') {
    if (!meta.hasAlpha) problems.push('no alpha channel (must be transparent)');
    else if (!transparent) problems.push('alpha channel present but nothing is transparent');
  }
  if (spec.white && nonWhite) problems.push(`${nonWhite} non-white visible pixels (must be white only)`);

  // Safe zone: visible artwork must sit inside a centred circle.
  if (spec.safeRadius) {
    const cx = (info.width - 1) / 2;
    const cy = (info.height - 1) / 2;
    const limit = spec.safeRadius * Math.min(info.width, info.height) + 1;
    let worst = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        // Near-black counts as background: some files (maskable icon,
        // Expo's Android splash logo) are flattened onto the black brand bg.
        const visible = data[i + 3] > 48 && Math.max(data[i], data[i + 1], data[i + 2]) > 12;
        if (visible) worst = Math.max(worst, Math.hypot(x - cx, y - cy));
      }
    }
    if (worst > limit) problems.push(`artwork reaches ${(worst / Math.min(info.width, info.height) * 200).toFixed(1)}% diameter, safe zone ${(spec.safeRadius * 200).toFixed(0)}%`);
  }
  return { problems, size: `${meta.width}x${meta.height}` };
}

function checkIco(file, spec) {
  const buf = fs.readFileSync(file);
  const problems = [];
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return { problems: ['not an ICO file'], size: '?' };
  const count = buf.readUInt16LE(4);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    sizes.push(buf.readUInt8(o) || 256);
    const len = buf.readUInt32LE(o + 8);
    const off = buf.readUInt32LE(o + 12);
    if (off + len > buf.length) problems.push(`entry ${i} truncated`);
  }
  const want = spec.icoSizes.join(',');
  if ([...sizes].sort((a, b) => a - b).join(',') !== want) problems.push(`sizes ${sizes.join(',')}, want ${want}`);
  return { problems, size: sizes.map((s) => `${s}`).join('/') };
}

async function checkSvg(file, spec) {
  const text = fs.readFileSync(file, 'utf8');
  const problems = [];
  if (!/^<svg[\s>]/.test(text.trim())) problems.push('does not start with <svg>');
  if (!/viewBox=/.test(text)) problems.push('no viewBox');
  try { await sharp(Buffer.from(text)).png().toBuffer(); } catch (e) { problems.push(`does not render: ${e.message}`); }
  if (spec.singleColor) {
    const fills = new Set([...text.matchAll(/fill="([^"]+)"/g)].map((m) => m[1].toLowerCase()).filter((f) => f !== 'none'));
    if (fills.size !== 1) problems.push(`${fills.size} fill colours, want exactly 1`);
    if (/<image/.test(text)) problems.push('embeds a raster image (must be pure vector)');
  }
  return { problems, size: 'vector' };
}

async function checkManifest(file) {
  const problems = [];
  let m;
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { problems: ['invalid JSON'], size: '-' }; }
  if (m.short_name !== BRAND.name) problems.push(`short_name "${m.short_name}"`);
  if (!m.name) problems.push('missing name');
  if (m.display !== 'standalone') problems.push(`display "${m.display}"`);
  for (const k of ['theme_color', 'background_color']) if ((m[k] || '').toUpperCase() !== BRAND.black) problems.push(`${k} ${m[k]}`);
  for (const icon of m.icons || []) {
    const p = path.join(WEB_PUBLIC_DIR, icon.src.replace(/^\//, ''));
    if (!fs.existsSync(p)) { problems.push(`icon ${icon.src} missing`); continue; }
    const { width, height } = await sharp(p).metadata();
    if (`${width}x${height}` !== icon.sizes) problems.push(`icon ${icon.src} is ${width}x${height}, manifest says ${icon.sizes}`);
  }
  if (!(m.icons || []).some((i) => i.purpose === 'maskable')) problems.push('no maskable icon');
  return { problems, size: `${(m.icons || []).length} icons` };
}

async function checkSpec(spec) {
  const file = specPath(spec);
  const label = spec.group === 'web' ? `web/${spec.file}` : spec.file;
  if (spec.group === 'web' && !fs.existsSync(path.dirname(WEB_PUBLIC_DIR))) {
    add(label, '-', '-', 'SKIP', `website not found at ${path.dirname(WEB_PUBLIC_DIR)}`);
    return;
  }
  if (!fs.existsSync(file)) { add(label, '-', '-', 'FAIL', 'missing (run npm run assets)'); return; }
  const bytes = fs.statSync(file).size;
  let res;
  if (spec.format === 'ico') res = checkIco(file, spec);
  else if (spec.format === 'svg') res = await checkSvg(file, spec);
  else if (spec.format === 'manifest') res = await checkManifest(file);
  else res = await checkRaster(file, spec);
  if (spec.maxBytes && bytes > spec.maxBytes) res.problems.push(`${bytes} bytes > limit ${spec.maxBytes}`);
  add(label, res.size, bytes, res.problems.length ? 'FAIL' : 'PASS', res.problems.join('; '));
}

async function checkScreenshots() {
  for (const set of SCREENSHOT_SETS) {
    const dir = path.join(STORE_DIR, set.dir);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort() : [];
    const label = `assets/store/${set.dir}/`;
    if (!files.length) {
      add(label, `${set.width}x${set.height}`, '-', RELEASE ? 'FAIL' : 'PENDING', 'no screenshots yet: add raws to assets/store/raw/');
      continue;
    }
    const countOk = files.length >= set.min && files.length <= set.max;
    add(label, `${files.length} files`, '-', countOk ? 'PASS' : 'FAIL', countOk ? '' : `need ${set.min}-${set.max}`);
    for (const f of files) {
      const p = path.join(dir, f);
      const res = await checkRaster(p, { w: set.width, h: set.height, alpha: 'none' });
      const bytes = fs.statSync(p).size;
      if (bytes > set.maxBytes) res.problems.push(`${bytes} bytes > ${set.maxBytes}`);
      add(`${label}${f}`, res.size, bytes, res.problems.length ? 'FAIL' : 'PASS', res.problems.join('; '));
    }
  }
}

// ----------------------------------------------------- resolved Expo config

function checkExpoConfig() {
  let cfg;
  try {
    const out = execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    cfg = JSON.parse(out);
  } catch (e) {
    add('expo config', '-', '-', 'FAIL', `could not resolve: ${e.message.split('\n')[0]}`);
    return;
  }
  const problems = [];
  const expect = (cond, msg) => { if (!cond) problems.push(msg); };
  const plugin = (name) => (cfg.plugins || []).find((p) => (Array.isArray(p) ? p[0] : p) === name);
  const opts = (name) => (Array.isArray(plugin(name)) ? plugin(name)[1] : {}) || {};
  const black = (c) => (c || '').toUpperCase() === BRAND.black;

  expect(cfg.icon === './assets/images/icon.png', `icon is ${cfg.icon}`);
  const ai = cfg.android?.adaptiveIcon || {};
  expect(ai.foregroundImage === './assets/images/adaptive-icon-foreground.png', `adaptiveIcon.foregroundImage is ${ai.foregroundImage}`);
  expect(ai.monochromeImage === './assets/images/adaptive-icon-monochrome.png', `adaptiveIcon.monochromeImage is ${ai.monochromeImage}`);
  expect(black(ai.backgroundColor), `adaptiveIcon.backgroundColor is ${ai.backgroundColor}`);
  const iosIcon = cfg.ios?.icon;
  if (iosIcon) expect(typeof iosIcon === 'object' && iosIcon.light === './assets/images/icon.png', 'ios.icon.light is not icon.png');
  const splash = opts('expo-splash-screen');
  expect(splash.image === './assets/images/splash-icon.png', `expo-splash-screen image is ${splash.image}`);
  expect(black(splash.backgroundColor), `expo-splash-screen backgroundColor is ${splash.backgroundColor}`);
  const notif = opts('expo-notifications');
  expect(notif.icon === './assets/images/notification-icon.png', `expo-notifications icon is ${notif.icon}`);
  expect((notif.color || '').toUpperCase() === BRAND.orange, `expo-notifications color is ${notif.color}`);
  expect(cfg.web?.favicon === './assets/images/favicon.png', `web.favicon is ${cfg.web?.favicon}`);
  for (const p of [cfg.icon, ai.foregroundImage, ai.monochromeImage, splash.image, notif.icon, cfg.web?.favicon]) {
    if (p && !fs.existsSync(r(p))) problems.push(`${p} does not exist`);
  }
  add('expo config (resolved)', '-', '-', problems.length ? 'FAIL' : 'PASS', problems.join('; '));
}

// --------------------------------------------- native output (post-prebuild)

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function checkNativeImage(label, file, w, opts = {}) {
  if (!file) { add(label, '-', '-', 'FAIL', 'missing'); return; }
  const res = await checkRaster(file, { w, h: w, ...opts });
  add(label, res.size, fs.statSync(file).size, res.problems.length ? 'FAIL' : 'PASS', res.problems.join('; '));
}

const firstExisting = (base) => ['.png', '.webp'].map((e) => base + e).find((p) => fs.existsSync(p));

async function checkAndroid() {
  const res = r('android/app/src/main/res');
  if (!fs.existsSync(res)) return;
  for (const [d, k] of Object.entries(DENSITIES)) {
    const dir = path.join(res, `mipmap-${d}`);
    await checkNativeImage(`android mipmap-${d}/ic_launcher`, firstExisting(path.join(dir, 'ic_launcher')), 48 * k);
    await checkNativeImage(`android mipmap-${d}/ic_launcher_round`, firstExisting(path.join(dir, 'ic_launcher_round')), 48 * k);
    await checkNativeImage(`android mipmap-${d}/ic_launcher_foreground`, firstExisting(path.join(dir, 'ic_launcher_foreground')), 108 * k, { alpha: 'required' });
    await checkNativeImage(`android mipmap-${d}/ic_launcher_monochrome`, firstExisting(path.join(dir, 'ic_launcher_monochrome')), 108 * k, { alpha: 'required', white: true });
    await checkNativeImage(`android drawable-${d}/notification_icon`, firstExisting(path.join(res, `drawable-${d}`, 'notification_icon')), 24 * k, { alpha: 'required', white: true });
    // Android 12+ splash: 288dp icon area, only the centre 192dp circle shows.
    await checkNativeImage(`android drawable-${d}/splashscreen_logo`, firstExisting(path.join(res, `drawable-${d}`, 'splashscreen_logo')), 288 * k, { alpha: 'required', safeRadius: 192 / 288 / 2 });
  }

  const xml = path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml');
  const adaptive = fs.existsSync(xml) ? fs.readFileSync(xml, 'utf8') : '';
  const aProblems = [];
  if (!adaptive) aProblems.push('missing');
  else for (const tag of ['background', 'foreground', 'monochrome']) if (!adaptive.includes(`<${tag}`)) aProblems.push(`no <${tag}> layer`);
  add('android mipmap-anydpi-v26/ic_launcher.xml', '-', '-', aProblems.length ? 'FAIL' : 'PASS', aProblems.join('; '));

  const manifest = fs.readFileSync(r('android/app/src/main/AndroidManifest.xml'), 'utf8');
  const colors = fs.readFileSync(path.join(res, 'values/colors.xml'), 'utf8');
  const mProblems = [];
  if (!/com\.google\.firebase\.messaging\.default_notification_icon"\s+android:resource="@drawable\/notification_icon"/.test(manifest)) mProblems.push('default_notification_icon not set');
  if (!/com\.google\.firebase\.messaging\.default_notification_color"\s+android:resource="@color\/notification_icon_color"/.test(manifest)) mProblems.push('default_notification_color not set');
  const notifColor = colors.match(/name="notification_icon_color">(#[0-9A-Fa-f]+)</)?.[1] || '';
  if (notifColor.toUpperCase() !== BRAND.orange) mProblems.push(`notification_icon_color ${notifColor}`);
  const iconBg = colors.match(/name="iconBackground">(#[0-9A-Fa-f]+)</)?.[1] || '';
  if (iconBg.toUpperCase() !== BRAND.black) mProblems.push(`iconBackground ${iconBg}`);
  const splashBg = colors.match(/name="splashscreen_background">(#[0-9A-Fa-f]+)</)?.[1] || '';
  if (splashBg.toUpperCase() !== BRAND.black) mProblems.push(`splashscreen_background ${splashBg}`);
  add('android manifest + colors', '-', '-', mProblems.length ? 'FAIL' : 'PASS', mProblems.join('; '));
}

async function checkIos() {
  const iosDir = r('ios');
  if (!fs.existsSync(iosDir)) return;
  const appDir = fs.readdirSync(iosDir).map((d) => path.join(iosDir, d, 'Images.xcassets/AppIcon.appiconset')).find((p) => fs.existsSync(p));
  if (!appDir) { add('ios AppIcon.appiconset', '-', '-', 'FAIL', 'not found'); return; }
  const contents = JSON.parse(fs.readFileSync(path.join(appDir, 'Contents.json'), 'utf8'));
  const universal = contents.images.filter((i) => i.idiom === 'universal' && i.size === '1024x1024');
  const light = universal.find((i) => !i.appearances);
  add('ios AppIcon Contents.json', `${contents.images.length} entries`, '-', light ? 'PASS' : 'FAIL',
    light ? `single 1024 universal${universal.length > 1 ? ` + ${universal.length - 1} appearance variant(s)` : ''}` : 'no 1024x1024 universal image');
  for (const img of universal) {
    const p = path.join(appDir, img.filename);
    const appearance = img.appearances?.[0]?.value || 'light';
    const alpha = appearance === 'dark' ? 'required' : 'none';
    await checkNativeImage(`ios AppIcon ${appearance}`, fs.existsSync(p) ? p : null, 1024, { alpha });
  }
  const storyboard = fs.readdirSync(iosDir).map((d) => path.join(iosDir, d, 'SplashScreen.storyboard')).find((p) => fs.existsSync(p));
  const sbProblems = [];
  if (!storyboard) sbProblems.push('SplashScreen.storyboard not found');
  else if (!fs.readFileSync(storyboard, 'utf8').includes('SplashScreenLogo')) sbProblems.push('no SplashScreenLogo image');
  add('ios launch screen', '-', '-', sbProblems.length ? 'FAIL' : 'PASS', sbProblems.join('; '));
}

// --------------------------------------------------------------------- main

function printTable() {
  const head = ['File', 'Px', 'Bytes', 'Result', 'Notes'];
  const data = rows.map((x) => [x.file, x.size, String(x.bytes), x.status, x.note]);
  const widths = head.map((h, i) => Math.min(i === 4 ? 80 : 70, Math.max(h.length, ...data.map((d) => d[i].length))));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(head));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const d of data) console.log(line(d));
}

async function main() {
  for (const spec of SPECS) await checkSpec(spec);
  await checkScreenshots();
  checkExpoConfig();
  await checkAndroid();
  await checkIos();
  printTable();
  const fails = rows.filter((x) => x.status === 'FAIL').length;
  const pending = rows.filter((x) => x.status === 'PENDING').length;
  console.log(`\n${rows.length} checks: ${rows.length - fails - pending} pass, ${fails} fail${pending ? `, ${pending} pending` : ''}.`);
  if (!fs.existsSync(r('android')) && !fs.existsSync(r('ios'))) console.log('Native output not checked (run `npx expo prebuild` first).');
  process.exit(fails ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
