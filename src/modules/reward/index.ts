export interface RewardLine {
  readonly lineId: string;
  readonly grantKindId: string;
  readonly referenceId: string;
  readonly amount: number;
}
export interface RewardPackage {
  readonly packageId: string;
  readonly lines: readonly RewardLine[];
}
export interface RewardSourceReference {
  readonly kind: string;
  readonly id: string;
}
export interface RewardRecipientReference {
  readonly kind: string;
  readonly id: string;
}
export interface RewardClaimState {
  readonly claimId: string;
  readonly source: RewardSourceReference;
  readonly recipient: RewardRecipientReference;
  readonly reward: RewardPackage;
  readonly status: 'available' | 'claimed';
}

// Capture descriptors, never invoke caller getters (including array indices).
function dataEntries(input: unknown, array = false): [string, unknown][] {
  if (typeof input !== 'object' || input === null || Array.isArray(input) !== array) {
    throw new TypeError('Expected Reward data record or dense array');
  }
  const prototype = Object.getPrototypeOf(input);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Reward data must have a plain prototype');
  }
  return Reflect.ownKeys(input).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) {
      throw new TypeError('Reward requires own string data properties');
    }
    return [key, descriptor.value as unknown];
  });
}
function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const entries = dataEntries(input);
  if (entries.length !== keys.length || entries.some(([key]) => !keys.includes(key))) {
    throw new TypeError('Missing or unknown Reward fields');
  }
  return Object.fromEntries(entries);
}
function values(input: unknown): unknown[] {
  const entries = dataEntries(input, true), captured = new Map(entries);
  const length = captured.get('length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || entries.length !== length + 1) {
    throw new TypeError('Reward arrays must be dense with no extra fields');
  }
  return Array.from({length}, (_, index) => {
    if (!captured.has(String(index))) throw new TypeError('Reward array index missing');
    return captured.get(String(index));
  });
}
function id(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected nonblank Reward ID');
  return input;
}
function reference(input: unknown): RewardSourceReference {
  const record = fields(input, ['kind', 'id']);
  return Object.freeze({kind: id(record.kind), id: id(record.id)});
}
function inspect<T>(action: () => T): T {
  try { return action(); }
  catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Reward data could not be inspected safely');
  }
}

/** Capture resolved content only; grant-kind consumer rules remain caller-owned. */
export function validateRewardPackage(input: RewardPackage): RewardPackage {
  return inspect(() => {
    const record = fields(input, ['packageId', 'lines']);
    const packageId = id(record.packageId), ids = new Set<string>();
    const lines = values(record.lines).map(value => {
      const line = fields(value, ['lineId', 'grantKindId', 'referenceId', 'amount']);
      const lineId = id(line.lineId), grantKindId = id(line.grantKindId), referenceId = id(line.referenceId);
      if (ids.has(lineId)) throw new TypeError('Duplicate Reward lineId');
      ids.add(lineId);
      const amount = line.amount;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw new TypeError('Reward amount must be finite and positive');
      }
      return Object.freeze({lineId, grantKindId, referenceId, amount});
    });
    return Object.freeze({packageId, lines: Object.freeze(lines)});
  });
}
export function createRewardPackage(input: RewardPackage): RewardPackage {
  return validateRewardPackage(input);
}

/** Structural claim snapshot; a claimed status is not evidence of delivery. */
export function validateRewardClaimState(input: RewardClaimState): RewardClaimState {
  return inspect(() => {
    const record = fields(input, ['claimId', 'source', 'recipient', 'reward', 'status']);
    const claimId = id(record.claimId), source = reference(record.source), recipient = reference(record.recipient);
    const reward = validateRewardPackage(record.reward as RewardPackage), status = record.status;
    if (status !== 'available' && status !== 'claimed') throw new TypeError('Unknown Reward claim status');
    return Object.freeze({claimId, source, recipient, reward, status});
  });
}
export function createRewardClaimState(input: RewardClaimState): RewardClaimState {
  return validateRewardClaimState(input);
}

export interface RewardClaimAdmission {
  readonly eligible: boolean;
}
export type RewardClaimPreparationResult =
  | {
      readonly status: 'accepted';
      readonly reason: 'none';
      readonly candidate: RewardClaimState;
      readonly grants: readonly RewardLine[];
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'already_claimed' | 'ineligible';
      readonly candidate: null;
      readonly grants: readonly [];
    };

/** Prepare intents only. L4 must atomically commit the claim and all external grants. */
export function prepareRewardClaim(state: RewardClaimState, admission: RewardClaimAdmission): RewardClaimPreparationResult {
  return inspect(() => {
    const snapshot = validateRewardClaimState(state);
    const {eligible} = fields(admission, ['eligible']);
    if (typeof eligible !== 'boolean') throw new TypeError('Reward admission eligible must be boolean');
    if (snapshot.status === 'claimed' || !eligible) {
      return Object.freeze({status: 'rejected', reason: snapshot.status === 'claimed' ? 'already_claimed' : 'ineligible',
        candidate: null, grants: Object.freeze([] as const)});
    }
    const candidate = Object.freeze({...snapshot, status: 'claimed' as const});
    const grants = validateRewardPackage(snapshot.reward).lines;
    return Object.freeze({status: 'accepted', reason: 'none', candidate, grants});
  });
}
