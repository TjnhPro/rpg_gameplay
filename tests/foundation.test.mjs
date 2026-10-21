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
function assertActivationRegistration(receipt) {
  assert.ok(receipt, 'mandatory installed activation consumer registration');
  assertTapEvidence(receipt.runtime, 11, Array.from({length:48}, (_, i) => 'ENCOUNTER_A' + String(i + 1).padStart(2, '0') + '_PASS'));
  assert.equal(receipt.typechecked, true, 'mandatory external activation strict NodeNext');
}

test('installed artifact: GF01–GF16 + EC01–EC18 + PG01–PG19 + CB01–CB30 + SK01–SK35 + EF01–EF40 + AI01–AI40 + EN01–EN10, ESM root, closed exports, strict declarations and real Kernel', () => {
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
      'dist/modules/actor-ai/index.d.ts', 'dist/modules/actor-ai/index.js',
      'dist/modules/encounter/index.d.ts', 'dist/modules/encounter/index.js',
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
    let activationReceipt;
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
    assertVersion(packageJson.version, '0.8.1');
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
 'createEntityResourceState', 'getEntityResourceCurrent', 'normalizeEntityResource', 'transitionEntityResource', 'regenerateEntityResource', 'createEntityLifeState', 'resolveEntityDefeat', 'reviveEntity', 'createProgressionState', 'gainExperience', 'adjustExperience', 'evaluateLevelAdvancement', 'advanceProgressionLevel', 'createAttributePointState', 'grantAttributePointRewards', 'allocateAttributePoints', 'createSkillRankState', 'getSkillRank', 'createSkillPointState', 'grantSkillPointRewards', 'evaluateSkillUpgrade', 'upgradeSkillRank', 'createCombatActionContext', 'evaluateCombatActionAdmission', 'evaluateCombatTargetValidation', 'resolveCombatAttack', 'applyCombatAttackDamage', 'createSkillDefinition', 'createSkillInstance', 'evaluateSkillActivationAdmission', 'evaluateSkillResourceCosts', 'applySkillResourceCosts', 'createSkillCooldownState', 'evaluateSkillCooldownReady', 'startSkillCooldown', 'activateSkill', 'reportSkillExecutionOutcome', 'createSkillLoadoutState', 'validateSkillLoadoutState', 'assignSkillLoadoutSlot', 'replaceSkillLoadoutSlot', 'removeSkillLoadoutSlot', 'createEffectDefinition', 'createEffectInstance', 'createEffectState', 'validateEffectState', 'evaluateEffectApplyAdmission', 'applyEffect', 'createEffectLifecycleState', 'startEffectLifetime', 'advanceEffectLifecycle', 'removeEffectLifetime', 'inspectEffectStackGroups', 'evaluateEffectStackAdmission', 'applyEffectStack', 'refreshEffectStackLifetime', 'consumeEffectStacks', 'removeEffectStackGroup', 'createEffectModifierState', 'applyEffectModifierTransition', 'listActiveEffectModifiers', 'createEffectStatusState', 'applyEffectStatusTransition', 'listActiveEffectStatuses', 'listActiveEffectRestrictions', 'evaluateEffectRestrictionGate', 'createEffectPeriodicState', 'applyEffectPeriodicTransition', 'getNextDueEffectTick', 'completeEffectPeriodicTick', 'cleanupDefeatedTargetEffects', 'createActorAIProfileReference', 'createActorAIState', 'validateActorAIState', 'createActorAIDecisionContext', 'createActorAIActionIntent', 'validateActorAIDecisionResult', 'createActorAIPerceptionSnapshot', 'validateActorAIPerceptionSnapshot', 'evaluateActorAIPerception', 'evaluateActorAITargetSelection', 'createActorAIBehaviorPolicy', 'createActorAIBehaviorObservation', 'evaluateActorAIBehaviorTransition', 'createActorAIActionSelectionPolicy', 'createActorAIActionObservation', 'evaluateActorAIActionSelection', 'validateActorAIActionExecutionFeedback','evaluateActorAILifeGate','evaluateActorAIReset','createActorAIDecisionTimingState','evaluateActorAIDecisionTiming', 'createEncounterDefinitionReference', 'createEncounterSide', 'createEncounterParticipant', 'createEncounterState', 'validateEncounterState', 'createEncounterActivationPolicy', 'createEncounterActivationObservation', 'evaluateEncounterActivationAdmission', 'activateEncounter'].sort());
// Independent contract oracle: 8 units minus 3 gives 5, bounds [0,10].
assert.deepEqual(calculateResourceTransition({resource:'energy',current:8,maximum:10,
 amount:3,operation:'decrease',rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}),
 {resource:'energy',before:8,after:5,applied:3,reachedMinimum:false});
