import {
  createModuleRegistry, configureModules, composeModules,
  createGameplayMessaging, registerCommandHandler, dispatchCommand,
  subscribeEvent, publishEvent, unsubscribeEvent, unsubscribeModuleEvents,
  type GameplayMessaging, type GameplayCommand, type CommandOutcome,
  type CommandHandlerRegistration, type CommandFailure, type CommandResult,
  type GameplayEvent, type EventSubscription, type EventSubscriptionRegistration,
  type EventFailure, type EventPublishResult,
} from '@rpg/gameplay';

const context: GameplayMessaging = createGameplayMessaging(composeModules(createModuleRegistry(), configureModules(createModuleRegistry())));
const command: GameplayCommand = {type: 'probe', payload: {caller: true}};
const outcome: CommandOutcome = {status: 'success', value: 3};
const registration: CommandHandlerRegistration = {moduleId: 'unit', commandType: 'probe', handler(input) {
  const payload: unknown = input.payload;
  // @ts-expect-error Unknown business payload requires caller validation.
  payload.value;
  // @ts-expect-error Foundation envelope is readonly.
  input.type = 'other';
  return outcome;
}};
registerCommandHandler(context, registration);
const result: CommandResult = dispatchCommand(context, command);
if (result.status === 'failed') { const failure: CommandFailure = result.failure; void failure; }
if (result.status === 'rejected') { const reason: string = result.reason; void reason; }
if (result.status === 'success') {
  const value: unknown = result.value; void value;
  // @ts-expect-error Success is distinct from technical failure.
  result.failure;
}
// @ts-expect-error Malformed handler results are rejected statically too.
registerCommandHandler(context, {moduleId: 'unit', commandType: 'bad', handler: () => true});
// @ts-expect-error Async command results are unsupported.
registerCommandHandler(context, {moduleId: 'unit', commandType: 'bad', handler: async () => outcome});
const event: GameplayEvent = {type: 'event-x', payload: undefined};
const subscriber: EventSubscriptionRegistration = {moduleId: 'unit', eventType: 'event-x', handler(input) { void input.payload; }};
const token: EventSubscription = subscribeEvent(context, subscriber);
const delivery: EventPublishResult = publishEvent(context, event);
if (!delivery.ok) { const failure: EventFailure = delivery.failure; void failure; }
const removed: boolean = unsubscribeEvent(context, token);
const count: number = unsubscribeModuleEvents(context, 'unit');
// @ts-expect-error Context has no public tables or engine methods.
context.subscriptions.clear();
// @ts-expect-error Capability cannot be structurally forged.
const forged: GameplayMessaging = {};
// @ts-expect-error Subscription cannot be structurally forged.
const fakeToken: EventSubscription = {};
// @ts-expect-error Subscription is not a messaging context.
publishEvent(token, event);
// @ts-expect-error Results are readonly coordination metadata.
result.status = 'success';
// @ts-expect-error Delivery progress is readonly.
delivery.completedDeliveries = 99;
// @ts-expect-error Payload field must be supplied (may explicitly be undefined).
publishEvent(context, {type: 'event-x'});
void [removed, count, forged, fakeToken];
