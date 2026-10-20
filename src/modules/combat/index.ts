import {getEntity, getEntityResourceCurrent, transitionEntityResource, resolveEntityDefeat,
  type EntityCollection, type EntityLifeState, type EntityLifeStatus,
  type EntityResourceState, type EntityResourceTransitionInput, type EntityResourceTransitionResult,
  type EntityLifeResourcePolicy, type EntityLifeTransitionResult} from '../entity/index.js';
import {nextExecutionRandom, type GameplayExecutionContext} from '../../foundation/execution/index.js';
import {calculateHit, calculateCritical, calculateDamageB0, calculateDamageB1, calculateMitigation,
  type HitCalculationInput, type HitCalculationResult, type CriticalCalculationInput,
  type CriticalCalculationResult, type DamageB0Input, type DamageB0Result,
  type DamageScaling, type ResolvedDamageBonus, type MitigationCalculationInput,
  type MitigationCalculationResult, type NumericBounds, type ProbabilityRule} from '@rpg/core/kernel';

/** Exact caller-owned actor reference; existence and targeting policy are external. */
export interface CombatEntityTarget {
  readonly kind: 'entity';
  readonly entityId: string;
}

/** Structural intent only; actionType does not imply supported execution. */
export interface CombatActionRequest {
  readonly actionId: string;
  readonly actionType: string;
  readonly sourceEntityId: string;
  readonly target: CombatEntityTarget;
}

/** Detached frozen intent, not an admission decision or execution receipt. */
export type CombatActionContext = CombatActionRequest;

function dataFields(input: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Expected a closed own-data record');
  }
  const keys = Reflect.ownKeys(input);
  if (required.some(key => !Object.hasOwn(input, key))
    || keys.some(key => typeof key !== 'string' || (!required.includes(key) && !optional.includes(key)))
    || optional.some(key => key in input && !Object.hasOwn(input, key))) {
    throw new TypeError('Missing, inherited or unknown Combat fields');
  }
  return Object.fromEntries(keys.map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field || !('value' in field)) throw new TypeError('Combat fields must be own data properties');
    return [key, field.value as unknown];
  }));
}

function identifier(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected a nonblank Combat identifier');
  return input;
}

/** Capture one independent attempt without lookup, admission or gameplay effects. */
export function createCombatActionContext(request: CombatActionRequest): CombatActionContext {
  const data = dataFields(request, ['actionId', 'actionType', 'sourceEntityId', 'target']);
  const actionId = identifier(data.actionId);
  const actionType = identifier(data.actionType);
  const sourceEntityId = identifier(data.sourceEntityId);
  const target = dataFields(data.target, ['kind', 'entityId']);
  if (target.kind !== 'entity') throw new TypeError('Combat target kind must be entity');
  const entityId = identifier(target.entityId);
  return Object.freeze({actionId, actionType, sourceEntityId,
    target: Object.freeze({kind: 'entity' as const, entityId})});
}

/** Caller evaluates external conditions before supplying this explicit boolean. */
export interface CombatActorEligibilityPolicy {
  readonly eligible: boolean;
}

export type CombatAdmissionStatus = 'admitted' | 'rejected';
export type CombatAdmissionReason = 'none' | 'source_not_found' | 'source_dead' | 'source_ineligible';

/** Actor-stage evaluation only; not an execution token or durable reservation. */
export interface CombatAdmissionResult {
  readonly context: CombatActionContext;
  readonly status: CombatAdmissionStatus;
  readonly reason: CombatAdmissionReason;
}

function readLife(input: unknown, expectedId: string): EntityLifeStatus {
  const life = dataFields(input, ['entityId', 'status']);
  const entityId = identifier(life.entityId);
  if (life.status !== 'alive' && life.status !== 'dead') throw new TypeError('Invalid entity life status');
  if (entityId !== expectedId) throw new TypeError('Context and life entity IDs must match');
  return life.status;
}

/** Validate all inputs before evaluating source-only rejection priority. */
export function evaluateCombatActionAdmission(
  context: CombatActionContext,
  entities: EntityCollection,
  sourceLife: EntityLifeState,
  policy: CombatActorEligibilityPolicy,
): CombatAdmissionResult {
  const snapshot = createCombatActionContext(context);
  const source = getEntity(entities, snapshot.sourceEntityId);
  const status = readLife(sourceLife, snapshot.sourceEntityId);
  const eligibility = dataFields(policy, ['eligible']);
  if (typeof eligibility.eligible !== 'boolean') throw new TypeError('Eligibility must be an explicit boolean');
  const reason: CombatAdmissionReason = source === undefined ? 'source_not_found'
    : status === 'dead' ? 'source_dead'
      : !eligibility.eligible ? 'source_ineligible' : 'none';
  return Object.freeze({context: snapshot, status: reason === 'none' ? 'admitted' : 'rejected', reason});
}

