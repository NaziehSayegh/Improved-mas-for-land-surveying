// Run with: node --test src/utils/parcelHelpers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parcelKey, formatArea, latestVersions, countVersions, distToSegment, nearestEdgeIndex, pruneCurves } from './parcelHelpers.js';

test('parcelKey ignores case and spaces and never throws', () => {
    assert.equal(parcelKey({ number: ' 12/B ' }), '12/b');
    assert.equal(parcelKey({ number: 7 }), '7');
    assert.equal(parcelKey({}), '');
    assert.equal(parcelKey(null), '');
});

test('formatArea shows a dash for a missing or bad area', () => {
    assert.equal(formatArea(12.5), '12.5000');
    assert.equal(formatArea(null), '—');
    assert.equal(formatArea(NaN), '—');
    assert.equal(formatArea('12'), '—');
});

test('latestVersions keeps the newest save of each number', () => {
    const parcels = [{ id: 1, number: 'A' }, { id: 2, number: 'B' }, { id: 3, number: 'a ' }];
    assert.deepEqual(latestVersions(parcels).map(p => p.id), [2, 3]);
});

test('countVersions numbers each save of the same parcel', () => {
    const parcels = [{ id: 1, number: 'A' }, { id: 2, number: 'B' }, { id: 3, number: 'A' }];
    const { totals, versionOf } = countVersions(parcels);
    assert.equal(totals.get('a'), 2);
    assert.equal(totals.get('b'), 1);
    assert.equal(versionOf.get(1), 1);
    assert.equal(versionOf.get(3), 2);
});

test('distToSegment measures to the nearest part of the segment', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
    assert.equal(distToSegment({ x: 5, y: 3 }, a, b), 3);
    assert.equal(distToSegment({ x: 13, y: 4 }, a, b), 5);
    assert.equal(distToSegment({ x: 3, y: 4 }, a, a), 5);
});

test('nearestEdgeIndex finds the edge to insert a point on, including the closing edge', () => {
    const points = { 1: { x: 0, y: 0 }, 2: { x: 10, y: 0 }, 3: { x: 10, y: 10 }, 4: { x: 0, y: 10 } };
    const ids = ['1', '2', '3', '4'];
    assert.equal(nearestEdgeIndex(ids, points, { x: 5, y: -2 }), 0);
    assert.equal(nearestEdgeIndex(ids, points, { x: 12, y: 5 }), 1);
    assert.equal(nearestEdgeIndex(ids, points, { x: -2, y: 5 }), 3);
});

test('pruneCurves drops curves whose edge is gone', () => {
    const curves = [{ from: '1', to: '2', M: 1 }, { from: '4', to: '1', M: 1 }, { from: '2', to: '3', M: 1 }];
    assert.deepEqual(pruneCurves(['1', '2', '4'], curves).map(c => c.from + c.to), ['12', '41']);
    assert.deepEqual(pruneCurves(['1', '2'], null), []);
});
