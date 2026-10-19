import {createEntity, createProgressionState, type ProgressionInitialState, type ProgressionState} from '@rpg/gameplay';

const actor = createEntity({id: 'typed-actor', kind: 'custom'});
const input: ProgressionInitialState = {level: 30, experience: 0.125};
const state: ProgressionState = createProgressionState(actor, input);
const entityId: string = state.entityId;
const level: number = state.level;
const experience: number = state.experience;
// @ts-expect-error Initial state is readonly.
input.level = 2;
// @ts-expect-error Snapshot identity is readonly.
state.entityId = 'other';
// @ts-expect-error Snapshot level is readonly.
state.level = 2;
// @ts-expect-error Snapshot experience is readonly.
state.experience = 1;
// @ts-expect-error Canonical Entity requires kind as well as id.
createProgressionState({id: 'missing-kind'}, input);
// @ts-expect-error Level must be a number; numeric constraints are runtime validation.
createProgressionState(actor, {level: '1', experience: 0});
// @ts-expect-error EXP must be a number.
createProgressionState(actor, {level: 1, experience: '100'});
// @ts-expect-error No implicit starting experience.
createProgressionState(actor, {level: 1});
// @ts-expect-error No premature points bag in initial state.
createProgressionState(actor, {level: 1, experience: 0, skillPoints: 0});
// @ts-expect-error No points/ranks in the public snapshot.
state.attributePoints;
// @ts-expect-error Only package root is exported, including declarations.
import {createProgressionState as deep} from '@rpg/gameplay/modules/progression';
void entityId; void level; void experience; void deep;