for (const spec of ['@rpg/gameplay/modules/encounter','@rpg/gameplay/dist/modules/encounter/index.js','@rpg/gameplay/src/index.ts','@rpg/gameplay/dist/index.js', '@rpg/gameplay/foundation/modules', '@rpg/gameplay/foundation/runtime', '@rpg/gameplay/dist/foundation/runtime/index.js', '@rpg/gameplay/foundation/messaging', '@rpg/gameplay/dist/foundation/messaging/index.js', '@rpg/gameplay/foundation/execution', '@rpg/gameplay/dist/foundation/execution/index.js', '@rpg/gameplay/modules/entity', '@rpg/gameplay/dist/modules/entity/index.js', '@rpg/gameplay/modules/combat', '@rpg/gameplay/dist/modules/combat/index.js', '@rpg/gameplay/modules/progression', '@rpg/gameplay/dist/modules/progression/index.js', '@rpg/gameplay/skill', '@rpg/gameplay/skill/internal', '@rpg/gameplay/modules/skill', '@rpg/gameplay/dist/modules/skill/index.js', '@rpg/gameplay/effect', '@rpg/gameplay/modules/effect', '@rpg/gameplay/dist/modules/effect/index.js']) {
 await assert.rejects(import(spec), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
}
`);
    exec(['consumer.mjs'], temp);
    // A missing packaged root export must fail the very same runtime consumer.
    const installedRoot = path.join(installed, 'dist/index.js');
    const rootSource = fs.readFileSync(installedRoot, 'utf8');
    for (const requiredExport of ['activateSkill', 'createEffectInstance', 'evaluateEffectApplyAdmission', 'applyEffect', 'createEffectLifecycleState', 'startEffectLifetime', 'advanceEffectLifecycle', 'removeEffectLifetime', 'inspectEffectStackGroups', 'evaluateEffectStackAdmission', 'applyEffectStack', 'refreshEffectStackLifetime', 'consumeEffectStacks', 'removeEffectStackGroup', 'createEffectModifierState', 'applyEffectModifierTransition', 'listActiveEffectModifiers', 'createEffectStatusState', 'applyEffectStatusTransition', 'listActiveEffectStatuses', 'listActiveEffectRestrictions', 'evaluateEffectRestrictionGate', 'createEffectPeriodicState', 'applyEffectPeriodicTransition', 'getNextDueEffectTick', 'completeEffectPeriodicTick', 'cleanupDefeatedTargetEffects', 'createActorAIProfileReference', 'createActorAIState', 'validateActorAIState', 'createActorAIDecisionContext', 'createActorAIActionIntent', 'validateActorAIDecisionResult', 'createActorAIPerceptionSnapshot', 'validateActorAIPerceptionSnapshot', 'evaluateActorAIPerception', 'evaluateActorAITargetSelection', 'createActorAIBehaviorPolicy', 'createActorAIBehaviorObservation', 'evaluateActorAIBehaviorTransition', 'createActorAIActionSelectionPolicy', 'createActorAIActionObservation', 'evaluateActorAIActionSelection', 'validateActorAIActionExecutionFeedback','evaluateActorAILifeGate','evaluateActorAIReset','createActorAIDecisionTimingState','evaluateActorAIDecisionTiming']) {
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
      {id: 'actor-ai', optional: true, dependencies: ['entity']},
      {id: 'encounter', optional: true, dependencies: ['entity']},
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
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-integration.mjs'), path.join(temp, 'effect-integration.mjs'));
    copyRequiredConsumer(path.join(root, 'tests/consumers/effect-integration.ts'), path.join(temp, 'effect-integration.ts'));
    const integrationMarkers = ['E2E', 'ADMISSION', 'STACK', 'SOURCES', 'SAFETY', 'REPLAY',
      'DEFEAT_TIMELINE', 'DEFEAT_VALIDATION', 'DEFEAT_COMPANIONS'].map(x => 'EFFECT_INTEGRATION_' + x + '_PASS');
    const effectIntegrationEvidence = exec(['--test', '--test-reporter=tap', 'effect-integration.mjs'], temp);
    assertTapEvidence(effectIntegrationEvidence, 9, integrationMarkers);
    for (const marker of integrationMarkers) console.log(effectIntegrationEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_EFFECT_INTEGRATION_PASS EF36-EF40 + FIX01-FIX16; consumer_tests=9 skipped=0; actual_Entity_Core_Skill_Combat; independent_literal_replay');
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, 'effect-integration.' + extension), saved = required + '.saved';
      try {fs.renameSync(required, saved); assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});}
      finally {fs.renameSync(saved, required);}
    }
    assert.throws(() => assertVersion('0.6.6', '0.6.7'), /installed package version/);
    const integrationFile = path.join(temp, 'effect-integration.mjs'), integrationSource = fs.readFileSync(integrationFile, 'utf8');
    for (const [expected, faulty] of [
      ["contract('EF36: complete", "test.skip('EF36: complete"],
      ["candidate.baseline !== f.current", 'false'],
      ['assert.', 'unchecked.'],
    ]) {
      assert.ok(integrationSource.includes(expected), 'required integration consumer fault: ' + expected);
      try {
        const fault = expected === 'assert.'
          ? "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + integrationSource.replaceAll('assert.', 'unchecked.')
            .replace("unchecked.ok(assertions > 0, 'integration requires actual assertions')", "assert.ok(assertions > 0, 'integration requires actual assertions')")
          : integrationSource.replace(expected, faulty);
        fs.writeFileSync(integrationFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-integration.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(integrationFile, integrationSource);}
    }
    const staleGuard = 'const current = statusState(lifecycleSnapshot(lifecycle), state);';
    assert.ok(periodicRuntime.includes(staleGuard));
    try {
      // Installed implementation mutation: accept a stale companion instead of validating it.
      fs.writeFileSync(effectFile, periodicRuntime.replace(staleGuard, 'const current = state;'));
      assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-integration.mjs'], temp), /AssertionError|ERR_ASSERTION/);
    } finally {fs.writeFileSync(effectFile, periodicRuntime);}
    assertPackedFiles();
    console.log('INSTALLED_EFFECT_INTEGRATION_RUNNER_NEGATIVE_PASS missing_fixtures; wrong_version; stale_companion; stale_L4_baseline; skipped; no_assertions; restored_artifacts');
    const cleanupStart = periodicRuntime.indexOf('export function cleanupDefeatedTargetEffects(');
    assert.ok(cleanupStart > 0);
    const cleanupRuntime = periodicRuntime.slice(cleanupStart);
    for (const [name, scope, expected, faulty] of [
      ['backdated_removal', 'cleanup', 'atMs: defeatedAtMs', 'atMs: current.observedAtMs'],
      ['horizon_instead_of_death', 'cleanup', 'lifecycleTime(fields.defeatedAtMs)', 'readExecutionTime(context)'],
      ['HoT_after_death', 'runtime', "if (status === 'dead')", 'if (false)'],
      ['earlier_tick_discarded', 'cleanup', 'due && due.dueAtMs < defeatedAtMs', 'false'],
      ['normal_pending_guard_bypassed', 'runtime', 'if (periodicDue(before, previous, next.observedAtMs))', 'if (false)'],
      ['alive_cleanup_accepted', 'cleanup', "status !== 'dead'", 'false'],
      ['wrong_Life_binding', 'runtime', 'effectId(fields.entityId) !== lifecycle.effectState.entityId', 'false'],
      ['stale_companion_after_cleanup', 'runtime', 'const next = validated.state, newInstances = next.effectState.instances;',
        "if (validated.action === 'target_defeated') return Object.freeze({status: 'applied', reason: 'none', state: previous}); const next = validated.state, newInstances = next.effectState.instances;"],
      ['duplicate_terminal', 'cleanup', 'events: Object.freeze(events)', 'events: Object.freeze([...events, ...events])'],
      ['failed_numerical_commit', 'consumer', 'const resource=g.transitionEntityResource(',
        'f.current=Object.freeze({...baseline,periodic:g.completeEffectPeriodicTick(baseline.lifecycle,baseline.periodic,intent,baseline.life,f.context).state}); const resource=g.transitionEntityResource('],
    ]) {
      const original = scope === 'cleanup' ? cleanupRuntime : scope === 'runtime' ? periodicRuntime : integrationSource;
      assert.ok(original.includes(expected), 'required FIX01 fault anchor: ' + name);
      const file = scope === 'consumer' ? integrationFile : effectFile;
      const saved = scope === 'consumer' ? integrationSource : periodicRuntime;
      try {
        fs.writeFileSync(file, (scope === 'cleanup' ? periodicRuntime.slice(0, cleanupStart) : '') + original.replace(expected, faulty));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'effect-integration.mjs'], temp), /AssertionError|ERR_ASSERTION|Invalid target-defeat cleanup delta|Canonical event identity\/time mismatch/);
      } finally {fs.writeFileSync(file, saved);}
      assertPackedFiles();
      console.log('INSTALLED_EFFECT_DEFEAT_FAULT_DETECTED ' + name);
    }
    console.log('INSTALLED_EFFECT_DEFEAT_NEGATIVE_PASS faults=10 restored_artifacts');
    copyRequiredConsumer(path.join(root, 'tests/consumers/actor-ai-foundation.mjs'), path.join(temp, 'actor-ai-foundation.mjs'));
    copyRequiredConsumer(path.join(root, 'tests/consumers/actor-ai-foundation.ts'), path.join(temp, 'actor-ai-foundation.ts'));
    fs.copyFileSync(path.join(root, 'harness/modules.json'), path.join(temp, 'actor-ai-modules.json'));
    const aiMarkers = ['IDENTITY', 'DECISION', 'VALIDATION', 'MODULE', 'REPLAY'].map(x => 'ACTOR_AI_' + x + '_PASS');
    const aiEvidence = exec(['--test', '--test-reporter=tap', 'actor-ai-foundation.mjs'], temp);
    assertTapEvidence(aiEvidence, 5, aiMarkers);
    for (const marker of aiMarkers) console.log(aiEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_ACTOR_AI_FOUNDATION_PASS AI01-AI05; consumer_tests=5 skipped=0; structural_only');
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, 'actor-ai-foundation.' + extension), saved = required + '.saved';
      try {fs.renameSync(required, saved); assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});}
      finally {fs.renameSync(saved, required);}
    }
    assert.throws(() => assertVersion('0.7.0', '0.7.1'), /installed package version/);
    const aiFile = path.join(temp, 'actor-ai-foundation.mjs'), aiSource = fs.readFileSync(aiFile, 'utf8');
    for (const [expected, faulty] of [
      ["contract('AI foundation: actor-agnostic", "test.skip('AI foundation: actor-agnostic"],
      ['assert.', 'unchecked.'],
    ]) {
      assert.ok(aiSource.includes(expected));
      try {
        const fault = expected === 'assert.'
          ? "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + aiSource.replaceAll('assert.', 'unchecked.')
            .replace("unchecked.ok(assertions>0,'Actor AI contract requires actual assertions')", "assert.ok(assertions>0,'Actor AI contract requires actual assertions')")
          : aiSource.replace(expected, faulty);
        fs.writeFileSync(aiFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-foundation.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(aiFile, aiSource);}
    }
    const aiRuntimeFile = path.join(installed, 'dist/modules/actor-ai/index.js'), aiRuntime = fs.readFileSync(aiRuntimeFile, 'utf8');
    try {
      fs.appendFileSync(aiRuntimeFile, '\n// deliberate installed Actor AI drift\n');
      assert.throws(assertPackedFiles, /installed artifact content/);
    } finally {fs.writeFileSync(aiRuntimeFile, aiRuntime);}
    assertPackedFiles();
    for (const [name, expected, faulty] of [
      ['manual_proposal', "current.controller !== 'ai'", 'false'],
      ['unknown_actor', 'if (!getEntity(entities, current.actorId))', 'if (false)'],
    ]) {
      assert.ok(aiRuntime.includes(expected), 'required installed AI fault: ' + name);
      try {
        fs.writeFileSync(aiRuntimeFile, aiRuntime.replace(expected, faulty));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-foundation.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(aiRuntimeFile, aiRuntime);}
      assertPackedFiles();
      console.log('INSTALLED_ACTOR_AI_FAULT_DETECTED ' + name);
    }
    assert.doesNotMatch(fs.readFileSync(path.join(installed, 'dist/modules/actor-ai/index.d.ts'), 'utf8'),
      /(?<!['"])\bany\b(?!['"])|\b(?:fields|stateSnapshot|contextSnapshot|intentSnapshot|Map|WeakMap|AIManager|AIRuntime|AIEngine)\b/);
    assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_NEGATIVE_PASS missing_fixtures; all_six_root_exports; wrong_version; skipped; no_assertions; manual_proposal; unknown_actor; Core_integrity; artifact_provenance; restored');
    // AI06–AI10 always run against the installed tarball, never source imports.
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, 'actor-ai-perception.' + extension);
      copyRequiredConsumer(path.join(root, 'tests/consumers/actor-ai-perception.' + extension), required);
      const saved = required + '.saved';
      try {fs.renameSync(required, saved); assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});}
      finally {fs.renameSync(saved, required);}
    }
    const perceptionMarkers = ['CAPTURE', 'VALIDATION', 'POLICY', 'PRECEDENCE', 'ORDER', 'REPLAY'].map(x => 'ACTOR_AI_PERCEPTION_' + x + '_PASS');
    const perceptionEvidence = exec(['--test', '--test-reporter=tap', 'actor-ai-perception.mjs'], temp);
    assertTapEvidence(perceptionEvidence, 6, perceptionMarkers);
    for (const marker of perceptionMarkers) console.log(perceptionEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_ACTOR_AI_PERCEPTION_PASS AI06-AI10; consumer_tests=6 skipped=0; advisory_only');
    const perceptionFile = path.join(temp, 'actor-ai-perception.mjs'), perceptionSource = fs.readFileSync(perceptionFile, 'utf8');
    assert.ok(perceptionSource.includes("contract('perception: explicit capture"));
    try {
      fs.writeFileSync(perceptionFile, perceptionSource.replace("contract('perception: explicit capture", "test.skip('perception: explicit capture"));
      assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-perception.mjs'], temp), /AssertionError|ERR_ASSERTION/);
    } finally {fs.writeFileSync(perceptionFile, perceptionSource);}
    for (const [name, expected, faulty] of [
      ['duplicate', 'if (seen.has(candidate.entityId))', 'if (false)'],
      ['actor_binding', 'if (snapshot.actorId !== actorId)', 'if (false)'],
      ['precedence', "reason = 'target_life_not_allowed';", "reason = 'relation_not_allowed';"],
      ['order', 'eligible: Object.freeze(eligible)', 'eligible: Object.freeze(eligible.reverse())'],
      ['state_mutation', 'const current = validateActorAIState(state, entities);', "state.targetEntityId = 'C'; const current = validateActorAIState(state, entities);"],
      ['target_selection', 'eligible: Object.freeze(eligible)', "selectedTarget: eligible[0]?.entityId ?? null, eligible: Object.freeze(eligible)"],
    ]) {
      assert.ok(aiRuntime.includes(expected), 'required installed perception fault: ' + name);
      try {
        fs.writeFileSync(aiRuntimeFile, aiRuntime.replace(expected, faulty));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-perception.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(aiRuntimeFile, aiRuntime);}
      assertPackedFiles();
      console.log('INSTALLED_ACTOR_AI_PERCEPTION_FAULT_DETECTED ' + name);
    }
    console.log('INSTALLED_ACTOR_AI_PERCEPTION_NEGATIVE_PASS missing_fixtures; all_three_root_exports; wrong_version; Core_integrity; skipped; six_runtime_faults; restored_artifacts');
    // AI11–AI15: the same installed public consumer must expose every injected fault.
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, 'actor-ai-target-selection.' + extension);
      copyRequiredConsumer(path.join(root, 'tests/consumers/actor-ai-target-selection.' + extension), required);
      const saved = required + '.saved';
      try {fs.renameSync(required, saved); assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});}
      finally {fs.renameSync(saved, required);}
    }
    assert.throws(() => assertVersion('0.7.1', '0.7.2'), /installed package version/);
    const targetMarkers = ['PRIORITY', 'RETENTION', 'LOSS', 'MANUAL', 'VALIDATION', 'REPLAY'].map(x => 'ACTOR_AI_TARGET_' + x + '_PASS');
    const aiTargetEvidence = exec(['--test', '--test-reporter=tap', 'actor-ai-target-selection.mjs'], temp);
    assertTapEvidence(aiTargetEvidence, 6, targetMarkers);
    for (const marker of targetMarkers) console.log(aiTargetEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_ACTOR_AI_TARGET_SELECTION_PASS AI11-AI15; consumer_tests=6 skipped=0; candidate_only');
    const targetFile = path.join(temp, 'actor-ai-target-selection.mjs'), targetSource = fs.readFileSync(targetFile, 'utf8');
    for (const mode of ['skipped', 'zero_assertions']) {
      const fault = mode === 'skipped'
        ? targetSource.replace("contract('target selection: acquisition", "test.skip('target selection: acquisition")
        : "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + targetSource.replaceAll('assert.', 'unchecked.')
          .replace("unchecked.ok(assertions > 0, 'Target selection contract requires actual assertions')", "assert.ok(assertions > 0, 'Target selection contract requires actual assertions')");
      assert.notEqual(fault, targetSource);
      try {
        fs.writeFileSync(targetFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-target-selection.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(targetFile, targetSource);}
      console.log('INSTALLED_ACTOR_AI_TARGET_RUNNER_FAULT_DETECTED ' + mode);
    }
    for (const [name, expected, faulty] of [
      ['excluded_target', 'rules.preferredTargetIds.find(candidate => eligibleIds.includes(candidate))', 'rules.preferredTargetIds.find(() => true)'],
      ['manual_candidate', "if (current.controller === 'manual')", 'if (false)'],
      ['retention', "rules.retention === 'retain_if_eligible' && previousEligible", 'false'],
      ['priority', 'preferred ?? fallback', 'fallback'],
      ['lexical', 'candidate < best', 'candidate > best'],
      ['loss_clear', 'targetEntityId: selectedTargetEntityId', 'targetEntityId: selectedTargetEntityId ?? previousTargetEntityId'],
      ['state_mutation', 'const current = validateActorAIState(state, entities), assessment = perceptionAssessment(perception);',
        "state.targetEntityId = 'mutated'; const current = validateActorAIState(state, entities), assessment = perceptionAssessment(perception);"],
    ]) {
      assert.ok(aiRuntime.includes(expected), 'required installed target fault: ' + name);
      try {
        fs.writeFileSync(aiRuntimeFile, aiRuntime.replace(expected, faulty));
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-target-selection.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(aiRuntimeFile, aiRuntime);}
      assertPackedFiles();
      console.log('INSTALLED_ACTOR_AI_TARGET_FAULT_DETECTED ' + name);
    }
    console.log('INSTALLED_ACTOR_AI_TARGET_NEGATIVE_PASS missing_fixtures; root_export; wrong_version; Core_integrity; seven_runtime_faults; skipped; zero_assertions; restored_artifacts');
    // AI16–AI20: installed FSM contracts and independently observable fault controls.
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, 'actor-ai-behavior.' + extension);
      copyRequiredConsumer(path.join(root, 'tests/consumers/actor-ai-behavior.' + extension), required);
      const saved = required + '.saved';
      try {fs.renameSync(required, saved); assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});}
      finally {fs.renameSync(saved, required);}
    }
    assert.throws(() => assertVersion('0.7.2', '0.7.3'), /installed package version/);
    const behaviorMarkers = ['CAPTURE', 'RULES', 'PROFILES', 'COMPOSITION', 'MANUAL', 'VALIDATION', 'REPLAY'].map(x => 'ACTOR_AI_BEHAVIOR_' + x + '_PASS');
    const behaviorEvidence = exec(['--test', '--test-reporter=tap', 'actor-ai-behavior.mjs'], temp);
    assertTapEvidence(behaviorEvidence, 7, behaviorMarkers);
    for (const marker of behaviorMarkers) console.log(behaviorEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_ACTOR_AI_BEHAVIOR_PASS AI16-AI20; consumer_tests=7 skipped=0; candidate_only');
    const behaviorFile = path.join(temp, 'actor-ai-behavior.mjs'), behaviorSource = fs.readFileSync(behaviorFile, 'utf8');
    for (const mode of ['skipped', 'zero_assertions']) {
      const fault = mode === 'skipped'
        ? behaviorSource.replace("contract('behavior: generic", "test.skip('behavior: generic")
        : "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + behaviorSource.replaceAll('assert.', 'unchecked.')
          .replace("unchecked.ok(assertions > 0, 'Behavior contract requires actual assertions')", "assert.ok(assertions > 0, 'Behavior contract requires actual assertions')");
      assert.notEqual(fault, behaviorSource);
      try {
        fs.writeFileSync(behaviorFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-behavior.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(behaviorFile, behaviorSource);}
      console.log('INSTALLED_ACTOR_AI_BEHAVIOR_RUNNER_FAULT_DETECTED ' + mode);
    }
    const behaviorStart = aiRuntime.indexOf('function behaviorIds(');
    assert.ok(behaviorStart > 0);
    const behaviorRuntime = aiRuntime.slice(behaviorStart);
    for (const [name, expected, faulty] of [
      ['manual', "if (current.controller === 'manual')", 'if (false)'],
      ['priority', 'rules.rules.find(rule =>', '[...rules.rules].reverse().find(rule =>'],
      ['profile', 'if (rules.profileId !== current.profileId)', 'if (false)'],
      ['state_reference', 'if (!stateIds.includes(rule.fromStateId) || !stateIds.includes(rule.toStateId))', 'if (false)'],
      ['target_guard', "rule.targetRequirement === 'any'", 'true'],
      ['target_mutation', 'behaviorStateId: nextBehaviorStateId', 'behaviorStateId: nextBehaviorStateId, targetEntityId: null'],
      ['state_mutation', 'const current = validateActorAIState(state, entities), rules = createActorAIBehaviorPolicy(policy);',
        "state.behaviorStateId = 'changed'; const current = validateActorAIState(state, entities), rules = createActorAIBehaviorPolicy(policy);"],
      ['gameplay_execution', 'const nextBehaviorStateId = matched?.toStateId ?? previousBehaviorStateId;',
        "transitionEntityResource({entityId: current.actorId, current: {health: 5}}, 'health', {amount: 1, operation: 'decrease', maximum: 100, rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: false}}); const nextBehaviorStateId = matched?.toStateId ?? previousBehaviorStateId;"],
    ]) {
      assert.ok(behaviorRuntime.includes(expected), 'required installed behavior fault: ' + name);
      let fault = aiRuntime.slice(0, behaviorStart) + behaviorRuntime.replace(expected, faulty);
      if (name === 'gameplay_execution') fault = "import {transitionEntityResource} from '../entity/index.js';\n" + fault;
      try {
        fs.writeFileSync(aiRuntimeFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-behavior.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(aiRuntimeFile, aiRuntime);}
      assertPackedFiles();
      console.log('INSTALLED_ACTOR_AI_BEHAVIOR_FAULT_DETECTED ' + name);
    }
    console.log('INSTALLED_ACTOR_AI_BEHAVIOR_NEGATIVE_PASS missing_fixtures; three_root_exports; wrong_version; Core_integrity; eight_runtime_faults; execution_boundary; skipped; zero_assertions; restored_artifacts');
    // AI21–AI25: installed action proposals and actual decision-validator delegation.
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, 'actor-ai-action-selection.' + extension);
      copyRequiredConsumer(path.join(root, 'tests/consumers/actor-ai-action-selection.' + extension), required);
      const saved = required + '.saved';
      try {fs.renameSync(required, saved); assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});}
      finally {fs.renameSync(saved, required);}
    }
    assert.throws(() => assertVersion('0.7.3', '0.7.4'), /installed package version/);
    const actionMarkers = ['CAPTURE', 'INTENTS', 'PRIORITY', 'DIAGNOSTICS', 'MANUAL', 'VALIDATION', 'COMPOSITION', 'REPLAY'].map(x => 'ACTOR_AI_ACTION_' + x + '_PASS');
    const actionEvidence = exec(['--test', '--test-reporter=tap', 'actor-ai-action-selection.mjs'], temp);
    assertTapEvidence(actionEvidence, 8, actionMarkers);
    for (const marker of actionMarkers) console.log(actionEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_ACTOR_AI_ACTION_PASS AI21-AI25; consumer_tests=8 skipped=0; advisory_intents');
    const actionFile = path.join(temp, 'actor-ai-action-selection.mjs'), actionSource = fs.readFileSync(actionFile, 'utf8');
    for (const mode of ['skipped', 'zero_assertions']) {
      const fault = mode === 'skipped'
        ? actionSource.replace("contract('action: detached", "test.skip('action: detached")
        : "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + actionSource.replaceAll('assert.', 'unchecked.')
          .replace("unchecked.ok(assertions > 0, 'Action contract requires actual assertions')", "assert.ok(assertions > 0, 'Action contract requires actual assertions')");
      assert.notEqual(fault, actionSource);
      try {
        fs.writeFileSync(actionFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-action-selection.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(actionFile, actionSource);}
      console.log('INSTALLED_ACTOR_AI_ACTION_RUNNER_FAULT_DETECTED ' + mode);
    }
    const actionStart = aiRuntime.indexOf('function actionRule('); assert.ok(actionStart > 0);
    const actionRuntime = aiRuntime.slice(actionStart);
    for (const [name, expected, faulty] of [
      ['manual', "if (current.controller === 'manual')", 'if (false)'],
      ['priority', 'for (const rule of rules.rules)', 'for (const rule of [...rules.rules].reverse())'],
      ['skill_fallback', 'if (reason) {', "if (reason && rule.actionKind !== 'skill') {"],
      ['target_missing', "rule.targetMode === 'current_target' && current.targetEntityId === null ? 'target_missing'", "false ? 'target_missing'"],
      ['target_mode', "throw new TypeError('Invalid Actor AI action kind/target mode');", '/* fault: accepted combination */'],
      ['decision', 'observed.decisionId !== correlation.decisionId', 'false'],
      ['unavailable', "fact.status === 'unavailable' ? 'action_unavailable'", "false ? 'action_unavailable'"],
      ['availability_missing', "!fact ? 'availability_missing'", "false ? 'availability_missing'"],
      ['implicit_wait', "return Object.freeze({ status: 'no_action', reason: 'no_candidate', selectedRuleId: null, actionKind: null,",
        "return Object.freeze({status: 'selected', reason: 'rule_selected', selectedRuleId: 'invented', actionKind: 'wait', decision: {status: 'proposed', reason: 'none', intent: createActorAIActionIntent(correlation, {actionKey: 'wait', targetEntityId: null})}, rejected: Object.freeze(rejected)}); return Object.freeze({ status: 'no_action', reason: 'no_candidate', selectedRuleId: null, actionKind: null,"],
      ['state_mutation', 'const current = validateActorAIState(state, entities), correlation = contextSnapshot(context);',
        "state.behaviorStateId = 'changed'; const current = validateActorAIState(state, entities), correlation = contextSnapshot(context);"],
      ['profile', 'if (rules.profileId !== current.profileId)', 'if (false)'],
      ['gameplay_execution', 'const intent = createActorAIActionIntent(correlation,',
        "transitionEntityResource({entityId: current.actorId, current: {health: 5}}, 'health', {amount: 1, operation: 'decrease', maximum: 100, rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: false}}); const intent = createActorAIActionIntent(correlation,"],
    ]) {
      assert.ok(actionRuntime.includes(expected), 'required installed action fault: ' + name);
      let fault = aiRuntime.slice(0, actionStart) + actionRuntime.replace(expected, faulty);
      if (name === 'gameplay_execution') fault = "import {transitionEntityResource} from '../entity/index.js';\n" + fault;
      try {
        fs.writeFileSync(aiRuntimeFile, fault);
        assert.throws(() => exec(['--test', '--test-reporter=tap', 'actor-ai-action-selection.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(aiRuntimeFile, aiRuntime);}
      assertPackedFiles(); console.log('INSTALLED_ACTOR_AI_ACTION_FAULT_DETECTED ' + name);
    }
    // Observe the existing validator on the actual evaluator path. A bypass must fail this probe.
    const validatorProbe = path.join(temp, 'action-validator-probe.mjs');
    fs.writeFileSync(validatorProbe, "import assert from 'node:assert/strict'; import * as g from '@rpg/gameplay';\n"
      + "const actor=g.createEntity({id:'A',kind:'custom'}), entities=g.addEntity(g.createEntityCollection(),actor);\n"
      + "const state=g.createActorAIState(actor,{profileId:'P'},{controller:'ai',behaviorStateId:'idle'}), context=g.createActorAIDecisionContext(state,'D');\n"
      + "assert.throws(()=>g.evaluateActorAIActionSelection(state,entities,context,{profileId:'P',rules:[{ruleId:'r',behaviorStateId:'idle',actionKey:'wait',actionKind:'wait',targetMode:'none'}]},g.createActorAIActionObservation(context,[{actionKey:'wait',status:'available',reasonId:null}])), /action-result-validation-probe/);\n");
    const validatorSignature = 'export function validateActorAIDecisionResult(state, context, result) {';
    const selectedValidation = "validateActorAIDecisionResult(current, correlation, { status: 'proposed', reason: 'none', intent })";
    assert.ok(aiRuntime.includes(validatorSignature)); assert.ok(actionRuntime.includes(selectedValidation));
    const probed = aiRuntime.replace(validatorSignature, validatorSignature + " if (result.status === 'proposed') throw new TypeError('action-result-validation-probe');");
    try {
      fs.writeFileSync(aiRuntimeFile, probed); exec([validatorProbe], temp);
      const bypassed = probed.slice(0, probed.indexOf('function actionRule('))
        + probed.slice(probed.indexOf('function actionRule(')).replace(selectedValidation, "Object.freeze({status: 'proposed', reason: 'none', intent})");
      fs.writeFileSync(aiRuntimeFile, bypassed);
      assert.throws(() => exec([validatorProbe], temp), /AssertionError|ERR_ASSERTION/);
    } finally {fs.writeFileSync(aiRuntimeFile, aiRuntime); fs.rmSync(validatorProbe);}
    assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_ACTION_VALIDATOR_DELEGATION_PASS actual_validator_invoked; bypass_detected; restored');
    console.log('INSTALLED_ACTOR_AI_ACTION_NEGATIVE_PASS missing_fixtures; three_root_exports; wrong_version; Core_integrity; twelve_runtime_faults; validator_bypass; skipped; zero_assertions; restored_artifacts');
    { // AI26-AI30: real L4 consumer composition, terminal reports and fail-closed evidence.
    for (const extension of ['mjs', 'ts']) {
      const required = path.join(temp, 'actor-ai-integration.' + extension);
      copyRequiredConsumer(path.join(root, 'tests/consumers/actor-ai-integration.' + extension), required);
      const saved = required + '.saved';
      try {fs.renameSync(required, saved); assert.throws(() => copyRequiredConsumer(required, required + '.copy'), {code: 'ENOENT'});}
      finally {fs.renameSync(saved, required);}
    }
    assert.throws(() => assertVersion('0.7.4', '0.7.5'), /installed package version/);
    const integrationMarkers = ['COMBAT','REJECTIONS','SKILL','SKILL_REJECTIONS','EFFECT','FEEDBACK','VALIDATION','FRESHNESS','FALLBACK','REPLAY'].map(x => 'ACTOR_AI_INTEGRATION_' + x + '_PASS');
    const integrationEvidence = exec(['--test', '--test-reporter=tap', 'actor-ai-integration.mjs'], temp);
    assertTapEvidence(integrationEvidence, 10, integrationMarkers);
    for (const marker of integrationMarkers) console.log(integrationEvidence.split(/\r?\n/).find(line => line.includes(marker)));
    console.log('INSTALLED_ACTOR_AI_INTEGRATION_PASS AI26-AI30; consumer_tests=10 skipped=0; canonical_L4_composition');
    const integrationFile = path.join(temp, 'actor-ai-integration.mjs'), integrationSource = fs.readFileSync(integrationFile, 'utf8').replace(/\r\n/g, '\n');
    const mutations = [
      ['pending_completion', "if(options.pending) return {activation,feedback:null};", "if(options.pending) return {activation,feedback:terminal(f,selected,attemptId,'execution','completed',null)};"],
      ['cooldown_bypass', 'const ready=g.evaluateSkillCooldownReady', 'f.cooldown=g.createSkillCooldownState(f.instance); const ready=g.evaluateSkillCooldownReady'],
      ['resource_bypass', 'const payment=g.evaluateSkillResourceCosts', "f.resources=g.createEntityResourceState(f.actor,{mana:{minimum:0,maximum:100,current:100}}); const payment=g.evaluateSkillResourceCosts"],
      ['combat_actor_bypass', 'g.evaluateCombatActionAdmission(context,f.entities,f.life,{eligible})', "g.evaluateCombatActionAdmission(context,f.entities,g.createEntityLifeState(f.actor,{status:'alive'}),{eligible})"],
      ['combat_target_bypass', 'g.evaluateCombatTargetValidation(admission,f.entities,f.targetLife,targetPolicy(relation))', "g.evaluateCombatTargetValidation(admission,f.entities,g.createEntityLifeState(f.target,{status:'alive'}),targetPolicy(relation))"],
      ['effect_block_ignored', "if(restriction.status === 'blocked') return rejected('effect_blocked');", '/* fault: restriction ignored */'],
      ['effect_allowed_overrides_rejection', "if(admission.status !== 'admitted') return {reason:admission.reason};", "if(admission.status !== 'admitted') return {admission:{...admission,status:'admitted',reason:'none'},validation:g.evaluateCombatTargetValidation({...admission,status:'admitted',reason:'none'},f.entities,f.targetLife,targetPolicy('enemy'))};"],
      ['commit_after_rejection', "const rejected=reason=>({feedback:terminal(f,selected,attemptId,'admission','rejected',reason)});", "const rejected=reason=>{f.targetResources=g.transitionEntityResource(f.targetResources,'health',{operation:'decrease',amount:5,maximum:100,rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:false}}).state;return {feedback:terminal(f,selected,attemptId,'admission','rejected',reason)};};"],
      ['stale_execution', "if(intent.actorId !== f.actor.id || f.currentDecision !== intent.decisionId || bound.revision !== f.revision\n    || bound.stateToken !== JSON.stringify(f.ai)) return rejected('stale_decision');", '/* fault: stale decision admitted */'],
      ['manual_takeover', "if(f.ai.controller !== 'ai') return rejected('controller_changed');", "if(f.ai.controller !== 'ai'){f.ai.controller='ai';bound.stateToken=JSON.stringify(f.ai);}"],
      ['automatic_retry', 'const outcome=g.reportSkillExecutionOutcome(activation.request,report);', "const outcome=g.reportSkillExecutionOutcome(activation.request,report); if(outcome.status === 'failed'){f.dispatches++;combatDispatch(f,checked,options.mode);}"],
      ['duplicate_commit', "if(f.attempts.has(attemptId) || f.decisions.has(intent.decisionId)) throw new TypeError('L4 duplicate attempt/decision');", '/* fault: duplicate allowed */'],
      ['feedback_mutates_ai', 'f.feedback.push(result);', "f.ai.behaviorStateId='changed'; f.feedback.push(result);"],
      ['feedback_wrong_action', 'selected,{...selected.decision.intent,attemptId,phase,status,reasonId}', "selected,{...selected.decision.intent,actionKey:'wrong',attemptId,phase,status,reasonId}"],
    ];
    for (const [name, expected, faulty] of mutations) {
      assert.ok(integrationSource.includes(expected), 'required integration fault: ' + name);
      let fault = integrationSource.replace(expected, faulty);
      if (name === 'stale_execution') fault = fault.replace("else if(intent.targetEntityId !== f.ai.targetEntityId && intent.targetEntityId !== null) return rejected('stale_target');", 'else {}');
      try {
        fs.writeFileSync(integrationFile, fault);
        assert.throws(() => exec(['--test','--test-reporter=tap','actor-ai-integration.mjs'], temp), /AssertionError|ERR_ASSERTION/);
      } finally {fs.writeFileSync(integrationFile, integrationSource);}
      assertPackedFiles(); console.log('INSTALLED_ACTOR_AI_INTEGRATION_FAULT_DETECTED ' + name);
    }
    for (const mode of ['skipped', 'zero_assertions']) {
      const fault = mode === 'skipped' ? integrationSource.replace("contract('integration C01", "test.skip('integration C01")
        : "const unchecked = new Proxy(() => {}, {get: () => () => {}});\n" + integrationSource.replaceAll('assert.', 'unchecked.')
          .replace("unchecked.ok(assertions > 0, 'Integration contract requires actual assertions')", "assert.ok(assertions > 0, 'Integration contract requires actual assertions')");
      assert.notEqual(fault, integrationSource);
      try {fs.writeFileSync(integrationFile, fault);assert.throws(() => exec(['--test','--test-reporter=tap','actor-ai-integration.mjs'], temp), /AssertionError|ERR_ASSERTION/);}
      finally {fs.writeFileSync(integrationFile, integrationSource);}
      console.log('INSTALLED_ACTOR_AI_INTEGRATION_RUNNER_FAULT_DETECTED ' + mode);
    }
    const feedbackStart = aiRuntime.indexOf('export function validateActorAIActionExecutionFeedback(');assert.ok(feedbackStart > 0);
    const feedbackRuntime = aiRuntime.slice(feedbackStart);
    for (const [name, expected, faulty] of [
      ['correlation', "if (report.actorId !== intent.actorId || report.decisionId !== intent.decisionId\n        || report.actionKey !== intent.actionKey || report.targetEntityId !== intent.targetEntityId)", 'if (false)'],
      ['no_action', 'const selected = fields(selection,', "if(selection.status === 'no_action') return Object.freeze({...feedback}); const selected = fields(selection,"],
      ['reason', "data.status === 'completed' && data.reasonId === null", "data.status === 'completed'"],
      ['snapshot', "return Object.freeze({ ...report, phase: 'execution', status: 'completed', reasonId: null });", "return {...report, phase: 'execution', status: 'completed', reasonId: null};"],
    ]) {
      assert.ok(feedbackRuntime.includes(expected), 'required feedback fault: ' + name);
      try {fs.writeFileSync(aiRuntimeFile, aiRuntime.slice(0,feedbackStart)+feedbackRuntime.replace(expected,faulty));
        assert.throws(() => exec(['--test','--test-reporter=tap','actor-ai-integration.mjs'],temp),/AssertionError|ERR_ASSERTION/);}
      finally {fs.writeFileSync(aiRuntimeFile,aiRuntime);}
      assertPackedFiles();console.log('INSTALLED_ACTOR_AI_FEEDBACK_FAULT_DETECTED '+name);
    }
    console.log('INSTALLED_ACTOR_AI_INTEGRATION_NEGATIVE_PASS fourteen_L4_faults; four_feedback_faults; missing_fixture_export; version_Core; skipped_zero_assertions; restored_artifacts');
    }
    { // AI31-AI35 installed lifecycle/recovery evidence, caller orchestration only.
    for (const extension of ['mjs','ts']) {
      const required=path.join(temp,'actor-ai-lifecycle-recovery.'+extension);
      copyRequiredConsumer(path.join(root,'tests/consumers/actor-ai-lifecycle-recovery.'+extension),required);
      const saved=required+'.saved';try{fs.renameSync(required,saved);assert.throws(()=>copyRequiredConsumer(required,required+'.copy'),{code:'ENOENT'});}finally{fs.renameSync(saved,required);}
    }
    assert.throws(()=>assertVersion('0.7.5','0.7.6'),/installed package version/);
    const markers=['LIFE','RESET','TARGET','DISENGAGE','TIMING','FRESHNESS','CONTINUITY','OWNERS','VALIDATION','ACTORS','REPLAY'].map(x=>'ACTOR_AI_LIFECYCLE_'+x+'_PASS');
    const evidence=exec(['--test','--test-reporter=tap','actor-ai-lifecycle-recovery.mjs'],temp);
    assertTapEvidence(evidence,11,markers);for(const marker of markers)console.log(evidence.split(/\r?\n/).find(line=>line.includes(marker)));
    console.log('INSTALLED_ACTOR_AI_LIFECYCLE_PASS AI31-AI35; consumer_tests=11 skipped=0; canonical_Life_Foundation_clock_L4_commit');
    const consumerFile=path.join(temp,'actor-ai-lifecycle-recovery.mjs'),consumerBytes=fs.readFileSync(consumerFile),consumerSource=consumerBytes.toString('utf8').replace(/\r\n/g,'\n');
    const lifecycleStart=aiRuntime.indexOf('function actorLifeStatus(');assert.ok(lifecycleStart>0);
    const lifecycleRuntime=aiRuntime.slice(lifecycleStart);
    const runtimeFaults=[
      ['dead_actor',"if (life === 'dead')\n        return Object.freeze({ status: 'blocked'", "if (false)\n        return Object.freeze({ status: 'blocked'"],
      ['dead_reset',"if (life === 'dead')\n        return Object.freeze({ status: 'rejected'", "if (false)\n        return Object.freeze({ status: 'rejected'"],
      ['reset_controller','state: Object.freeze({ ...current, behaviorStateId: destination, targetEntityId: null })',"state: Object.freeze({ ...current, controller:'ai', behaviorStateId: destination, targetEntityId: null })"],
      ['reset_profile','state: Object.freeze({ ...current, behaviorStateId: destination, targetEntityId: null })',"state: Object.freeze({ ...current, profileId:'changed', behaviorStateId: destination, targetEntityId: null })"],
      ['manual_timing',"if (gate.status === 'blocked')", "if (false)"],
      ['hidden_clock','const now = readExecutionTime(context);','const now = Date.now();'],
      ['time_regressed','if (now < cursor.observedAtMs)','if (false)'],
      ['time_unrepresentable','if (!Number.isFinite(nextEligibleAtMs) || (intervalMs > 0 && nextEligibleAtMs <= now))','if (false)'],
      ['life_binding','if (id(data.entityId) !== state.actorId)','if (false)'],
      ['timing_binding','if (cursor.actorId !== gate.actorId)','if (false)'],
    ];
    for(const [name,expected,faulty] of runtimeFaults){
      assert.ok(lifecycleRuntime.includes(expected),'required lifecycle runtime fault '+name);
      try{fs.writeFileSync(aiRuntimeFile,aiRuntime.slice(0,lifecycleStart)+lifecycleRuntime.replace(expected,faulty));
        assert.throws(()=>exec(['--test','--test-reporter=tap','actor-ai-lifecycle-recovery.mjs'],temp),/AssertionError|ERR_ASSERTION/);
      }finally{fs.writeFileSync(aiRuntimeFile,aiRuntime);}
      assertPackedFiles();console.log('INSTALLED_ACTOR_AI_LIFECYCLE_RUNTIME_FAULT_DETECTED '+name);
    }
    const fixtureFaults=[
      ['automatic_revival','f.life=g.reviveEntity(f.life,f.resources,lifePolicy).state;',"f.life=g.reviveEntity(f.life,f.resources,lifePolicy).state;f.enabled=true;f.ai=reset(f,'respawn').state;"],
      ['fake_returning','f.ai=transitioned.state;return transitioned;',"f.ai={...transitioned.state,behaviorStateId:'returning'};return {...transitioned,status:'transitioned'};"],
      ['reset_mutates_world',"const cleared=reset(f,'disengage',null,policy);","const cleared=reset(f,'disengage',null,policy);f.world.position=0;"],
      ['manual_proposal',"if(!f.enabled || gate(f).status !== 'allowed')return null;", "if(f.ai.controller==='manual')f.ai={...f.ai,controller:'ai'};if(!f.enabled)return null;"],
      ['stale_timing_commit','if(staged.baseline !== f.timing)return false;','/* fault: stale second accepted */'],
      ['accepted_is_completed',"a.equal(activation.status,'accepted');a.deepEqual(f.feedback,[]);", "if(activation.status==='accepted')f.feedback.push({status:'completed'});a.equal(activation.status,'accepted');a.deepEqual(f.feedback,[]);"],
      ['automatic_retry','f.feedback.push(result);return result;',"f.feedback.push(result);if(status==='failed')f.dispatches++;return result;"],
      ['duplicate_dispatch',"if(f.attempts.has(attemptId))throw new TypeError('L4 duplicate');",'/* fault: duplicate allowed */'],
    ];
    for(const [name,expected,faulty] of fixtureFaults){
      assert.ok(consumerSource.includes(expected),'required lifecycle fixture fault '+name);
      try{fs.writeFileSync(consumerFile,consumerSource.replace(expected,faulty));assert.throws(()=>exec(['--test','--test-reporter=tap','actor-ai-lifecycle-recovery.mjs'],temp),/AssertionError|ERR_ASSERTION/);}
      finally{fs.writeFileSync(consumerFile,consumerBytes);}
      assertPackedFiles();console.log('INSTALLED_ACTOR_AI_LIFECYCLE_FIXTURE_FAULT_DETECTED '+name);
    }
    for(const mode of ['skipped','zero_assertions']){
      const fault=mode==='skipped'?consumerSource.replace("contract('lifecycle L01", "test.skip('lifecycle L01"):
        consumerSource.replace('count++;return Reflect.get(t,k)(...args);','return undefined;');
      assert.notEqual(fault,consumerSource);
      try{fs.writeFileSync(consumerFile,fault);assert.throws(()=>exec(['--test','--test-reporter=tap','actor-ai-lifecycle-recovery.mjs'],temp),/AssertionError|ERR_ASSERTION/);}
      finally{fs.writeFileSync(consumerFile,consumerBytes);}
      console.log('INSTALLED_ACTOR_AI_LIFECYCLE_RUNNER_FAULT_DETECTED '+mode);
    }
    assertTapEvidence(exec(['--test','--test-reporter=tap','actor-ai-lifecycle-recovery.mjs'],temp),11,markers);
    console.log('INSTALLED_ACTOR_AI_LIFECYCLE_NEGATIVE_PASS runtime_faults10; fixture_faults8; fifteen_required_categories; missing_consumers_exports; wrong_version_Core; skipped_zero_assertions; restored_clean_rerun');
    }
    { // AI36-AI40: physical installed closure plus actual fail-closed controls.
    for(const extension of ['mjs','ts'])copyRequiredConsumer(path.join(root,'tests/consumers/actor-ai-integration-closure.'+extension),path.join(temp,'actor-ai-integration-closure.'+extension));
    const file=path.join(temp,'actor-ai-integration-closure.mjs'),bytes=fs.readFileSync(file),source=bytes.toString('utf8').replaceAll('\r\n','\n');
    const scenarioIds=[...Array.from({length:41},(_,i)=>'E'+String(i+1).padStart(2,'0')),'E44','E45','E49','E50','E53','E55'];
    const markers=scenarioIds.map(id=>'ACTOR_AI_CLOSURE_'+id+'_PASS');
    const run=()=>exec(['--test','--test-reporter=tap','actor-ai-integration-closure.mjs'],temp);
    const validate=evidence=>assertTapEvidence(evidence,14,[...markers,'ACTOR_AI_FIX01_DUPLICATE_ATTEMPT_PASS','ACTOR_AI_FIX01_DUPLICATE_DECISION_PASS','ACTOR_AI_FIX01_FEEDBACK_TIMING_PASS']);
    const evidence=run();validate(evidence);
    for(const marker of markers)console.log(evidence.split(/\r?\n/).find(line=>line.includes(marker)));
    console.log(evidence.split(/\r?\n/).find(line=>line.includes('ACTOR_AI_CLOSURE_REPLAY_SHA256')));
    console.log('INSTALLED_ACTOR_AI_CLOSURE_PASS AI36-AI40; consumer_tests=14 skipped=0; runtime_scenarios47; external_gates13');
    function fixtureFault(name,expected,faulty){assert.ok(source.includes(expected),'required closure fault '+name);
      try{fs.writeFileSync(file,source.replace(expected,faulty));assert.throws(run,/AssertionError|ERR_ASSERTION/);}
      finally{fs.writeFileSync(file,bytes);}assertPackedFiles();console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED '+name);}
    fixtureFault('outcome_provenance',"if(phase==='execution' && f.receipts.get(attemptId)!==status)throw new TypeError('L4 outcome provenance');",'');
    // FIX01: require a real failing run of the dedicated fresh-decision test.
    const ledger="if(f.attempts.has(attemptId) || f.decisions.has(intent.decisionId)) throw new TypeError('L4 duplicate attempt/decision');";
    assert.ok(source.includes(ledger));
    try {
      fs.writeFileSync(file,source.replace(ledger,''));
      const env={...process.env};delete env.NODE_TEST_CONTEXT;
      for(const scenario of ['duplicate_attempt','duplicate_decision']){
        const result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern=closure FIX01 '+scenario,'actor-ai-integration-closure.mjs'],{cwd:temp,shell:false,encoding:'utf8',env});
        assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,1,result.stdout+result.stderr);
        assert.match(result.stdout,new RegExp('not ok 1 - closure FIX01 '+scenario));
        assert.match(result.stdout,new RegExp('FIX01 '+scenario+' ledger must reject before second commit'));
        assert.match(result.stdout,/# tests 1/);assert.match(result.stdout,/# fail 1/);assert.match(result.stdout,/# skipped 0/);
        if(scenario==='duplicate_decision')assert.match(result.stdout,/Missing expected exception/);
        console.log('ACTOR_AI_FIX01_MUTANT_KILLED '+scenario+'; expected_ledger_assertion; exit=1');
        console.log(result.stdout.split(/\r?\n/).filter(line=>/not ok 1|ledger must reject|Missing expected exception/.test(line)).join('\n'));
      }
    } finally {fs.writeFileSync(file,bytes);}
    assert.deepEqual(fs.readFileSync(file),bytes);assertPackedFiles();validate(run());
    console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED duplicate_commit');
    fixtureFault('duplicate_feedback',"if(f.feedback.some(x=>x.attemptId===attemptId))throw new TypeError('L4 duplicate feedback');",'');
    fixtureFault('stale_turn',"if(bound.timing!==f.timing || bound.life!==f.life)return rejected('stale_turn');",'');
    fixtureFault('manual_stale',"if(f.ai.controller !== 'ai') return rejected('controller_changed');",'');
    fixtureFault('dead_actor',"if(lifeGate.status!=='allowed')return rejected(lifeGate.reason);",'');
    fixtureFault('dead_target',"const validation=g.evaluateCombatTargetValidation(admission,f.entities,f.targetLife,targetPolicy(relation));","const validation=g.evaluateCombatTargetValidation(admission,f.entities,g.createEntityLifeState(f.target,{status:'alive'}),targetPolicy(relation));");
    fixtureFault('effect_bypass',"if(restriction.status === 'blocked') return rejected('effect_blocked');",'');
    fixtureFault('skill_admission',"owned:options.owned ?? true","owned:true");
    fixtureFault('skill_resource',"amount:25","amount:0");
    fixtureFault('skill_cooldown',"const ready=g.evaluateSkillCooldownReady(f.instance,f.cooldown,f.context);","f.cooldown=g.createSkillCooldownState(f.instance);const ready=g.evaluateSkillCooldownReady(f.instance,f.cooldown,f.context);");
    fixtureFault('action_priority',"...(mode==='passive'?[]:rules.slice(0,2))","...(mode==='passive'?[]:rules.slice(0,2).reverse())");
    fixtureFault('fsm_priority',"f.profile.behavior);","{...f.profile.behavior,rules:[...f.profile.behavior.rules].reverse()});");
    fixtureFault('lifecycle_timing',"if(f.due.status!=='ready')return null;",'');
    fixtureFault('stale_cursor',"if(staged.baseline!==f.timing)return false;",'');
    fixtureFault('zero_assertions','assertions++;','');
    try{fs.writeFileSync(file,source.replace('test(name, () =>','test.skip(name, () =>'));assert.throws(run,/TAP skipped|ERR_ASSERTION/);}
    finally{fs.writeFileSync(file,bytes);}console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED skipped');
    try{fs.writeFileSync(file,source.replace('E38 E41','E38'));assert.throws(()=>validate(run()),/E41/);}
    finally{fs.writeFileSync(file,bytes);}console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED omitted_scenario');
    const rootFile=path.join(installed,'dist/index.js'),rootBytes=fs.readFileSync(rootFile);
    try{fs.writeFileSync(rootFile,rootBytes.toString('utf8').replace('evaluateActorAILifeGate,','evaluateActorAILifeGate as missingLifeGate,'));assert.throws(run,/ERR_ASSERTION/);}
    finally{fs.writeFileSync(rootFile,rootBytes);}assertPackedFiles();console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED missing_export');
    const runtimeFile=path.join(installed,'dist/modules/actor-ai/index.js'),runtimeBytes=fs.readFileSync(runtimeFile),runtime=runtimeBytes.toString('utf8');
    const correlation="if (report.actorId !== intent.actorId || report.decisionId !== intent.decisionId";assert.ok(runtime.includes(correlation));
    try{fs.writeFileSync(runtimeFile,runtime.replace(correlation,"if (false && (report.actorId !== intent.actorId || report.decisionId !== intent.decisionId").replace('report.targetEntityId !== intent.targetEntityId) {','report.targetEntityId !== intent.targetEntityId)) {'));assert.throws(run,/ERR_ASSERTION/);}
    finally{fs.writeFileSync(runtimeFile,runtimeBytes);}assertPackedFiles();console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED feedback_correlation');
    try{fs.appendFileSync(runtimeFile,'\n// closure deliberate drift\n');assert.throws(assertPackedFiles,/installed artifact content/);}
    finally{fs.writeFileSync(runtimeFile,runtimeBytes);}assertPackedFiles();console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED dist_drift');
    // Accepted canonical source and historical fixtures: normalize checkout EOL only.
    const protectedFiles=[".github/workflows/harness.yml","ARCHITECTURE.md","docs/CORE_INTEGRATION.md","docs/DECISIONS.md","harness/core-pin.json","harness/modules.json","src/foundation/execution/index.ts","src/foundation/messaging/index.ts","src/foundation/modules/index.ts","src/foundation/runtime/index.ts","src/index.ts","src/modules/actor-ai/index.ts","src/modules/combat/index.ts","src/modules/effect/index.ts","src/modules/entity/index.ts","src/modules/progression/index.ts","src/modules/skill/index.ts","tests/consumers/actor-ai-action-selection.mjs","tests/consumers/actor-ai-action-selection.ts","tests/consumers/actor-ai-behavior.mjs","tests/consumers/actor-ai-behavior.ts","tests/consumers/actor-ai-foundation.mjs","tests/consumers/actor-ai-foundation.ts","tests/consumers/actor-ai-integration.mjs","tests/consumers/actor-ai-integration.ts","tests/consumers/actor-ai-lifecycle-recovery.mjs","tests/consumers/actor-ai-lifecycle-recovery.ts","tests/consumers/actor-ai-perception.mjs","tests/consumers/actor-ai-perception.ts","tests/consumers/actor-ai-target-selection.mjs","tests/consumers/actor-ai-target-selection.ts","tests/consumers/advancement.mjs","tests/consumers/advancement.ts","tests/consumers/attribute-points.mjs","tests/consumers/attribute-points.ts","tests/consumers/combat-admission.mjs","tests/consumers/combat-admission.ts","tests/consumers/combat-attack.mjs","tests/consumers/combat-attack.ts","tests/consumers/combat-damage.mjs","tests/consumers/combat-damage.ts","tests/consumers/combat-integration.mjs","tests/consumers/combat-integration.ts","tests/consumers/combat-target.mjs","tests/consumers/combat-target.ts","tests/consumers/combat.mjs","tests/consumers/combat.ts","tests/consumers/composition.mjs","tests/consumers/composition.ts","tests/consumers/effect-application.mjs","tests/consumers/effect-application.ts","tests/consumers/effect-foundation.mjs","tests/consumers/effect-foundation.ts","tests/consumers/effect-integration.mjs","tests/consumers/effect-integration.ts","tests/consumers/effect-lifecycle.mjs","tests/consumers/effect-lifecycle.ts","tests/consumers/effect-modifiers.mjs","tests/consumers/effect-modifiers.ts","tests/consumers/effect-periodic.mjs","tests/consumers/effect-periodic.ts","tests/consumers/effect-restrictions.mjs","tests/consumers/effect-restrictions.ts","tests/consumers/effect-stacking.mjs","tests/consumers/effect-stacking.ts","tests/consumers/entity-collection.mjs","tests/consumers/entity-collection.ts","tests/consumers/entity-integration.mjs","tests/consumers/entity-integration.ts","tests/consumers/entity-life.mjs","tests/consumers/entity-life.ts","tests/consumers/entity-resources.mjs","tests/consumers/entity-resources.ts","tests/consumers/entity-stats.mjs","tests/consumers/entity-stats.ts","tests/consumers/entity.mjs","tests/consumers/entity.ts","tests/consumers/execution.mjs","tests/consumers/execution.ts","tests/consumers/experience.mjs","tests/consumers/experience.ts","tests/consumers/messaging.mjs","tests/consumers/messaging.ts","tests/consumers/modules.mjs","tests/consumers/modules.ts","tests/consumers/progression-integration.mjs","tests/consumers/progression-integration.ts","tests/consumers/progression.mjs","tests/consumers/progression.ts","tests/consumers/runtime.mjs","tests/consumers/runtime.ts","tests/consumers/skill-activation.mjs","tests/consumers/skill-activation.ts","tests/consumers/skill-admission.mjs","tests/consumers/skill-admission.ts","tests/consumers/skill-combat-handoff.mjs","tests/consumers/skill-cooldown.mjs","tests/consumers/skill-cooldown.ts","tests/consumers/skill-foundation.mjs","tests/consumers/skill-foundation.ts","tests/consumers/skill-integration.mjs","tests/consumers/skill-integration.ts","tests/consumers/skill-loadout.mjs","tests/consumers/skill-loadout.ts","tests/consumers/skill-progression.mjs","tests/consumers/skill-progression.ts","tests/consumers/skill-resource-costs.mjs","tests/consumers/skill-resource-costs.ts"];
    const digest=entries=>createHash('sha256').update(JSON.stringify(entries)).digest('hex');
    const captured=protectedFiles.map(name=>[name,fs.readFileSync(path.join(root,name),'utf8').replaceAll('\r\n','\n')]);
    // Only exact Developer-approved additive deltas may be removed before hashing.
    const approvedAdditions=[["src/index.ts","\nexport {createEncounterDefinitionReference, createEncounterSide, createEncounterParticipant,\n  createEncounterState, validateEncounterState} from './modules/encounter/index.js';\nexport type {EncounterDefinitionReference, EncounterSide, EncounterParticipant, EncounterStatus,\n  EncounterInitialState, EncounterState} from './modules/encounter/index.js';\n",""],["harness/modules.json",",\n    {\"id\": \"encounter\", \"optional\": true, \"dependencies\": [\"entity\"]}",""],["docs/DECISIONS.md","\n## Encounter phase decisions — v0.8.x (Developer approved, 2026-10-21)\n\n| ID | Approved A | EN01–EN05 implementation boundary |\n| --- | --- | --- |\n| ENC-D01 | One encounter = one engagement | Opaque encounterId; no zone/dungeon/global runtime |\n| ENC-D02 | Entity dependency only | Optional encounter -> [entity]; canonical getEntity/listEntities |\n| ENC-D03 | Generic side IDs | Exact nonblank sideId; no kind/relation inference |\n| ENC-D04 | Future explicit dynamic participation | Initial structural roster only; no Join/Leave |\n| ENC-D05 | Future explicit completion evaluation | No auto-win, objective evaluator or outcome |\n| ENC-D06 | Closed terminal; new ID for rematch | Status vocabulary only; no transition/reopen implementation |\n| ENC-D07 | Future side-based outcome | No winner/reward fields in five-field state |\n\nAll seven choices are approved; later behavior still requires its own milestone.\nStructural validation of any recognized status proves no transition provenance.\nL3 owns content/policy; L4 owns World storage, authoritative commit, spawning,\ncross-encounter exclusivity and orchestration. No new owner or engine.\nSee [approved task](tasks/active/v0.8.0-encounter-foundation.md).\n",""]];
    approvedAdditions.push(["src/index.ts","\nexport {createEncounterActivationPolicy, createEncounterActivationObservation,\n  evaluateEncounterActivationAdmission, activateEncounter} from './modules/encounter/index.js';\nexport type {EncounterParticipantActivationFact, EncounterActivationObservation, EncounterActivationPolicy,\n  EncounterActivationRejectionReason, EncounterActivationAdmissionResult, EncounterActivationTransitionResult} from './modules/encounter/index.js';\n",""]);
    const historical=entries=>entries.map(([name,text])=>{
      for(const addition of approvedAdditions.filter(([file])=>file===name)){
        assert.equal(text.split(addition[1]).length,2,'exact approved additive scope '+name);
        text=text.replace(addition[1],addition[2]);
      }
      return [name,text];
    });
    const assertProtected=entries=>assert.equal(digest(historical(entries)),'6b71e71ff40973efb3056e104c59934f1d025bf946a12ad4de5e38bc397619be','closure protected source/Core/registry/history guard');
    assertProtected(captured);
    for(const name of ['src/modules/entity/index.ts','harness/core-pin.json','harness/modules.json']){
      const fault=captured.map(([file,text])=>[file,text+(file===name?'\n// deliberate scope fault':'')]);assert.throws(()=>assertProtected(fault),/protected source/);
    }
    console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED protected_scope');
    validate(run());assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_CLOSURE_NEGATIVE_PASS runtime_and_fixture_faults; source_Core_registry_guard; scenario_inventory; restored_clean_rerun');
    }

    { // EN01-EN05: physically installed contracts, targeted mutations and strict declarations.
    for(const ext of ['mjs','ts'])copyRequiredConsumer(path.join(root,'tests/consumers/encounter-foundation.'+ext),path.join(temp,'encounter-foundation.'+ext));
    const file=path.join(temp,'encounter-foundation.mjs'),bytes=fs.readFileSync(file),source=bytes.toString('utf8');
    const registryFile=path.join(temp,'encounter-modules.json'),registryBytes=fs.readFileSync(path.join(root,'harness/modules.json'));fs.writeFileSync(registryFile,registryBytes);
    const markers=Array.from({length:44},(_,i)=>'ENCOUNTER_F'+String(i+1).padStart(2,'0')+'_PASS');
    const run=()=>exec(['--test','--test-reporter=tap','encounter-foundation.mjs'],temp);
    const validate=output=>assertTapEvidence(output,12,markers);
    const clean=()=>{validate(run());assertPackedFiles();};
    const evidence=run();validate(evidence);for(const marker of markers)console.log(evidence.split(/\r?\n/).find(line=>line.includes(marker)));
    console.log(evidence.split(/\r?\n/).find(line=>line.includes('ENCOUNTER_REPLAY_SHA256')));
    console.log('INSTALLED_ENCOUNTER_FOUNDATION_PASS EN01-EN05; consumer_tests=12 skipped=0; structural_only');
    // Require the intended failing assertion in a real isolated subprocess.
    function red(id,pattern,diagnostic){
      const env={...process.env};delete env.NODE_TEST_CONTEXT;
      const args=['--test','--test-reporter=tap',...(pattern?['--test-name-pattern=Encounter '+pattern]:[]),'encounter-foundation.mjs'];
      const result=spawnSync(process.execPath,args,{cwd:temp,shell:false,encoding:'utf8',env});
      assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,1,result.stdout+result.stderr);
      assert.match(result.stdout+result.stderr,diagnostic,id+' intended assertion');
      console.log('ENCOUNTER_NEGATIVE_RED '+id+' exit=1 intended='+diagnostic.source);
    }
    function done(id){assertPackedFiles();clean();console.log('ENCOUNTER_NEGATIVE_PASS '+id+' restored_bytes; clean12/12');}
    // Run the same central guard functions in an isolated process so expected
    // assertion failures carry an observed nonzero exit, not a synthetic label.
    const guardFile=path.join(temp,'encounter-negative-guard.mjs');
    const guardPrelude=`import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
      const installed=${JSON.stringify(installed)};
      const expectedPackedFiles=${JSON.stringify(expectedPackedFiles.map(([name,bytes])=>[name,bytes.toString('base64')]))}.map(([name,bytes])=>[name,Buffer.from(bytes,'base64')]);
      const assertVersion=${assertVersion.toString()};const assertCoreIntegrity=${assertCoreIntegrity.toString()};
      const assertTapEvidence=${assertTapEvidence.toString()};const assertPackedFiles=${assertPackedFiles.toString()};`;
    function guardRed(id,code,diagnostic){
      fs.writeFileSync(guardFile,guardPrelude+code);
      const result=spawnSync(process.execPath,[guardFile],{cwd:temp,shell:false,encoding:'utf8'});
      assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,1,result.stdout+result.stderr);
      assert.match(result.stdout+result.stderr,diagnostic,id+' intended central guard');
      console.log('ENCOUNTER_NEGATIVE_RED '+id+' exit=1 intended='+diagnostic.source);
    }

    // N01: actual missing file and skipped execution, not a simulated marker.
    try{fs.renameSync(file,file+'.saved');red('N01',null,/Could not find.*encounter-foundation\.mjs|ENOENT|MODULE_NOT_FOUND/);}
    finally{if(fs.existsSync(file+'.saved'))fs.renameSync(file+'.saved',file);}done('N01');
    const rootFile=path.join(installed,'dist/index.js'),rootBytes=fs.readFileSync(rootFile);
    try{const text=rootBytes.toString('utf8');assert.ok(text.includes('createEncounterState,'));fs.writeFileSync(rootFile,text.replace('createEncounterState,','createEncounterState as missingEncounterState,'));red('N02','prepared:',/createEncounterState is not a function/);}
    finally{fs.writeFileSync(rootFile,rootBytes);}done('N02');
    const manifestFile=path.join(installed,'package.json'),manifestBytes=fs.readFileSync(manifestFile);
    try{const manifest=JSON.parse(manifestBytes);manifest.version='0.0.0';fs.writeFileSync(manifestFile,JSON.stringify(manifest));guardRed('N03',`assertVersion(JSON.parse(fs.readFileSync(${JSON.stringify(manifestFile)})).version,'0.8.1');`,/installed package version/);}
    finally{fs.writeFileSync(manifestFile,manifestBytes);}done('N03');
    const coreManifest=path.join(temp,'node_modules/@rpg/core/package.json'),coreBytes=fs.readFileSync(coreManifest);
    try{const manifest=JSON.parse(coreBytes);manifest.version='0.0.0';fs.writeFileSync(coreManifest,JSON.stringify(manifest));guardRed('N04_version',`assertVersion(JSON.parse(fs.readFileSync(${JSON.stringify(coreManifest)})).version,${JSON.stringify(pin.version)});`,/installed package version/);guardRed('N04_integrity',`assertCoreIntegrity(Buffer.concat([fs.readFileSync(${JSON.stringify(coreArtifact)}),Buffer.from('corrupt')]),${JSON.stringify(lock.packages['node_modules/@rpg/core'].integrity)});`,/Core artifact integrity/);}
    finally{fs.writeFileSync(coreManifest,coreBytes);}done('N04');
    try{const registry=JSON.parse(registryBytes);registry.modules.find(d=>d.id==='encounter').dependencies=[];fs.writeFileSync(registryFile,JSON.stringify(registry));red('N05','composition:',/Encounter exact dependency oracle/);}
    finally{fs.writeFileSync(registryFile,registryBytes);}done('N05');
    const runtimeFile=path.join(installed,'dist/modules/encounter/index.js'),runtimeBytes=fs.readFileSync(runtimeFile),runtime=runtimeBytes.toString('utf8');
    const faults=[
      ['N06','sides:',"if (sideIds.has(side.sideId))",'if (false)',/duplicate side must reject/],
      ['N07','participants:',"if (entityIds.has(participant.entityId))",'if (false)',/duplicate participant must reject/],
      ['N08','membership:',"if (!getEntity(entities, participant.entityId))",'if (false)',/unknown canonical Entity must reject/],
      ['N09','definition:',"if (!field || !('value' in field))",'if (false)',/definition accessor must reject/],
      ['N10','prepared:',"status: 'prepared'","status: 'active'",/prepared literal oracle/],
      ['N11','snapshots:','sides: Object.freeze(sides)','sides: sides',/Encounter snapshot must be frozen/],
      ['N12','status:',"if (typeof status !== 'string' || !['prepared', 'active', 'resolved', 'closed', 'cancelled'].includes(status))",'if (false)',/unknown status must reject/],
    ];
    for(const [id,pattern,expected,faulty,diagnostic] of faults){
      assert.ok(runtime.includes(expected),id+' required mutation');let changed=runtime.replace(expected,faulty);
      // N09 deliberately invokes the getter instead of capturing its descriptor.
      if(id==='N09')changed=changed.replace('return [key, field.value];','return [key, input[key]];');
      try{fs.writeFileSync(runtimeFile,changed);red(id,pattern,diagnostic);}
      finally{fs.writeFileSync(runtimeFile,runtimeBytes);}assert.deepEqual(fs.readFileSync(runtimeFile),runtimeBytes);done(id);
    }
    const config=path.join(temp,'encounter-tsconfig.json');fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022'],module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,skipLibCheck:false,types:[]},files:['encounter-foundation.ts']}));
    const compile=()=>exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p','encounter-tsconfig.json'],temp);compile();
    const declarationFile=path.join(installed,'dist/modules/encounter/index.d.ts'),declarationBytes=fs.readFileSync(declarationFile);
    try{const text=declarationBytes.toString('utf8');assert.ok(text.includes('readonly encounterId: string'));fs.writeFileSync(declarationFile,text.replaceAll('readonly encounterId: string','encounterId: string'));assert.throws(compile,/TS2578/);}
    finally{fs.writeFileSync(declarationFile,declarationBytes);}compile();console.log('ENCOUNTER_NEGATIVE_RED N13 real_tsc_exit=1 TS2578_readonly_assertion');done('N13');
    for(const [kind,changed,diagnostic] of [
      ['zero_assertions',source.replace('assertions++;',''),/Encounter requires actual assertions/],
      ['skipped',source.replace("test('Encounter '","test.skip('Encounter '"),/TAP skipped|required evidence|required test count/],
    ]){try{fs.writeFileSync(file,changed);if(kind==='skipped'){const env={...process.env};delete env.NODE_TEST_CONTEXT;const result=spawnSync(process.execPath,['--test','--test-reporter=tap','encounter-foundation.mjs'],{cwd:temp,shell:false,encoding:'utf8',env});assert.ifError(result.error);assert.equal(result.status,0);guardRed('N14_skipped',`assertTapEvidence(${JSON.stringify(result.stdout)},12);`,/0 !== 12/);}else red('N14_'+kind,'identity:',diagnostic);}
    finally{fs.writeFileSync(file,bytes);}done('N14_'+kind);}
    const rootDeclaration=()=>{const manifest=JSON.parse(fs.readFileSync(manifestFile));const name=manifest.exports['.'].types;
      assert.equal(name,'./dist/index.d.ts','Encounter canonical root declaration path');assert.ok(packed.files.some(f=>'./'+f.path===name));assert.ok(fs.statSync(path.join(installed,name)).isFile());};
    rootDeclaration();try{const manifest=JSON.parse(manifestBytes);manifest.exports['.'].types='./dist/missing.d.ts';fs.writeFileSync(manifestFile,JSON.stringify(manifest));guardRed('N15',`const name=JSON.parse(fs.readFileSync(${JSON.stringify(manifestFile)})).exports['.'].types;assert.equal(name,'./dist/index.d.ts','Encounter canonical root declaration path');assert.ok(${JSON.stringify(packed.files.map(f=>'./'+f.path))}.includes(name));assert.ok(fs.statSync(path.join(installed,name)).isFile());`,/Encounter canonical root declaration path/);}
    finally{fs.writeFileSync(manifestFile,manifestBytes);}assert.deepEqual(fs.readFileSync(manifestFile),manifestBytes);rootDeclaration();done('N15');
    try{fs.appendFileSync(runtimeFile,'\n// deliberate drift\n');guardRed('N16','assertPackedFiles();',/installed artifact content/);}
    finally{fs.writeFileSync(runtimeFile,runtimeBytes);}done('N16');
    // Actual runtime dependency/source audit: no execution or hidden providers.
    assert.deepEqual([...runtime.matchAll(/from ['"]([^'"]+)['"]/g)].map(m=>m[1]),['../entity/index.js']);
    assert.doesNotMatch(runtime,/Date\.now|Math\.random|setTimeout|setInterval|randomUUID|process\.|fetch\(|class |new WeakMap|from ['"](?:node:|@rpg\/core)/);
    console.log('ENCOUNTER_F45_PASS installed_runtime; strict_NodeNext; historical_runner_required');
    console.log('INSTALLED_ENCOUNTER_NEGATIVE_PASS N01-N16; targeted_assertions; restored_clean; strict_NodeNext');
    }


    { // EN06-EN10: mandatory installed activation contracts and isolated fault controls.
    for(const ext of ['mjs','ts'])copyRequiredConsumer(path.join(root,'tests/consumers/encounter-activation.'+ext),path.join(temp,'encounter-activation.'+ext));
    const file=path.join(temp,'encounter-activation.mjs'),bytes=fs.readFileSync(file),source=bytes.toString('utf8');
    const markers=Array.from({length:48},(_,i)=>'ENCOUNTER_A'+String(i+1).padStart(2,'0')+'_PASS');
    const run=()=>exec(['--test','--test-reporter=tap','encounter-activation.mjs'],temp);
    const validate=output=>assertTapEvidence(output,11,markers);
    const clean=()=>{validate(run());assertPackedFiles();};
    const evidence=run();validate(evidence);for(const marker of markers)console.log(evidence.split(/\r?\n/).find(line=>line.includes(marker)));
    console.log(evidence.split(/\r?\n/).find(line=>line.includes('ENCOUNTER_ACTIVATION_REPLAY_SHA256')));
    console.log('INSTALLED_ENCOUNTER_ACTIVATION_PASS EN06-EN10; consumer_tests=11 skipped=0; candidate_only');
    function red(id,pattern,diagnostic){
      const env={...process.env};delete env.NODE_TEST_CONTEXT;
      const args=['--test','--test-reporter=tap',...(pattern?['--test-name-pattern=Activation '+pattern]:[]),'encounter-activation.mjs'];
      const result=spawnSync(process.execPath,args,{cwd:temp,shell:false,encoding:'utf8',env});
      assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,1,result.stdout+result.stderr);
      assert.match(result.stdout+result.stderr,diagnostic,id+' intended assertion');
      console.log('ENCOUNTER_ACTIVATION_NEGATIVE_RED '+id+' exit=1 intended='+diagnostic.source);
    }
    function done(id){assertPackedFiles();clean();console.log('ENCOUNTER_ACTIVATION_NEGATIVE_PASS '+id+' restored_bytes; clean11/11');}
    const guardFile=path.join(temp,'encounter-activation-negative-guard.mjs');
    const guardPrelude=`import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
      const installed=${JSON.stringify(installed)};
      const expectedPackedFiles=${JSON.stringify(expectedPackedFiles.map(([name,bytes])=>[name,bytes.toString('base64')]))}.map(([name,bytes])=>[name,Buffer.from(bytes,'base64')]);
      const assertVersion=${assertVersion.toString()};const assertCoreIntegrity=${assertCoreIntegrity.toString()};
      const assertTapEvidence=${assertTapEvidence.toString()};const assertPackedFiles=${assertPackedFiles.toString()};
      const copyRequiredConsumer=${copyRequiredConsumer.toString()};const assertActivationRegistration=${assertActivationRegistration.toString()};`;
    function guardRed(id,code,diagnostic){
      fs.writeFileSync(guardFile,guardPrelude+code);
      const result=spawnSync(process.execPath,[guardFile],{cwd:temp,shell:false,encoding:'utf8'});
      assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,1,result.stdout+result.stderr);
      assert.match(result.stdout+result.stderr,diagnostic,id+' intended central guard');
      console.log('ENCOUNTER_ACTIVATION_NEGATIVE_RED '+id+' exit=1 intended='+diagnostic.source);
    }
    try{fs.renameSync(file,file+'.saved');guardRed('N01',`copyRequiredConsumer(${JSON.stringify(file)},${JSON.stringify(file+'.copy')});`,/ENOENT/);}
    finally{if(fs.existsSync(file+'.saved'))fs.renameSync(file+'.saved',file);}done('N01');
    guardRed('N01_registration_skipped','assertActivationRegistration(undefined);',/mandatory installed activation consumer registration/);done('N01_registration_skipped');
    const rootFile=path.join(installed,'dist/index.js'),rootBytes=fs.readFileSync(rootFile);
    try{const text=rootBytes.toString('utf8');assert.match(text,/\bactivateEncounter\b/);fs.writeFileSync(rootFile,text.replace(/\bactivateEncounter\b/,'activateEncounter as deliberatelyMissingActivation'));red('N02',null,/does not provide an export named 'activateEncounter'/);}
    finally{fs.writeFileSync(rootFile,rootBytes);}done('N02');
    const manifestFile=path.join(installed,'package.json'),manifestBytes=fs.readFileSync(manifestFile);
    try{const manifest=JSON.parse(manifestBytes);manifest.version='0.8.0';fs.writeFileSync(manifestFile,JSON.stringify(manifest));guardRed('N03',`assertVersion(JSON.parse(fs.readFileSync(${JSON.stringify(manifestFile)})).version,'0.8.1');`,/installed package version/);}
    finally{fs.writeFileSync(manifestFile,manifestBytes);}done('N03');
    const pinFile=path.join(temp,'activation-core-pin.json');fs.writeFileSync(pinFile,fs.readFileSync(path.join(root,'harness/core-pin.json')));const pinBytes=fs.readFileSync(pinFile);
    try{const changed=JSON.parse(pinBytes);changed.revision='0000000000000000000000000000000000000000';fs.writeFileSync(pinFile,JSON.stringify(changed));guardRed('N04_revision',`assert.equal(JSON.parse(fs.readFileSync(${JSON.stringify(pinFile)})).revision,'04b7239f998c3c688a0dfa3202f11811a9acd775','activation pinned Core revision');`,/activation pinned Core revision/);guardRed('N04_integrity',`assertCoreIntegrity(Buffer.concat([fs.readFileSync(${JSON.stringify(coreArtifact)}),Buffer.from('corrupt')]),${JSON.stringify(lock.packages['node_modules/@rpg/core'].integrity)});`,/Core artifact integrity/);}
    finally{fs.writeFileSync(pinFile,pinBytes);}assert.deepEqual(fs.readFileSync(pinFile),pinBytes);done('N04');
    const registryFile=path.join(temp,'encounter-modules.json'),registryBytes=fs.readFileSync(registryFile);
    try{const registry=JSON.parse(registryBytes);registry.modules.find(d=>d.id==='encounter').dependencies=[];fs.writeFileSync(registryFile,JSON.stringify(registry));red('N05','providers:',/activation exact Entity dependency/);}
    finally{fs.writeFileSync(registryFile,registryBytes);}done('N05');
    const runtimeFile=path.join(installed,'dist/modules/encounter/index.js'),runtimeBytes=fs.readFileSync(runtimeFile),runtime=runtimeBytes.toString('utf8');
    const faults=[
      ['N06','missing:',"return reject('participant_fact_missing', participant.sideId, participant.entityId);","return Object.freeze({status:'admitted',reason:'none',encounterId:current.encounterId,sideId:null,entityId:null});",/missing fact exact diagnostic/],
      ['N07','readiness:',"if (!rules.allowedLifeStatuses.includes(facts.get(participant.entityId).life.status))",'if (false)',/life exact diagnostic before world/],
      ['N08','readiness:',"if (rules.requireWorldReady && !facts.get(participant.entityId).worldReady)",'if (false)',/world exact diagnostic/],
      ['N09','policy:',"const occupied = new Set(current.participants.map(participant => participant.sideId));","const occupied = new Set(current.sides.map(side => side.sideId));",/occupied not declared oracle/],
      ['N10','readiness:',"if (!rules.allowedLifeStatuses.includes(facts.get(participant.entityId).life.status))","if (rules.requireWorldReady && !facts.get(participant.entityId).worldReady) return reject('participant_world_not_ready', participant.sideId, participant.entityId);\n        if (!rules.allowedLifeStatuses.includes(facts.get(participant.entityId).life.status))",/life exact diagnostic before world/],
      ['N11','terminal:',"if (current.status !== 'prepared')","if (false)",/terminal cannot restart/],
      ['N12','terminal:',"const rules = createEncounterActivationPolicy(policy), observed = createEncounterActivationObservation(observation);","const rules = current.status !== 'prepared' ? policy : createEncounterActivationPolicy(policy), observed = createEncounterActivationObservation(observation);",/terminal policy still validated/],
      ['N13','diagnostics:',"encounterId: admission.encounterId, state: null","encounterId: admission.encounterId, state: Object.freeze({...input.current,status:'active'})",/rejected transition exact null state/],
      ['N14','candidate:',"sides: Object.freeze(sides)","sides: sides",/activation deep freeze/],
      ['N15','observations:',"if (observed.encounterId !== current.encounterId)",'if (false)',/observation binding must throw/],
    ];
    for(const [id,pattern,expected,faulty,diagnostic] of faults){
      assert.ok(runtime.includes(expected),id+' required installed mutation');
      try{fs.writeFileSync(runtimeFile,runtime.replace(expected,faulty));red(id,pattern,diagnostic);}
      finally{fs.writeFileSync(runtimeFile,runtimeBytes);}assert.deepEqual(fs.readFileSync(runtimeFile),runtimeBytes);done(id);
    }
    const config=path.join(temp,'activation-tsconfig.json');fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022'],module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,skipLibCheck:false,types:[]},files:['encounter-activation.ts']}));
    const compile=()=>exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p','activation-tsconfig.json'],temp);compile();
    const declarationFile=path.join(installed,'dist/modules/encounter/index.d.ts'),declarationBytes=fs.readFileSync(declarationFile);
    try{const text=declarationBytes.toString('utf8');assert.ok(text.includes('readonly requireWorldReady: boolean'));fs.writeFileSync(declarationFile,text.replace('readonly requireWorldReady: boolean','requireWorldReady: boolean'));assert.throws(compile,/TS2578/);}
    finally{fs.writeFileSync(declarationFile,declarationBytes);}compile();console.log('ENCOUNTER_ACTIVATION_NEGATIVE_RED N16 real_tsc_exit=1 TS2578_readonly_assertion');done('N16');
    const rootDeclaration=()=>{const manifest=JSON.parse(fs.readFileSync(manifestFile));const name=manifest.exports['.'].types;
      assert.equal(name,'./dist/index.d.ts','Activation canonical root declaration path');assert.ok(packed.files.some(f=>'./'+f.path===name));assert.ok(fs.statSync(path.join(installed,name)).isFile());};
    rootDeclaration();try{const manifest=JSON.parse(manifestBytes);manifest.exports['.'].types='./dist/missing.d.ts';fs.writeFileSync(manifestFile,JSON.stringify(manifest));guardRed('N17',`const name=JSON.parse(fs.readFileSync(${JSON.stringify(manifestFile)})).exports['.'].types;assert.equal(name,'./dist/index.d.ts','Activation canonical root declaration path');assert.ok(${JSON.stringify(packed.files.map(f=>'./'+f.path))}.includes(name));assert.ok(fs.statSync(path.join(installed,name)).isFile());`,/Activation canonical root declaration path/);}
    finally{fs.writeFileSync(manifestFile,manifestBytes);}assert.deepEqual(fs.readFileSync(manifestFile),manifestBytes);rootDeclaration();done('N17');
    for(const [kind,changed] of [['zero_assertions',source.replace('assertions++;','')],['skipped',source.replace("test('Activation '","test.skip('Activation '")]]){
      assert.notEqual(changed,source);
      try{fs.writeFileSync(file,changed);if(kind==='skipped'){
        const env={...process.env};delete env.NODE_TEST_CONTEXT;const result=spawnSync(process.execPath,['--test','--test-reporter=tap','encounter-activation.mjs'],{cwd:temp,shell:false,encoding:'utf8',env});assert.ifError(result.error);assert.equal(result.status,0);guardRed('N18_skipped',`assertTapEvidence(${JSON.stringify(result.stdout)},11);`,/0 !== 11/);
      }else red('N18_zero_assertions','creation:',/Activation requires actual assertions/);}
      finally{fs.writeFileSync(file,bytes);}done('N18_'+kind);
    }
    try{fs.appendFileSync(runtimeFile,'\n// deliberate activation drift\n');guardRed('N19','assertPackedFiles();',/installed artifact content/);}
    finally{fs.writeFileSync(runtimeFile,runtimeBytes);}done('N19');
    guardRed('N20',`assertTapEvidence(${JSON.stringify(evidence.replace('ENCOUNTER_A35_PASS','removed_marker'))},11,${JSON.stringify(markers)});`,/required evidence ENCOUNTER_A35_PASS/);done('N20');
    console.log('ENCOUNTER_A49_PASS physical_tarball; root_named_exports; exact_types_pack_exists; strict_NodeNext');
    console.log('ENCOUNTER_A50_PASS mandatory_central_runner; historical_regressions; CI_runs_same_verify');
    console.log('INSTALLED_ENCOUNTER_ACTIVATION_NEGATIVE_PASS N01-N20; targeted_assertions; restored_clean; strict_NodeNext');
    activationReceipt={runtime:evidence,typechecked:true};
    }

    assertActivationRegistration(activationReceipt);

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
    }, files:['consumer.ts', 'modules.ts', 'composition.ts', 'runtime.ts', 'messaging.ts', 'execution.ts', 'entity.ts', 'entity-collection.ts', 'entity-stats.ts', 'entity-resources.ts', 'entity-life.ts', 'entity-integration.ts', 'progression.ts', 'experience.ts', 'advancement.ts', 'attribute-points.ts', 'skill-progression.ts', 'progression-integration.ts', 'combat.ts', 'combat-admission.ts', 'combat-target.ts', 'combat-attack.ts', 'combat-damage.ts', 'combat-integration.ts', 'skill-foundation.ts', 'skill-admission.ts', 'skill-resource-costs.ts', 'skill-cooldown.ts', 'skill-activation.ts', 'skill-loadout.ts', 'skill-integration.ts', 'effect-foundation.ts', 'effect-application.ts', 'effect-lifecycle.ts', 'effect-stacking.ts', 'effect-modifiers.ts', 'effect-restrictions.ts', 'effect-periodic.ts', 'effect-integration.ts', 'actor-ai-foundation.ts', 'actor-ai-perception.ts', 'actor-ai-target-selection.ts', 'actor-ai-behavior.ts', 'actor-ai-action-selection.ts', 'actor-ai-integration.ts','actor-ai-lifecycle-recovery.ts','actor-ai-integration-closure.ts']}));
    exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp);
    const aiDeclarationFile = path.join(installed, 'dist/modules/actor-ai/index.d.ts');
    const aiDeclaration = fs.readFileSync(aiDeclarationFile, 'utf8');
    assert.ok(aiDeclaration.includes("'manual' | 'ai'"));
    try {
      fs.writeFileSync(aiDeclarationFile, aiDeclaration.replace("'manual' | 'ai'", "'manual'"));
      assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp), /TS\d+/);
    } finally {fs.writeFileSync(aiDeclarationFile, aiDeclaration);}
    assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_DECLARATION_NEGATIVE_PASS wrong_controller; strict_NodeNext_failure; restored_declarations');
    assert.ok(aiDeclaration.includes('readonly observedAtMs: number;'));
    try {
      fs.writeFileSync(aiDeclarationFile, aiDeclaration.replaceAll('readonly observedAtMs: number;', 'readonly observedAtMs: string;'));
      assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp), /TS\d+/);
    } finally {fs.writeFileSync(aiDeclarationFile, aiDeclaration);}
    assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_PERCEPTION_DECLARATION_NEGATIVE_PASS wrong_observation_time; strict_NodeNext_failure; restored_declarations');
    assert.ok(aiDeclaration.includes("'retain_if_eligible' | 'prefer_priority'"));
    try {
      fs.writeFileSync(aiDeclarationFile, aiDeclaration.replace("'retain_if_eligible' | 'prefer_priority'", "'retain_if_eligible'"));
      assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp), /TS\d+/);
    } finally {fs.writeFileSync(aiDeclarationFile, aiDeclaration);}
    assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_TARGET_DECLARATION_NEGATIVE_PASS missing_retention_mode; strict_NodeNext_failure; restored_declarations');
    assert.ok(aiDeclaration.includes("'any' | 'present' | 'absent'"));
    try {
      fs.writeFileSync(aiDeclarationFile, aiDeclaration.replace("'any' | 'present' | 'absent'", "'any' | 'absent'"));
      assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp), /TS\d+/);
    } finally {fs.writeFileSync(aiDeclarationFile, aiDeclaration);}
    assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_BEHAVIOR_DECLARATION_NEGATIVE_PASS missing_target_guard; strict_NodeNext_failure; restored_declarations');
    assert.ok(aiDeclaration.includes("'current_target' | 'self' | 'none'"));
    try {
      fs.writeFileSync(aiDeclarationFile, aiDeclaration.replace("'current_target' | 'self' | 'none'", "'current_target' | 'none'"));
      assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp), /TS\d+/);
    } finally {fs.writeFileSync(aiDeclarationFile, aiDeclaration);}
    assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_ACTION_DECLARATION_NEGATIVE_PASS missing_self_target; strict_NodeNext_failure; restored_declarations');
    const feedbackDeclaration = aiDeclaration.slice(aiDeclaration.indexOf('export type ActorAIActionExecutionFeedback'));
    assert.ok(feedbackDeclaration.includes('readonly attemptId: string'));
    try {
      fs.writeFileSync(aiDeclarationFile, aiDeclaration.slice(0, aiDeclaration.indexOf('export type ActorAIActionExecutionFeedback'))
        + feedbackDeclaration.replace('readonly attemptId: string', 'readonly attemptId: number'));
      assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp), /TS\d+/);
    } finally {fs.writeFileSync(aiDeclarationFile, aiDeclaration);}
    assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_INTEGRATION_DECLARATION_NEGATIVE_PASS wrong_attempt_type; real_strict_NodeNext_failure; restored');
    const timingDeclarationStart=aiDeclaration.indexOf('export interface ActorAIDecisionTimingPolicy');
    assert.ok(timingDeclarationStart>0);
    const timingDeclaration=aiDeclaration.slice(timingDeclarationStart);assert.ok(timingDeclaration.includes('readonly intervalMs: number'));
    try{fs.writeFileSync(aiDeclarationFile,aiDeclaration.slice(0,timingDeclarationStart)+timingDeclaration.replace('readonly intervalMs: number','readonly intervalMs: string'));
      assert.throws(()=>exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],temp),/TS\d+/);
    }finally{fs.writeFileSync(aiDeclarationFile,aiDeclaration);}
    assertPackedFiles();console.log('INSTALLED_ACTOR_AI_LIFECYCLE_DECLARATION_NEGATIVE_PASS wrong_interval_type; real_strict_NodeNext_failure; restored');
    try{fs.writeFileSync(aiDeclarationFile,aiDeclaration.replace('readonly intervalMs: number','readonly intervalMs: string'));assert.throws(()=>exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],temp),/TS\d+/);}
    finally{fs.writeFileSync(aiDeclarationFile,aiDeclaration);}assertPackedFiles();
    console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED installed_declaration');
    const manifestFile=path.join(installed,'package.json'),manifestBytes=fs.readFileSync(manifestFile);
    // NodeNext can fall back through the import condition. Check the package
    // declaration contract directly; declaration validity remains a compiler gate.
    const assertRootDeclarationExport=()=>{
      const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
      const declaration=manifest.exports['.'].types;
      assert.equal(declaration,'./dist/index.d.ts','installed root types export must name the canonical declaration');
      assert.ok(packed.files.some(file=>'./'+file.path===declaration),'root declaration must be included in the packed artifact');
      assert.ok(fs.statSync(path.join(installed,declaration)).isFile(),'installed root declaration must exist as a file');
    };
    assertRootDeclarationExport();
    try{const broken=JSON.parse(manifestBytes);broken.exports['.'].types='./dist/missing.d.ts';fs.writeFileSync(manifestFile,JSON.stringify(broken));assert.throws(assertRootDeclarationExport,{code:'ERR_ASSERTION',message:/installed root types export must name the canonical declaration/});}
    finally{fs.writeFileSync(manifestFile,manifestBytes);}
    assert.deepEqual(fs.readFileSync(manifestFile),manifestBytes);assertRootDeclarationExport();assertPackedFiles();
    exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],temp);
    console.log('INSTALLED_ACTOR_AI_CLOSURE_FAULT_DETECTED export_map');
    console.log('INSTALLED_ACTOR_AI_CLOSURE_DECLARATION_PASS strict_NodeNext; skipLibCheck_false; restored');
    const declarationFile = path.join(installed, 'dist/modules/effect/index.d.ts');
    const declarationBytes = fs.readFileSync(declarationFile, 'utf8');
    assert.ok(declarationBytes.includes("readonly kind: 'dot' | 'hot';"));
    try {
      fs.writeFileSync(declarationFile, declarationBytes.replaceAll("readonly kind: 'dot' | 'hot';", "readonly kind: 'hot';"));
      assert.throws(() => exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp), /TS\d+/);
    } finally {fs.writeFileSync(declarationFile, declarationBytes);}
    assertPackedFiles();
    console.log('INSTALLED_EFFECT_INTEGRATION_DECLARATION_NEGATIVE_PASS wrong_installed_kind; strict_NodeNext_failure; restored_declarations');
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
