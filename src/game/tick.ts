import { PREFECTURES } from "../data/prefectures";
import { randomInt } from "./rng";
import { dateForTick } from "./time";
import { applyStateTransaction } from "./transaction";
import type {
  GameEvent,
  GameState,
  RegionMetrics,
  StateChange,
  StateTransaction,
} from "./types";

export const PROTOTYPE_EMERGENCY_PROCUREMENT_RULE =
  "prototype-emergency-procurement";
export const EMERGENCY_TAX_RULE = "emergency-tax";
export const STABILIZE_RULE = "stabilize";
export const INVEST_RULE = "invest";
export const RULE_CONTROLLER_PRIORITIES = Object.freeze([
  PROTOTYPE_EMERGENCY_PROCUREMENT_RULE,
  EMERGENCY_TAX_RULE,
  STABILIZE_RULE,
  INVEST_RULE,
] as const);

export type RuleControllerAction = (typeof RULE_CONTROLLER_PRIORITIES)[number];

export function selectRuleControllerAction(
  treasury: number,
  metrics: RegionMetrics,
  foodShortage: number,
): RuleControllerAction {
  for (const action of RULE_CONTROLLER_PRIORITIES) {
    if (
      action === PROTOTYPE_EMERGENCY_PROCUREMENT_RULE &&
      foodShortage > 0 &&
      treasury > 0
    ) {
      return action;
    }
    if (action === EMERGENCY_TAX_RULE && treasury < 5_000) return action;
    if (action === STABILIZE_RULE && metrics.stabilityBp < 4_000) return action;
    if (action === INVEST_RULE) return action;
  }
  return INVEST_RULE;
}

