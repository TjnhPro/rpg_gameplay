import {createCombatActionContext, type CombatEntityTarget, type CombatActionRequest,
  type CombatActionContext} from '@rpg/gameplay';

const target: CombatEntityTarget = {kind: 'entity', entityId: 'monster-1'};
const request: CombatActionRequest = {actionId: 'attack-001', actionType: 'custom', sourceEntityId: 'player-1', target};
const context: CombatActionContext = createCombatActionContext(request);
const kind: 'entity' = context.target.kind;
const ids: readonly string[] = [context.actionId, context.actionType, context.sourceEntityId, context.target.entityId];
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof createCombatActionContext>, IsAny<typeof context>,
  IsAny<typeof context.target>, IsAny<typeof context.actionId>, IsAny<typeof context.actionType>,
  IsAny<typeof context.sourceEntityId>, IsAny<typeof context.target.entityId>] = [false, false, false, false, false, false, false];
// @ts-expect-error Request identity is readonly.
request.actionId = 'changed';
// @ts-expect-error Request action type is readonly.
request.actionType = 'changed';
// @ts-expect-error Request source is readonly.
request.sourceEntityId = 'changed';
// @ts-expect-error Request target is readonly.
request.target = target;
// @ts-expect-error Nested target kind is readonly.
target.kind = 'entity';
// @ts-expect-error Nested target ID is readonly.
target.entityId = 'changed';
// @ts-expect-error Snapshot identity is readonly.
context.actionId = 'changed';
// @ts-expect-error Snapshot action type is readonly.
context.actionType = 'changed';
// @ts-expect-error Snapshot source is readonly.
context.sourceEntityId = 'changed';
// @ts-expect-error Snapshot target is readonly.
context.target = target;
// @ts-expect-error Snapshot nested kind is readonly.
context.target.kind = 'entity';
// @ts-expect-error Snapshot nested ID is readonly.
context.target.entityId = 'changed';
// @ts-expect-error Required actionId cannot be omitted.
createCombatActionContext({actionType: 'custom', sourceEntityId: 'x', target});
// @ts-expect-error IDs are strings.
createCombatActionContext({...request, actionId: 1});
// @ts-expect-error Only entity targets are implemented.
createCombatActionContext({...request, target: {kind: 'ground', entityId: 'x'}});
// @ts-expect-error No metadata or execution data.
createCombatActionContext({...request, damage: 1});
// @ts-expect-error No execution result.
context.admitted;
// @ts-expect-error Root-only declarations.
import {createCombatActionContext as deep} from '@rpg/gameplay/modules/combat';
void kind; void ids; void noAny; void deep;
