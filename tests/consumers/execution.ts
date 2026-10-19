import {
  createExecutionContext, readExecutionTime, nextExecutionRandom, nextExecutionId,
  type GameplayClock, type GameplayRandom, type GameplayIdProvider,
  type GameplayExecutionDependencies, type GameplayExecutionContext,
} from '@rpg/gameplay';
const clock: GameplayClock = {now: () => 1000};
const random: GameplayRandom = {next: () => 0.25};
const ids: GameplayIdProvider = {next: () => 'caller-id'};
const dependencies: GameplayExecutionDependencies = {clock, random, ids};
const context: GameplayExecutionContext = createExecutionContext(dependencies);
const time: number = readExecutionTime(context);
const sample: number = nextExecutionRandom(context);
const id: string = nextExecutionId(context);
createExecutionContext({clock});
// @ts-expect-error Clock is mandatory.
createExecutionContext({random});
// @ts-expect-error Provider results must match their contract.
createExecutionContext({clock: {now: () => '1000'}});
// @ts-expect-error RNG is synchronous and numeric.
createExecutionContext({clock, random: {next: async () => 0.25}});
// @ts-expect-error IDs must be strings.
createExecutionContext({clock, ids: {next: () => 1}});
// @ts-expect-error Dependency slots are readonly.
dependencies.clock = clock;
// @ts-expect-error Opaque contexts cannot be constructed structurally.
const forged: GameplayExecutionContext = {};
// @ts-expect-error Provider bindings are private.
context.clock.now();
// @ts-expect-error No context mutation API.
context.advanceTime(100);
void time; void sample; void id; void forged;