export type CombatTargetRelation = 'self' | 'ally' | 'enemy' | 'neutral';

/** Caller resolves relationships; exact IDs must agree with self/non-self. */
export interface CombatTargetPolicy {
  readonly relation: CombatTargetRelation;
  readonly allowedRelations: readonly CombatTargetRelation[];
  readonly allowedLifeStatuses: readonly EntityLifeStatus[];
}

export type CombatTargetValidationStatus = 'accepted' | 'rejected';
export type CombatTargetRejectionReason = 'none' | 'target_not_found'
  | 'relation_not_allowed' | 'target_life_not_allowed';

/** Evaluation diagnostics only, not an authorization or authoritative target state. */
export interface CombatTargetValidationResult {
  readonly context: CombatActionContext;
  readonly targetEntityId: string;
  readonly relation: CombatTargetRelation;
  readonly targetLifeStatus: EntityLifeStatus;
  readonly status: CombatTargetValidationStatus;
  readonly reason: CombatTargetRejectionReason;
}

function relationValue(input: unknown): CombatTargetRelation {
  if (input !== 'self' && input !== 'ally' && input !== 'enemy' && input !== 'neutral') {
    throw new TypeError('Invalid target relation');
  }
  return input;
}

function allowedValues<T extends string>(input: unknown, supported: readonly T[]): readonly T[] {
  if (!Array.isArray(input)) throw new TypeError('Expected a nonempty targeting policy array');
  const length = Object.getOwnPropertyDescriptor(input, 'length')?.value as number;
  const keys = Reflect.ownKeys(input);
  if (!length || length > supported.length || keys.length !== length + 1) {
    throw new TypeError('Invalid targeting policy array shape');
  }
  const values: T[] = [];
  for (let i = 0; i < length; i++) {
    const entry = Object.getOwnPropertyDescriptor(input, String(i));
    if (!entry || !('value' in entry) || !supported.includes(entry.value as T)
      || values.includes(entry.value as T)) throw new TypeError('Invalid or duplicate targeting policy entry');
    values.push(entry.value as T);
  }
  return Object.freeze(values);
}

/** Target-only evaluation after structural admitted/none precondition validation. */
export function evaluateCombatTargetValidation(
  admission: CombatAdmissionResult,
  entities: EntityCollection,
  targetLife: EntityLifeState,
  policy: CombatTargetPolicy,
): CombatTargetValidationResult {
  const receipt = dataFields(admission, ['context', 'status', 'reason']);
  if (receipt.status !== 'admitted' || receipt.reason !== 'none') {
    throw new TypeError('Target validation requires admitted/none');
  }
  const context = createCombatActionContext(receipt.context as CombatActionContext);
  const targetEntityId = context.target.entityId;
  const target = getEntity(entities, targetEntityId);
  const targetLifeStatus = readLife(targetLife, targetEntityId);
  const data = dataFields(policy, ['relation', 'allowedRelations', 'allowedLifeStatuses']);
  const relation = relationValue(data.relation);
  const relations = allowedValues(data.allowedRelations, ['self', 'ally', 'enemy', 'neutral'] as const);
  const statuses = allowedValues(data.allowedLifeStatuses, ['alive', 'dead'] as const);
  if ((context.sourceEntityId === targetEntityId) !== (relation === 'self')) {
    throw new TypeError('Target relation must agree with exact source/target IDs');
  }
  const reason: CombatTargetRejectionReason = target === undefined ? 'target_not_found'
    : !relations.includes(relation) ? 'relation_not_allowed'
      : !statuses.includes(targetLifeStatus) ? 'target_life_not_allowed' : 'none';
  return Object.freeze({context, targetEntityId, relation, targetLifeStatus,
    status: reason === 'none' ? 'accepted' : 'rejected', reason});
}

/** Captured numerical data only; caller maps game stats/ranks to Kernel inputs. */
export interface CombatAttackInput {
  readonly hit: Required<Omit<HitCalculationInput, 'roll'>>;
  readonly critical: Omit<CriticalCalculationInput, 'roll'>;
  readonly damage: Pick<DamageB0Input, 'base' | 'rank' | 'perRank'> & {
    readonly scaling: readonly DamageScaling[];
    readonly flat: ReturnType<DamageB0Input['resolveFlat']>;
    readonly bonuses: readonly ResolvedDamageBonus[];
  };
  readonly mitigation: Omit<MitigationCalculationInput, 'damage'>;
}

