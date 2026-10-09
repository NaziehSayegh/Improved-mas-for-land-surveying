// Run with: node --test src/utils/numberLayers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    detectCornerLayers, detectParcelNumberLayers, filterCornerLabels, pickParcelNumberText, resolveNumberLayers,
} from './numberLayers.js';

const layers = ['0', 'GIS', 'numbers for marks', 'numbers for building corners', 'text for description', 'dimensions', 'roads', 'Defpoints'];

test('the two corner-number layers are detected, whatever the case / separators', () => {
    assert.deepEqual(detectCornerLayers(layers), ['numbers for marks', 'numbers for building corners']);
    assert.deepEqual(detectCornerLayers(['Numbers_For_Marks', 'NUMBERS-FOR-BUILDING-CORNERS', 'NUMBER OF LOTS']).length, 2);
    assert.deepEqual(detectCornerLayers(['dimensions', 'roads']), []);
});

test('the parcel-number layer is "text for description"', () => {
    assert.deepEqual(detectParcelNumberLayers(layers), ['text for description']);
    assert.deepEqual(detectParcelNumberLayers(['0', 'Description']), ['Description']);   // looser fallback
    assert.deepEqual(detectParcelNumberLayers(['0', 'roads']), []);
});

test('corner labels from other layers are ignored once layers are chosen', () => {
    const labels = [{ text: '5', layer: 'numbers for marks' }, { text: '6', layer: 'dimensions' }, { text: '7', layer: 'numbers for building corners' }];
    assert.deepEqual(filterCornerLabels(labels, ['numbers for marks', 'numbers for building corners']).map(l => l.text), ['5', '7']);
    assert.equal(filterCornerLabels(labels, []).length, 3);            // nothing chosen = old behaviour
    assert.equal(filterCornerLabels(labels, undefined).length, 3);
});

test('parcel number comes only from the chosen layer, preferring numbers near the centre', () => {
    const c = { x: 0, y: 0 };
    const inside = [
        { text: '99', layer: 'dimensions', x: 0, y: 0 },                 // closest, but wrong layer
        { text: 'Parcel 12', layer: 'text for description', x: 5, y: 5 },
        { text: '7', layer: 'text for description', x: 9, y: 9 },
    ];
    assert.equal(pickParcelNumberText(inside, ['text for description'], c), '7');     // numeric preferred
    assert.equal(pickParcelNumberText(inside.slice(0, 2), ['text for description'], c), '12');
    assert.equal(pickParcelNumberText([inside[0]], ['text for description'], c), '');  // nothing on that layer
    assert.equal(pickParcelNumberText(inside, [], c), null);                           // no layer chosen: old behaviour
});

test('saved choice is kept only for layers that exist; otherwise auto-detect', () => {
    const r1 = resolveNumberLayers(layers, { corner: ['numbers for marks', 'gone'], parcel: ['roads'] });
    assert.deepEqual(r1, { corner: ['numbers for marks'], parcel: ['roads'] });
    const r2 = resolveNumberLayers(layers, { corner: ['gone'], parcel: [] });
    assert.deepEqual(r2, { corner: ['numbers for marks', 'numbers for building corners'], parcel: ['text for description'] });
    assert.deepEqual(resolveNumberLayers(['0'], null), { corner: [], parcel: [] });
});
