#!/usr/bin/env node
// scripts/generate-licenses.js — `npm run licenses`
//
// Builds assets/licenses.json for Profile → Acknowledgements from the
// installed *production* dependencies (and everything they pull in):
// [{ name, version, license, repository, text }], sorted by name, one entry
// per package (the highest installed version), without this app itself.
//
// Runs on EAS after `npm install` (package.json "eas-build-post-install"),
// so every build ships an up-to-date list. The generated file is committed
// so the screen also works in development.
//
// Prints a warning for any package whose licence is unknown, copyleft
// (GPL/AGPL/LGPL/MPL/EPL/CDDL/CC-BY-SA…), or that needs its licence text
// shown but has none in the package.

const fs = require('fs');
const path = require('path');
const checker = require('license-checker-rseidelsohn');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'licenses.json');
const APP_NAME = require(path.join(ROOT, 'package.json')).name;

// Licences that require the licence text / copyright notice to be shown.
const ATTRIBUTION = /\b(MIT|BSD|Apache|ISC|Zlib|Artistic|BlueOak|Python|OFL|CC-BY(?!-SA))/i;
const COPYLEFT = /\b(A?GPL|LGPL|MPL|EPL|CDDL|EUPL|OSL|CC-BY-SA|SSPL)/i;
const UNKNOWN = /UNKNOWN|UNLICENSED|Custom|SEE LICENSE/i;

function compareVersions(a, b) {
  const pa = String(a).split(/[.-]/).map((n) => (isNaN(+n) ? n : +n));
  const pb = String(b).split(/[.-]/).map((n) => (isNaN(+n) ? n : +n));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    if (pa[i] === pb[i]) continue;
    return typeof pa[i] === 'number' && typeof pb[i] === 'number' ? pa[i] - pb[i] : String(pa[i]).localeCompare(String(pb[i]));
  }
  return 0;
}

// license-checker falls back to the README when a package has no licence
// file; only text from a real LICENSE / COPYING / NOTICE file counts.
const REAL_LICENSE_FILE = /^(licen[cs]e|copying|notice|unlicense)/i;

const MIT_TEXT = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

const ISC_TEXT = (holder) => `ISC License

Copyright (c) ${holder}

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;

/** Standard notice for a package that ships no licence file. */
function fallbackText(license, holder, repository) {
  if (/^MIT$/i.test(license)) return MIT_TEXT(holder);
  if (/^ISC$/i.test(license)) return ISC_TEXT(holder);
  const spdx = license.replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+/i)[0].replace(/\s+/g, '-');
  return `Licensed under the ${license} licence${holder ? ` by ${holder}` : ''}.\n\nFull licence text: https://spdx.org/licenses/${spdx}.html${repository ? `\nSource: ${repository}` : ''}`;
}

const cleanRepo = (url) =>
  (url || '')
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '') || null;

checker.init(
  {
    start: ROOT,
    production: true,
    excludePrivatePackages: false,
    customFormat: { name: '', version: '', licenses: '', repository: '', publisher: '', licenseFile: '', licenseText: '' },
  },
  (err, packages) => {
    if (err) {
      console.error('✖ licenses: license-checker failed:', err.message || err);
      process.exit(1);
    }

    const byName = new Map();
    for (const [key, info] of Object.entries(packages)) {
      const at = key.lastIndexOf('@');
      const name = info.name || key.slice(0, at);
      const version = info.version || key.slice(at + 1);
      if (name === APP_NAME) continue;
      const prev = byName.get(name);
      if (prev && compareVersions(prev.version, version) >= 0) continue;
      const license = Array.isArray(info.licenses) ? info.licenses.join(' OR ') : String(info.licenses || 'UNKNOWN');
      const repository = cleanRepo(info.repository);
      const hasFile = !!info.licenseFile && REAL_LICENSE_FILE.test(path.basename(String(info.licenseFile)));
      const fileText = hasFile && typeof info.licenseText === 'string' ? info.licenseText.trim() : '';
      byName.set(name, {
        name,
        version,
        license,
        repository,
        text: fileText || fallbackText(license, info.publisher || name, repository),
        generated: !fileText,
      });
    }

    const list = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

    const unknown = list.filter((p) => UNKNOWN.test(p.license));
    // "A OR B" lets us pick either, so it's only copyleft if every option is.
    const isCopyleft = (license) =>
      license.replace(/[()]/g, '').split(/\s+OR\s+/i).every((option) => COPYLEFT.test(option));
    const copyleft = list.filter((p) => isCopyleft(p.license));
    const missingText = list.filter((p) => p.generated && ATTRIBUTION.test(p.license));

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const output = list.map(({ generated, ...entry }) => entry);
    fs.writeFileSync(OUT, JSON.stringify(output, null, 0) + '\n');

    const kb = Math.round(fs.statSync(OUT).size / 1024);
    console.log(`✔ licenses: ${list.length} packages → ${path.relative(ROOT, OUT)} (${kb} KB)`);

    const warn = (title, items) => {
      if (items.length === 0) return;
      console.warn(`\n⚠ licenses: ${items.length} ${title}:`);
      items.forEach((p) => console.warn(`   - ${p.name}@${p.version}  [${p.license}]`));
    };
    warn('package(s) with an unknown or custom licence — check manually', unknown);
    warn('package(s) with a copyleft licence — check the obligations before release', copyleft);
    warn('package(s) ship no licence file — a standard notice was generated from the package metadata; check it if needed', missingText);
  }
);
