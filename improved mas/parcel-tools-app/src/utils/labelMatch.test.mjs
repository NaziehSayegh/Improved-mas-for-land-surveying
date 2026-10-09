// Run with: node --test src/utils/labelMatch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLabelMatches } from './labelMatch.js';

// 6 corners of a ~20 m parcel; points file holds the same coordinates (+ optional shift)
const corners = [[0, 0], [20, 0], [20, 10], [10, 15], [0, 10], [5, 3]];
const mk = (shift = [0, 0]) => {
    const loaded = {};
    const det = corners.map(([x, y], i) => {
        loaded[String(i + 1)] = { x: x + shift[0], y: y + shift[1] };
        return { vertexIdx: i, x, y, label: String(i + 1), dist: 0.6, pointId: String(i + 1), status: 'matched' };
    });
    return { det, loaded, missing: {} };
};

test('a label whose point is far from its corner is rejected and the corner keeps its CAD position', () => {
    const { det, loaded, missing } = mk();
    loaded['38'] = { x: 100, y: 3 };                       // point of a neighbouring parcel, 100 m away
    det[3].pointId = '38'; det[3].label = '38'; det[3].dist = 7.2;
    const r = validateLabelMatches(det, missing, loaded, 25);
    assert.equal(det[3].status, 'generated');
    assert.match(det[3].pointId, /^CAD_\d+$/);
    assert.deepEqual(missing[det[3].pointId], { x: 10, y: 15 });
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /Corner #4/);
    assert.ok(det.filter(p => p.status === 'matched').length === 5);   // the rest untouched
});

test('a consistent shift between CAD and the points file is NOT treated as an error', () => {
    const { det, loaded, missing } = mk([5000, 7000]);
    const r = validateLabelMatches(det, missing, loaded, 25);
    assert.equal(r.warnings.length, 0);
    assert.ok(det.every(p => p.status === 'matched'));
});

test('a drawing in a completely different frame is left alone (most corners disagree)', () => {
    const { det, loaded, missing } = mk();
    // rotate/scale the points file so most corners disagree wildly
    Object.keys(loaded).forEach((k, i) => { loaded[k] = { x: loaded[k].y * 3 + i * 40, y: -loaded[k].x * 2 + i * 55 }; });
    const r = validateLabelMatches(det, missing, loaded, 25);
    assert.ok(det.every(p => p.status === 'matched'));
    assert.equal(Object.keys(missing).length, 0);
    assert.ok(r.warnings.every(w => !/was ignored/.test(w)));
});

test('fewer than 3 matches: nothing to compare, nothing changes', () => {
    const { det, loaded, missing } = mk();
    det.slice(2).forEach(p => { p.status = 'generated'; p.pointId = 'CAD_x'; });
    loaded['1'] = { x: 999, y: 999 };
    const r = validateLabelMatches(det, missing, loaded, 25);
    assert.equal(det[0].status, 'matched');
    assert.equal(r.warnings.length, 0);
});

test('new CAD ids never collide with existing points', () => {
    const { det, loaded, missing } = mk();
    loaded['CAD_1'] = { x: 1, y: 1 };
    loaded['38'] = { x: 100, y: 3 };
    det[3].pointId = '38';
    validateLabelMatches(det, missing, loaded, 25);
    assert.equal(det[3].pointId, 'CAD_2');
});

// ───────── reconcileCorners ─────────
import { reconcileCorners } from './labelMatch.js';

const square = [[0, 0], [20, 0], [20, 10], [0, 10], [10, 15]];
function scene({ shift = [0, 0], unlabelled = [], absent = [] } = {}) {
    const loaded = {}, det = [];
    square.forEach(([x, y], i) => {
        const id = String(i + 1);
        if (!absent.includes(i)) loaded[id] = { x: x + shift[0], y: y + shift[1] };
        const has = !unlabelled.includes(i) && !absent.includes(i);
        det.push({ vertexIdx: i, x, y, label: has ? id : null, dist: has ? 0.5 : Infinity,
            pointId: has ? id : `CAD_${i + 1}`, status: has ? 'matched' : 'generated' });
    });
    const missing = {};
    det.forEach(p => { if (p.status === 'generated') missing[p.pointId] = { x: p.x, y: p.y }; });
    return { det, loaded, missing };
}

test('a corner without a label is identified by its position in the points file (same frame)', () => {
    const { det, loaded, missing } = scene({ unlabelled: [3] });
    const r = reconcileCorners(det, missing, loaded, 25);
    assert.equal(det[3].pointId, '4');
    assert.equal(det[3].status, 'matched');
    assert.equal(Object.keys(missing).length, 0);        // no CAD_n invented
    assert.equal(r.consistent, true);
});

test('a corner without a label is identified when the drawing is offset from the points file', () => {
    const { det, loaded, missing } = scene({ shift: [50000, 70000], unlabelled: [1, 3] });
    const r = reconcileCorners(det, missing, loaded, 25);
    assert.deepEqual([det[1].pointId, det[3].pointId], ['2', '4']);
    assert.equal(Object.keys(missing).length, 0);
    assert.equal(r.consistent, true);
});

test('a genuinely new corner is moved into the points-file frame (no spike, area can be computed)', () => {
    const { det, loaded, missing } = scene({ shift: [50000, 70000], absent: [4] });   // corner 5 not in the points file
    const r = reconcileCorners(det, missing, loaded, 25);
    assert.equal(r.consistent, true);
    assert.equal(det[4].status, 'generated');
    assert.deepEqual({ x: det[4].x, y: det[4].y }, { x: 10 + 50000, y: 15 + 70000 });
    assert.deepEqual(missing[det[4].pointId], { x: 50010, y: 70015 });
});

test('stray neighbour label + missing own label: rejected, then identified by position', () => {
    const { det, loaded, missing } = scene({ unlabelled: [3] });
    loaded['38'] = { x: 100, y: 3 };
    det[3].pointId = '38'; det[3].label = '38'; det[3].dist = 7; det[3].status = 'matched';
    const r = reconcileCorners(det, missing, loaded, 25);
    assert.equal(det[3].pointId, '4');
    assert.ok(r.warnings.some(w => /the drawing label was ignored/.test(w)));
});

test('unrelated frames (nothing matches): left alone, not consistent', () => {
    const { det, loaded, missing } = scene({ shift: [500, 500], unlabelled: [0, 1, 2, 3, 4] });
    const r = reconcileCorners(det, missing, loaded, 25);
    assert.equal(r.consistent, false);
    assert.ok(det.every(p => p.status === 'generated'));
});

test('two corners never claim the same point', () => {
    const { det, loaded, missing } = scene({ unlabelled: [0, 1] });
    det[1].x = 0.05; det[1].y = 0.05;                   // sits on top of corner 1 as well
    reconcileCorners(det, missing, loaded, 25);
    assert.notEqual(det[0].pointId, det[1].pointId);
});