export function advanceOneTick(state: GameState): GameState {
  const nextTick = state.tick + 1;
  const changes: StateChange[] = [];
  const events: GameEvent[] = [];
  let eventSequence = (state.events.at(-1)?.sequence ?? -1) + 1;
  const emitEvent = (event: Omit<GameEvent, "sequence">) => {
    events.push({ ...event, sequence: eventSequence });
    eventSequence += 1;
  };

  for (const prefecture of PREFECTURES) {
    const regionId = `region:${prefecture.id}` as const;
    const polityId = `polity:${prefecture.id}` as const;
    const region = state.regions[regionId];
    const polity = state.polities[polityId];
    if (!region || !polity)
      throw new Error(`Incomplete world at ${prefecture.id}`);

    const consumption = Math.ceil(region.metrics.population / 100_000);
    const populationChange = randomInt(
      state.metadata.worldSeed,
      -2,
      4,
      "population",
      nextTick,
      regionId,
      "daily-delta",
    );
    const gdpBpChange = randomInt(
      state.metadata.worldSeed,
      -3,
      5,
      "economy",
      nextTick,
      regionId,
      "gdp-bp",
    );
    const stabilityChange = randomInt(
      state.metadata.worldSeed,
      -2,
      2,
      "politics",
      nextTick,
      polityId,
      "stability-bp",
    );
    const availableFood =
      region.metrics.food + region.metrics.foodProduction - consumption;
    const shortage = Math.max(0, -availableFood);
    const normalRevenue = Math.max(
      0,
      Math.floor(region.metrics.gdp / 10_000_000),
    );
    let treasury = polity.treasury + normalRevenue;
    let food = Math.max(0, availableFood);
    const economyEventId = `event:economy:${nextTick}:${prefecture.id}`;
    const metrics = {
      population: Math.max(0, region.metrics.population + populationChange),
      gdp: Math.max(
        0,
        Math.floor((region.metrics.gdp * (10_000 + gdpBpChange)) / 10_000),
      ),
      food,
      foodProduction: region.metrics.foodProduction,
      stabilityBp: Math.max(
        0,
        Math.min(
          10_000,
          region.metrics.stabilityBp + stabilityChange - shortage * 5,
        ),
      ),
      military: region.metrics.military,
    };
    const hasUrgentGoal =
      shortage > 0 || treasury < 5_000 || metrics.stabilityBp < 4_000;
    const action =
      hasUrgentGoal || nextTick % 10 === 0
        ? selectRuleControllerAction(treasury, metrics, shortage)
        : null;
    if (action === PROTOTYPE_EMERGENCY_PROCUREMENT_RULE) {
      // Prototype stopgap: this creates supplies directly and is not trade, a market, or logistics.
      emitEvent({
        id: economyEventId,
        tick: nextTick,
        type: "FoodShortageDetected",
        actorPolityId: polityId,
        regionId,
        causes: [{ type: "rule", id: "goal:food-shortage" }],
        effects: [`food-shortage:${shortage}`],
        visibility: "public",
        importance: 20,
      });
      const spend = Math.min(treasury, shortage * 2, 1_000);
      const procuredFood = Math.floor(spend / 2);
      treasury -= spend;
      food += procuredFood;
      metrics.food = food;
      emitEvent({
        id: `event:prototype-emergency-procurement:${nextTick}:${prefecture.id}`,
        tick: nextTick,
        type: "PrototypeEmergencyProcurement",
        actorPolityId: polityId,
        regionId,
        causes: [
          { type: "event", id: economyEventId },
          { type: "rule", id: PROTOTYPE_EMERGENCY_PROCUREMENT_RULE },
        ],
        effects: [`treasury:-${spend}`, `food:+${procuredFood}`],
        visibility: "public",
        importance: 25,
      });
    } else if (action === EMERGENCY_TAX_RULE) {
      const taxRevenue = 500;
      treasury += taxRevenue;
      metrics.stabilityBp = Math.max(0, metrics.stabilityBp - 50);
      emitEvent({
        id: `event:emergency-tax:${nextTick}:${prefecture.id}`,
        tick: nextTick,
        type: "EmergencyTax",
        actorPolityId: polityId,
        regionId,
        causes: [
          { type: "rule", id: "goal:treasury-danger" },
          { type: "rule", id: EMERGENCY_TAX_RULE },
        ],
        effects: [`treasury:+${taxRevenue}`, "stability-bp:-50"],
        visibility: "public",
        importance: 30,
      });
    } else if (action === STABILIZE_RULE) {
      const spend = Math.min(treasury, 200);
      const stabilityGain = Math.floor(spend / 2);
      treasury -= spend;
      metrics.stabilityBp = Math.min(
        10_000,
        metrics.stabilityBp + stabilityGain,
      );
      emitEvent({
        id: `event:stabilize:${nextTick}:${prefecture.id}`,
        tick: nextTick,
        type: "Stabilize",
        actorPolityId: polityId,
        regionId,
        causes: [
          { type: "rule", id: "goal:low-stability" },
          { type: "rule", id: STABILIZE_RULE },
        ],
        effects: [`treasury:-${spend}`, `stability-bp:+${stabilityGain}`],
        visibility: "public",
        importance: 25,
      });
    } else if (action === INVEST_RULE) {
      const spend = Math.min(treasury, 100);
      const gdpGain = spend * 100;
      treasury -= spend;
      metrics.gdp += gdpGain;
      emitEvent({
        id: `event:invest:${nextTick}:${prefecture.id}`,
        tick: nextTick,
        type: "Invest",
        actorPolityId: polityId,
        regionId,
        causes: [
          { type: "rule", id: "goal:long-term-growth" },
          { type: "rule", id: INVEST_RULE },
        ],
        effects: [`treasury:-${spend}`, `gdp:+${gdpGain}`],
        visibility: "public",
        importance: 15,
      });
    }
    changes.push({ type: "set-region-metrics", regionId, metrics });
    changes.push({ type: "set-polity-treasury", polityId, treasury });
  }

  changes.push({
    type: "advance-day",
    fromTick: state.tick,
    toTick: nextTick,
    date: dateForTick(nextTick),
  });
  const transaction: StateTransaction = {
    id: `transaction:tick:${nextTick}`,
    baseStateVersion: state.metadata.stateVersion,
    source: { type: "rule", id: "daily-tick-pipeline" },
    changes,
    events,
  };
  return applyStateTransaction(state, transaction);
}

export function advanceTicks(state: GameState, count: number): GameState {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("Tick count must be a non-negative safe integer");
  let next = state;
  for (let index = 0; index < count; index += 1) next = advanceOneTick(next);
  return next;
}
