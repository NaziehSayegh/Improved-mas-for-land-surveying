// Run with: node --test src/utils/hatchRender.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { hatchSegments } from './hatchRender.js';

const box = { minX: 0, minY: 0, maxX: 10, maxY: 5 };
const ansi31 = { angle: 45, base: [0, 0], offset: [-4.49, 4.49], dashes: [] };    // spacing ~6.35

test('diagonal pattern: parallel lines at 45 degrees, covering the whole box', () => {
    const segs = hatchSegments([ansi31], box);
    assert.ok(segs.length >= 2 && segs.length <= 4, `got ${segs.length}`);
    segs.forEach(([x1, y1, x2, y2]) => {
        assert.ok(Math.abs(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI - 45) < 1e-6);
    });
});

test('spacing between neighbouring lines is the perpendicular offset', () => {
    const segs = hatchSegments([{ angle: 0, base: [0, 0], offset: [0, 1] }], box);   // horizontal lines every 1
    const ys = [...new Set(segs.map(s => Math.round(s[1] * 1000) / 1000))].sort((a, b) => a - b);
    assert.deepEqual(ys.slice(0, 3), [0, 1, 2]);
    assert.ok(ys[0] <= 0 && ys[ys.length - 1] >= 5);
});

test('crosshatch has two directions', () => {
    const segs = hatchSegments([
        { angle: 0, base: [0, 0], offset: [0, 1] },
        { angle: 90, base: [0, 0], offset: [-1, 0] },
    ], box);
    const horizontal = segs.filter(s => Math.abs(s[1] - s[3]) < 1e-9).length;
    const vertical = segs.filter(s => Math.abs(s[0] - s[2]) < 1e-9).length;
    assert.ok(horizontal >= 5 && vertical >= 10);
});

test('dashed lines are cut into dashes with the right length and gap', () => {
    const segs = hatchSegments([{ angle: 0, base: [0, 0], offset: [0, 10], dashes: [2, -1] }], { minX: 0, minY: 0, maxX: 9, maxY: 0 });
    const row = segs.filter(s => Math.abs(s[1]) < 1e-9).sort((a, b) => a[0] - b[0]);
    assert.ok(row.length >= 3);
    assert.ok(Math.abs((row[0][2] - row[0][0]) - 2) < 1e-9);          // dash 2
    assert.ok(Math.abs(row[1][0] - row[0][2] - 1) < 1e-9);            // gap 1
});

test('too dense a pattern is reported (drawn as a tint instead of thousands of lines)', () => {
    assert.equal(hatchSegments([{ angle: 0, base: [0, 0], offset: [0, 0.01] }], box, 0.5), null);
    assert.equal(hatchSegments([{ angle: 0, base: [0, 0], offset: [0, 0.0001] }], { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }), null);
});

test('zero spacing is ignored and does not hang', () => {
    assert.deepEqual(hatchSegments([{ angle: 30, base: [0, 0], offset: [1, 0] }].map(l => ({ ...l, angle: 0 })), box), []);
});
