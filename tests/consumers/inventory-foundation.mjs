// Supplemental installed-package proof; deliberately outside daily MVP verify.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createItemDefinition, createItemInstance, createInventoryState, validateInventoryState} from '@rpg/gameplay';

test('installed root ESM creates and validates canonical immutable Inventory snapshots', () => {
  const definition = createItemDefinition({definitionId: 'potion'},
    {categoryId: null, tagIds: [], rarityId: null, properties: {}});
  const item = createItemInstance(definition, {instanceId: 'one', properties: {quality: {value: 2}}});
  const context = {items: [{definition, stackPolicy: {stackable: true}, maxStackQuantity: 20}]};
  const input = {inventoryId: 'bag', owner: null, entries: [{item, quantity: 9}]};
  const state = createInventoryState(input, context);
  assert.deepEqual(state, {inventoryId: 'bag', owner: null, entries: [
    {item: {instanceId: 'one', definitionId: 'potion', properties: {quality: {value: 2}}}, quantity: 9},
  ]});
  const next = validateInventoryState(state, context);
  assert.deepEqual(next, state);
  assert.notEqual(next, state);
  assert.notEqual(next.entries[0].item, state.entries[0].item);
  assert.throws(() => { state.entries[0].item.properties.quality.value = 3; }, TypeError);
  assert.throws(() => validateInventoryState({...input, entries: [{item, quantity: 21}]}, context), /exceeds maximum/);
  assert.throws(() => validateInventoryState({...input, entries: [input.entries[0], input.entries[0]]}, context), /Duplicate/);
  assert.throws(() => validateInventoryState(input, {items: []}), /Unresolved/);
  input.entries.length = 0;
  assert.equal(state.entries.length, 1);
});