export type CombatAttackOutcome = 'dodged' | 'landed';

/** Unrun stages are absent; landed damage is calculated, never applied. */
export type CombatAttackResolutionResult = {
  readonly context: CombatActionContext;
  readonly outcome: 'dodged';
  readonly hit: Readonly<HitCalculationResult>;
  readonly finalDamage: 0;
} | {
  readonly context: CombatActionContext;
  readonly outcome: 'landed';
  readonly hit: Readonly<HitCalculationResult>;
  readonly critical: Readonly<CriticalCalculationResult>;
  readonly b0: Readonly<Omit<DamageB0Result, 'scaling'>> & {
    readonly scaling: readonly Readonly<DamageB0Result['scaling'][number]>[];
  };
  readonly b1: Readonly<ReturnType<typeof calculateDamageB1>>;
  readonly mitigation: Readonly<MitigationCalculationResult>;
  readonly finalDamage: number;
};

function finite(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) throw new TypeError('Expected finite attack value');
  return input;
}

function flag(input: unknown): boolean {
  if (typeof input !== 'boolean') throw new TypeError('Expected explicit attack boolean');
  return input;
}

function attackArray(input: unknown): readonly unknown[] {
  if (!Array.isArray(input)) throw new TypeError('Expected dense own-data attack array');
  const length = Object.getOwnPropertyDescriptor(input, 'length')!.value as number;
  if (Reflect.ownKeys(input).length !== length + 1) throw new TypeError('Unknown attack array fields');
  return Array.from({length}, (_, index) => {
    const entry = Object.getOwnPropertyDescriptor(input, String(index));
    if (!entry || !('value' in entry)) throw new TypeError('Attack entries must be own data');
    return entry.value as unknown;
  });
}

function attackBounds(input: unknown): NumericBounds {
  const data = dataFields(input, [], ['min', 'max']);
  const min = Object.hasOwn(data, 'min') ? finite(data.min) : undefined;
  const max = Object.hasOwn(data, 'max') ? finite(data.max) : undefined;
  if (min !== undefined && max !== undefined && min > max) throw new TypeError('Inverted attack bounds');
  return {...(min === undefined ? {} : {min}), ...(max === undefined ? {} : {max})};
}

function probability(input: unknown): ProbabilityRule {
  const data = dataFields(input, ['enabled', 'bounds']);
  return {enabled: flag(data.enabled), bounds: attackBounds(data.bounds)};
}

