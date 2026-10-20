import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = process.env.npm_execpath;
function exec(args, cwd) {
  const env = {...process.env};
  // The installed consumer owns its test runner, not the parent runner's IPC context.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, {cwd, shell: false, encoding: 'utf8', env});
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

test('installed artifact: GF01–GF16 + EC01–EC18 + PG01–PG19 + CB01–CB30, ESM root, closed exports, strict declarations and real Kernel', () => {
  assert.ok(cli, 'run with npm run test:functional');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg package consumer '));
  try {
    const pin = JSON.parse(fs.readFileSync(path.join(root, 'harness/core-pin.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const coreArtifact = path.join(root, '.artifacts', pin.artifact);
    const integrity = 'sha512-' + createHash('sha512').update(fs.readFileSync(coreArtifact)).digest('base64');
    assert.equal(integrity, lock.packages['node_modules/@rpg/core'].integrity);
    const packedResult = JSON.parse(exec([cli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temp], root));
    const packed = Array.isArray(packedResult) ? packedResult[0] : packedResult['@rpg/gameplay'];
    assert.deepEqual(packed.files.map(x => x.path).sort(), [
      'README.md', 'dist/foundation/execution/index.d.ts', 'dist/foundation/execution/index.js',
      'dist/foundation/messaging/index.d.ts', 'dist/foundation/messaging/index.js',
      'dist/foundation/modules/index.d.ts', 'dist/foundation/modules/index.js',
      'dist/foundation/runtime/index.d.ts', 'dist/foundation/runtime/index.js',
      'dist/index.d.ts', 'dist/index.js', 'dist/modules/combat/index.d.ts', 'dist/modules/combat/index.js',
      'dist/modules/entity/index.d.ts', 'dist/modules/entity/index.js',
      'dist/modules/progression/index.d.ts', 'dist/modules/progression/index.js', 'package.json',
    ].sort());
    fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({name: 'foundation-consumer', private: true, type: 'module'}));
    exec([cli, 'install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temp, packed.filename), coreArtifact], temp);
    const installed = path.join(temp, 'node_modules/@rpg/gameplay');
    assert.equal(fs.lstatSync(installed).isSymbolicLink(), false, 'must install tarball, not source link');
    assert.ok(fs.existsSync(path.join(installed, 'dist/index.d.ts')));
    assert.equal(fs.existsSync(path.join(installed, 'src')), false);
    const packageJson = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    assert.equal(packageJson.version, '0.4.5');
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
 'createEntityResourceState', 'getEntityResourceCurrent', 'normalizeEntityResource', 'transitionEntityResource', 'regenerateEntityResource', 'createEntityLifeState', 'resolveEntityDefeat', 'reviveEntity', 'createProgressionState', 'gainExperience', 'adjustExperience', 'evaluateLevelAdvancement', 'advanceProgressionLevel', 'createAttributePointState', 'grantAttributePointRewards', 'allocateAttributePoints', 'createSkillRankState', 'getSkillRank', 'createSkillPointState', 'grantSkillPointRewards', 'evaluateSkillUpgrade', 'upgradeSkillRank', 'createCombatActionContext', 'evaluateCombatActionAdmission', 'evaluateCombatTargetValidation', 'resolveCombatAttack', 'applyCombatAttackDamage'].sort());
// Independent contract oracle: 8 units minus 3 gives 5, bounds [0,10].
assert.deepEqual(calculateResourceTransition({resource:'energy',current:8,maximum:10,
 amount:3,operation:'decrease',rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}),
 {resource:'energy',before:8,after:5,applied:3,reachedMinimum:false});
for (const spec of ['@rpg/gameplay/src/index.ts','@rpg/gameplay/dist/index.js', '@rpg/gameplay/foundation/modules', '@rpg/gameplay/foundation/runtime', '@rpg/gameplay/dist/foundation/runtime/index.js', '@rpg/gameplay/foundation/messaging', '@rpg/gameplay/dist/foundation/messaging/index.js', '@rpg/gameplay/foundation/execution', '@rpg/gameplay/dist/foundation/execution/index.js', '@rpg/gameplay/modules/entity', '@rpg/gameplay/dist/modules/entity/index.js', '@rpg/gameplay/modules/combat', '@rpg/gameplay/dist/modules/combat/index.js', '@rpg/gameplay/modules/progression', '@rpg/gameplay/dist/modules/progression/index.js']) {
 await assert.rejects(import(spec), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
}
`);
    exec(['consumer.mjs'], temp);
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
    }, files:['consumer.ts', 'modules.ts', 'composition.ts', 'runtime.ts', 'messaging.ts', 'execution.ts', 'entity.ts', 'entity-collection.ts', 'entity-stats.ts', 'entity-resources.ts', 'entity-life.ts', 'entity-integration.ts', 'progression.ts', 'experience.ts', 'advancement.ts', 'attribute-points.ts', 'skill-progression.ts', 'progression-integration.ts', 'combat.ts', 'combat-admission.ts', 'combat-target.ts', 'combat-attack.ts', 'combat-damage.ts', 'combat-integration.ts']}));
    exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp);
  } finally {
    const resolved = fs.realpathSync(temp);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rpg package consumer '));
    fs.rmSync(resolved, {recursive: true, force: true});
  }
});
