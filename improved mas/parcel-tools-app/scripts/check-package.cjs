// Run after electron-builder: stops the release if private or developer-only files ended up inside the app.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'dist-electron');
const unpacked = path.join(root, 'win-unpacked', 'resources');
if (!fs.existsSync(unpacked)) {
  console.log('[check-package] No win-unpacked folder found - nothing to check.');
  process.exit(0);
}

const FORBIDDEN = [
  { re: /(^|\/)data\/users\.json$/i, why: 'a copy of your user list' },
  { re: /(^|\/)data\/license\.json$/i, why: 'a local license file' },
  { re: /(^|\/)data\/ai_config\.json$/i, why: 'local AI settings' },
  { re: /(^|\/)(list_users|make_admin)\.py$/i, why: 'admin scripts' },
  { re: /(^|\/)debug_[^/]*\.py$/i, why: 'debug scripts' },
  { re: /(^|\/)\.env$/i, why: 'an environment file' },
];
const KEY = /(^|\/)serviceAccountKey\.json$/i;

const bad = []; let keys = [];
(function walk(dir, rel) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${name.name}` : name.name;
    if (name.name === 'python-embed' || name.name === 'node_modules') continue;
    if (name.isDirectory()) { walk(path.join(dir, name.name), r); continue; }
    if (KEY.test(r)) keys.push(r);
    for (const f of FORBIDDEN) if (f.re.test(r)) bad.push(`${r}  (${f.why})`);
  }
})(unpacked, '');

if (keys.length) {
  console.error('\n[check-package] FAILED - the Firebase ADMIN key is inside this build:\n  ' + keys.join('\n  ') +
    '\n  Anyone who installs the app could read it and control your whole Firebase project.\n' +
    '  Keep the key on your own PC only (see firebase/README.md) - builds must not contain it.\n');
  process.exit(1);
}
if (bad.length) {
  console.error('\n[check-package] FAILED - these files must not be shipped:\n  ' + bad.join('\n  ') + '\n');
  process.exit(1);
}
console.log('[check-package] OK - no admin key, private data or developer scripts found in the build.');