function captureAttack(input: CombatAttackInput): CombatAttackInput {
  const data = dataFields(input, ['hit', 'critical', 'damage', 'mitigation']);
  const hit = dataFields(data.hit, ['dodgeChance', 'eligible', 'rule']);
  const critical = dataFields(data.critical, ['chance', 'bonus', 'eligible', 'rule']);
  const damage = dataFields(data.damage, ['base', 'rank', 'perRank', 'scaling', 'flat', 'bonuses']);
  const rank = finite(damage.rank);
  if (!Number.isSafeInteger(rank) || rank < 1) throw new TypeError('Attack rank must be a positive safe integer');
  const scaling = attackArray(damage.scaling).map(value => {
    const term = dataFields(value, ['source', 'value', 'coefficient']);
    return {source: identifier(term.source), value: finite(term.value), coefficient: finite(term.coefficient)};
  });
  if (new Set(scaling.map(term => term.source)).size !== scaling.length) throw new TypeError('Duplicate scaling source');
  const flat = dataFields(damage.flat, ['definition', 'additional', 'resolved']);
  const bonuses = attackArray(damage.bonuses).map(value => {
    const bonus = dataFields(value, ['id', 'source', 'eligible', 'reason', 'value', 'contributions']);
    if (typeof bonus.reason !== 'string') throw new TypeError('Bonus reason must be a string');
    return {id: identifier(bonus.id), source: identifier(bonus.source), eligible: flag(bonus.eligible),
      reason: bonus.reason, value: finite(bonus.value), contributions: attackArray(bonus.contributions).map(value => {
        const term = dataFields(value, ['id', 'value']);
        return {id: identifier(term.id), value: finite(term.value)};
      })};
  });
  const mitigation = dataFields(data.mitigation, ['ruleKey', 'rating', 'rule'], ['sourceLevel', 'targetLevel']);
  const rule = dataFields(mitigation.rule, ['enabled', 'bounds', 'levelScalingEnabled'], ['baseK', 'levelPenalty']);
  const enabled = flag(rule.enabled), levelScalingEnabled = flag(rule.levelScalingEnabled);
  const baseK = Object.hasOwn(rule, 'baseK') ? finite(rule.baseK) : undefined;
  const levelPenalty = Object.hasOwn(rule, 'levelPenalty') ? finite(rule.levelPenalty) : undefined;
  const sourceLevel = Object.hasOwn(mitigation, 'sourceLevel') ? finite(mitigation.sourceLevel) : undefined;
  const targetLevel = Object.hasOwn(mitigation, 'targetLevel') ? finite(mitigation.targetLevel) : undefined;
  if ((baseK !== undefined && baseK <= 0) || (levelPenalty !== undefined && levelPenalty < 0)
    || (enabled && (baseK === undefined || levelPenalty === undefined
      || (levelScalingEnabled && (sourceLevel === undefined || targetLevel === undefined))))) {
    throw new TypeError('Incomplete or invalid mitigation configuration');
  }
  return {
    hit: {dodgeChance: finite(hit.dodgeChance), eligible: flag(hit.eligible), rule: probability(hit.rule)},
    critical: {chance: finite(critical.chance), bonus: finite(critical.bonus),
      eligible: flag(critical.eligible), rule: probability(critical.rule)},
    damage: {base: finite(damage.base), rank, perRank: finite(damage.perRank), scaling,
      flat: {definition: finite(flat.definition), additional: finite(flat.additional), resolved: finite(flat.resolved)}, bonuses},
    mitigation: {ruleKey: identifier(mitigation.ruleKey), rating: finite(mitigation.rating),
      ...(sourceLevel === undefined ? {} : {sourceLevel}), ...(targetLevel === undefined ? {} : {targetLevel}),
      rule: {enabled, bounds: attackBounds(rule.bounds), levelScalingEnabled,
        ...(baseK === undefined ? {} : {baseK}), ...(levelPenalty === undefined ? {} : {levelPenalty})}},
  };
}

// Kernel diagnostics contain only records/arrays/scalars. Copy values verbatim,
// reject nonfinite output, and freeze new objects without mutating Kernel results.
function diagnosticSnapshot<T>(value: T): T {
  if (typeof value === 'number') finite(value);
  if (Array.isArray(value)) return Object.freeze(value.map(item => diagnosticSnapshot(item))) as T;
  if (typeof value === 'object' && value !== null) {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, diagnosticSnapshot(item)]))) as T;
  }
  return value;
}

/** Validate/capture first, then let Kernel own numerical work and lazy draw order. */
export function resolveCombatAttack(
  admission: CombatAdmissionResult,
  targetValidation: CombatTargetValidationResult,
  attackInput: CombatAttackInput,
  executionContext: GameplayExecutionContext,
): CombatAttackResolutionResult {
  const actor = dataFields(admission, ['context', 'status', 'reason']);
  if (actor.status !== 'admitted' || actor.reason !== 'none') throw new TypeError('Attack requires admitted/none');
  const context = createCombatActionContext(actor.context as CombatActionContext);
  const target = dataFields(targetValidation, ['context', 'targetEntityId', 'relation', 'targetLifeStatus', 'status', 'reason']);
  if (target.status !== 'accepted' || target.reason !== 'none') throw new TypeError('Attack requires accepted/none target');
  const targetContext = createCombatActionContext(target.context as CombatActionContext);
  if (context.actionId !== targetContext.actionId || context.actionType !== targetContext.actionType
    || context.sourceEntityId !== targetContext.sourceEntityId || context.target.kind !== targetContext.target.kind
    || context.target.entityId !== targetContext.target.entityId
    || identifier(target.targetEntityId) !== context.target.entityId) throw new TypeError('Attack stage identity mismatch');
  const relation = relationValue(target.relation);
  if ((context.sourceEntityId === context.target.entityId) !== (relation === 'self')) throw new TypeError('Inconsistent target relation');
  if (target.targetLifeStatus !== 'alive' && target.targetLifeStatus !== 'dead') throw new TypeError('Invalid target life status');
  const input = captureAttack(attackInput);
  const roll = () => nextExecutionRandom(executionContext);
  const hit = diagnosticSnapshot(calculateHit({...input.hit, roll}));
  if (!hit.hit) return Object.freeze({context, outcome: 'dodged', hit, finalDamage: 0});
  const critical = diagnosticSnapshot(calculateCritical({...input.critical, roll}));
  const terms = input.damage.scaling;
  const b0 = diagnosticSnapshot(calculateDamageB0({base: input.damage.base, rank: input.damage.rank,
    perRank: input.damage.perRank, sourceOrder: terms.map(term => term.source),
    sourceValue: source => terms.find(term => term.source === source)!.value,
    coefficient: source => terms.find(term => term.source === source)!.coefficient,
    resolveFlat: () => input.damage.flat}));
  const b1 = diagnosticSnapshot(calculateDamageB1(b0.raw, input.damage.bonuses, critical.bonus));
  const mitigation = diagnosticSnapshot(calculateMitigation({...input.mitigation, damage: b1.beforeDefense}));
  if (mitigation.status === 'missing_config') throw new TypeError(`Mitigation missing_config: ${mitigation.missing.join(', ')}`);
  return Object.freeze({context, outcome: 'landed', hit, critical, b0, b1, mitigation, finalDamage: mitigation.finalDamage});
}

