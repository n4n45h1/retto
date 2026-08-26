import { describe, expect, it } from "vitest";
import { PREFECTURES } from "../data/prefectures";
import {
  advanceOneTick,
  advanceTicks,
  applyStateTransaction,
  assertGameState,
  createWorld,
  EMERGENCY_TAX_RULE,
  INVEST_RULE,
  PROTOTYPE_EMERGENCY_PROCUREMENT_RULE,
  randomInt,
  randomUint32,
  recordAcceptedExternalInput,
  STABILIZE_RULE,
  type StateTransaction,
  selectRuleControllerAction,
} from ".";

const config = {
  seed: "day-one-seed",
  playerPolityId: "polity:JP-13" as const,
};

describe("RETTO Day 1 domain", () => {
  it("has all 47 unique prefectures in stable JIS order", () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(new Set(PREFECTURES.map((prefecture) => prefecture.id)).size).toBe(
      47,
    );
    expect(PREFECTURES[0]?.id).toBe("JP-01");
    expect(PREFECTURES[46]?.id).toBe("JP-47");
  });

  it("creates equal worlds and event order from the same seed", () => {
    expect(advanceTicks(createWorld(config), 10)).toEqual(
      advanceTicks(createWorld(config), 10),
    );
  });

  it("derives legal but divergent prototype metrics from different seeds", () => {
    const first = createWorld(config);
    const second = createWorld({ ...config, seed: "different-seed" });
    expect(second.regions["region:JP-13"]?.metrics).not.toEqual(
      first.regions["region:JP-13"]?.metrics,
    );
    expect(second.polities["polity:JP-13"]?.treasury).not.toBe(
      first.polities["polity:JP-13"]?.treasury,
    );
    expect(() => assertGameState(second)).not.toThrow();
    expect(first.polities["polity:JP-01"]?.treasury).toBe(
      randomInt(config.seed, 15_000, 30_000, "initial:polity:JP-01:treasury"),
    );
  });

  it("isolates RNG namespaces and semantic counters", () => {
    const before = randomUint32(
      config.seed,
      "economy",
      8,
      "region:JP-01",
      "gdp-bp",
    );
    randomUint32(config.seed, "politics", 8, "polity:JP-01", "extra-draw");
    expect(
      randomUint32(config.seed, "economy", 8, "region:JP-01", "gdp-bp"),
    ).toBe(before);
    expect(
      randomUint32(config.seed, "economy", 8, "region:JP-02", "gdp-bp"),
    ).not.toBe(before);
  });

  it("leaves state untouched when an atomic transaction fails", () => {
    const state = createWorld(config);
    const snapshot = structuredClone(state);
    const region = state.regions["region:JP-01"];
    expect(region).toBeDefined();
    if (!region) throw new Error("Test world is incomplete");
    const invalid: StateTransaction = {
      id: "invalid",
      baseStateVersion: 0,
      source: { type: "rule", id: "test" },
      changes: [
        { type: "set-polity-treasury", polityId: "polity:JP-01", treasury: 1 },
        {
          type: "set-region-metrics",
          regionId: "region:JP-01",
          metrics: { ...region.metrics, food: -1 },
        },
      ],
      events: [],
    };
    expect(() => applyStateTransaction(state, invalid)).toThrow();
    expect(state).toEqual(snapshot);
  });

  it("increments only aggregates whose values changed", () => {
    const state = createWorld(config);
    const region = state.regions["region:JP-01"];
    const polity = state.polities["polity:JP-01"];
    expect(region).toBeDefined();
    expect(polity).toBeDefined();
    if (!region || !polity) throw new Error("Test world is incomplete");
    const unchanged = applyStateTransaction(state, {
      id: "unchanged-aggregates",
      baseStateVersion: 0,
      source: { type: "rule", id: "test" },
      changes: [
        {
          type: "set-region-metrics",
          regionId: region.id,
          metrics: { ...region.metrics },
        },
        {
          type: "set-polity-treasury",
          polityId: polity.id,
          treasury: polity.treasury,
        },
      ],
      events: [],
    });
    expect(unchanged.regions[region.id]?.revision).toBe(0);
    expect(unchanged.polities[polity.id]?.revision).toBe(0);
  });

  it("updates all 47 regions exactly once per daily transaction", () => {
    const before = createWorld(config);
    const after = advanceOneTick(before);
    expect(after.tick).toBe(1);
    expect(after.date).toBe("2030-01-02");
    expect(after.metadata.stateVersion).toBe(1);
    expect(Object.keys(after.regions)).toHaveLength(47);
    expect(after.externalInputs).toEqual(before.externalInputs);
    for (const prefecture of PREFECTURES) {
      expect(after.regions[`region:${prefecture.id}`]).not.toBe(
        before.regions[`region:${prefecture.id}`],
      );
      expect(after.regions[`region:${prefecture.id}`]?.revision).toBe(1);
      expect(after.polities[`polity:${prefecture.id}`]?.revision).toBe(1);
      expect(after.governments[`government:${prefecture.id}:1`]?.revision).toBe(
        0,
      );
    }
  });

  it("uses explicit deterministic controller goal priorities", () => {
    const metrics = createWorld(config).regions["region:JP-01"]?.metrics;
    expect(metrics).toBeDefined();
    if (!metrics) throw new Error("Test world is incomplete");
    expect(selectRuleControllerAction(100, metrics, 1)).toBe(
      PROTOTYPE_EMERGENCY_PROCUREMENT_RULE,
    );
    expect(selectRuleControllerAction(0, metrics, 0)).toBe(EMERGENCY_TAX_RULE);
    expect(
      selectRuleControllerAction(10_000, { ...metrics, stabilityBp: 3_999 }, 0),
    ).toBe(STABILIZE_RULE);
    expect(selectRuleControllerAction(10_000, metrics, 0)).toBe(INVEST_RULE);
  });

  it("is speed-independent because N ticks are repeated one-day ticks", () => {
    let manual = createWorld(config);
    for (let index = 0; index < 30; index += 1) manual = advanceOneTick(manual);
    expect(advanceTicks(createWorld(config), 30)).toEqual(manual);
  });

  it("records an emergency procurement with its economy cause", () => {
    const initial = createWorld(config);
    const region = initial.regions["region:JP-01"];
    expect(region).toBeDefined();
    if (!region) throw new Error("Test world is incomplete");
    const starved = applyStateTransaction(initial, {
      id: "setup-starvation",
      baseStateVersion: 0,
      source: { type: "rule", id: "test-setup" },
      changes: [
        {
          type: "set-region-metrics",
          regionId: region.id,
          metrics: { ...region.metrics, food: 0, foodProduction: 0 },
        },
      ],
      events: [],
    });
    const after = advanceOneTick(starved);
    const procurement = after.events.find(
      (event) => event.type === "PrototypeEmergencyProcurement",
    );
    expect(procurement?.causes).toContainEqual({
      type: "event",
      id: "event:economy:1:JP-01",
    });
    expect(
      after.events.find((event) => event.id === procurement?.causes[0]?.id),
    ).toBeDefined();
    expect(Object.isFrozen(procurement)).toBe(true);
    expect(Object.isFrozen(procurement?.causes)).toBe(true);
  });

  it("applies bounded emergency tax and stabilization tradeoffs", () => {
    const initial = createWorld(config);
    const region = initial.regions["region:JP-01"];
    expect(region).toBeDefined();
    if (!region) throw new Error("Test world is incomplete");
    const endangered = applyStateTransaction(initial, {
      id: "setup-controller-goals",
      baseStateVersion: 0,
      source: { type: "rule", id: "test-setup" },
      changes: [
        { type: "set-polity-treasury", polityId: "polity:JP-01", treasury: 0 },
        {
          type: "set-region-metrics",
          regionId: region.id,
          metrics: { ...region.metrics, stabilityBp: 3_000 },
        },
      ],
      events: [],
    });
    const taxed = advanceOneTick(endangered);
    const tax = taxed.events.find((event) => event.type === "EmergencyTax");
    expect(tax?.causes).toContainEqual({
      type: "rule",
      id: "goal:treasury-danger",
    });
    expect(taxed.polities["polity:JP-01"]?.treasury).toBeLessThanOrEqual(510);
    expect(taxed.regions[region.id]?.metrics.stabilityBp).toBeLessThan(3_010);

    const funded = applyStateTransaction(endangered, {
      id: "fund-stabilization",
      baseStateVersion: endangered.metadata.stateVersion,
      source: { type: "rule", id: "test-setup" },
      changes: [
        {
          type: "set-polity-treasury",
          polityId: "polity:JP-01",
          treasury: 10_000,
        },
      ],
      events: [],
    });
    const stabilized = advanceOneTick(funded);
    expect(stabilized.events.some((event) => event.type === "Stabilize")).toBe(
      true,
    );
    expect(stabilized.regions[region.id]?.metrics.stabilityBp).toBeGreaterThan(
      3_000,
    );
    expect(stabilized.polities["polity:JP-01"]?.treasury).toBeLessThan(10_000);
  });

  it("emits sparse visible investment events with contiguous sequence", () => {
    const state = advanceTicks(createWorld(config), 20);
    expect(state.events.length).toBeGreaterThanOrEqual(94);
    expect(state.events.length).toBeLessThanOrEqual(100);
    expect(state.events.some((event) => event.type === "Invest")).toBe(true);
    expect(state.events.map((event) => event.sequence)).toEqual(
      state.events.map((_, index) => index),
    );
    expect(Object.isFrozen(state.events)).toBe(true);
  });

  it("rejects a non-contiguous event sequence atomically", () => {
    const state = createWorld(config);
    expect(() =>
      applyStateTransaction(state, {
        id: "bad-event-sequence",
        baseStateVersion: 0,
        source: { type: "rule", id: "test" },
        changes: [],
        events: [
          {
            id: "event:bad-sequence",
            sequence: 1,
            tick: 0,
            type: "Invest",
            actorPolityId: "polity:JP-01",
            regionId: "region:JP-01",
            causes: [{ type: "rule", id: INVEST_RULE }],
            effects: [],
            visibility: "public",
            importance: 1,
          },
        ],
      }),
    ).toThrow("Invalid event");
    expect(state.events).toHaveLength(0);
  });

  it("rejects an action event without a corresponding state change", () => {
    const state = createWorld(config);
    expect(() =>
      applyStateTransaction(state, {
        id: "event-without-change",
        baseStateVersion: 0,
        source: { type: "rule", id: "test" },
        changes: [],
        events: [
          {
            id: "event:unsupported-action",
            sequence: 0,
            tick: 0,
            type: "Invest",
            actorPolityId: "polity:JP-01",
            regionId: "region:JP-01",
            causes: [{ type: "rule", id: INVEST_RULE }],
            effects: ["gdp:+999"],
            visibility: "public",
            importance: 1,
          },
        ],
      }),
    ).toThrow("has no corresponding state change");
    expect(state.events).toHaveLength(0);
    expect(state.metadata.stateVersion).toBe(0);
  });

  it("records accepted external input with tick and sequence", () => {
    const state = recordAcceptedExternalInput(createWorld(config), {
      kind: "player-command",
      commandId: "command:1",
      payload: { policy: "hold" },
    });
    expect(state.externalInputs.at(-1)).toMatchObject({
      appliedTick: 0,
      sequence: 1,
      input: { kind: "player-command", commandId: "command:1" },
    });
  });

  it("clones and deeply freezes accepted external-input history", () => {
    const initial = createWorld(config);
    const initialRecord = initial.externalInputs[0];
    expect(Object.isFrozen(initial.externalInputs)).toBe(true);
    expect(Object.isFrozen(initialRecord)).toBe(true);
    expect(Object.isFrozen(initialRecord?.input)).toBe(true);

    const command: {
      kind: "player-command";
      commandId: string;
      payload: { policy: string; urgent: boolean };
    } = {
      kind: "player-command",
      commandId: "command:immutable",
      payload: { policy: "hold", urgent: false },
    };
    const commanded = recordAcceptedExternalInput(initial, command);
    command.commandId = "command:rewritten";
    command.payload.policy = "attack";
    command.payload.urgent = true;

    const commandRecord = commanded.externalInputs[1];
    expect(commandRecord?.input).toEqual({
      kind: "player-command",
      commandId: "command:immutable",
      payload: { policy: "hold", urgent: false },
    });
    expect(Object.isFrozen(commanded.externalInputs)).toBe(true);
    expect(Object.isFrozen(commandRecord)).toBe(true);
    expect(Object.isFrozen(commandRecord?.input)).toBe(true);
    expect(
      commandRecord?.input.kind === "player-command" &&
        Object.isFrozen(commandRecord.input.payload),
    ).toBe(true);

    const decision: {
      kind: "external-decision";
      decisionId: string;
      actorPolityId: "polity:JP-01";
      basedOnStateVersion: number;
      payload: { action: string };
    } = {
      kind: "external-decision",
      decisionId: "decision:immutable",
      actorPolityId: "polity:JP-01",
      basedOnStateVersion: commanded.metadata.stateVersion,
      payload: { action: "wait" },
    };
    const decided = recordAcceptedExternalInput(commanded, decision);
    decision.decisionId = "decision:rewritten";
    decision.payload.action = "attack";

    const decisionRecord = decided.externalInputs[2];
    expect(decisionRecord?.input).toMatchObject({
      decisionId: "decision:immutable",
      payload: { action: "wait" },
    });
    expect(Object.isFrozen(decisionRecord)).toBe(true);
    expect(Object.isFrozen(decisionRecord?.input)).toBe(true);
    expect(
      decisionRecord?.input.kind === "external-decision" &&
        Object.isFrozen(decisionRecord.input.payload),
    ).toBe(true);
  });

  it("preserves numeric and reference invariants for 1000 ticks", () => {
    const state = advanceTicks(createWorld(config), 1_000);
    expect(() => assertGameState(state)).not.toThrow();
    expect(state.tick).toBe(1_000);
    expect(state.externalInputs).toHaveLength(1);
  });
});
