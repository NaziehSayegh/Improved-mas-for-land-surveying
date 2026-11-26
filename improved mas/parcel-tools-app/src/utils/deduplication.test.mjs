import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateDatasets } from './deduplication.js';

test('legacy alias keys are dropped so a stale copy cannot be saved next to an edited value', () => {
  const { parcels } = deduplicateDatasets({}, [{
    id: 'a', number: '103/A', parcelNumber: '103', parcel_number: '103',
    ids: ['4', '3', '8', '7'], enteredIds: ['4', '3', '8'], entered_ids: ['4'], curves: [], area: 10,
  }]);
  assert.equal(parcels.length, 1);
  assert.equal(parcels[0].number, '103/A');
  assert.deepEqual(parcels[0].ids, ['4', '3', '8', '7']);
  for (const k of ['parcelNumber', 'parcel_number', 'enteredIds', 'entered_ids']) assert.ok(!(k in parcels[0]), k);
});

test('a parcel that only has the legacy number key still keeps its number', () => {
  const { parcels } = deduplicateDatasets({}, [{ id: 'b', parcelNumber: '7', ids: ['1', '2', '3'], curves: [], area: 5 }]);
  assert.equal(parcels[0].number, '7');
});

test('other parcel fields (such as source) survive', () => {
  const { parcels } = deduplicateDatasets({}, [{ id: 'c', number: '9', ids: ['1', '2', '3'], curves: [], area: 5, source: 'cad' }]);
  assert.equal(parcels[0].source, 'cad');
});
