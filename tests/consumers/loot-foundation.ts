import {createLootTableDefinition, validateLootTableDefinition, validateLootRollResult,
  type LootTableEntry, type LootTableDefinition, type LootDropIntent, type LootRollResult} from '@rpg/gameplay';

const entry: LootTableEntry = {entryId:'one',definitionId:'opaque',weight:1,quantity:2};
const definition: LootTableDefinition = createLootTableDefinition({tableId:'one',entries:[entry],noDropWeight:0});
const validated: LootTableDefinition = validateLootTableDefinition(definition);
const drop: LootDropIntent = {entryId:'one',definitionId:'opaque',quantity:2};
const result: LootRollResult = validateLootRollResult({tableId:validated.tableId,drops:[drop,drop]});
// @ts-expect-error snapshots have readonly scalar fields
definition.tableId = 'changed';
// @ts-expect-error entries are readonly arrays
definition.entries.push(entry);
// @ts-expect-error nested entries are readonly
entry.weight = 2;
// @ts-expect-error result arrays are readonly
result.drops.push(drop);
// @ts-expect-error drop snapshots are readonly
drop.quantity = 3;
// @ts-expect-error result fields are readonly
result.tableId = 'changed';
// @ts-expect-error missing explicit noDropWeight
createLootTableDefinition({tableId:'bad',entries:[]});
// @ts-expect-error IDs are strings
validateLootRollResult({tableId:1,drops:[]});
// @ts-expect-error quantity is required
const malformed: LootDropIntent = {entryId:'one',definitionId:'opaque'};
// @ts-expect-error weights are numbers
const badEntry: LootTableEntry = {entryId:'one',definitionId:'opaque',weight:'1',quantity:1};
// @ts-expect-error source metadata is outside the contract
validateLootRollResult({tableId:'bad',drops:[],sourceEntityId:'actor'});
void [malformed,badEntry];
