import { cloneAndFreezeExternalInputRecord } from "./immutable-history";
import { assertGameState, assertMetrics } from "./invariants";
import type { GameState, RegionMetrics, StateTransaction } from "./types";

function metricsEqual(left: RegionMetrics, right: RegionMetrics): boolean {
  return (
    left.population === right.population &&
    left.gdp === right.gdp &&
    left.food === right.food &&
    left.foodProduction === right.foodProduction &&
    left.stabilityBp === right.stabilityBp &&
    left.military === right.military
  );
}

export function applyStateTransaction(
  state: GameState,
  transaction: StateTransaction,
): GameState {
  if (transaction.baseStateVersion !== state.metadata.stateVersion)
    throw new Error("Stale transaction");
  const polities = { ...state.polities };
  const regions = { ...state.regions };
  let tick = state.tick;
  let date = state.date;
  let externalInputs = state.externalInputs;
  let advancedDay = false;
  const changedPolityIds = new Set<string>();
  const changedRegionIds = new Set<string>();

  for (const change of transaction.changes) {
    if (change.type === "set-region-metrics") {
      changedRegionIds.add(change.regionId);
      const region = regions[change.regionId];
      if (!region) throw new Error(`Unknown region ${change.regionId}`);
      assertMetrics(change.metrics);
      if (!metricsEqual(region.metrics, change.metrics)) {
        regions[change.regionId] = {
          ...region,
          revision: region.revision + 1,
          metrics: { ...change.metrics },
        };
      }
    } else if (change.type === "set-polity-treasury") {
      changedPolityIds.add(change.polityId);
      const polity = polities[change.polityId];
      if (!polity) throw new Error(`Unknown polity ${change.polityId}`);
      if (!Number.isSafeInteger(change.treasury) || change.treasury < 0)
        throw new Error("Invalid treasury");
      if (polity.treasury !== change.treasury) {
        polities[change.polityId] = {
          ...polity,
          revision: polity.revision + 1,
          treasury: change.treasury,
        };
      }
    } else if (change.type === "advance-day") {
      if (advancedDay || change.fromTick !== tick || change.toTick !== tick + 1)
        throw new Error("Ticks must advance exactly one day");
      advancedDay = true;
      tick = change.toTick;
      date = change.date;
    } else {
      const previous = externalInputs.at(-1);
      if (
        change.record.appliedTick !== tick ||
        change.record.sequence !== (previous?.sequence ?? -1) + 1
      ) {
        throw new Error("External input ordering is invalid");
      }
      const committedRecord = cloneAndFreezeExternalInputRecord(change.record);
      externalInputs = Object.freeze([...externalInputs, committedRecord]);
    }
  }

  const knownEventIds = new Set(state.events.map((event) => event.id));
  let expectedEventSequence = (state.events.at(-1)?.sequence ?? -1) + 1;
  for (const event of transaction.events) {
    if (
      !polities[event.actorPolityId] ||
      !regions[event.regionId] ||
      !Number.isSafeInteger(event.tick) ||
      event.tick < 0 ||
      event.tick > tick ||
      event.sequence !== expectedEventSequence ||
      !Number.isSafeInteger(event.importance) ||
      event.importance < 0 ||
      event.importance > 100
    ) {
      throw new Error(`Invalid event ${event.id}`);
    }
    if (knownEventIds.has(event.id)) {
      throw new Error(`Duplicate event ${event.id}`);
    }
    if (
      event.type !== "FoodShortageDetected" &&
      !changedRegionIds.has(event.regionId) &&
      !changedPolityIds.has(event.actorPolityId)
    ) {
      throw new Error(
        `Action event ${event.id} has no corresponding state change`,
      );
    }
    for (const cause of event.causes) {
      if (cause.type === "event" && !knownEventIds.has(cause.id)) {
        throw new Error(`Unknown event cause ${cause.id}`);
      }
    }
    knownEventIds.add(event.id);
    expectedEventSequence += 1;
  }

  const committedEvents = transaction.events.map((event) =>
    Object.freeze({
      ...event,
      causes: Object.freeze(
        event.causes.map((cause) => Object.freeze({ ...cause })),
      ),
      effects: Object.freeze([...event.effects]),
    }),
  );
  const next: GameState = {
    ...state,
    metadata: {
      ...state.metadata,
      stateVersion: state.metadata.stateVersion + 1,
    },
    tick,
    date,
    polities,
    regions,
    events: Object.freeze([...state.events, ...committedEvents]),
    externalInputs,
  };
  // Existing history was valid at the base version; appended events were checked above.
  assertGameState(next, false);
  return next;
}
