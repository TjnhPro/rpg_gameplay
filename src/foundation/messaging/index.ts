import {validateModuleDefinition, type ModuleComposition} from '../modules/index.js';

export interface GameplayCommand {
  readonly type: string;
  /** Caller-owned business data; Foundation neither validates nor freezes it. */
  readonly payload: unknown;
}

export type CommandOutcome =
  | {readonly status: 'success'; readonly value?: unknown}
  | {readonly status: 'rejected'; readonly reason: string};

export interface CommandHandlerRegistration {
  readonly moduleId: string;
  readonly commandType: string;
  readonly handler: (command: GameplayCommand) => CommandOutcome;
}

export interface CommandFailure {
  readonly commandType: string;
  readonly moduleId: string;
  readonly message: string;
}

export type CommandResult =
  | {readonly status: 'success'; readonly commandType: string; readonly moduleId: string; readonly value?: unknown}
  | {readonly status: 'rejected'; readonly commandType: string; readonly moduleId: string; readonly reason: string}
  | {readonly status: 'unhandled'; readonly commandType: string}
  | {readonly status: 'failed'; readonly failure: CommandFailure};

export interface GameplayEvent {
  readonly type: string;
  /** Caller-owned business data, passed by reference to listeners. */
  readonly payload: unknown;
}

const messagingIdentity: unique symbol = Symbol('GameplayMessaging');
const subscriptionIdentity: unique symbol = Symbol('EventSubscription');

/** Opaque opt-in coordination capability, independent of Runtime lifecycle. */
export interface GameplayMessaging { readonly [messagingIdentity]: true; }
export interface EventSubscription { readonly [subscriptionIdentity]: true; }

export interface EventSubscriptionRegistration {
  readonly moduleId: string;
  readonly eventType: string;
  /** Must return undefined synchronously. */
  readonly handler: (event: GameplayEvent) => void;
}

export interface EventFailure {
  readonly eventType: string;
  readonly moduleId: string;
  readonly subscription: EventSubscription;
  readonly message: string;
}

export type EventPublishResult =
  | {readonly ok: true; readonly eventType: string; readonly completedDeliveries: number}
  | {readonly ok: false; readonly eventType: string; readonly completedDeliveries: number; readonly failure: EventFailure};

interface MessagingData {
  readonly selected: ReadonlySet<string>;
  readonly commands: Map<string, CommandHandlerRegistration>;
  readonly subscriptions: Map<EventSubscription, EventSubscriptionRegistration>;
  readonly issued: WeakSet<EventSubscription>;
  executing: boolean;
}

// Weak identity association only. Each context owns its own tables; nothing is
// stored on public capabilities, including non-enumerable/symbol properties.
const messagingRecords = new WeakMap<GameplayMessaging, MessagingData>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireIdentity(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)) {
    throw new TypeError('Message type must be lowercase kebab-case, starting with a letter');
  }
}

function readMessaging(messaging: GameplayMessaging): MessagingData {
  const data = messagingRecords.get(messaging);
  if (!data) throw new TypeError('Expected a context created by createGameplayMessaging');
  return data;
}

function requireOwner(data: MessagingData, moduleId: unknown): asserts moduleId is string {
  if (typeof moduleId !== 'string' || !data.selected.has(moduleId)) {
    throw new TypeError('Messaging owner must be a selected module');
  }
}

/** Validate supplied composition order; never select modules or resolve a graph. */
export function createGameplayMessaging(composition: ModuleComposition): GameplayMessaging {
  if (!isRecord(composition) || !Array.isArray(composition.moduleIds) || !Array.isArray(composition.definitions)) {
    throw new TypeError('Composition must contain moduleIds and definitions arrays');
  }
  const ids = [...composition.moduleIds];
  const definitions = composition.definitions.map(validateModuleDefinition);
  if (ids.length !== definitions.length) throw new TypeError('Composition IDs/definitions length mismatch');
  const selected = new Set<string>();
  for (const [index, definition] of definitions.entries()) {
    if (ids[index] !== definition.id || selected.has(definition.id) || !definition.dependencies.every(id => selected.has(id))) {
      throw new TypeError('Composition must contain unique aligned definitions in dependency-first order');
    }
    selected.add(definition.id);
  }
  const messaging: GameplayMessaging = Object.freeze({[messagingIdentity]: true as const});
  messagingRecords.set(messaging, {selected, commands: new Map(), subscriptions: new Map(), issued: new WeakSet(), executing: false});
  return messaging;
}

/** Invalid/duplicate registration throws without overwriting an existing handler. */
export function registerCommandHandler(messaging: GameplayMessaging, registration: CommandHandlerRegistration): void {
  const data = readMessaging(messaging);
  if (!isRecord(registration)) throw new TypeError('Command registration must be an object');
  const {moduleId, commandType, handler} = registration;
  requireOwner(data, moduleId);
  requireIdentity(commandType);
  if (typeof handler !== 'function') throw new TypeError('Command handler must be callable');
  if (data.commands.has(commandType)) throw new TypeError(`Command '${commandType}' already has a handler`);
  data.commands.set(commandType, Object.freeze({moduleId, commandType, handler}));
}

