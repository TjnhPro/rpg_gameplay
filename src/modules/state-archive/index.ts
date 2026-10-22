/** JSON-compatible own data; finite numbers excluding negative zero. */
export type PortableValue = null | string | number | boolean |
  readonly PortableValue[] | {readonly [key: string]: PortableValue};
export interface GameplayStateRecord {
  readonly moduleId: string;
  readonly stateKind: string;
  readonly stateId: string;
  readonly schemaVersion: number;
  readonly payload: PortableValue;
}
export interface GameplayStateArchive {
  readonly formatVersion: number;
  readonly records: readonly GameplayStateRecord[];
}

function inspect<T>(action: () => T): T {
  try { return action(); }
  catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('State Archive data could not be inspected safely');
  }
}
// All data fields must be enumerable; hidden/symbol/accessor fields cannot survive JSON faithfully.
function entries(input: unknown, array = false): [string, unknown][] {
  if (typeof input !== 'object' || input === null || Array.isArray(input) !== array) {
    throw new TypeError('Expected State Archive plain data or dense array');
  }
  const prototype = Object.getPrototypeOf(input);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('State Archive data must have a plain prototype');
  }
  return Reflect.ownKeys(input).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor) ||
      (!descriptor.enumerable && !(array && key === 'length'))) {
      throw new TypeError('State Archive requires enumerable own string data properties');
    }
    return [key, descriptor.value as unknown];
  });
}
function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const captured = entries(input);
  if (captured.length !== keys.length || captured.some(([key]) => !keys.includes(key))) {
    throw new TypeError('Missing or unknown State Archive fields');
  }
  return Object.fromEntries(captured);
}
function arrayValues(input: unknown): unknown[] {
  const captured = entries(input, true), data = new Map(captured), length = data.get('length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || captured.length !== length + 1) {
    throw new TypeError('State Archive arrays must be dense without extra fields');
  }
  return Array.from({length}, (_, index) => {
    if (!data.has(String(index))) throw new TypeError('State Archive array index missing');
    return data.get(String(index));
  });
}
function portable(input: unknown, active: Set<object>): PortableValue {
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number' && Number.isFinite(input) && !Object.is(input, -0)) return input;
  if (typeof input !== 'object' || input === null) throw new TypeError('Non-portable State Archive value');
  if (active.has(input)) throw new TypeError('Cyclic State Archive payload');
  active.add(input);
  try {
    if (Array.isArray(input)) return Object.freeze(arrayValues(input).map(value => portable(value, active)));
    // fromEntries defines inert own keys, including __proto__, without prototype setters.
    return Object.freeze(Object.fromEntries(entries(input).map(([key, value]) => [key, portable(value, active)])));
  } finally { active.delete(input); }
}
function id(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected nonblank State Archive ID');
  return input;
}
function version(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input <= 0) {
    throw new TypeError('Expected positive safe integer State Archive version');
  }
  return input;
}

/** Structural capture only: IDs and schema labels are not interpreted by domain owners here. */
export function validateGameplayStateRecord(record: GameplayStateRecord): GameplayStateRecord {
  return inspect(() => {
    const data = fields(record, ['moduleId', 'stateKind', 'stateId', 'schemaVersion', 'payload']);
    return Object.freeze({moduleId: id(data.moduleId), stateKind: id(data.stateKind), stateId: id(data.stateId),
      schemaVersion: version(data.schemaVersion), payload: portable(data.payload, new Set())});
  });
}

/** Immutable ordered archive, unique by exact (moduleId,stateKind,stateId); no restore or commit. */
export function validateGameplayStateArchive(archive: GameplayStateArchive): GameplayStateArchive {
  return inspect(() => {
    const data = fields(archive, ['formatVersion', 'records']), formatVersion = version(data.formatVersion);
    const seen = new Map<string, Map<string, Set<string>>>();
    const records = arrayValues(data.records).map(value => {
      const record = validateGameplayStateRecord(value as GameplayStateRecord);
      const kinds = seen.get(record.moduleId) ?? new Map<string, Set<string>>();
      const ids = kinds.get(record.stateKind) ?? new Set<string>();
      if (ids.has(record.stateId)) throw new TypeError('Duplicate State Archive record identity');
      ids.add(record.stateId); kinds.set(record.stateKind, ids); seen.set(record.moduleId, kinds);
      return record;
    });
    return Object.freeze({formatVersion, records: Object.freeze(records)});
  });
}

export interface GameplayStateRecordKey {
  readonly moduleId: string;
  readonly stateKind: string;
  readonly stateId: string;
}

/** Capture the complete record list explicitly selected by the caller. */
export function assembleGameplayStateArchive(
  formatVersion: number, records: readonly GameplayStateRecord[],
): GameplayStateArchive {
  return validateGameplayStateArchive({formatVersion, records});
}

