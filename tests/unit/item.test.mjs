import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

const content = () => ({categoryId: 'consumable', tagIds: ['potion'], rarityId: null, properties: {}});

test('Item binding and nested immutable copies reject cyclic and hostile input', () => {
  const input = {...content(), properties: {nested: {values: [1, 2]}}};
  const definition = g.createItemDefinition({definitionId: 'potion'}, input);
  const instance = g.createItemInstance(definition, {instanceId: 'one', properties: input.properties});
  input.properties.nested.values[0] = 99;
  assert.deepEqual(instance.properties.nested.values, [1, 2]);
  assert.deepEqual(definition.properties.nested.values, [1, 2]);
  assert.equal(instance.definitionId, 'potion');
  assert.throws(() => { instance.properties.nested.values.push(3); }, TypeError);
  const other = g.createItemDefinition({definitionId: 'other'}, content());
  assert.throws(() => g.validateItemInstance(other, instance), /binding mismatch/);
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => g.createItemInstance(definition, {instanceId: 'cycle', properties: cycle}), TypeError);
  let getterCalls = 0;
  const hostile = {get value() { getterCalls++; return 1; }};
  assert.throws(() => g.createItemInstance(definition, {instanceId: 'hostile', properties: hostile}), TypeError);
  assert.equal(getterCalls, 0);
});

test('Item property candidates preserve identity and stack compatibility is advisory', () => {
  const definition = g.createItemDefinition({definitionId: 'potion'}, content());
  const left = g.createItemInstance(definition, {instanceId: 'left', properties: {quality: 2}});
  const right = g.createItemInstance(definition, {instanceId: 'right', properties: {quality: 2}});
  const changed = g.setItemInstanceProperty(definition, left, 'quality', 3, {eligible: true});
  assert.equal(changed.status, 'accepted');
  assert.equal(changed.candidate.instanceId, 'left');
  assert.deepEqual(g.getItemInstanceProperty(definition, changed.candidate, 'quality'), {found: true, value: 3});
  assert.equal(left.properties.quality, 2);
  assert.deepEqual(g.setItemInstanceProperty(definition, left, 'quality', 3, {eligible: false}),
    {status: 'rejected', reason: 'ineligible', candidate: null});
  assert.deepEqual(g.assessItemStackCompatibility(definition, left, definition, right, {stackable: true}),
    {compatible: true, reason: 'none'});
  assert.deepEqual(g.assessItemStackCompatibility(definition, changed.candidate, definition, right, {stackable: true}),
    {compatible: false, reason: 'different_properties'});
});
