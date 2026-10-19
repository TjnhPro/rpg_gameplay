import {validateModuleDefinition, type ModuleComposition} from '../modules/index.js';

export type LifecycleStage = 'initialize' | 'start' | 'stop' | 'dispose';
export type RuntimeStatus = 'created' | 'initialized' | 'running' | 'stopped' | 'disposed' | 'failed';

export interface LifecycleFailure {
  readonly moduleId: string;
  readonly stage: LifecycleStage;
  readonly message: string;
}

export interface ModuleLifecycleSnapshot {
  readonly id: string;
  readonly status: RuntimeStatus;
  readonly completedStages: readonly LifecycleStage[];
  readonly failure?: LifecycleFailure;
}

export interface GameplayRuntimeSnapshot {
  readonly status: RuntimeStatus;
  /** Selected IDs in resolved dependency order. */
  readonly moduleIds: readonly string[];
  readonly modules: readonly ModuleLifecycleSnapshot[];
  /** Latest failure; retained after successful explicit cleanup. */
  readonly failure?: LifecycleFailure;
}

export interface LifecycleContext {
  readonly moduleId: string;
  readonly stage: LifecycleStage;
  /** Progress immediately before this hook, without executable bindings. */
  readonly runtime: GameplayRuntimeSnapshot;
}

/** Hooks must return undefined synchronously. No implicit services are supplied. */
export type ModuleLifecycleBindings = Readonly<Partial<Record<LifecycleStage, (context: LifecycleContext) => void>>>;
export type LifecycleBindings = Readonly<Record<string, ModuleLifecycleBindings>>;

const runtimeIdentity: unique symbol = Symbol('GameplayRuntime');
const runtimeData = Symbol('RuntimeData');

/** Opaque execution capability; obtain immutable data through inspection. */
export interface GameplayRuntime {
  readonly [runtimeIdentity]: true;
}

export type LifecycleTransitionResult =
  | {readonly ok: true; readonly runtime: GameplayRuntime}
  | {readonly ok: false; readonly runtime: GameplayRuntime; readonly failure: LifecycleFailure};

interface RuntimeData {
  readonly composition: ModuleComposition;
  readonly bindings: LifecycleBindings;
  readonly snapshot: GameplayRuntimeSnapshot;
  readonly owns: (value: unknown) => boolean;
  readonly claim: () => void;
}

