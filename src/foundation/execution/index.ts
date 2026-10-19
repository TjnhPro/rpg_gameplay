/** Caller-owned time in milliseconds relative to a caller-chosen origin. */
export interface GameplayClock { now(): number; }
export interface GameplayRandom { next(): number; }
export interface GameplayIdProvider { next(): string; }
export interface GameplayExecutionDependencies {
  readonly clock: GameplayClock;
  readonly random?: GameplayRandom;
  readonly ids?: GameplayIdProvider;
}

const executionIdentity: unique symbol = Symbol('GameplayExecutionContext');
/** Opaque capability; providers and their mutable state remain caller-owned. */
export interface GameplayExecutionContext { readonly [executionIdentity]: true; }

interface ExecutionData {
  readonly now: () => unknown;
  readonly random?: () => unknown;
  readonly id?: () => unknown;
}
// Identity associations only; no enumerable registry, gameplay state or counters.
const executionRecords = new WeakMap<GameplayExecutionContext, ExecutionData>();

function capture(provider: unknown, method: 'now' | 'next'): () => unknown {
  if (typeof provider !== 'object' || provider === null || Array.isArray(provider)) {
    throw new TypeError(`Execution provider '${method}' must be an object`);
  }
  const callback: unknown = (provider as Record<string, unknown>)[method];
  if (typeof callback !== 'function') throw new TypeError(`Execution provider '${method}' must be a function`);
  return () => Reflect.apply(callback, provider, []);
}

/** Captures methods and receivers without calling, cloning or freezing providers. */
export function createExecutionContext(dependencies: GameplayExecutionDependencies): GameplayExecutionContext {
  if (typeof dependencies !== 'object' || dependencies === null || Array.isArray(dependencies)) {
    throw new TypeError('Execution dependencies must be an object with a clock');
  }
  const {clock, random, ids} = dependencies;
  const data: ExecutionData = Object.freeze({now: capture(clock, 'now'),
    ...(random === undefined ? {} : {random: capture(random, 'next')}),
    ...(ids === undefined ? {} : {id: capture(ids, 'next')}),
  });
  const context: GameplayExecutionContext = Object.freeze({[executionIdentity]: true as const});
  executionRecords.set(context, data);
  return context;
}

function readContext(context: GameplayExecutionContext): ExecutionData {
  const data = executionRecords.get(context);
  if (!data) throw new TypeError('Expected a context created by createExecutionContext');
  return data;
}

/** Exactly one clock call; no caching, monotonicity policy or implicit advance. */
export function readExecutionTime(context: GameplayExecutionContext): number {
  const value = readContext(context).now();
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError('Execution time must be a finite nonnegative number of milliseconds');
  }
  return value;
}

/** Exactly one RNG call when supplied; no default generator, retry or restoration. */
export function nextExecutionRandom(context: GameplayExecutionContext): number {
  const provider = readContext(context).random;
  if (!provider) throw new TypeError('Execution random provider is missing');
  const value = provider();
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) {
    throw new TypeError('Execution random sample must be finite and in [0, 1)');
  }
  return value;
}

/** Nonblank string unchanged; uniqueness and format belong to the caller. */
export function nextExecutionId(context: GameplayExecutionContext): string {
  const provider = readContext(context).id;
  if (!provider) throw new TypeError('Execution ID provider is missing');
  const value = provider();
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError('Execution ID must be a nonblank string');
  }
  return value;
}
