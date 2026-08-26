import { PREFECTURES } from "../data/prefectures";
import { dateForTick } from "./time";
import type { GameState, RegionMetrics } from "./types";

export function assertMetrics(metrics: RegionMetrics): void {
  for (const [name, value] of Object.entries(metrics)) {
    if (!Number.isSafeInteger(value))
      throw new Error(`${name} must be a safe integer`);
  }
  if (
    metrics.population < 0 ||
    metrics.gdp < 0 ||
    metrics.food < 0 ||
    metrics.foodProduction < 0 ||
    metrics.military < 0
  ) {
    throw new Error("Region metrics cannot be negative");
  }
  if (metrics.stabilityBp < 0 || metrics.stabilityBp > 10_000) {
    throw new Error("Stability must be between 0 and 10000 basis points");
  }
}

export function assertGameState(
  state: GameState,
  includeEventHistory = true,
): void {
  if (
    !Number.isSafeInteger(state.tick) ||
    state.tick < 0 ||
    !Number.isSafeInteger(state.metadata.stateVersion)
  ) {
    throw new Error("Invalid state counters");
  }
  if (!state.polities[state.playerPolityId])
    throw new Error("Player polity does not exist");
  if (state.date !== dateForTick(state.tick))
    throw new Error("Date does not match tick");
  for (const prefecture of PREFECTURES) {
    const polityId = `polity:${prefecture.id}` as const;
    const governmentId = `government:${prefecture.id}:1` as const;
    const regionId = `region:${prefecture.id}` as const;
    const polity = state.polities[polityId];
    const government = state.governments[governmentId];
    const region = state.regions[regionId];
    if (!polity || !government || !region)
      throw new Error(`Missing entities for ${prefecture.id}`);
    if (
      polity.governmentId !== government.id ||
      government.polityId !== polity.id
    ) {
      throw new Error(`Dangling government for ${polityId}`);
    }
    if (!Number.isSafeInteger(polity.treasury) || polity.treasury < 0)
      throw new Error(`Invalid treasury for ${polityId}`);
    if (
      !Number.isSafeInteger(polity.revision) ||
      polity.revision < 0 ||
      !Number.isSafeInteger(government.revision) ||
      government.revision < 0 ||
      !Number.isSafeInteger(region.revision) ||
      region.revision < 0
    ) {
      throw new Error(`Invalid aggregate revision for ${prefecture.id}`);
    }
    if (
      !state.polities[region.ownerPolityId] ||
      !state.polities[region.controllerPolityId]
    ) {
      throw new Error(`Dangling ownership or control for ${regionId}`);
    }
    assertMetrics(region.metrics);
  }
  if (
    Object.keys(state.polities).length !== 47 ||
    Object.keys(state.governments).length !== 47 ||
    Object.keys(state.regions).length !== 47
  ) {
    throw new Error(
      "A Day 1 world must contain exactly 47 polities, governments, and regions",
    );
  }
  if (includeEventHistory) {
    const priorEventIds = new Set<string>();
    let expectedSequence = 0;
    for (const event of state.events) {
      if (
        !state.polities[event.actorPolityId] ||
        !state.regions[event.regionId]
      ) {
        throw new Error(`Dangling event ${event.id}`);
      }
      if (
        !Number.isSafeInteger(event.tick) ||
        event.tick < 0 ||
        event.tick > state.tick
      ) {
        throw new Error(`Invalid event tick ${event.id}`);
      }
      if (event.sequence !== expectedSequence) {
        throw new Error(`Invalid event sequence ${event.id}`);
      }
      for (const cause of event.causes) {
        if (cause.type === "event" && !priorEventIds.has(cause.id)) {
          throw new Error(`Invalid event cause ${cause.id}`);
        }
      }
      if (priorEventIds.has(event.id))
        throw new Error(`Duplicate event ${event.id}`);
      priorEventIds.add(event.id);
      expectedSequence += 1;
    }
  }
}
