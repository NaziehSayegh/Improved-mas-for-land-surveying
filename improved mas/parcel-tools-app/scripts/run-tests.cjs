// Runs every frontend unit test (src/**/*.test.mjs). Used by "npm test".
// The files are listed explicitly so the bundled Python folder is never scanned.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const findTests = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return findTests(full);
  return entry.name.endsWith('.test.mjs') ? [full] : [];
});

const tests = findTests(path.join(__dirname, '..', 'src'));
if (tests.length === 0) {
  console.error('No test files found under src/');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
process.exit(result.status ?? 1);
