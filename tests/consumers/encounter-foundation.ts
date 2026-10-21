import {createEncounterDefinitionReference,createEncounterSide,createEncounterParticipant,
 createEncounterState,validateEncounterState,createEntityCollection,addEntity,
 type EncounterDefinitionReference,type EncounterSide,type EncounterParticipant,
 type EncounterInitialState,type EncounterState,type EncounterStatus,type EntityCollection} from '@rpg/gameplay';
const definition:EncounterDefinitionReference=createEncounterDefinitionReference({definitionId:'opaque'});
const side:EncounterSide=createEncounterSide({sideId:'A'});
const participant:EncounterParticipant=createEncounterParticipant({entityId:'X',sideId:'A'});
const collection:EntityCollection=addEntity(createEntityCollection(),{id:'X',kind:'custom'});
const initial:EncounterInitialState={encounterId:'E',sides:[side],participants:[participant]};
const state:EncounterState=createEncounterState(definition,initial,collection);
validateEncounterState(state,collection);
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
const statuses:Equal<EncounterStatus,'prepared'|'active'|'resolved'|'closed'|'cancelled'>=true;
const keys:Equal<keyof EncounterState,'encounterId'|'definitionId'|'status'|'sides'|'participants'>=true;
void statuses;void keys;
// @ts-expect-error State identity is readonly in the actual installed declaration.
state.encounterId='other';
// @ts-expect-error Nested side is readonly.
state.sides[0]!.sideId='other';
// @ts-expect-error Participant array is readonly.
state.participants.push(participant);
// @ts-expect-error No lifecycle input to the factory.
createEncounterState(definition,{...initial,status:'active'},collection);
// @ts-expect-error Closed lifecycle vocabulary.
const invalid:EncounterStatus='running';void invalid;
// @ts-expect-error Root-only package boundary.
import {} from '@rpg/gameplay/dist/modules/encounter/index.js';
