import {
  createModuleRegistry, configureModules, composeModules,
  createGameplayRuntime, initializeGameplayRuntime, startGameplayRuntime,
  stopGameplayRuntime, disposeGameplayRuntime, inspectGameplayRuntime,
  type GameplayRuntime, type GameplayRuntimeSnapshot, type LifecycleBindings,
  type LifecycleTransitionResult, type LifecycleStage, type RuntimeStatus,
  type ModuleLifecycleBindings, type ModuleLifecycleSnapshot,
  type LifecycleContext, type LifecycleFailure,
} from '@rpg/gameplay';

const hook = (context: LifecycleContext): void => { const stage: LifecycleStage = context.stage; void stage; };
const moduleHooks: ModuleLifecycleBindings = {initialize:hook};
const bindings: LifecycleBindings = {unit:moduleHooks};
void bindings;
const runtime: GameplayRuntime = createGameplayRuntime(composeModules(createModuleRegistry(), {enabledModuleIds:[]}));
const result: LifecycleTransitionResult = initializeGameplayRuntime(runtime);
const view: GameplayRuntimeSnapshot = inspectGameplayRuntime(result.runtime);
const status: RuntimeStatus = view.status;
const modules: readonly ModuleLifecycleSnapshot[] = view.modules;
if (!result.ok) { const failure: LifecycleFailure = result.failure; void failure; }
if (result.ok) {
  // @ts-expect-error Success has no failure field.
  result.failure;
}
// @ts-expect-error Runtime capabilities cannot be forged structurally.
const forged: GameplayRuntime = {};
// @ts-expect-error Runtime has no methods or game engine.
runtime.start();
// @ts-expect-error Inspection is readonly.
view.status = 'running';
// @ts-expect-error Selected IDs are readonly.
view.moduleIds.push('unit');
// @ts-expect-error Module progress is readonly.
view.modules[0]!.completedStages.push('start');
// @ts-expect-error Failure diagnostics are readonly.
if (view.failure) view.failure.message = 'hidden';
// @ts-expect-error Hooks receive no implicit clock.
hook({moduleId:'unit',stage:'start',runtime:view,clock:42});
// @ts-expect-error Only lifecycle stages are supported.
const invalid: ModuleLifecycleBindings = {update:hook};
void [configureModules, startGameplayRuntime, stopGameplayRuntime, disposeGameplayRuntime, status, modules, forged, invalid];
