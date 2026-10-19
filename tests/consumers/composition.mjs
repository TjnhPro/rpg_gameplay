// Executed only inside the external installed-tarball consumer.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModuleRegistry, registerModule, getModule, listModules, configureModules,
  resolveModuleDependencies, composeModules,
} from '@rpg/gameplay';

const definition = (id, dependencies = [], optional = true) => ({id, optional, dependencies});
const registryOf = definitions => definitions.reduce((registry, value) => registerModule(registry, value), createModuleRegistry());
function rejectBoth(registry, configuration, message) {
  for (const fn of [resolveModuleDependencies, composeModules]) {
    assert.throws(() => fn(registry, configuration), {name:'TypeError', message});
  }
}

test('GF04/GF05: direct/transitive/shared dependencies and registration priority at every ready step', () => {
  // Independent expected orders distinguish DFS and batched-ready ordering errors.
  const scenarios = [
    [[definition('equipment', ['inventory']), definition('inventory', ['character']), definition('character', [], false)],
      ['character', 'inventory', 'equipment']],
    [[definition('dependent', ['base']), definition('independent'), definition('base')],
      ['independent', 'base', 'dependent']],
    [[definition('dependent', ['base']), definition('base'), definition('independent')],
      ['base', 'dependent', 'independent']],
    [[definition('top', ['right', 'left']), definition('left', ['base']), definition('right', ['base']), definition('base')],
      ['base', 'left', 'right', 'top']],
  ];
  for (const [definitions, expected] of scenarios) {
    const registry = registryOf(definitions);
    const configuration = configureModules(registry, {enable:definitions.map(x => x.id).reverse()});
    const registrationOrder = definitions.map(x => x.id);
    const resolved = resolveModuleDependencies(registry, configuration);
    const composition = composeModules(registry, configuration);
    assert.deepEqual(resolved, expected);
    assert.deepEqual(resolveModuleDependencies(registry, configuration), expected);
    assert.deepEqual(composition.moduleIds, expected);
    assert.deepEqual(composition.definitions, expected.map(id => definitions.find(x => x.id === id)));
    assert.deepEqual(configuration.enabledModuleIds, registrationOrder);
    assert.deepEqual(listModules(registry), definitions);
  }
});

test('GF04/GF05: reject unknown/disabled dependencies and selected cycles without changing inputs', () => {
  const unknown = registryOf([definition('equipment', ['inventory'])]);
  rejectBoth(unknown, configureModules(unknown, {enable:['equipment']}), /'equipment'.*unknown dependency 'inventory'/);
  const registry = registerModule(unknown, definition('inventory'));
  const configuration = configureModules(registry, {enable:['equipment']});
  rejectBoth(registry, configuration, /'equipment'.*dependency 'inventory'.*enabled/);
  assert.deepEqual(configuration.enabledModuleIds, ['equipment']);
  assert.deepEqual(listModules(registry).map(x => x.id), ['equipment', 'inventory']);
  assert.deepEqual(composeModules(registry, configureModules(registry, {enable:['equipment', 'inventory']})).moduleIds,
    ['inventory', 'equipment']); // A prior failure leaves no resolver cache/state.
  const cycle = registryOf([
    definition('downstream', ['cycle-a']), definition('independent'),
    definition('cycle-a', ['cycle-b']), definition('cycle-b', ['cycle-c']), definition('cycle-c', ['cycle-a']),
  ]);
  const selected = configureModules(cycle, {enable:listModules(cycle).map(x => x.id)});
  rejectBoth(cycle, selected, /cycle: cycle-a -> cycle-b -> cycle-c -> cycle-a/);
  assert.deepEqual(selected.enabledModuleIds, ['downstream', 'independent', 'cycle-a', 'cycle-b', 'cycle-c']);
  assert.deepEqual(resolveModuleDependencies(cycle, configureModules(cycle, {enable:['independent']})), ['independent']);
});

test('GF04/GF05: validate configuration snapshots, ignore unselected graphs, allow empty composition', () => {
  const empty = createModuleRegistry();
  assert.deepEqual(resolveModuleDependencies(empty, configureModules(empty)), []);
  assert.deepEqual(composeModules(empty, configureModules(empty)), {moduleIds:[], definitions:[]});
  const required = definition('required', [], false);
  const registry = registryOf([required, definition('broken', ['unknown']), definition('cycle-a', ['cycle-b']), definition('cycle-b', ['cycle-a'])]);
  const defaults = configureModules(registry);
  assert.deepEqual(resolveModuleDependencies(registry, defaults), ['required']);
  assert.deepEqual(composeModules(registry, defaults), {moduleIds:['required'], definitions:[required]});
  for (const [input, message] of [
    [undefined, /configuration.*object/], [null, /configuration.*object/], [[], /configuration.*object/],
    [{}, /enabledModuleIds.*array/], [{enabledModuleIds:null}, /array/],
    [{enabledModuleIds:'required'}, /array/], [{enabledModuleIds:[42]}, /Module ID/],
    [{enabledModuleIds:['']}, /Module ID/],
    [{enabledModuleIds:['required', 'unknown']}, /Unknown enabled module 'unknown'/],
    [{enabledModuleIds:['required', 'required']}, /duplicate ID 'required'/],
    [{enabledModuleIds:[]}, /Required module 'required'.*missing/],
  ]) rejectBoth(registry, input, message);
  const extended = registerModule(registry, definition('new-required', [], false));
  rejectBoth(extended, defaults, /Required module 'new-required'.*missing/);
  assert.deepEqual(defaults.enabledModuleIds, ['required']);
});

test('GF05: frozen composition snapshots remain independent of inputs and later calls', () => {
  const input = definition('dependent', ['base']);
  const registry = registryOf([input, definition('base')]);
  const externalIds = ['dependent', 'base'];
  const externalConfiguration = {enabledModuleIds:externalIds};
  const configuration = configureModules(registry, {enable:externalIds});
  const first = composeModules(registry, externalConfiguration);
  const second = composeModules(registry, configuration);
  externalIds.splice(0); input.dependencies.push('unknown'); input.id = 'changed';
  const expected = {moduleIds:['base', 'dependent'], definitions:[definition('base'), definition('dependent', ['base'])]};
  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);
  assert.notEqual(first, second);
  assert.throws(() => first.moduleIds.reverse(), TypeError);
  assert.throws(() => first.definitions.pop(), TypeError);
  assert.throws(() => { first.moduleIds = []; }, TypeError);
  assert.throws(() => { first.definitions[0].optional = false; }, TypeError);
  assert.throws(() => first.definitions[1].dependencies.push('unknown'), TypeError);
  assert.throws(() => resolveModuleDependencies(registry, configuration).push('unknown'), TypeError);
  assert.equal(first.definitions[0], getModule(registry, 'base')); // Safe frozen definition sharing.
  const extended = registerModule(registry, definition('later', [], false));
  assert.deepEqual(composeModules(extended, configureModules(extended)).moduleIds, ['later']);
  assert.deepEqual(composeModules(registry, configureModules(registry)).moduleIds, []);
  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);
  assert.deepEqual(configuration.enabledModuleIds, ['dependent', 'base']);
});
