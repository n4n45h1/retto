import { PREFECTURES } from "../data/prefectures";
import { cloneAndFreezeExternalInputRecord } from "./immutable-history";
import { assertGameState } from "./invariants";
import { randomInt } from "./rng";
import { dateForTick } from "./time";
import type {
  GameState,
  Government,
  InitialWorldConfig,
  Polity,
  Region,
} from "./types";

export function createWorld(config: InitialWorldConfig): GameState {
  const seed = String(config.seed);
  if (seed.length === 0) throw new Error("World seed cannot be empty");
  const polities = {} as Record<Polity["id"], Polity>;
  const governments = {} as Record<Government["id"], Government>;
  const regions = {} as Record<Region["id"], Region>;

  for (const [index, prefecture] of PREFECTURES.entries()) {
    const polityId = `polity:${prefecture.id}` as const;
    const governmentId = `government:${prefecture.id}:1` as const;
    const regionId = `region:${prefecture.id}` as const;
    const initial = (metric: string, minimum: number, maximum: number) =>
      randomInt(seed, minimum, maximum, `initial:${polityId}:${metric}`);
    const population =
      480_000 +
      (47 - index) * 35_000 +
      (index % 7) * 90_000 +
      initial("population", -100_000, 100_000);
    const dailyConsumption = Math.ceil(population / 100_000);
    polities[polityId] = {
      id: polityId,
      revision: 0,
      name: prefecture.name,
      governmentId,
      treasury: initial("treasury", 15_000, 30_000),
    };
    governments[governmentId] = {
      id: governmentId,
      revision: 0,
      polityId,
      name: `${prefecture.name} Government`,
      establishedTick: 0,
    };
    regions[regionId] = {
      id: regionId,
      revision: 0,
      prefectureId: prefecture.id,
      ownerPolityId: polityId,
      controllerPolityId: polityId,
      metrics: {
        population,
        gdp: population * initial("gdp", 26, 38),
        food: dailyConsumption * initial("food", 20, 40),
        foodProduction: dailyConsumption + initial("foodProduction", 0, 3),
        stabilityBp: initial("stabilityBp", 5_500, 8_000),
        military: initial("military", 800, 2_200),
      },
    };
  }

  if (!polities[config.playerPolityId])
    throw new Error(`Unknown player polity ${config.playerPolityId}`);
  const state: GameState = {
    metadata: {
      saveSchemaVersion: 1,
      rulesetVersion: "retto-day1-v1",
      rngVersion: 1,
      stateVersion: 0,
      worldSeed: seed,
    },
    tick: 0,
    date: dateForTick(0),
    playerPolityId: config.playerPolityId,
    polities,
    governments,
    regions,
    events: Object.freeze([]),
    externalInputs: Object.freeze([
      cloneAndFreezeExternalInputRecord({
        appliedTick: 0,
        sequence: 0,
        input: {
          kind: "initial-config",
          seed,
          playerPolityId: config.playerPolityId,
        },
      }),
    ]),
  };
  assertGameState(state);
  return state;
}
