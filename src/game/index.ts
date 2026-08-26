export { PREFECTURES } from "../data/prefectures";
export type {
  PrefectureId,
  PrefectureMetadata,
} from "../data/prefectures.schema";
export { recordAcceptedExternalInput } from "./external-input";
export { assertGameState, assertMetrics } from "./invariants";
export type {
  GameProjection,
  PolityProjection,
  RegionProjection,
} from "./projections";
export { projectGameState } from "./projections";
export { randomInt, randomUint32 } from "./rng";
export type { RuleControllerAction } from "./tick";
export {
  advanceOneTick,
  advanceTicks,
  EMERGENCY_TAX_RULE,
  INVEST_RULE,
  PROTOTYPE_EMERGENCY_PROCUREMENT_RULE,
  RULE_CONTROLLER_PRIORITIES,
  STABILIZE_RULE,
  selectRuleControllerAction,
} from "./tick";
export { dateForTick } from "./time";
export { applyStateTransaction } from "./transaction";
export type * from "./types";
export { createWorld } from "./world";
