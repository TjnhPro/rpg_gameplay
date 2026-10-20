import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {copyRequiredConsumer, assertVersion, assertCoreIntegrity, assertTapEvidence} from './consumer-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = process.env.npm_execpath;
function exec(args, cwd) {
  const env = {...process.env};
  // The installed consumer owns its test runner, not the parent runner's IPC context.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, {cwd, shell: false, encoding: 'utf8', env});
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  if (args.includes('--test')) assertTapEvidence(result.stdout);
  return result.stdout;
}

test('installed artifact: GF01–GF16 + EC01–EC18 + PG01–PG19 + CB01–CB30 + SK01–SK35 + EF01–EF35, ESM root, closed exports, strict declarations and real Kernel', () => {
  assert.ok(cli, 'run with npm run test:functional');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg package consumer '));
  try {
    const pin = JSON.parse(fs.readFileSync(path.join(root, 'harness/core-pin.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const coreArtifact = path.join(root, '.artifacts', pin.artifact);
    assertCoreIntegrity(fs.readFileSync(coreArtifact), lock.packages['node_modules/@rpg/core'].integrity);
    const packedResult = JSON.parse(exec([cli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temp], root));
    const packed = Array.isArray(packedResult) ? packedResult[0] : packedResult['@rpg/gameplay'];
    console.log(`INSTALLED_PACKAGE_SHA256 ${packed.filename} ${createHash('sha256').update(fs.readFileSync(path.join(temp, packed.filename))).digest('hex')}`);
    assert.deepEqual(packed.files.map(x => x.path).sort(), [
      'README.md', 'dist/foundation/execution/index.d.ts', 'dist/foundation/execution/index.js',
      'dist/foundation/messaging/index.d.ts', 'dist/foundation/messaging/index.js',
      'dist/foundation/modules/index.d.ts', 'dist/foundation/modules/index.js',
      'dist/foundation/runtime/index.d.ts', 'dist/foundation/runtime/index.js',
      'dist/index.d.ts', 'dist/index.js', 'dist/modules/combat/index.d.ts', 'dist/modules/combat/index.js',
      'dist/modules/entity/index.d.ts', 'dist/modules/entity/index.js',
      'dist/modules/effect/index.d.ts', 'dist/modules/effect/index.js',
      'dist/modules/progression/index.d.ts', 'dist/modules/progression/index.js',
      'dist/modules/skill/index.d.ts', 'dist/modules/skill/index.js', 'package.json',
    ].sort());
    fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({name: 'foundation-consumer', private: true, type: 'module'}));
    exec([cli, 'install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temp, packed.filename), coreArtifact], temp);
    const installed = path.join(temp, 'node_modules/@rpg/gameplay');
    const expectedPackedFiles = packed.files.filter(file => file.path.startsWith('dist/'))
      .map(file => [file.path, fs.readFileSync(path.join(root, file.path))]);
    const assertPackedFiles = () => {
      for (const [file, bytes] of expectedPackedFiles) {
        assert.deepEqual(fs.readFileSync(path.join(installed, file)), bytes, `installed artifact content: ${file}`);
      }
    };
    assertPackedFiles();
    const effectFile = path.join(installed, 'dist/modules/effect/index.js');
    const effectBytes = fs.readFileSync(effectFile);
    try {
      fs.appendFileSync(effectFile, '\n// deliberate installed artifact drift\n');
      assert.throws(assertPackedFiles, /installed artifact content/);
    } finally {fs.writeFileSync(effectFile, effectBytes);}
    assertPackedFiles();
    console.log('INSTALLED_EFFECT_ARTIFACT_NEGATIVE_PASS actual_dist_bytes; content_drift_rejected');
    assert.equal(fs.lstatSync(installed).isSymbolicLink(), false, 'must install tarball, not source link');
    assert.ok(fs.existsSync(path.join(installed, 'dist/index.d.ts')));
    assert.equal(fs.existsSync(path.join(installed, 'src')), false);
    const packageJson = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    assertVersion(packageJson.version, '0.6.6');
    assertVersion(JSON.parse(fs.readFileSync(path.join(temp, 'node_modules/@rpg/core/package.json'), 'utf8')).version, pin.version);
    assert.equal(fs.lstatSync(path.join(temp, 'node_modules/@rpg/core')).isSymbolicLink(), false);
    assert.deepEqual(packageJson.peerDependencies, {'@rpg/core': '2.0.0'});
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.type, 'module');
    assert.deepEqual(packageJson.exports, {'.': {types: './dist/index.d.ts', import: './dist/index.js'}});
    fs.writeFileSync(path.join(temp, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import * as gameplay from '@rpg/gameplay';
import {calculateResourceTransition} from '@rpg/core/kernel';
assert.deepEqual(Object.keys(gameplay).sort(), ['composeModules', 'configureModules', 'createGameplayRuntime', 'createModuleRegistry',
 'disposeGameplayRuntime', 'getModule', 'initializeGameplayRuntime', 'inspectGameplayRuntime', 'isModuleEnabled', 'listModules',
 'registerModule', 'resolveModuleDependencies', 'startGameplayRuntime', 'stopGameplayRuntime', 'validateModuleDefinition',
 'createGameplayMessaging', 'registerCommandHandler', 'dispatchCommand', 'subscribeEvent', 'publishEvent', 'unsubscribeEvent', 'unsubscribeModuleEvents',
 'createExecutionContext', 'readExecutionTime', 'nextExecutionRandom', 'nextExecutionId', 'createEntity',
 'createEntityCollection', 'addEntity', 'getEntity', 'hasEntity', 'listEntities', 'removeEntity', 'replaceEntity',
 'createEntityAttributeState', 'getEntityBaseAttributes', 'setEntityBaseAttribute', 'calculateEntityStats',
 'createEntityResourceState', 'getEntityResourceCurrent', 'normalizeEntityResource', 'transitionEntityResource', 'regenerateEntityResource', 'createEntityLifeState', 'resolveEntityDefeat', 'reviveEntity', 'createProgressionState', 'gainExperience', 'adjustExperience', 'evaluateLevelAdvancement', 'advanceProgressionLevel', 'createAttributePointState', 'grantAttributePointRewards', 'allocateAttributePoints', 'createSkillRankState', 'getSkillRank', 'createSkillPointState', 'grantSkillPointRewards', 'evaluateSkillUpgrade', 'upgradeSkillRank', 'createCombatActionContext', 'evaluateCombatActionAdmission', 'evaluateCombatTargetValidation', 'resolveCombatAttack', 'applyCombatAttackDamage', 'createSkillDefinition', 'createSkillInstance', 'evaluateSkillActivationAdmission', 'evaluateSkillResourceCosts', 'applySkillResourceCosts', 'createSkillCooldownState', 'evaluateSkillCooldownReady', 'startSkillCooldown', 'activateSkill', 'reportSkillExecutionOutcome', 'createSkillLoadoutState', 'validateSkillLoadoutState', 'assignSkillLoadoutSlot', 'replaceSkillLoadoutSlot', 'removeSkillLoadoutSlot', 'createEffectDefinition', 'createEffectInstance', 'createEffectState', 'validateEffectState', 'evaluateEffectApplyAdmission', 'applyEffect', 'createEffectLifecycleState', 'startEffectLifetime', 'advanceEffectLifecycle', 'removeEffectLifetime', 'inspectEffectStackGroups', 'evaluateEffectStackAdmission', 'applyEffectStack', 'refreshEffectStackLifetime', 'consumeEffectStacks', 'removeEffectStackGroup', 'createEffectModifierState', 'applyEffectModifierTransition', 'listActiveEffectModifiers', 'createEffectStatusState', 'applyEffectStatusTransition', 'listActiveEffectStatuses', 'listActiveEffectRestrictions', 'evaluateEffectRestrictionGate', 'createEffectPeriodicState', 'applyEffectPeriodicTransition', 'getNextDueEffectTick', 'completeEffectPeriodicTick'].sort());
// Independent contract oracle: 8 units minus 3 gives 5, bounds [0,10].
assert.deepEqual(calculateResourceTransition({resource:'energy',current:8,maximum:10,
 amount:3,operation:'decrease',rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}),
 {resource:'energy',before:8,after:5,applied:3,reachedMinimum:false});
for (const spec of ['@rpg/gameplay/src/index.ts','@rpg/gameplay/dist/index.js', '@rpg/gameplay/foundation/modules', '@rpg/gameplay/foundation/runtime', '@rpg/gameplay/dist/foundation/runtime/index.js', '@rpg/gameplay/foundation/messaging', '@rpg/gameplay/dist/foundation/messaging/index.js', '@rpg/gameplay/foundation/execution', '@rpg/gameplay/dist/foundation/execution/index.js', '@rpg/gameplay/modules/entity', '@rpg/gameplay/dist/modules/entity/index.js', '@rpg/gameplay/modules/combat', '@rpg/gameplay/dist/modules/combat/index.js', '@rpg/gameplay/modules/progression', '@rpg/gameplay/dist/modules/progression/index.js', '@rpg/gameplay/skill', '@rpg/gameplay/skill/internal', '@rpg/gameplay/modules/skill', '@rpg/gameplay/dist/modules/skill/index.js', '@rpg/gameplay/effect', '@rpg/gameplay/modules/effect', '@rpg/gameplay/dist/modules/effect/index.js']) {
 await assert.rejects(import(spec), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
}
`);
    exec(['consumer.mjs'], temp);
    // A missing packaged root export must fail the very same runtime consumer.
    const installedRoot = path.join(installed, 'dist/index.js');
    const rootSource = fs.readFileSync(installedRoot, 'utf8');
    for (const requiredExport of ['activateSkill', 'createEffectInstance', 'evaluateEffectApplyAdmission', 'applyEffect', 'createEffectLifecycleState', 'startEffectLifetime', 'advanceEffectLifecycle', 'removeEffectLifetime', 'inspectEffectStackGroups', 'evaluateEffectStackAdmission', 'applyEffectStack', 'refreshEffectStackLifetime', 'consumeEffectStacks', 'removeEffectStackGroup', 'createEffectModifierState', 'applyEffectModifierTransition', 'listActiveEffectModifiers', 'createEffectStatusState', 'applyEffectStatusTransition', 'listActiveEffectStatuses', 'listActiveEffectRestrictions', 'evaluateEffectRestrictionGate', 'createEffectPeriodicState', 'applyEffectPeriodicTransition', 'getNextDueEffectTick', 'completeEffectPeriodicTick']) {
      const pattern = new RegExp(`\\b${requiredExport}\\b`);
      assert.match(rootSource, pattern);
      try {
        fs.writeFileSync(installedRoot, rootSource.replace(pattern, `${requiredExport} as deliberatelyMissingExport`));
        assert.throws(() => exec(['consumer.mjs'], temp), new RegExp(requiredExport));
      } finally {fs.writeFileSync(installedRoot, rootSource);}
    }
    console.log('INSTALLED_EFFECT_RUNNER_NEGATIVE_PASS missing_Effect_root_export');
    console.log('INSTALLED_EFFECT_APPLICATION_RUNNER_NEGATIVE_PASS missing_admission_and_apply_exports');
    fs.copyFileSync(path.join(root, 'tests/consumers/modules.mjs'), path.join(temp, 'modules.mjs'));
    const moduleEvidence = exec(['--test', '--test-reporter=tap', 'modules.mjs'], temp);
    assert.match(moduleEvidence, /# pass 3/);
    assert.match(moduleEvidence, /# skipped 0/);
    console.log('INSTALLED_MODULE_CONTRACTS_PASS GF01–GF03; consumer_tests=3 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/modules.ts'), path.join(temp, 'modules.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/composition.mjs'), path.join(temp, 'composition.mjs'));
    const compositionEvidence = exec(['--test', '--test-reporter=tap', 'composition.mjs'], temp);
    assert.match(compositionEvidence, /# pass 4/);
    assert.match(compositionEvidence, /# skipped 0/);
    console.log('INSTALLED_COMPOSITION_CONTRACTS_PASS GF04–GF05; consumer_tests=4 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/composition.ts'), path.join(temp, 'composition.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/runtime.mjs'), path.join(temp, 'runtime.mjs'));
    const runtimeEvidence = exec(['--test', '--test-reporter=tap', 'runtime.mjs'], temp);
    assert.match(runtimeEvidence, /# pass 8/);
    assert.match(runtimeEvidence, /# skipped 0/);
    console.log('INSTALLED_RUNTIME_CONTRACTS_PASS GF06–GF09; consumer_tests=8 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/runtime.ts'), path.join(temp, 'runtime.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/messaging.mjs'), path.join(temp, 'messaging.mjs'));
    const messagingEvidence = exec(['--test', '--test-reporter=tap', 'messaging.mjs'], temp);
    assert.match(messagingEvidence, /# pass 7/);
    assert.match(messagingEvidence, /# skipped 0/);
    console.log('INSTALLED_MESSAGING_CONTRACTS_PASS GF10–GF13; consumer_tests=7 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/messaging.ts'), path.join(temp, 'messaging.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/execution.mjs'), path.join(temp, 'execution.mjs'));
    const executionEvidence = exec(['--test', '--test-reporter=tap', 'execution.mjs'], temp);
    assert.match(executionEvidence, /# pass 7/);
    assert.match(executionEvidence, /# skipped 0/);
    assert.match(executionEvidence, /FOUNDATION_TRACE_PASS/);
    console.log('INSTALLED_EXECUTION_CLOSURE_PASS GF14–GF16 + GF01–GF13 integration/profiles; consumer_tests=7 skipped=0');
    console.log(executionEvidence.split(/\r?\n/).find(line => line.includes('FOUNDATION_TRACE_PASS')));
    fs.copyFileSync(path.join(root, 'tests/consumers/execution.ts'), path.join(temp, 'execution.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/entity.mjs'), path.join(temp, 'entity.mjs'));
    const entityEvidence = exec(['--test', '--test-reporter=tap', 'entity.mjs'], temp);
    assert.match(entityEvidence, /# pass 3/);
    assert.match(entityEvidence, /# skipped 0/);
    console.log('INSTALLED_ENTITY_CONTRACTS_PASS EC01–EC03; consumer_tests=3 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/entity.ts'), path.join(temp, 'entity.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-collection.mjs'), path.join(temp, 'entity-collection.mjs'));
    const collectionEvidence = exec(['--test', '--test-reporter=tap', 'entity-collection.mjs'], temp);
    assert.match(collectionEvidence, /# pass 3/);
    assert.match(collectionEvidence, /# skipped 0/);
    console.log('INSTALLED_ENTITY_COLLECTION_CONTRACTS_PASS EC04–EC06; consumer_tests=3 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-collection.ts'), path.join(temp, 'entity-collection.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-stats.mjs'), path.join(temp, 'entity-stats.mjs'));
    const statsEvidence = exec(['--test', '--test-reporter=tap', 'entity-stats.mjs'], temp);
    assert.match(statsEvidence, /# pass 5/);
    assert.match(statsEvidence, /# skipped 0/);
    console.log('INSTALLED_ENTITY_STATS_CONTRACTS_PASS EC07–EC09; consumer_tests=5 skipped=0; oracle=25/29/32');
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-stats.ts'), path.join(temp, 'entity-stats.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-resources.mjs'), path.join(temp, 'entity-resources.mjs'));
    const resourceEvidence = exec(['--test', '--test-reporter=tap', 'entity-resources.mjs'], temp);
    assert.match(resourceEvidence, /# pass 5/);
    assert.match(resourceEvidence, /# skipped 0/);
    console.log('INSTALLED_ENTITY_RESOURCES_CONTRACTS_PASS EC10–EC13; consumer_tests=5 skipped=0; oracle=80/50/55/70; above-max=-20/10; regen=35');
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-resources.ts'), path.join(temp, 'entity-resources.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-life.mjs'), path.join(temp, 'entity-life.mjs'));
    const lifeEvidence = exec(['--test', '--test-reporter=tap', 'entity-life.mjs'], temp);
    assert.match(lifeEvidence, /# pass 5/);
    assert.match(lifeEvidence, /# skipped 0/);
    assert.match(lifeEvidence, /LIFE_TRACE_PASS/);
    assert.match(lifeEvidence, /LIFE_EVENTS_PASS/);
    console.log('INSTALLED_ENTITY_LIFE_CONTRACTS_PASS EC14–EC17; consumer_tests=5 skipped=0; explicit_life/events');
    console.log(lifeEvidence.split(/\r?\n/).find(line => line.includes('LIFE_TRACE_PASS')));
    console.log(lifeEvidence.split(/\r?\n/).find(line => line.includes('LIFE_EVENTS_PASS')));
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-life.ts'), path.join(temp, 'entity-life.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-integration.mjs'), path.join(temp, 'entity-integration.mjs'));
    const integrationEvidence = exec(['--test', '--test-reporter=tap', 'entity-integration.mjs'], temp);
    assert.match(integrationEvidence, /# pass 1/);
    assert.match(integrationEvidence, /# skipped 0/);
    assert.match(integrationEvidence, /ENTITY_INTEGRATION_TRACE_PASS/);
    assert.match(integrationEvidence, /ENTITY_PROFILE_DATA_PASS/);
    console.log('INSTALLED_ENTITY_INTEGRATION_PASS EC18; consumer_tests=1 skipped=0; sessions=2 literal_oracle');
    for (const marker of ['ENTITY_INTEGRATION_TRACE_PASS', 'ENTITY_PROFILE_DATA_PASS']) {
      console.log(integrationEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    fs.copyFileSync(path.join(root, 'tests/consumers/entity-integration.ts'), path.join(temp, 'entity-integration.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/progression.mjs'), path.join(temp, 'progression.mjs'));
    const progressionEvidence = exec(['--test', '--test-reporter=tap', 'progression.mjs'], temp);
    assert.match(progressionEvidence, /# pass 3/);
    assert.match(progressionEvidence, /# skipped 0/);
    console.log('INSTALLED_PROGRESSION_CONTRACTS_PASS PG01–PG03; consumer_tests=3 skipped=0; creation_only');
    fs.copyFileSync(path.join(root, 'tests/consumers/progression.ts'), path.join(temp, 'progression.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/experience.mjs'), path.join(temp, 'experience.mjs'));
    const experienceEvidence = exec(['--test', '--test-reporter=tap', 'experience.mjs'], temp);
    assert.match(experienceEvidence, /# pass 3/);
    assert.match(experienceEvidence, /# skipped 0/);
    assert.match(experienceEvidence, /EXPERIENCE_TRACE_PASS/);
    console.log('INSTALLED_EXPERIENCE_CONTRACTS_PASS PG04–PG06; consumer_tests=3 skipped=0; scalar_bookkeeping');
    console.log(experienceEvidence.split(/\r?\n/).find(line => line.includes('EXPERIENCE_TRACE_PASS')));
    fs.copyFileSync(path.join(root, 'tests/consumers/experience.ts'), path.join(temp, 'experience.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/advancement.mjs'), path.join(temp, 'advancement.mjs'));
    const advancementEvidence = exec(['--test', '--test-reporter=tap', 'advancement.mjs'], temp);
    assert.match(advancementEvidence, /# pass 3/);
    assert.match(advancementEvidence, /# skipped 0/);
    assert.match(advancementEvidence, /ADVANCEMENT_TRACE_PASS/);
    console.log('INSTALLED_ADVANCEMENT_CONTRACTS_PASS PG07–PG10; consumer_tests=3 skipped=0; explicit_modes');
    console.log(advancementEvidence.split(/\r?\n/).find(line => line.includes('ADVANCEMENT_TRACE_PASS')));
    fs.copyFileSync(path.join(root, 'tests/consumers/advancement.ts'), path.join(temp, 'advancement.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/attribute-points.mjs'), path.join(temp, 'attribute-points.mjs'));
    const pointEvidence = exec(['--test', '--test-reporter=tap', 'attribute-points.mjs'], temp);
    assert.match(pointEvidence, /# pass 4/);
    assert.match(pointEvidence, /# skipped 0/);
    assert.match(pointEvidence, /ATTRIBUTE_POINTS_TRACE_PASS/);
    console.log('INSTALLED_ATTRIBUTE_POINTS_CONTRACTS_PASS PG11–PG13; consumer_tests=4 skipped=0; cursor_rewards_allocation');
    console.log(pointEvidence.split(/\r?\n/).find(line => line.includes('ATTRIBUTE_POINTS_TRACE_PASS')));
    fs.copyFileSync(path.join(root, 'tests/consumers/attribute-points.ts'), path.join(temp, 'attribute-points.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-progression.mjs'), path.join(temp, 'skill-progression.mjs'));
    const skillEvidence = exec(['--test', '--test-reporter=tap', 'skill-progression.mjs'], temp);
    assert.match(skillEvidence, /# pass 5/);
    assert.match(skillEvidence, /# skipped 0/);
    assert.match(skillEvidence, /SKILL_PROGRESSION_TRACE_PASS/);
    console.log('INSTALLED_SKILL_PROGRESSION_CONTRACTS_PASS PG14–PG18; consumer_tests=5 skipped=0; ranks_points_requirements_upgrade');
    console.log(skillEvidence.split(/\r?\n/).find(line => line.includes('SKILL_PROGRESSION_TRACE_PASS')));
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-progression.ts'), path.join(temp, 'skill-progression.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/progression-integration.mjs'), path.join(temp, 'progression-integration.mjs'));
    const progressionIntegration = exec(['--test', '--test-reporter=tap', 'progression-integration.mjs'], temp);
    assert.match(progressionIntegration, /# pass 2\b/);
    assert.match(progressionIntegration, /# skipped 0\b/);
    for (const marker of ['PROGRESSION_INTEGRATION_TRACE_PASS', 'PROGRESSION_INTEGRATION_SESSIONS_PASS', 'POINT_POOL_ISOLATION_PASS']) {
      assert.ok(progressionIntegration.includes(marker), `Missing ${marker}`);
      console.log(progressionIntegration.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_PROGRESSION_INTEGRATION_PASS PG19 + F-001; consumer_tests=2 skipped=0; sessions=2 literal_oracle');
    fs.copyFileSync(path.join(root, 'tests/consumers/progression-integration.ts'), path.join(temp, 'progression-integration.ts'));
    const architecture = JSON.parse(fs.readFileSync(path.join(root, 'harness/modules.json'), 'utf8'));
    assert.deepEqual(architecture.modules, [
      {id: 'entity', optional: true, dependencies: []},
      {id: 'progression', optional: true, dependencies: ['entity']},
      {id: 'combat', optional: true, dependencies: ['entity']},
      {id: 'skill', optional: true, dependencies: ['entity']},
      {id: 'effect', optional: true, dependencies: ['entity']},
    ]);
    fs.copyFileSync(path.join(root, 'tests/consumers/combat.mjs'), path.join(temp, 'combat.mjs'));
    const combatEvidence = exec(['--test', '--test-reporter=tap', 'combat.mjs'], temp);
    assert.match(combatEvidence, /# pass 4\b/);
    assert.match(combatEvidence, /# skipped 0\b/);
    for (const marker of ['COMBAT_CONTEXT_PASS', 'COMBAT_VALIDATION_PASS']) {
      assert.ok(combatEvidence.includes(marker), `Missing ${marker}`);
      console.log(combatEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_COMBAT_FOUNDATION_PASS CB01–CB05; consumer_tests=4 skipped=0; structural_intent_only');
    fs.copyFileSync(path.join(root, 'tests/consumers/combat.ts'), path.join(temp, 'combat.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-admission.mjs'), path.join(temp, 'combat-admission.mjs'));
    const admissionEvidence = exec(['--test', '--test-reporter=tap', 'combat-admission.mjs'], temp);
    assert.match(admissionEvidence, /# pass 4\b/);
    assert.match(admissionEvidence, /# skipped 0\b/);
    for (const marker of ['COMBAT_ADMISSION_PRIORITY_PASS', 'COMBAT_ADMISSION_VALIDATION_PASS', 'COMBAT_ADMISSION_SESSIONS_PASS']) {
      assert.ok(admissionEvidence.includes(marker), `Missing ${marker}`);
      console.log(admissionEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_COMBAT_ADMISSION_PASS CB06–CB10; consumer_tests=4 skipped=0; source_stage_only');
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-admission.ts'), path.join(temp, 'combat-admission.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-target.mjs'), path.join(temp, 'combat-target.mjs'));
    const targetEvidence = exec(['--test', '--test-reporter=tap', 'combat-target.mjs'], temp);
    assert.match(targetEvidence, /# pass 4\b/);
    assert.match(targetEvidence, /# skipped 0\b/);
    for (const marker of ['COMBAT_TARGET_POLICY_PASS', 'COMBAT_TARGET_VALIDATION_PASS', 'COMBAT_TARGET_SESSIONS_PASS']) {
      assert.ok(targetEvidence.includes(marker), `Missing ${marker}`);
      console.log(targetEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_COMBAT_TARGET_PASS CB11-CB15; consumer_tests=4 skipped=0; target_evaluation_only');
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-target.ts'), path.join(temp, 'combat-target.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-attack.mjs'), path.join(temp, 'combat-attack.mjs'));
    const attackEvidence = exec(['--test', '--test-reporter=tap', 'combat-attack.mjs'], temp);
    assert.match(attackEvidence, /# pass 7\b/);
    assert.match(attackEvidence, /# skipped 0\b/);
    for (const marker of ['COMBAT_ATTACK_ORACLE_PASS', 'COMBAT_ATTACK_RNG_PASS', 'COMBAT_ATTACK_VALIDATION_PASS', 'COMBAT_ATTACK_SESSIONS_PASS']) {
      assert.ok(attackEvidence.includes(marker), `Missing ${marker}`);
      console.log(attackEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_COMBAT_ATTACK_PASS CB16-CB20; consumer_tests=7 skipped=0; resolution_only');
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-attack.ts'), path.join(temp, 'combat-attack.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-damage.mjs'), path.join(temp, 'combat-damage.mjs'));
    const damageEvidence = exec(['--test', '--test-reporter=tap', 'combat-damage.mjs'], temp);
    assert.match(damageEvidence, /# pass 8\b/);
    assert.match(damageEvidence, /# skipped 0\b/);
    for (const marker of ['COMBAT_DAMAGE_NORMAL_PASS', 'COMBAT_DAMAGE_DEFEAT_PASS', 'COMBAT_DAMAGE_ABOVEMAX_PASS',
      'COMBAT_DAMAGE_NOOP_PASS', 'COMBAT_DAMAGE_VALIDATION_PASS', 'COMBAT_DAMAGE_REPLAY_PASS']) {
      assert.ok(damageEvidence.includes(marker), `Missing ${marker}`);
      console.log(damageEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_COMBAT_DAMAGE_PASS CB21-CB25; consumer_tests=8 skipped=0; canonical_resource_life');
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-damage.ts'), path.join(temp, 'combat-damage.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-integration.mjs'), path.join(temp, 'combat-integration.mjs'));
    const combatIntegration = exec(['--test', '--test-reporter=tap', 'combat-integration.mjs'], temp);
    assert.match(combatIntegration, /# pass 3\b/);
    assert.match(combatIntegration, /# skipped 0\b/);
    for (const marker of ['COMBAT_INTEGRATION_TRACE_PASS', 'COMBAT_INTEGRATION_REPLAY_PASS',
      'COMBAT_INTEGRATION_NEGATIVE_PASS', 'COMBAT_INTEGRATION_ACCOUNTING_PASS']) {
      assert.ok(combatIntegration.includes(marker), `Missing ${marker}`);
      console.log(combatIntegration.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_COMBAT_INTEGRATION_PASS CB26-CB30; consumer_tests=3 skipped=0; sessions2/literal_oracle');
    fs.copyFileSync(path.join(root, 'tests/consumers/combat-integration.ts'), path.join(temp, 'combat-integration.ts'));
    fs.copyFileSync(path.join(root, 'harness/modules.json'), path.join(temp, 'skill-modules.json'));
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-foundation.mjs'), path.join(temp, 'skill-foundation.mjs'));
    const skillFoundationEvidence = exec(['--test', '--test-reporter=tap', 'skill-foundation.mjs'], temp);
    assert.match(skillFoundationEvidence, /# tests 3\b/);
    assert.match(skillFoundationEvidence, /# pass 3\b/);
    assert.match(skillFoundationEvidence, /# skipped 0\b/);
    for (const marker of ['SKILL_FOUNDATION_IDENTITY_PASS', 'SKILL_FOUNDATION_VALIDATION_PASS', 'SKILL_FOUNDATION_COMPOSITION_PASS']) {
      assert.ok(skillFoundationEvidence.includes(marker), `Missing ${marker}`);
      console.log(skillFoundationEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_SKILL_FOUNDATION_PASS SK01-SK05; consumer_tests=3 skipped=0; identity_only');
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-foundation.ts'), path.join(temp, 'skill-foundation.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-admission.mjs'), path.join(temp, 'skill-admission.mjs'));
    const skillAdmissionEvidence = exec(['--test', '--test-reporter=tap', 'skill-admission.mjs'], temp);
    assert.match(skillAdmissionEvidence, /# tests 4\b/);
    assert.match(skillAdmissionEvidence, /# pass 4\b/);
    assert.match(skillAdmissionEvidence, /# skipped 0\b/);
    for (const marker of ['SKILL_ADMISSION_OUTCOMES_PASS', 'SKILL_ADMISSION_PRIORITY_PASS',
      'SKILL_ADMISSION_VALIDATION_PASS', 'SKILL_ADMISSION_ISOLATION_PASS']) {
      assert.ok(skillAdmissionEvidence.includes(marker), `Missing ${marker}`);
      console.log(skillAdmissionEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_SKILL_ADMISSION_PASS SK06-SK10; consumer_tests=4 skipped=0; availability_only');
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-admission.ts'), path.join(temp, 'skill-admission.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-resource-costs.mjs'), path.join(temp, 'skill-resource-costs.mjs'));
    const skillCostEvidence = exec(['--test', '--test-reporter=tap', 'skill-resource-costs.mjs'], temp);
    assert.match(skillCostEvidence, /# tests 5\b/);
    assert.match(skillCostEvidence, /# pass 5\b/);
    assert.match(skillCostEvidence, /# fail 0\b/);
    assert.match(skillCostEvidence, /# skipped 0\b/);
    for (const marker of ['SKILL_COST_NUMERICAL_PASS', 'SKILL_COST_ATOMICITY_PASS', 'SKILL_COST_NOOP_PASS',
      'SKILL_COST_VALIDATION_PASS', 'SKILL_COST_ISOLATION_PASS']) {
      assert.match(skillCostEvidence, new RegExp(marker));
      console.log(skillCostEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_SKILL_RESOURCE_COSTS_PASS SK11-SK15; consumer_tests=5 skipped=0; all_or_nothing_candidates');
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-resource-costs.ts'), path.join(temp, 'skill-resource-costs.ts'));

    fs.copyFileSync(path.join(root, 'tests/consumers/skill-cooldown.mjs'), path.join(temp, 'skill-cooldown.mjs'));
    const cooldownEvidence = exec(['--test', '--test-reporter=tap', 'skill-cooldown.mjs'], temp);
    assert.match(cooldownEvidence, /# tests 5\b/);
    assert.match(cooldownEvidence, /# pass 5\b/);
    assert.match(cooldownEvidence, /# fail 0\b/);
    assert.match(cooldownEvidence, /# skipped 0\b/);
    for (const marker of ['SKILL_COOLDOWN_DURATION_PASS', 'SKILL_COOLDOWN_BOUNDARY_PASS',
      'SKILL_COOLDOWN_VALIDATION_PASS', 'SKILL_COOLDOWN_ISOLATION_PASS', 'SKILL_COOLDOWN_REPLAY_PASS']) {
      assert.match(cooldownEvidence, new RegExp(marker));
      console.log(cooldownEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    }
    console.log('INSTALLED_SKILL_COOLDOWN_PASS SK16-SK20; consumer_tests=5 skipped=0; injected_clock_actual_Kernel');
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-cooldown.ts'), path.join(temp, 'skill-cooldown.ts'));

    for (const [fixture, count, markers] of [
      ['skill-activation', 5, ['SKILL_ACTIVATION_CANDIDATES_PASS', 'SKILL_ACTIVATION_GATES_PASS',
        'SKILL_ACTIVATION_VALIDATION_PASS', 'SKILL_EXECUTION_REPORT_PASS', 'SKILL_ACTIVATION_REPLAY_PASS']],
      ['skill-combat-handoff', 2, ['SKILL_COMBAT_PREFLIGHT_PASS', 'SKILL_COMBAT_HANDOFF_PASS']],
      ['skill-loadout', 5, ['SKILL_LOADOUT_TRANSITIONS_PASS', 'SKILL_LOADOUT_POLICY_PASS',
        'SKILL_LOADOUT_VALIDATION_PASS', 'SKILL_LOADOUT_BOUNDARY_PASS', 'SKILL_LOADOUT_ISOLATION_PASS']],
      ['skill-integration', 5, ['SKILL_INTEGRATION_TRACE_PASS', 'SKILL_INTEGRATION_CALLER_PASS',
        'SKILL_INTEGRATION_REJECTIONS_PASS', 'SKILL_INTEGRATION_LOADOUT_PASS', 'SKILL_INTEGRATION_VALIDATION_PASS']],
    ]) {
      copyRequiredConsumer(path.join(root, `tests/consumers/${fixture}.mjs`), path.join(temp, `${fixture}.mjs`));
      const evidence = exec(['--test', '--test-reporter=tap', `${fixture}.mjs`], temp);
      assertTapEvidence(evidence, count, markers);
      for (const metric of ['tests', 'pass']) assert.match(evidence, new RegExp(`# ${metric} ${count}\\b`));
      for (const metric of ['fail', 'cancelled', 'skipped', 'todo']) assert.match(evidence, new RegExp(`# ${metric} 0\\b`));
      for (const marker of markers) {
        assert.ok(evidence.includes(marker), `Missing ${marker}`);
        console.log(evidence.split(/\r?\n/).find(line => line.includes(marker)));
      }
      console.log(`INSTALLED_${fixture.toUpperCase().replaceAll('-', '_')}_PASS ${fixture === 'skill-integration' ? 'SK31-SK35' : fixture === 'skill-loadout' ? 'SK26-SK30' : 'SK21-SK25'}; consumer_tests=${count} skipped=0`);
    }
    fs.copyFileSync(path.join(root, 'tests/consumers/skill-activation.ts'), path.join(temp, 'skill-activation.ts'));

    fs.copyFileSync(path.join(root, 'tests/consumers/skill-loadout.ts'), path.join(temp, 'skill-loadout.ts'));
    copyRequiredConsumer(path.join(root, 'tests/consumers/skill-integration.ts'), path.join(temp, 'skill-integration.ts'));

    fs.copyFileSync(path.join(root, 'harness/modules.json'), path.join(temp, 'effect-modules.json'));
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-foundation.mjs'), path.join(temp, 'effect-foundation.mjs'));
    const effectEvidence = exec(['--test', '--test-reporter=tap', 'effect-foundation.mjs'], temp);
    const effectMarkers = ['EFFECT_IDENTITY_PASS', 'EFFECT_STATE_PASS', 'EFFECT_VALIDATION_PASS',
      'EFFECT_ISOLATION_PASS', 'EFFECT_COMPOSITION_PASS'];
    assertTapEvidence(effectEvidence, 5, effectMarkers);
    for (const marker of effectMarkers) console.log(effectEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_EFFECT_FOUNDATION_PASS EF01-EF05; consumer_tests=5 skipped=0; structural_only');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-foundation.ts'), path.join(temp, 'effect-foundation.ts'));
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-application.mjs'), path.join(temp, 'effect-application.mjs'));
    const applyEvidence = exec(['--test', '--test-reporter=tap', 'effect-application.mjs'], temp);
    const applyMarkers = ['EFFECT_APPLY_SOURCES_PASS', 'EFFECT_APPLY_PRIORITY_PASS', 'EFFECT_APPLY_CANDIDATE_PASS',
      'EFFECT_APPLY_VALIDATION_PASS', 'EFFECT_APPLY_REPLAY_PASS', 'EFFECT_APPLY_HANDOFF_PASS'];
    assertTapEvidence(applyEvidence, 6, applyMarkers);
    for (const marker of applyMarkers) console.log(applyEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_EFFECT_APPLICATION_PASS EF06-EF10; consumer_tests=6 skipped=0; candidate_only');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-application.ts'), path.join(temp, 'effect-application.ts'));
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-lifecycle.mjs'), path.join(temp, 'effect-lifecycle.mjs'));
    const lifecycleEvidence = exec(['--test', '--test-reporter=tap', 'effect-lifecycle.mjs'], temp);
    const lifecycleMarkers = ['EFFECT_LIFECYCLE_START_PASS', 'EFFECT_LIFECYCLE_EXPIRY_PASS', 'EFFECT_LIFECYCLE_REJECTIONS_PASS',
      'EFFECT_LIFECYCLE_REMOVAL_PASS', 'EFFECT_LIFECYCLE_VALIDATION_PASS', 'EFFECT_LIFECYCLE_REPLAY_PASS', 'EFFECT_LIFECYCLE_OWNERS_PASS'];
    assertTapEvidence(lifecycleEvidence, 7, lifecycleMarkers);
    for (const marker of lifecycleMarkers) console.log(lifecycleEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_EFFECT_LIFECYCLE_PASS EF11-EF15; consumer_tests=7 skipped=0; explicit_clock_candidates');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-lifecycle.ts'), path.join(temp, 'effect-lifecycle.ts'));
    // The actual installed consumer must reject incorrect expiry and tie-order expectations.
    const lifecycleFile = path.join(temp, 'effect-lifecycle.mjs');
    const lifecycleSource = fs.readFileSync(lifecycleFile, 'utf8').replaceAll('\r\n', '\n');
    for (const [expected, incorrect] of [
      ["events: [event('expired', 'A', 6000)]", "events: [event('expired', 'A', 6001)]"],
      ["event('expired', 'Z', 5000),\n    event('expired', 'a', 5000)", "event('expired', 'a', 5000),\n    event('expired', 'Z', 5000)"],
    ]) {
      assert.ok(lifecycleSource.includes(expected));
      try {
        fs.writeFileSync(lifecycleFile, lifecycleSource.replace(expected, incorrect));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-lifecycle.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(lifecycleFile, lifecycleSource);}
    }
    console.log('INSTALLED_EFFECT_LIFECYCLE_RUNNER_NEGATIVE_PASS all_four_exports; wrong_expiry; wrong_event_order');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-stacking.mjs'), path.join(temp, 'effect-stacking.mjs'));
    const stackEvidence = exec(['--test', '--test-reporter=tap', 'effect-stacking.mjs'], temp);
    const stackMarkers = ['EFFECT_STACK_GROUPS_PASS', 'EFFECT_STACK_ADMISSION_PASS', 'EFFECT_STACK_REFRESH_PASS',
      'EFFECT_STACK_CONSUME_PASS', 'EFFECT_STACK_PENDING_PASS', 'EFFECT_STACK_VALIDATION_PASS', 'EFFECT_STACK_REPLAY_PASS'];
    assertTapEvidence(stackEvidence, 7, stackMarkers);
    for (const marker of stackMarkers) console.log(stackEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_EFFECT_STACKING_PASS EF16-EF20; consumer_tests=7 skipped=0; canonical_membership');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-stacking.ts'), path.join(temp, 'effect-stacking.ts'));
    const stackBytes = fs.readFileSync(effectFile, 'utf8');
    for (const [expected, faulty] of [
      ["group.stackCount >= selection.maxStacks", "group.stackCount > selection.maxStacks"],
      ["if (count > group.stackCount)", "if (false)"],
      ["const state = lifecycleSnapshot({ ...current, lifetimes });",
        "const state = lifecycleSnapshot({ ...current, effectState: {...current.effectState, instances: current.effectState.instances.map(i => ({...i, effectInstanceId: 'replaced'}))}, lifetimes: lifetimes.map(l => ({...l, effectInstanceId: 'replaced'})) });"],
    ]) {
      assert.ok(stackBytes.includes(expected), `required stack fault injection: ${expected}`);
      try {
        fs.writeFileSync(effectFile, stackBytes.replace(expected, faulty));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-stacking.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(effectFile, stackBytes);}
    }
    assertPackedFiles();
    console.log('INSTALLED_EFFECT_STACKING_RUNNER_NEGATIVE_PASS all_six_exports; overflow; partial_consumption; replaced_identity');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-modifiers.mjs'), path.join(temp, 'effect-modifiers.mjs'));
    const modifierEvidence = exec(['--test', '--test-reporter=tap', 'effect-modifiers.mjs'], temp);
    const modifierMarkers = ['EFFECT_MODIFIER_CAPTURE_PASS', 'EFFECT_MODIFIER_NUMERICAL_PASS', 'EFFECT_MODIFIER_STACK_PASS',
      'EFFECT_MODIFIER_CLEANUP_PASS', 'EFFECT_MODIFIER_VALIDATION_PASS', 'EFFECT_MODIFIER_TRANSITION_PASS', 'EFFECT_MODIFIER_REPLAY_PASS'];
    assertTapEvidence(modifierEvidence, 7, modifierMarkers);
    for (const marker of modifierMarkers) console.log(modifierEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_EFFECT_MODIFIERS_PASS EF21-EF25; consumer_tests=7 skipped=0; actual_Entity_Core');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-modifiers.ts'), path.join(temp, 'effect-modifiers.ts'));
    const modifierFile = path.join(temp, 'effect-modifiers.mjs');
    const modifierSource = fs.readFileSync(modifierFile, 'utf8');
    for (const [expected, faulty] of [
      ['assert.equal(stats(f.state, [equipment]), 114)', 'assert.equal(stats(f.state, [equipment]), 999)'],
      ['assert.equal(stats(f.state), 100); assert.deepEqual(f.state.snapshots, [])',
        'assert.equal(stats(f.state), 120); assert.deepEqual(f.state.snapshots, [])'],
      ["['A']); assert.equal(stats(f.state), 110)", "['A']); assert.equal(stats(f.state), 120)"],
      ['assert.deepEqual(f.state.snapshots[0], previous.snapshots[0]); assert.equal(f.state.lifecycle.lifetimes[0].expiresAtMs, 10000)',
        'assert.equal(f.state.snapshots[0].modifiers[0].value, 0.9); assert.equal(f.state.lifecycle.lifetimes[0].expiresAtMs, 10000)'],
      ["{operation: 'multiply'}", "{operation: 'add_flat'}"],
      ["contract('EF21/22:", "test.skip('EF21/22:"],
      ['assert.', 'unchecked.'],
    ]) {
      assert.ok(modifierSource.includes(expected), `required modifier negative control: ${expected}`);
      try {
        const faultySource = expected === 'assert.'
          ? "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + modifierSource.replaceAll('assert.', 'unchecked.')
            .replace("unchecked.ok(assertions > 0, 'contract must execute real assertions')", "assert.ok(assertions > 0, 'contract must execute real assertions')")
          : modifierSource.replace(expected, faulty);
        fs.writeFileSync(modifierFile, faultySource);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-modifiers.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(modifierFile, modifierSource);}
    }
    const modifierRuntime = fs.readFileSync(effectFile, 'utf8');
    for (const [expected, faulty] of [
      ["if (operation !== 'add_flat' && operation !== 'add_percent' && operation !== 'add_percentage_points')",
        'if (false)'],
      ['state: modifierState({ lifecycle: next, snapshots })',
        "state: validated.action === 'advanced' && validated.removed.length ? previous : modifierState({ lifecycle: next, snapshots })"],
      ['state: modifierState({ lifecycle: next, snapshots })',
        "state: validated.action === 'consumed' ? previous : modifierState({ lifecycle: next, snapshots })"],
      ['return Object.freeze({ status: \'applied\', reason: \'none\', state: modifierState({ lifecycle: next, snapshots }) });',
        "if (validated.action === 'refreshed') snapshots[0] = {...snapshots[0], modifiers: snapshots[0].modifiers.map(m => ({...m, value: 0.9}))}; return Object.freeze({ status: 'applied', reason: 'none', state: modifierState({ lifecycle: next, snapshots }) });"],
    ]) {
      assert.ok(modifierRuntime.includes(expected), `required installed modifier fault: ${expected}`);
      try {
        // Target the new capture validator, leaving earlier Entity/lifecycle contracts intact.
        const position = modifierRuntime.indexOf('function modifierCapture(');
        fs.writeFileSync(effectFile, modifierRuntime.slice(0, position) + modifierRuntime.slice(position).replace(expected, faulty));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-modifiers.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(effectFile, modifierRuntime);}
    }
    assertPackedFiles();
    console.log('INSTALLED_EFFECT_MODIFIERS_RUNNER_NEGATIVE_PASS wrong_math; stale_expiry; consumed_contribution; refresh_payload; unsupported_operation; skipped; no_assertions; installed_runtime_faults4');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-restrictions.mjs'), path.join(temp, 'effect-restrictions.mjs'));
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-restrictions.ts'), path.join(temp, 'effect-restrictions.ts'));
    const statusMarkers = ['EFFECT_STATUS_CAPTURE_PASS', 'EFFECT_STATUS_PROVENANCE_PASS', 'EFFECT_STATUS_CLEANUP_PASS',
      'EFFECT_STATUS_VALIDATION_PASS', 'EFFECT_STATUS_TRANSITION_PASS', 'EFFECT_STATUS_ADMISSION_PASS',
      'EFFECT_STATUS_IMMUNITY_PASS', 'EFFECT_STATUS_REPLAY_PASS'];
    const statusEvidence = exec(['--test', '--test-reporter=tap', 'effect-restrictions.mjs'], temp);
    assertTapEvidence(statusEvidence, 8, statusMarkers);
    for (const marker of statusMarkers) console.log(statusEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_EFFECT_RESTRICTIONS_PASS EF26-EF30; consumer_tests=8 skipped=0; actual_Skill_Combat_EF08');
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, `effect-restrictions.${extension}`), saved = required + '.saved';
      try {
        fs.renameSync(required, saved);
        assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});
      } finally {fs.renameSync(saved, required);}
    }
    assert.throws(() => assertVersion('0.6.4', '0.6.5'), /installed package version/);
    const statusFile = path.join(temp, 'effect-restrictions.mjs'), statusSource = fs.readFileSync(statusFile, 'utf8');
    for (const [expected, faulty] of [
      ['return g.evaluateSkillActivationAdmission(', "return {status: 'admitted', reason: 'none'}; return g.evaluateSkillActivationAdmission("],
      ['return g.evaluateCombatActionAdmission(', "return {status: 'admitted', reason: 'none'}; return g.evaluateCombatActionAdmission("],
      ["contract('EF26/27:", "test.skip('EF26/27:"],
      ['assert.', 'unchecked.'],
    ]) {
      assert.ok(statusSource.includes(expected), `required restriction consumer fault: ${expected}`);
      try {
        const fault = expected === 'assert.'
          ? "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + statusSource.replaceAll('assert.', 'unchecked.')
            .replace("unchecked.ok(assertions > 0, 'contract must execute real assertions')", "assert.ok(assertions > 0, 'contract must execute real assertions')")
          : statusSource.replace(expected, faulty);
        fs.writeFileSync(statusFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-restrictions.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(statusFile, statusSource);}
    }
    const statusRuntime = fs.readFileSync(effectFile, 'utf8');
    for (const [expected, faulty] of [
      ['if (new Set(ids).size !== ids.length)', 'if (false)'],
      ['entityId !== lifecycle.effectState.entityId', 'false'],
      ['lifecycleSnapshot(lifecycle)', 'lifecycleSnapshot(lifecycle, true)'],
      ["return Object.freeze({ status: 'applied', reason: 'none', state: statusState(next,",
        "if (validated.action === 'refreshed') snapshots[0] = Object.freeze({...snapshots[0], restrictionIds: Object.freeze(['changed'])}); return Object.freeze({ status: 'applied', reason: 'none', state: statusState(next,"],
      ['const next = validated.state;', "if (validated.action === 'advanced' && validated.removed.length) return Object.freeze({status: 'applied', reason: 'none', state: previous}); const next = validated.state;"],
      ['contributors.push(snapshot.effectInstanceId);', 'contributors.length;'],
    ]) {
      const find = expected, replacement = faulty;
      const start = statusRuntime.indexOf('function statusIds(');
      const tail = statusRuntime.slice(start);
      assert.ok(tail.includes(find), `required installed restriction fault: ${find}`);
      try {
        fs.writeFileSync(effectFile, statusRuntime.slice(0, start) + tail.replaceAll(find, replacement));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-restrictions.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(effectFile, statusRuntime);}
    }
    assertPackedFiles();
    console.log('INSTALLED_EFFECT_RESTRICTIONS_RUNNER_NEGATIVE_PASS all_five_exports; missing_fixtures; wrong_version; duplicates; wrong_entity; stale_boundary; refresh_overwrite; expired_blocker; collapsed_contributors; actual_admission_bypass; skipped; no_assertions; runtime_faults6');
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-periodic.mjs'), path.join(temp, 'effect-periodic.mjs'));
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-periodic.ts'), path.join(temp, 'effect-periodic.ts'));
    const periodicMarkers = ['CAPTURE', 'TIMELINE', 'STACK', 'RESOURCE', 'DEATH', 'RECOVERY', 'VALIDATION', 'REPLAY'].map(x => 'EFFECT_PERIODIC_' + x + '_PASS');
    const periodicEvidence = exec(['--test', '--test-reporter=tap', 'effect-periodic.mjs'], temp);
    assertTapEvidence(periodicEvidence, 8, periodicMarkers);
    for (const marker of periodicMarkers) console.log(periodicEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_EFFECT_PERIODIC_PASS EF31-EF35; consumer_tests=8 skipped=0; actual_Entity_Core_Resource_Life');
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, 'effect-periodic.' + extension), saved = required + '.saved';
      try {fs.renameSync(required, saved); assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});}
      finally {fs.renameSync(saved, required);}
    }
    assert.throws(() => assertVersion('0.6.5', '0.6.6'), /installed package version/);
    const periodicFile = path.join(temp, 'effect-periodic.mjs'), periodicSource = fs.readFileSync(periodicFile, 'utf8');
    for (const [expected, faulty] of [
      ["contract('EF31:", "test.skip('EF31:"],
      ['const resource = g.transitionEntityResource(', 'const resource = null; throw new TypeError("Entity operation bypassed"); g.transitionEntityResource('],
      ['maximum: 100, amount, operation:', 'maximum: 1000, amount, operation:'],
      ['assert.', 'unchecked.'],
    ]) {
      assert.ok(periodicSource.includes(expected), 'required periodic consumer fault: ' + expected);
      try {
        const fault = expected === 'assert.'
          ? "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + periodicSource.replaceAll('assert.', 'unchecked.')
            .replace("unchecked.ok(assertions > 0, 'contract must execute real assertions')", "assert.ok(assertions > 0, 'contract must execute real assertions')")
          : periodicSource.replace(expected, faulty);
        fs.writeFileSync(periodicFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-periodic.mjs'], temp), /AssertionError|ERR_ASSERTION|Entity operation bypassed/);
      } finally {fs.writeFileSync(periodicFile, periodicSource);}
    }
    const periodicRuntime = fs.readFileSync(effectFile, 'utf8'), periodicStart = periodicRuntime.indexOf('function periodicCapture(');
    assert.ok(periodicStart > 0);
    for (const [expected, faulty] of [
      ['entry.nextTickAtMs > lifetime.expiresAtMs', 'entry.nextTickAtMs >= lifetime.expiresAtMs'],
      ['periodicNext(entry.nextTickAtMs, entry.intervalMs)', 'periodicNext(entry.nextTickAtMs, entry.intervalMs * 2)'],
      ["if (status === 'dead')", 'if (false)'],
      ['if (existing)\n            return existing;', 'if (existing && existing.mode === "periodic") return {...existing, nextTickAtMs: existing.nextTickAtMs + 123}; if (existing) return existing;'],
      ['if (periodicDue(before, previous, next.observedAtMs))', 'if (false)'],
      ["return Object.freeze({ status: 'rejected', reason: 'stale_tick', state: null, events: Object.freeze([]) });", "return Object.freeze({status: 'applied', reason: 'none', state: current, events: Object.freeze([])});"],
    ]) {
      const tail = periodicRuntime.slice(periodicStart);
      assert.ok(tail.includes(expected), 'required installed periodic fault: ' + expected);
      try {
        fs.writeFileSync(effectFile, periodicRuntime.slice(0, periodicStart) + tail.replaceAll(expected, faulty));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-periodic.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(effectFile, periodicRuntime);}
    }
    assertPackedFiles();
    console.log('INSTALLED_EFFECT_PERIODIC_RUNNER_NEGATIVE_PASS all_four_exports; missing_fixtures; wrong_version; expiry_tick; catchup; duplicate_completion; target_death; refresh_cadence; pending_tick_loss; Entity_bypass; HoT_maximum; skipped; no_assertions; runtime_faults6');
    const effectDeclarations = fs.readFileSync(path.join(installed, 'dist/modules/effect/index.d.ts'), 'utf8');
    assert.doesNotMatch(effectDeclarations, /\b(?:any|effectFields|sourceSnapshot|instanceSnapshot|applyPolicySnapshot|lifecycleTime|lifecycleArray|lifecycleSnapshot|durationSnapshot|sameEffectInstance|applicationSnapshot|lifecycleEvent|companionTransition|CompanionTransition|statusCapture|statusState|periodicCapture|periodicNext|periodicState|periodicDue|periodicLife|Set|Map|WeakMap|EffectEngine|EffectRuntime)\b|\bfunction\s+(?:effectId|statusIds)\b/);

    const skillDeclarations = fs.readFileSync(path.join(installed, 'dist/modules/skill/index.d.ts'), 'utf8');
    assert.doesNotMatch(skillDeclarations, /\b(?:any|identityField|admissionFields|admissionId|rankPolicy|costArray|costNumber|captureResourceCosts|resolveResourceCosts|cooldownIdentity|cooldownTime|cooldownSnapshot|cooldownAssessment|cooldownConfiguration|executionDispatch|executionIntent|activationAdmission|mutateLoadoutSlot|Set|Map|WeakMap|SkillEngine|SkillRuntime)\b/);
    const combatDeclarations = fs.readFileSync(path.join(installed, 'dist/modules/combat/index.d.ts'), 'utf8');
    assert.doesNotMatch(combatDeclarations, /\b(?:any|dataFields|identifier|Map|WeakMap|Set|CombatSession|CombatEngine)\b/);
    const progressionDeclarations = fs.readFileSync(path.join(installed, 'dist/modules/progression/index.d.ts'), 'utf8');
    assert.doesNotMatch(progressionDeclarations, /\b(?:Map|WeakMap|Set|WeakSet|ProgressionEngine|ProgressionManager|dataFields|finite|progressionValues|readState|positiveLevel|resolveLevelAdvancement|safePoints|pointValues|readPointState|readRewardAdvancement|createPointState|grantPointRewards|skillIdentifier|rankMap|readSkillRanks|resolveSkillUpgrade)\b/);
    const entityDeclarations = fs.readFileSync(path.join(installed, 'dist/modules/entity/index.d.ts'), 'utf8');
    assert.doesNotMatch(entityDeclarations, /\b(?:readCollection|makeCollection|requireEntityId|Map|WeakMap|Set|WeakSet)\b/);
    const executionDeclarations = fs.readFileSync(path.join(installed, 'dist/foundation/execution/index.d.ts'), 'utf8');
    assert.doesNotMatch(executionDeclarations, /\b(?:ExecutionData|executionRecords|capture|readContext|WeakMap)\b/);
    const messagingDeclarations = fs.readFileSync(path.join(installed, 'dist/foundation/messaging/index.d.ts'), 'utf8');
    assert.doesNotMatch(messagingDeclarations, /\b(?:MessagingData|messagingRecords|readMessaging|beginExecution|snapshotMessage|requireSynchronous|Map|WeakMap|WeakSet)\b/);
    const runtimeDeclarations = fs.readFileSync(path.join(installed, 'dist/foundation/runtime/index.d.ts'), 'utf8');
    assert.doesNotMatch(runtimeDeclarations, /\b(?:RuntimeData|snapshotComposition|snapshotBindings|readRuntime|makeRuntime|transition|WeakMap)\b/);
    const declarations = fs.readFileSync(path.join(installed, 'dist/foundation/modules/index.d.ts'), 'utf8');
    assert.doesNotMatch(declarations, /\b(?:isRecord|requireId|readIds|describeCycle|Map|WeakMap)\b/);
    fs.writeFileSync(path.join(temp, 'consumer.ts'), `
import * as gameplay from '@rpg/gameplay';
import {calculateResourceTransition, type ResourceTransitionInput} from '@rpg/core/kernel';
const input: ResourceTransitionInput<'energy'> = {resource:'energy',current:8,maximum:10,
 amount:3,operation:'decrease',rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}};
const resource: 'energy' = calculateResourceTransition(input).resource;
// @ts-expect-error No gameplay execution engine is exposed.
gameplay.createGameplayEngine();
// @ts-expect-error Installed Kernel declarations must reject invalid operation.
const invalid: ResourceTransitionInput['operation'] = 'teleport';
void resource; void invalid;
`);
    fs.writeFileSync(path.join(temp, 'tsconfig.json'), JSON.stringify({compilerOptions: {
      target:'ES2022', lib:['ES2022'], module:'NodeNext', moduleResolution:'NodeNext',
      strict:true, noEmit:true, types:[], skipLibCheck:false
    }, files:['consumer.ts', 'modules.ts', 'composition.ts', 'runtime.ts', 'messaging.ts', 'execution.ts', 'entity.ts', 'entity-collection.ts', 'entity-stats.ts', 'entity-resources.ts', 'entity-life.ts', 'entity-integration.ts', 'progression.ts', 'experience.ts', 'advancement.ts', 'attribute-points.ts', 'skill-progression.ts', 'progression-integration.ts', 'combat.ts', 'combat-admission.ts', 'combat-target.ts', 'combat-attack.ts', 'combat-damage.ts', 'combat-integration.ts', 'skill-foundation.ts', 'skill-admission.ts', 'skill-resource-costs.ts', 'skill-cooldown.ts', 'skill-activation.ts', 'skill-loadout.ts', 'skill-integration.ts', 'effect-foundation.ts', 'effect-application.ts', 'effect-lifecycle.ts', 'effect-stacking.ts', 'effect-modifiers.ts', 'effect-restrictions.ts', 'effect-periodic.ts']}));
    exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp);
    fs.writeFileSync(path.join(temp, 'broken.ts'), "import type {SkillActivationInput} from '@rpg/gameplay';const invalid: SkillActivationInput = {};void invalid;");
    fs.writeFileSync(path.join(temp, 'negative-tsconfig.json'), JSON.stringify({extends: './tsconfig.json', files: ['broken.ts']}));
    assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'negative-tsconfig.json'], temp), /TS\d+/);
    fs.writeFileSync(path.join(temp, 'broken-status.ts'), "import type {EffectStatusCapture} from '@rpg/gameplay';const invalid: EffectStatusCapture = {statusIds: []};void invalid;");
    fs.writeFileSync(path.join(temp, 'negative-status-tsconfig.json'), JSON.stringify({extends: './tsconfig.json', files: ['broken-status.ts']}));
    assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'negative-status-tsconfig.json'], temp), /TS\d+/);
    fs.writeFileSync(path.join(temp, 'broken-periodic.ts'), "import type {EffectPeriodicCapture} from '@rpg/gameplay';const invalid: EffectPeriodicCapture = {mode: 'periodic', kind: 'dot'};void invalid;");
    fs.writeFileSync(path.join(temp, 'negative-periodic-tsconfig.json'), JSON.stringify({extends: './tsconfig.json', files: ['broken-periodic.ts']}));
    assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'negative-periodic-tsconfig.json'], temp), /TS\d+/);
    console.log('INSTALLED_CONSUMER_NEGATIVE_PASS missing_root_export; real_TypeScript_failure; required_commands_nonzero');
  } finally {
    const resolved = fs.realpathSync(temp);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rpg package consumer '));
    fs.rmSync(resolved, {recursive: true, force: true});
  }
});