const stages: readonly LifecycleStage[] = Object.freeze(['initialize', 'start', 'stop', 'dispose']);
const targetStatus: Readonly<Record<LifecycleStage, RuntimeStatus>> = Object.freeze({
  initialize: 'initialized', start: 'running', stop: 'stopped', dispose: 'disposed',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotComposition(value: unknown): ModuleComposition {
  if (!isRecord(value) || !Array.isArray(value.moduleIds) || !Array.isArray(value.definitions)) {
    throw new TypeError('Composition must contain moduleIds and definitions arrays');
  }
  const ids = [...value.moduleIds];
  const definitions = value.definitions.map(validateModuleDefinition);
  if (ids.length !== definitions.length) throw new TypeError('Composition IDs/definitions length mismatch');
  const preceding = new Set<string>();
  for (const [index, definition] of definitions.entries()) {
    if (ids[index] !== definition.id || preceding.has(definition.id)) {
      throw new TypeError('Composition IDs must match unique ordered definitions');
    }
    // Validate the supplied order, never compute a new one or resolve a graph.
    for (const dependency of definition.dependencies) {
      if (!preceding.has(dependency)) {
        throw new TypeError(`Composition module '${definition.id}' requires preceding dependency '${dependency}'`);
      }
    }
    preceding.add(definition.id);
  }
  return Object.freeze({moduleIds: Object.freeze(ids as string[]), definitions: Object.freeze(definitions)});
}

function snapshotBindings(value: unknown, ids: readonly string[]): LifecycleBindings {
  if (!isRecord(value)) throw new TypeError('Lifecycle bindings must be an object');
  const entries: [string, ModuleLifecycleBindings][] = [];
  for (const id of Reflect.ownKeys(value)) {
    if (typeof id !== 'string' || !ids.includes(id)) throw new TypeError(`Lifecycle binding ID '${String(id)}' is not selected`);
    const input = value[id];
    if (!isRecord(input)) throw new TypeError(`Lifecycle binding '${id}' must be an object`);
    const hooks: Partial<Record<LifecycleStage, (context: LifecycleContext) => void>> = {};
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== 'string' || !stages.includes(key as LifecycleStage)) {
        throw new TypeError(`Unknown lifecycle stage '${String(key)}' for '${id}'`);
      }
      const hook = input[key];
      if (hook !== undefined && typeof hook !== 'function') throw new TypeError(`Lifecycle hook '${id}.${key}' must be a function`);
      if (hook !== undefined) hooks[key as LifecycleStage] = hook as (context: LifecycleContext) => void;
    }
    entries.push([id, Object.freeze(hooks)]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function makeSnapshot(status: RuntimeStatus, moduleIds: readonly string[], modules: readonly ModuleLifecycleSnapshot[], failure?: LifecycleFailure): GameplayRuntimeSnapshot {
  return Object.freeze({status, moduleIds, modules: Object.freeze([...modules]), ...(failure === undefined ? {} : {failure})});
}

function makeRuntime(composition: ModuleComposition, bindings: LifecycleBindings, snapshot: GameplayRuntimeSnapshot): GameplayRuntime {
  // Per-snapshot execution guard, not a global runtime registry. Inspection stays
  // immutable even after this capability advances. Claim before entering user code.
  let advanced = false;
  const runtime: GameplayRuntime = {
    [runtimeIdentity]: true,
    ...{[runtimeData]: Object.freeze({composition, bindings, snapshot,
      owns: (value: unknown) => value === runtime,
      claim: () => {
        if (advanced) throw new TypeError('Runtime snapshot already advanced or transition in progress');
        advanced = true;
      },
    } satisfies RuntimeData)},
  };
  return Object.freeze(runtime);
}

function readRuntime(runtime: GameplayRuntime): RuntimeData {
  const data = (runtime as unknown as Record<symbol, RuntimeData> | null)?.[runtimeData];
  if (!data || !data.owns(runtime)) throw new TypeError('Expected a runtime created by createGameplayRuntime');
  return data;
}

export function createGameplayRuntime(composition: ModuleComposition, lifecycleBindings: LifecycleBindings = {}): GameplayRuntime {
  const safeComposition = snapshotComposition(composition);
  const bindings = snapshotBindings(lifecycleBindings, safeComposition.moduleIds);
  const modules = safeComposition.moduleIds.map(id => Object.freeze({id, status: 'created' as const, completedStages: Object.freeze([])}));
  return makeRuntime(safeComposition, bindings, makeSnapshot('created', safeComposition.moduleIds, modules));
}

/** Frozen lifecycle data only; never invokes hooks or consumes a runtime. */
export function inspectGameplayRuntime(runtime: GameplayRuntime): GameplayRuntimeSnapshot {
  return readRuntime(runtime).snapshot;
}

function failureMessage(error: unknown): string {
  try { return String(error instanceof Error ? error.message : error); }
  catch { return 'Lifecycle hook threw an unprintable value'; }
}

function transition(runtime: GameplayRuntime, stage: LifecycleStage): LifecycleTransitionResult {
  const data = readRuntime(runtime);
  const before = data.snapshot;
  const allowed = stage === 'dispose'
    ? ['created', 'initialized', 'stopped', 'failed'].includes(before.status)
    : before.status === ({initialize: 'created', start: 'initialized', stop: 'running'} as const)[stage];
  if (!allowed) throw new TypeError(`Cannot ${stage} runtime in '${before.status}' state`);
  data.claim();
  const modules = [...before.modules];
  const indices = modules.map((_, index) => index);
  if (stage === 'stop' || stage === 'dispose') indices.reverse();
  for (const index of indices) {
    const module = modules[index]!;
    if (stage === 'dispose' && (!module.completedStages.includes('initialize') || module.completedStages.includes('dispose'))) continue;
    try {
      const hook = Object.hasOwn(data.bindings, module.id) ? data.bindings[module.id]?.[stage] : undefined;
      if (hook) {
        const context: LifecycleContext = Object.freeze({moduleId: module.id, stage,
          runtime: makeSnapshot(before.status, before.moduleIds, modules, before.failure)});
        const returned: unknown = hook(context);
        if (returned !== undefined) {
          const thenable = returned !== null && (typeof returned === 'object' || typeof returned === 'function') && typeof (returned as {then?: unknown}).then === 'function';
          // Observe a native rejected Promise to avoid an unhandled rejection;
          // this does not await, orchestrate or treat async work as successful.
          if (returned instanceof Promise) void Promise.prototype.then.call(returned, undefined, () => undefined);
          throw new TypeError(thenable ? 'Async lifecycle hooks are unsupported (Promise/thenable returned)' : 'Lifecycle hook must return undefined');
        }
      }
    } catch (error) {
      const failure = Object.freeze({moduleId: module.id, stage, message: failureMessage(error)});
      modules[index] = Object.freeze({...module, status: 'failed', failure});
      const failed = makeRuntime(data.composition, data.bindings, makeSnapshot('failed', before.moduleIds, modules, failure));
      return Object.freeze({ok: false, runtime: failed, failure});
    }
    modules[index] = Object.freeze({...module, status: targetStatus[stage], completedStages: Object.freeze([...module.completedStages, stage])});
  }
  return Object.freeze({ok: true, runtime: makeRuntime(data.composition, data.bindings,
    makeSnapshot(targetStatus[stage], before.moduleIds, modules, before.failure))});
}

export function initializeGameplayRuntime(runtime: GameplayRuntime): LifecycleTransitionResult { return transition(runtime, 'initialize'); }
export function startGameplayRuntime(runtime: GameplayRuntime): LifecycleTransitionResult { return transition(runtime, 'start'); }
export function stopGameplayRuntime(runtime: GameplayRuntime): LifecycleTransitionResult { return transition(runtime, 'stop'); }
export function disposeGameplayRuntime(runtime: GameplayRuntime): LifecycleTransitionResult { return transition(runtime, 'dispose'); }
