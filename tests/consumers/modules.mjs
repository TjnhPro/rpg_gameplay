// Copied into a separate installed-tarball consumer; never imports repository source.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateModuleDefinition, createModuleRegistry, registerModule, getModule,
  listModules, configureModules, isModuleEnabled,
} from '@rpg/gameplay';

const optional = {id:'optional-unit', optional:true, dependencies:[]};
const required = {id:'required-unit', optional:false, dependencies:[]};

test('GF01/GF02: valid snapshots, exact lookup, stable order and independent registries', () => {
  const input = {id:'dependent-unit', optional:true, dependencies:['unregistered-unit']};
  const validated = validateModuleDefinition(input);
  const original = createModuleRegistry();
  const independent = createModuleRegistry();
  const first = registerModule(original, input);
  const registry = registerModule(registerModule(first, required), optional);
  input.id = 'changed'; input.optional = false; input.dependencies.push('changed');
  assert.deepEqual(validated, {id:'dependent-unit', optional:true, dependencies:['unregistered-unit']});
  assert.deepEqual(getModule(registry, 'dependent-unit'), validated);
  assert.equal(getModule(registry, 'Dependent-unit'), undefined);
  assert.equal(getModule(registry, 'unknown'), undefined);
  const expected = ['dependent-unit', 'required-unit', 'optional-unit'];
  assert.deepEqual(listModules(registry).map(x => x.id), expected);
  const repeated = registerModule(registerModule(registerModule(createModuleRegistry(), validated), required), optional);
  assert.deepEqual(listModules(repeated), listModules(registry));
  assert.deepEqual(listModules(original), []);
  assert.deepEqual(listModules(independent), []);
  assert.deepEqual(listModules(first), [validated]);
  assert.throws(() => listModules(registry).pop(), TypeError);
  assert.throws(() => { getModule(registry, 'dependent-unit').optional = false; }, TypeError);
  assert.throws(() => getModule(registry, 'dependent-unit').dependencies.push('injected'), TypeError);
  assert.throws(() => { registry.definitions = []; }, TypeError);
  assert.throws(() => registerModule(registry, optional), /already registered/);
  assert.throws(() => registerModule(registry, {...optional, optional:false}), /already registered/);
  assert.deepEqual(listModules(registry).map(x => x.id), expected);
});

test('GF01/GF02: reject invalid definitions without changing state', () => {
  const registry = registerModule(createModuleRegistry(), required);
  const invalids = [
    [null, /object/], [[], /object/],
    [{...optional, id:''}, /Module ID/],
    [{...optional, id:'Bad_id'}, /Module ID/],
    [{...optional, id:'unit\n'}, /Module ID/],
    [{...optional, id:42}, /Module ID/],
    [{id:'unit', dependencies:[]}, /optional/],
    [{...optional, optional:'true'}, /optional/],
    [{id:'unit', optional:true}, /array/],
    [{...optional, dependencies:'other'}, /array/],
    [{...optional, dependencies:['']}, /Module ID/],
    [{...optional, dependencies:[7]}, /Module ID/],
    [{...optional, dependencies:['other', 'other']}, /duplicate/],
    [{...optional, dependencies:['optional-unit']}, /itself/],
  ];
  for (const [definition, message] of invalids) {
    assert.throws(() => validateModuleDefinition(definition), {name:'TypeError', message});
    assert.throws(() => registerModule(registry, definition), {name:'TypeError', message});
    assert.deepEqual(listModules(registry), [required]);
  }
});

test('GF03: defaults, explicit selection, rejection, stable order and isolation; no graph resolution', () => {
  const dependent = {id:'dependent-unit', optional:true, dependencies:['optional-unit', 'unregistered-unit']};
  // Deliberately register dependent first: selection must not topologically reorder it.
  const registry = registerModule(registerModule(registerModule(createModuleRegistry(), dependent), required), optional);
  const before = listModules(registry);
  const defaults = configureModules(registry);
  assert.deepEqual(defaults.enabledModuleIds, ['required-unit']);
  assert.equal(isModuleEnabled(defaults, 'optional-unit'), false);
  assert.equal(isModuleEnabled(defaults, 'required-unit'), true);
  assert.equal(isModuleEnabled(defaults, 'unknown'), false);
  const selection = {enable:['optional-unit', 'dependent-unit'], disable:[]};
  const enabled = configureModules(registry, selection);
  selection.enable.splice(0); selection.disable.push('required-unit');
  assert.deepEqual(enabled.enabledModuleIds, ['dependent-unit', 'required-unit', 'optional-unit']);
  assert.equal(isModuleEnabled(enabled, 'optional-unit'), true);
  const disabled = configureModules(registry, {disable:['optional-unit']});
  assert.deepEqual(disabled.enabledModuleIds, ['required-unit']);
  assert.deepEqual(defaults.enabledModuleIds, ['required-unit']);
  assert.throws(() => enabled.enabledModuleIds.push('injected'), TypeError);
  assert.throws(() => { enabled.enabledModuleIds = []; }, TypeError);
  assert.deepEqual(configureModules(registry, {enable:['required-unit']}).enabledModuleIds, ['required-unit']);
  assert.deepEqual(configureModules(registry, {enable:['dependent-unit']}).enabledModuleIds,
    ['dependent-unit', 'required-unit']); // Does not auto-enable optional dependency or reject missing one.
  for (const [input, message] of [
    [null, /object/], [[], /object/],
    [{enable:null}, /array/], [{disable:'optional-unit'}, /array/],
    [{enable:['']}, /Module ID/],
    [{enable:['unknown']}, /Unknown/], [{disable:['unknown']}, /Unknown/],
    [{enable:['optional-unit'], disable:['optional-unit']}, /both/],
    [{disable:['required-unit']}, /Required/],
    [{enable:['optional-unit', 'optional-unit']}, /duplicate/],
    [{disable:['optional-unit', 'optional-unit']}, /duplicate/],
  ]) {
    assert.throws(() => configureModules(registry, input), {name:'TypeError', message});
  }
  assert.deepEqual(listModules(registry), before);
  assert.deepEqual(defaults.enabledModuleIds, ['required-unit']);
  const next = registerModule(registry, {id:'later-unit', optional:false, dependencies:[]});
  assert.deepEqual(configureModules(next).enabledModuleIds, ['required-unit', 'later-unit']);
  assert.deepEqual(defaults.enabledModuleIds, ['required-unit']);
});
