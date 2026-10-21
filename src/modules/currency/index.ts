/** Opaque currency identity; content lookup belongs to L3/L4. */
export interface CurrencyReference {
  readonly currencyId: string;
}
export interface CurrencyWalletOwner {
  readonly ownerKind: string;
  readonly ownerId: string;
}
/** Safe integer units, including explicit zero entries. */
export interface CurrencyBalance {
  readonly currencyId: string;
  readonly amount: number;
}
export interface CurrencyWalletState {
  readonly walletId: string;
  readonly owner: CurrencyWalletOwner | null;
  readonly balances: readonly CurrencyBalance[];
}

// Capture descriptors without invoking getters, including array indices.
function dataEntries(input: unknown, array = false): [string, unknown][] {
  if (typeof input !== 'object' || input === null || Array.isArray(input) !== array) {
    throw new TypeError('Expected Currency data record or dense array');
  }
  const prototype = Object.getPrototypeOf(input);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Currency data must have a plain prototype');
  }
  return Reflect.ownKeys(input).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) {
      throw new TypeError('Currency fields must be own string data properties');
    }
    return [key, descriptor.value as unknown];
  });
}
function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const entries = dataEntries(input);
  if (entries.length !== keys.length || entries.some(([key]) => !keys.includes(key))) {
    throw new TypeError('Missing or unknown Currency fields');
  }
  return Object.fromEntries(entries);
}
function values(input: unknown): unknown[] {
  const entries = dataEntries(input, true), captured = new Map(entries);
  const length = captured.get('length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || entries.length !== length + 1) {
    throw new TypeError('Currency arrays must be dense with no extra fields');
  }
  return Array.from({length}, (_, index) => {
    if (!captured.has(String(index))) throw new TypeError('Currency array index missing');
    return captured.get(String(index));
  });
}
function id(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected nonblank Currency ID');
  return input;
}

/** Capture a complete wallet snapshot; no catalog, operation, IO or commit. */
export function validateCurrencyWalletState(state: CurrencyWalletState): CurrencyWalletState {
  try {
    const record = fields(state, ['walletId', 'owner', 'balances']);
    const walletId = id(record.walletId);
    const ownerInput = record.owner === null ? null : fields(record.owner, ['ownerKind', 'ownerId']);
    const owner = ownerInput === null ? null : Object.freeze({ownerKind: id(ownerInput.ownerKind), ownerId: id(ownerInput.ownerId)});
    const ids = new Set<string>();
    const balances = values(record.balances).map(value => {
      const balance = fields(value, ['currencyId', 'amount']);
      const currencyId = id(balance.currencyId), amount = balance.amount;
      if (ids.has(currencyId)) throw new TypeError('Duplicate Currency ID');
      ids.add(currencyId);
      if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) {
        throw new TypeError('Currency amount must be a nonnegative safe integer');
      }
      return Object.freeze({currencyId, amount});
    });
    return Object.freeze({walletId, owner, balances: Object.freeze(balances)});
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Currency data could not be inspected safely');
  }
}
export function createCurrencyWalletState(input: CurrencyWalletState): CurrencyWalletState {
  return validateCurrencyWalletState(input);
}
