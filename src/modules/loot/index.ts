export interface LootTableEntry {
  readonly entryId: string;
  readonly definitionId: string;
  readonly weight: number;
  readonly quantity: number;
}
export interface LootTableDefinition {
  readonly tableId: string;
  readonly entries: readonly LootTableEntry[];
  readonly noDropWeight: number;
}
export interface LootDropIntent {
  readonly entryId: string;
  readonly definitionId: string;
  readonly quantity: number;
}
export interface LootRollResult {
  readonly tableId: string;
  readonly drops: readonly LootDropIntent[];
}

// Inspect descriptors rather than reading caller properties (including array indices).
function dataEntries(input: unknown, array = false): [string, unknown][] {
  if (typeof input !== 'object' || input === null || Array.isArray(input) !== array) {
    throw new TypeError('Expected Loot data record or dense array');
  }
  const prototype = Object.getPrototypeOf(input);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Loot data must have a plain prototype');
  }
  return Reflect.ownKeys(input).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) {
      throw new TypeError('Loot requires own string data properties');
    }
    return [key, descriptor.value as unknown];
  });
}
function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const entries = dataEntries(input);
  if (entries.length !== keys.length || entries.some(([key]) => !keys.includes(key))) {
    throw new TypeError('Missing or unknown Loot fields');
  }
  return Object.fromEntries(entries);
}
function values(input: unknown): unknown[] {
  const entries = dataEntries(input, true), captured = new Map(entries);
  const length = captured.get('length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || entries.length !== length + 1) {
    throw new TypeError('Loot arrays must be dense with no extra fields');
  }
  return Array.from({length}, (_, index) => {
    if (!captured.has(String(index))) throw new TypeError('Loot array index missing');
    return captured.get(String(index));
  });
}
function id(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected nonblank Loot ID');
  return input;
}
function integer(input: unknown, minimum: number): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < minimum) {
    throw new TypeError('Loot weight or quantity outside safe integer bounds');
  }
  return input;
}
function inspect<T>(action: () => T): T {
  try { return action(); }
  catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Loot data could not be inspected safely');
  }
}

/** Capture a table definition; opaque Item references require no catalog lookup. */
export function validateLootTableDefinition(input: LootTableDefinition): LootTableDefinition {
  return inspect(() => {
    const table = fields(input, ['tableId', 'entries', 'noDropWeight']);
    const tableId = id(table.tableId), noDropWeight = integer(table.noDropWeight, 0);
    const ids = new Set<string>();
    let total = noDropWeight;
    const entries = values(table.entries).map(value => {
      const entry = fields(value, ['entryId', 'definitionId', 'weight', 'quantity']);
      const entryId = id(entry.entryId), definitionId = id(entry.definitionId);
      if (ids.has(entryId)) throw new TypeError('Duplicate Loot entryId');
      ids.add(entryId);
      const weight = integer(entry.weight, 1), quantity = integer(entry.quantity, 1);
      total += weight;
      if (!Number.isSafeInteger(total)) throw new TypeError('Loot total weight overflow');
      return Object.freeze({entryId, definitionId, weight, quantity});
    });
    if (total <= 0) throw new TypeError('Loot total weight must be positive');
    return Object.freeze({tableId, entries: Object.freeze(entries), noDropWeight});
  });
}

export function createLootTableDefinition(input: LootTableDefinition): LootTableDefinition {
  return validateLootTableDefinition(input);
}

/** Structural intent only; no selection, live-table binding, Item creation or delivery. */
export function validateLootRollResult(result: LootRollResult): LootRollResult {
  return inspect(() => {
    const input = fields(result, ['tableId', 'drops']);
    const tableId = id(input.tableId);
    const drops = values(input.drops).map(value => {
      const drop = fields(value, ['entryId', 'definitionId', 'quantity']);
      return Object.freeze({entryId: id(drop.entryId), definitionId: id(drop.definitionId), quantity: integer(drop.quantity, 1)});
    });
    return Object.freeze({tableId, drops: Object.freeze(drops)});
  });
}

/** Select one ordered bucket from a caller-supplied sample; never generates randomness. */
export function rollLootTable(table: LootTableDefinition, sample: number): LootRollResult {
  const snapshot = validateLootTableDefinition(table);
  if (typeof sample !== 'number' || !Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new TypeError('Loot sample must be a finite number in [0,1)');
  }
  const total = snapshot.entries.reduce((sum, entry) => sum + entry.weight, snapshot.noDropWeight);
  const ticket = Math.min(total - 1, Math.floor(sample * total));
  let end = snapshot.noDropWeight;
  if (ticket < end) return validateLootRollResult({tableId: snapshot.tableId, drops: []});
  for (const entry of snapshot.entries) {
    end += entry.weight;
    if (ticket < end) {
      return validateLootRollResult({tableId: snapshot.tableId, drops: [
        {entryId: entry.entryId, definitionId: entry.definitionId, quantity: entry.quantity},
      ]});
    }
  }
  // Validated positive safe total and clamped ticket make this unreachable.
  throw new TypeError('Loot ticket outside validated buckets');
}
