import {rollLootTable,createLootTableDefinition,validateLootRollResult,
  type LootTableDefinition,type LootRollResult,type LootDropIntent} from '@rpg/gameplay';
const table:LootTableDefinition=createLootTableDefinition({tableId:'one',noDropWeight:0,
  entries:[{entryId:'one',definitionId:'opaque',weight:1,quantity:2}]});
const result:LootRollResult=rollLootTable(table,0.5);
const drop:LootDropIntent|undefined=result.drops[0];
validateLootRollResult(result);
// @ts-expect-error sample must be a number
rollLootTable(table,'0.5');
// @ts-expect-error sample is mandatory
rollLootTable(table);
// @ts-expect-error table cannot omit noDropWeight
rollLootTable({tableId:'bad',entries:[]},0);
// @ts-expect-error result scalar is readonly
result.tableId='changed';
// @ts-expect-error result array is readonly
result.drops.push({entryId:'x',definitionId:'x',quantity:1});
if(drop) {
  // @ts-expect-error nested drop scalar is readonly
  drop.quantity=9;
}
