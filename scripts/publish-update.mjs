#!/usr/bin/env node
// Publishes an over-the-air (EAS Update) JS update to the builds of one
// eas.json build profile.
//
//   npm run update:testflight -- "Fix streak copy"
//   npm run update:production -- "Fix streak copy"
//   node scripts/publish-update.mjs <profile> "<message>" [--allow-dirty] [--dry-run]
//
// --dry-run does everything except the upload (bundle check only).
//
// Why not plain `eas update`? EXPO_PUBLIC_* values are baked into the JS
// bundle, and `eas update` on a laptop would take them from the local .env
// (often a localhost/LAN API) instead of the profile the store build used.
// That would point every installed app at the wrong backend. So this script:
//   1. resolves the profile's channel, EAS environment and env from eas.json
//      (following "extends"), exactly like `eas build` does;
//   2. turns .env loading off (EXPO_NO_DOTENV) and drops EXPO_PUBLIC_* from
//      the shell, so only the profile + EAS environment values are used;
//   3. exports the bundle and checks it contains the profile's API URL and no
//      localhost/LAN address;
//   4. uploads that exact bundle to the profile's channel.
//
// Only builds whose runtime fingerprint matches get the update: anything that
// changes native code (new native package, plugin or app.json native config)
// needs a new store build instead. `eas update` prints the runtime version;
// compare it with the build's on expo.dev if in doubt.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'dist');
const EAS = ['--yes', 'eas-cli@27'];
// Must be set for every build that can receive an update.
const REQUIRED_PUBLIC_VARS = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB',
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS',
];

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const allowDirty = args.includes('--allow-dirty');
const dryRun = args.includes('--dry-run');
const [profileName, message] = args.filter((a) => !a.startsWith('--'));
if (!profileName || !message) {
  fail('Usage: node scripts/publish-update.mjs <profile> "<message>" [--allow-dirty] [--dry-run]');
}

// --- 1. Resolve the build profile -----------------------------------------
const easJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
function resolveProfile(name, seen = new Set()) {
  const profile = easJson.build?.[name];
  if (!profile) fail(`No build profile "${name}" in eas.json.`);
  if (seen.has(name)) fail(`Circular "extends" in eas.json at "${name}".`);
  seen.add(name);
  const base = profile.extends ? resolveProfile(profile.extends, seen) : {};
  return { ...base, ...profile, env: { ...base.env, ...profile.env } };
}
const profile = resolveProfile(profileName);
const { channel, environment } = profile;
if (!channel) fail(`Build profile "${profileName}" has no "channel" in eas.json.`);
if (!environment) fail(`Build profile "${profileName}" has no "environment" in eas.json.`);

// --- Clean git tree: an update should be reproducible from a commit --------
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
if (dirty && !allowDirty && !dryRun) {
  fail('Uncommitted changes. Commit first, or pass --allow-dirty to ship them anyway.');
}

// --- 2. Environment for every child process --------------------------------
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_PUBLIC_'))
);
Object.assign(childEnv, profile.env, { EXPO_NO_DOTENV: '1' });

function run(cmd, cmdArgs, { capture = false } = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    env: childEnv,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(`${cmd} ${cmdArgs.join(' ')} failed.`);
  return result.stdout;
}

// Profile env (eas.json) + EAS environment variables, as the build saw them.
const easVarNames = run(
  'npx',
  [...EAS, 'env:list', '--environment', environment, '--format', 'short'],
  { capture: true }
)
  .split('\n')
  .map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1])
  .filter(Boolean);
const missing = REQUIRED_PUBLIC_VARS.filter(
  (name) => !profile.env[name] && !easVarNames.includes(name)
);
if (missing.length) {
  fail(
    `Not set for profile "${profileName}" (eas.json env or EAS "${environment}" environment): ` +
      `${missing.join(', ')}.\nThe store build has the same gap — fix it there first.`
  );
}

const apiUrl = profile.env.EXPO_PUBLIC_API_URL;
console.log(`\nProfile:     ${profileName}`);
console.log(`Channel:     ${channel}`);
console.log(`Environment: ${environment}`);
console.log(`API URL:     ${apiUrl ?? '(from EAS environment)'}`);
console.log(`Message:     ${message}\n`);

// --- 3. Export and check the bundle ----------------------------------------
fs.rmSync(OUT_DIR, { recursive: true, force: true });
run('npx', [
  ...EAS,
  'env:exec',
  environment,
  'npx expo export --output-dir dist --platform ios --platform android',
  '--non-interactive',
]);

const bundles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(hbc|js)$/.test(entry.name)) bundles.push(file);
  }
})(path.join(OUT_DIR, '_expo'));
if (!bundles.length) fail('Export produced no bundles.');

// API URLs that must not leak in: every EXPO_PUBLIC_API_URL in the local .env
// (commented-out ones too) other than this profile's. Bare "localhost" isn't
// checked — libraries ship strings like expo-router's http://localhost:8081/.
const envFile = path.join(ROOT, '.env');
const foreignApiUrls = fs.existsSync(envFile)
  ? [...fs.readFileSync(envFile, 'utf8').matchAll(/EXPO_PUBLIC_API_URL=(\S+)/g)]
      .map((m) => m[1])
      .filter((url) => url !== apiUrl)
  : [];
const LAN_URL = /https?:\/\/(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+(?:\.\d+)?[:/]/;

for (const file of bundles) {
  const contents = fs.readFileSync(file).toString('latin1');
  const rel = path.relative(ROOT, file);
  if (apiUrl && !contents.includes(apiUrl)) fail(`${rel} doesn't contain ${apiUrl}.`);
  const leaked = foreignApiUrls.find((url) => contents.includes(url));
  if (leaked) fail(`${rel} contains ${leaked} (from .env). Refusing to publish.`);
  const lan = contents.match(LAN_URL);
  if (lan && !apiUrl?.startsWith(lan[0])) {
    fail(`${rel} contains a LAN address (${lan[0]}). Refusing to publish.`);
  }
}
console.log(`\n✓ Checked ${bundles.length} bundle(s)\n`);
if (dryRun) {
  console.log('Dry run: nothing uploaded.\n');
  process.exit(0);
}

// --- 4. Upload that exact bundle -------------------------------------------
run('npx', [
  ...EAS,
  'update',
  '--channel',
  channel,
  '--environment',
  environment,
  '--message',
  message,
  '--skip-bundler',
  '--input-dir',
  'dist',
  '--non-interactive',
]);

// Readable stack traces for this update in Sentry (optional).
if (childEnv.SENTRY_AUTH_TOKEN) {
  run('npx', ['sentry-expo-upload-sourcemaps', 'dist']);
} else {
  console.log(
    '\nSentry source maps not uploaded (no SENTRY_AUTH_TOKEN in this shell). ' +
      'Errors from this update will show minified stack traces.'
  );
}

console.log(`\n✓ Published to "${channel}". Users get it on the next app launch after it downloads.\n`);