function beginExecution(data: MessagingData): void {
  if (data.executing) throw new TypeError('Reentrant dispatch/publish on the same messaging context is unsupported');
  data.executing = true;
}

function snapshotMessage(value: unknown): GameplayCommand {
  if (!isRecord(value) || !Object.hasOwn(value, 'payload')) throw new TypeError('Message must contain type and payload');
  const {type, payload} = value;
  requireIdentity(type);
  return Object.freeze({type, payload});
}

function requireSynchronous(value: unknown): void {
  // Observe native rejection without awaiting it. Never execute arbitrary thenables.
  if (value instanceof Promise) {
    void Promise.prototype.then.call(value, undefined, () => undefined);
    throw new TypeError('Async messaging callbacks are unsupported (Promise/thenable returned)');
  }
  if (value !== null && (typeof value === 'object' || typeof value === 'function') && typeof (value as {then?: unknown}).then === 'function') {
    throw new TypeError('Async messaging callbacks are unsupported (Promise/thenable returned)');
  }
}

function failureMessage(error: unknown): string {
  try { return String(error instanceof Error ? error.message : error); }
  catch { return 'Messaging callback threw an unprintable value'; }
}

/** Malformed input/reentrancy throws; callback problems become structured failures. */
export function dispatchCommand(messaging: GameplayMessaging, command: GameplayCommand): CommandResult {
  const data = readMessaging(messaging);
  beginExecution(data);
  try {
    const message = snapshotMessage(command);
    const registration = data.commands.get(message.type);
    if (!registration) return Object.freeze({status: 'unhandled', commandType: message.type});
    const {moduleId, commandType, handler} = registration;
    try {
      const outcome: unknown = handler(message);
      requireSynchronous(outcome);
      if (!isRecord(outcome)) throw new TypeError('Command handler must return an explicit success or rejection');
      const status = outcome.status;
      if (status === 'success') {
        const value = Object.hasOwn(outcome, 'value') ? {value: outcome.value} : {};
        return Object.freeze({status, commandType, moduleId, ...value});
      }
      const reason = outcome.reason;
      if (status === 'rejected' && typeof reason === 'string' && reason.trim().length > 0) {
        return Object.freeze({status, commandType, moduleId, reason});
      }
      throw new TypeError('Command handler must return an explicit success or nonempty rejection reason');
    } catch (error) {
      return Object.freeze({status: 'failed', failure: Object.freeze({commandType, moduleId, message: failureMessage(error)})});
    }
  } finally {
    data.executing = false;
  }
}

export function subscribeEvent(messaging: GameplayMessaging, registration: EventSubscriptionRegistration): EventSubscription {
  const data = readMessaging(messaging);
  if (!isRecord(registration)) throw new TypeError('Event subscription must be an object');
  const {moduleId, eventType, handler} = registration;
  requireOwner(data, moduleId);
  requireIdentity(eventType);
  if (typeof handler !== 'function') throw new TypeError('Event listener must be callable');
  const subscription: EventSubscription = Object.freeze({[subscriptionIdentity]: true as const});
  data.issued.add(subscription);
  data.subscriptions.set(subscription, Object.freeze({moduleId, eventType, handler}));
  return subscription;
}

/** False for an already removed token; invalid/foreign tokens throw TypeError. */
export function unsubscribeEvent(messaging: GameplayMessaging, subscription: EventSubscription): boolean {
  const data = readMessaging(messaging);
  if (!data.issued.has(subscription)) throw new TypeError('Subscription does not belong to this messaging context');
  return data.subscriptions.delete(subscription);
}

/** Explicit owner cleanup, suitable for caller-wired stop/dispose hooks. */
export function unsubscribeModuleEvents(messaging: GameplayMessaging, moduleId: string): number {
  const data = readMessaging(messaging);
  requireOwner(data, moduleId);
  let removed = 0;
  for (const [subscription, registration] of data.subscriptions) {
    if (registration.moduleId === moduleId) {
      data.subscriptions.delete(subscription);
      removed++;
    }
  }
  return removed;
}

/** Registration-order snapshot fan-out, fail-fast; mutations affect next publish. */
export function publishEvent(messaging: GameplayMessaging, event: GameplayEvent): EventPublishResult {
  const data = readMessaging(messaging);
  beginExecution(data);
  try {
    const message = snapshotMessage(event);
    const listeners = [...data.subscriptions].filter(([, registration]) => registration.eventType === message.type);
    let completedDeliveries = 0;
    for (const [subscription, {moduleId, handler}] of listeners) {
      try {
        const returned: unknown = handler(message);
        requireSynchronous(returned);
        if (returned !== undefined) throw new TypeError('Event listener must return undefined');
      } catch (error) {
        const failure = Object.freeze({eventType: message.type, moduleId, subscription, message: failureMessage(error)});
        return Object.freeze({ok: false, eventType: message.type, completedDeliveries, failure});
      }
      completedDeliveries++;
    }
    return Object.freeze({ok: true, eventType: message.type, completedDeliveries});
  } finally {
    data.executing = false;
  }
}