/** Validate the whole archive, then inspect its exact identity triple. */
export function getGameplayStateRecord(
  archive: GameplayStateArchive, key: GameplayStateRecordKey,
): GameplayStateRecord | null {
  return inspect(() => {
    const snapshot = validateGameplayStateArchive(archive);
    const data = fields(key, ['moduleId', 'stateKind', 'stateId']);
    const moduleId = id(data.moduleId), stateKind = id(data.stateKind), stateId = id(data.stateId);
    return snapshot.records.find(record => record.moduleId === moduleId &&
      record.stateKind === stateKind && record.stateId === stateId) ?? null;
  });
}

/** Preserve caller order in a detached, deeply frozen validated record list. */
export function listGameplayStateRecords(archive: GameplayStateArchive): readonly GameplayStateRecord[] {
  return validateGameplayStateArchive(archive).records;
}

export interface GameplayStateSchemaSupport {
  readonly moduleId: string;
  readonly stateKind: string;
  readonly supportedSchemaVersions: readonly number[];
}
export interface GameplayStateRestorePolicy {
  readonly supportedFormatVersions: readonly number[];
  readonly schemas: readonly GameplayStateSchemaSupport[];
  readonly requiredRecords: readonly GameplayStateRecordKey[];
}
export type GameplayStateRestorePreparation =
  | {readonly status: 'ready'; readonly reason: 'none'; readonly records: readonly GameplayStateRecord[]}
  | {readonly status: 'rejected';
     readonly reason: 'unsupported_format' | 'unknown_state_kind' | 'unsupported_schema' | 'missing_required';
     readonly records: null};

function versions(input: unknown): number[] {
  const result = arrayValues(input).map(version);
  if (!result.length || new Set(result).size !== result.length) {
    throw new TypeError('Expected nonempty unique supported versions');
  }
  return result;
}
function sameKind(left: GameplayStateRecordKey | GameplayStateSchemaSupport,
  right: GameplayStateRecordKey | GameplayStateSchemaSupport): boolean {
  return left.moduleId === right.moduleId && left.stateKind === right.stateKind;
}
function sameRecord(left: GameplayStateRecordKey, right: GameplayStateRecordKey): boolean {
  return sameKind(left, right) && left.stateId === right.stateId;
}
function restorePolicy(input: unknown): GameplayStateRestorePolicy {
  const data = fields(input, ['supportedFormatVersions', 'schemas', 'requiredRecords']);
  const supportedFormatVersions = versions(data.supportedFormatVersions);
  const schemas: GameplayStateSchemaSupport[] = [];
  for (const value of arrayValues(data.schemas)) {
    const support = fields(value, ['moduleId', 'stateKind', 'supportedSchemaVersions']);
    const schema = {moduleId: id(support.moduleId), stateKind: id(support.stateKind),
      supportedSchemaVersions: versions(support.supportedSchemaVersions)};
    if (schemas.some(other => sameKind(other, schema))) throw new TypeError('Duplicate supported state kind');
    schemas.push(schema);
  }
  const requiredRecords: GameplayStateRecordKey[] = [];
  for (const value of arrayValues(data.requiredRecords)) {
    const key = fields(value, ['moduleId', 'stateKind', 'stateId']);
    const required = {moduleId: id(key.moduleId), stateKind: id(key.stateKind), stateId: id(key.stateId)};
    if (!schemas.some(schema => sameKind(schema, required)) ||
      requiredRecords.some(other => sameRecord(other, required))) {
      throw new TypeError('Required records must be unique and reference a supported kind');
    }
    requiredRecords.push(required);
  }
  return {supportedFormatVersions, schemas, requiredRecords};
}
function rejectRestore(reason: Exclude<GameplayStateRestorePreparation['reason'], 'none'>): GameplayStateRestorePreparation {
  return Object.freeze({status: 'rejected', reason, records: null});
}

/** Metadata compatibility only; ready records still require owner validation and L4 authority. */
export function prepareGameplayStateRestore(
  archive: GameplayStateArchive, policy: GameplayStateRestorePolicy,
): GameplayStateRestorePreparation {
  return inspect(() => {
    const snapshot = validateGameplayStateArchive(archive), support = restorePolicy(policy);
    if (!support.supportedFormatVersions.includes(snapshot.formatVersion)) return rejectRestore('unsupported_format');
    // Separate passes preserve category priority even when a later record has an unknown kind.
    for (const record of snapshot.records) {
      if (!support.schemas.some(schema => sameKind(schema, record))) return rejectRestore('unknown_state_kind');
    }
    for (const record of snapshot.records) {
      const schema = support.schemas.find(candidate => sameKind(candidate, record))!;
      if (!schema.supportedSchemaVersions.includes(record.schemaVersion)) return rejectRestore('unsupported_schema');
    }
    for (const required of support.requiredRecords) {
      if (!snapshot.records.some(record => sameRecord(record, required))) return rejectRestore('missing_required');
    }
    return Object.freeze({status: 'ready', reason: 'none', records: snapshot.records});
  });
}
