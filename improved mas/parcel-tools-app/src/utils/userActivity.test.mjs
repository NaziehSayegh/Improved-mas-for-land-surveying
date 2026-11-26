import test from 'node:test';
import assert from 'node:assert/strict';
import { lastSeenMs } from './userActivity.js';

const iso = (s) => new Date(s).getTime();

test('a user who stays signed in is seen when their PC last checked in, not when they last signed in', () => {
  const u = { last_login: '2026-11-01T08:00:00+00:00', devices: { a: { last_seen: '2026-11-25T09:30:00+00:00' }, b: { last_seen: '2026-11-10T09:30:00+00:00' } } };
  assert.equal(lastSeenMs(u), iso('2026-11-25T09:30:00+00:00'));
});

test('a login newer than every PC check-in still counts', () => {
  const u = { last_login: '2026-11-26T08:00:00+00:00', devices: { a: { last_seen: '2026-11-25T09:30:00+00:00' } } };
  assert.equal(lastSeenMs(u), iso('2026-11-26T08:00:00+00:00'));
});

test('works with only a login, only devices, or nothing', () => {
  assert.equal(lastSeenMs({ last_login: '2026-11-01T08:00:00+00:00' }), iso('2026-11-01T08:00:00+00:00'));
  assert.equal(lastSeenMs({ devices: { a: { last_seen: '2026-11-02T08:00:00+00:00' } } }), iso('2026-11-02T08:00:00+00:00'));
  assert.equal(lastSeenMs({}), null);
  assert.equal(lastSeenMs(null), null);
});

test('ignores empty, damaged and non-object device entries', () => {
  const u = { last_login: '', devices: { a: null, b: { last_seen: 'garbage' }, c: 'x', d: { last_seen: '2026-11-03T08:00:00+00:00' } } };
  assert.equal(lastSeenMs(u), iso('2026-11-03T08:00:00+00:00'));
});

test('compares times, not text (mixed formats sort correctly)', () => {
  const u = { last_login: '2026-11-26T01:00:00+00:00', devices: { a: { last_seen: '2026-11-25T23:00:00-05:00' } } }; // = 04:00 UTC on the 26th
  assert.equal(lastSeenMs(u), iso('2026-11-25T23:00:00-05:00'));
});
