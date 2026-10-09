// Run with: node --test src/utils/entityMetrics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { exactMetricsFromSegments, withExactMetrics } from './entityMetrics.js';

const line = (x, y) => ({ type: 'line', x, y });
const arcFrom = (bulge, ccw, chord) => {
    const theta = 4 * Math.atan(Math.abs(bulge));
    return { type: 'arc', theta, r: chord / (2 * Math.sin(theta / 2)), ccw };
};

test('no arcs -> null (caller keeps its normal numbers)', () => {
    assert.equal(exactMetricsFromSegments([line(0, 0), line(1, 0), line(1, 1)]), null);
});

test('rectangle with a semicircle bulging outward (CCW) adds the half disc', () => {
    // (0,0) -> (10,0) -> (10,10) -> (0,10) with the top side (10,10)->(0,10) a CCW semicircle? (bulge +1 turns left)
    const segs = [line(0, 0), line(10, 0), line(10, 10), arcFrom(1, true, 10), line(0, 10)];
    const m = exactMetricsFromSegments(segs);
    assert.ok(Math.abs(m.baseArea - 100) < 1e-9);
    const half = Math.PI * 25 / 2;
    assert.ok(Math.abs(Math.abs(m.curveAdjustment) - half) < 1e-9);
    assert.ok(Math.abs(m.perimeter - (10 + 10 + Math.PI * 5 + 10)) < 1e-9);   // 3 straight sides + semicircle arc
});

test('the arc direction decides whether the segment is added or removed', () => {
    const outward = exactMetricsFromSegments([line(0, 0), line(10, 0), line(10, 10), arcFrom(1, true, 10), line(0, 10)]);
    const inward = exactMetricsFromSegments([line(0, 0), line(10, 0), line(10, 10), arcFrom(1, false, 10), line(0, 10)]);
    assert.ok(Math.abs(outward.area - (100 + Math.PI * 12.5)) < 1e-9);
    assert.ok(Math.abs(inward.area - (100 - Math.PI * 12.5)) < 1e-9);
});

test('withExactMetrics replaces the approximate numbers only when there are arcs', () => {
    const approx = { area: 1, perimeter: 2, dunams: 0.001, pointCount: 9 };
    const exact = withExactMetrics({ segments: [line(0, 0), line(10, 0), line(10, 10), arcFrom(1, true, 10), line(0, 10)] }, approx);
    assert.ok(exact.area > 100 && exact.pointCount === 9 && Math.abs(exact.dunams - exact.area / 1000) < 1e-12);
    assert.equal(withExactMetrics({ segments: [line(0, 0)] }, approx), approx);
    assert.equal(withExactMetrics({}, approx), approx);
});
