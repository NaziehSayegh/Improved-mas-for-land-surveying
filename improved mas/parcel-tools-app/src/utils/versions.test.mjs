import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, newestVersion } from './versions.js';

test('compareVersions compares numbers, not text', () => {
  assert.ok(compareVersions('2.0.9', '2.0.10') < 0);
  assert.ok(compareVersions('2.0.26', '2.0.25') > 0);
  assert.equal(compareVersions('v2.0.26', '2.0.26'), 0);
  assert.equal(compareVersions('2.0', '2.0.0'), 0);
  assert.equal(compareVersions('2.0.26-beta', '2.0.26'), 0);
});

test('latest is never lower than the admin\'s own copy, even if no user has updated yet', () => {
  const users = [{ app_version: '2.0.22' }, { app_version: '2.0.21' }, {}];
  assert.equal(newestVersion(users, '2.0.26'), '2.0.26');
});

test('latest follows users when they are ahead of the admin copy', () => {
  assert.equal(newestVersion([{ app_version: '2.1.0' }, { app_version: '2.0.5' }], '2.0.26'), '2.1.0');
});

test('works without a floor, with no users, and with damaged entries', () => {
  assert.equal(newestVersion([{ app_version: '2.0.3' }, { app_version: '2.0.12' }]), '2.0.12');
  assert.equal(newestVersion([]), '');
  assert.equal(newestVersion(null, '2.0.26'), '2.0.26');
  assert.equal(newestVersion([null, undefined, { app_version: null }], '2.0.26'), '2.0.26');
});