/** One caller-selected life resource/bounds policy for both canonical operations. */
export interface CombatDamageApplicationPolicy extends EntityLifeResourcePolicy {
  readonly currentAboveMaximum: EntityResourceTransitionInput['rule']['currentAboveMaximum'];
}

export type CombatDamageApplicationOutcome = 'dodged' | 'zero_damage' | 'processed';

export type CombatDamageApplicationResult = {
  readonly context: CombatActionContext;
  readonly outcome: 'dodged' | 'zero_damage';
  readonly calculatedDamage: 0;
  readonly appliedDamage: 0;
  readonly resourceResult: null;
  readonly lifeResult: null;
} | {
  readonly context: CombatActionContext;
  readonly outcome: 'processed';
  readonly calculatedDamage: number;
  readonly appliedDamage: number;
  readonly resourceResult: EntityResourceTransitionResult;
  readonly lifeResult: EntityLifeTransitionResult;
};

function numericDiagnostics(input: unknown, numbers: readonly string[], other: readonly string[] = []) {
  const data = dataFields(input, [...numbers, ...other]);
  for (const key of numbers) finite(data[key]);
  return data;
}

function receiptRoll(input: unknown): number | null {
  if (input === null) return null;
  const value = finite(input);
  if (value < 0 || value >= 1) throw new TypeError('Invalid attack receipt roll');
  return value;
}

// Validate the published CB20 schema and redundant stage links, never recalculate
// numerical formulas. Structural consistency does not authenticate a receipt.
function damageReceipt(input: CombatAttackResolutionResult) {
  const header = dataFields(input, ['context', 'outcome', 'hit', 'finalDamage'],
    ['critical', 'b0', 'b1', 'mitigation']);
  const context = createCombatActionContext(header.context as CombatActionContext);
  const damage = finite(header.finalDamage);
  if (damage < 0) throw new TypeError('Negative attack damage');
  const hit = numericDiagnostics(header.hit, ['chance'], ['hit', 'dodged', 'onHitSuccess', 'eligible', 'enabled', 'roll']);
  const landed = flag(hit.hit), dodged = flag(hit.dodged);
  const eligible = flag(hit.eligible), enabled = flag(hit.enabled), roll = receiptRoll(hit.roll);
  if (landed === dodged || flag(hit.onHitSuccess) !== landed
    || ((!eligible || !enabled) && hit.chance !== 0)
    || ((finite(hit.chance) > 0) !== (roll !== null)) || (dodged && roll === null)) {
    throw new TypeError('Inconsistent hit receipt');
  }
  if (header.outcome === 'dodged') {
    dataFields(input, ['context', 'outcome', 'hit', 'finalDamage']);
    if (!dodged || damage !== 0) throw new TypeError('Inconsistent dodge receipt');
    return {context, outcome: 'dodged' as const, damage};
  }
  if (header.outcome !== 'landed' || !landed) throw new TypeError('Invalid landed receipt');
  const complete = dataFields(input, ['context', 'outcome', 'hit', 'finalDamage', 'critical', 'b0', 'b1', 'mitigation']);
  const critical = numericDiagnostics(complete.critical, ['chance', 'bonus', 'multiplier'], ['roll', 'isCritical']);
  const criticalRoll = receiptRoll(critical.roll), isCritical = flag(critical.isCritical);
  if ((isCritical && criticalRoll === null) || (criticalRoll === null && critical.chance !== 0)
    || finite(critical.bonus) < 0 || finite(critical.multiplier) < 1
    || (!isCritical && (critical.bonus !== 0 || critical.multiplier !== 1))) {
    throw new TypeError('Inconsistent critical receipt');
  }
  const b0 = numericDiagnostics(complete.b0, ['base', 'flat', 'raw'], ['scaling']);
  const sources = attackArray(b0.scaling).map(value => {
    const term = numericDiagnostics(value, ['value'], ['source']);
    return identifier(term.source);
  });
  if (new Set(sources).size !== sources.length) throw new TypeError('Duplicate receipt scaling source');
  const b1 = numericDiagnostics(complete.b1, ['criticalBonus', 'totalBonus', 'beforeDefense']);
  const mitigation = numericDiagnostics(complete.mitigation,
    ['rawReduction', 'reduction', 'inputDamage', 'preventedDamage', 'finalDamage'],
    ['ruleKey', 'status', 'missing', 'levelGap', 'levelScalingEnabled', 'effectiveK']);
  identifier(mitigation.ruleKey); flag(mitigation.levelScalingEnabled);
  const missing = attackArray(mitigation.missing).map(value => {
    if (!['baseK', 'levelPenalty', 'source/target level'].includes(value as string)) {
      throw new TypeError('Invalid mitigation missing diagnostic');
    }
    return value;
  });
  if (new Set(missing).size !== missing.length
    || (mitigation.status !== 'applied' && mitigation.status !== 'disabled')
    || (mitigation.status === 'applied' && missing.length !== 0)
    || (mitigation.levelGap !== null && finite(mitigation.levelGap) < 0)
    || (mitigation.effectiveK !== null && finite(mitigation.effectiveK) <= 0)
    || ((missing.length > 0) !== (mitigation.effectiveK === null))
    || (mitigation.status === 'disabled' && (mitigation.reduction !== 0 || mitigation.preventedDamage !== 0))
    || b1.criticalBonus !== critical.bonus || finite(b1.beforeDefense) < 0
    || mitigation.inputDamage !== b1.beforeDefense || mitigation.finalDamage !== damage) {
    throw new TypeError('Inconsistent damage diagnostics');
  }
  return {context, outcome: 'landed' as const, damage};
}

/** Immutable orchestration only; Entity owns resource arithmetic and defeat. */
export function applyCombatAttackDamage(
  attack: CombatAttackResolutionResult,
  resources: EntityResourceState,
  life: EntityLifeState,
  policy: CombatDamageApplicationPolicy,
): CombatDamageApplicationResult {
  const receipt = damageReceipt(attack);
  const targetId = receipt.context.target.entityId;
  readLife(life, targetId);
  if (![Object.prototype, null].includes(Object.getPrototypeOf(life))) {
    throw new TypeError('Expected canonical own-data Life state');
  }
  const config = dataFields(policy, ['resourceId', 'minimum', 'maximum', 'currentAboveMaximum']);
  const resourceId = identifier(config.resourceId), minimum = finite(config.minimum), maximum = finite(config.maximum);
  const currentAboveMaximum = config.currentAboveMaximum;
  if (minimum > maximum || (currentAboveMaximum !== 'allow' && currentAboveMaximum !== 'reject')) {
    throw new TypeError('Invalid damage application policy');
  }
  // Public Entity read validates the complete resource snapshot, including all
  // unrelated entries, without normalization or a fabricated transition.
  const current = getEntityResourceCurrent(resources, resourceId);
  const resourceData = dataFields(resources, ['entityId', 'current']);
  if (resourceData.entityId !== targetId || current === undefined || current < minimum) {
    throw new TypeError('Invalid target resource identity/current');
  }
  const context = receipt.context;
  if (receipt.outcome === 'dodged' || receipt.damage === 0) {
    return Object.freeze({context, outcome: receipt.outcome === 'dodged' ? 'dodged' : 'zero_damage',
      calculatedDamage: 0, appliedDamage: 0, resourceResult: null, lifeResult: null});
  }
  const resourceResult = transitionEntityResource(resources, resourceId, {
    maximum, amount: receipt.damage, operation: 'decrease',
    rule: {minimum, currentAboveMaximum, allowIncreaseFromMinimum: false},
  });
  const lifeResult = resolveEntityDefeat(life, resourceResult.state, {resourceId, minimum, maximum});
  return Object.freeze({context, outcome: 'processed', calculatedDamage: receipt.damage,
    appliedDamage: resourceResult.transition.applied, resourceResult, lifeResult});
}
