import { describe, expect, it } from "vitest";
import {
  advanceTicks,
  createWorld,
  recordAcceptedExternalInput,
} from "../game";
import {
  createSaveFile,
  LocalStorageSaveRepository,
  type ReplayData,
  RNG_VERSION,
  RULESET_VERSION,
  replayGame,
  SAVE_SCHEMA_VERSION,
  type StorageLike,
} from ".";

const config = {
  seed: "persistence-seed",
  playerPolityId: "polity:JP-13" as const,
};

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("RETTO persistence", () => {
  it("saves and loads a snapshot with deep equality, including events", () => {
    const state = advanceTicks(createWorld(config), 20);
    const repository = new LocalStorageSaveRepository(new MemoryStorage());
    repository.save(createSaveFile(state));

    expect(repository.load()?.snapshot).toEqual(state);
    expect(repository.load()?.snapshot.events).toEqual(state.events);
  });

  it("continues identically after save and load", () => {
    const state = advanceTicks(createWorld(config), 12);
    const repository = new LocalStorageSaveRepository(new MemoryStorage());
    repository.save(createSaveFile(state));
    const loaded = repository.load();
    expect(loaded).not.toBeNull();
    if (!loaded) throw new Error("Expected a save");

    expect(advanceTicks(loaded.snapshot, 18)).toEqual(advanceTicks(state, 18));
  });

  it("deterministically replays accepted inputs to the saved snapshot", () => {
    let state = advanceTicks(createWorld(config), 3);
    state = recordAcceptedExternalInput(state, {
      kind: "player-command",
      commandId: "command:hold",
      payload: { policy: "hold" },
    });
    state = advanceTicks(state, 4);
    state = recordAcceptedExternalInput(state, {
      kind: "external-decision",
      decisionId: "decision:accepted",
      actorPolityId: "polity:JP-01",
      basedOnStateVersion: state.metadata.stateVersion,
      payload: { action: "wait" },
    });
    state = advanceTicks(state, 5);

    const save = createSaveFile(state);
    expect(replayGame(save.replay)).toEqual(save.snapshot);
  });

  it("replays an initial-configuration-only game", () => {
    const state = advanceTicks(createWorld(config), 8);
    const save = createSaveFile(state);

    expect(save.replay.externalInputs).toEqual([]);
    expect(replayGame(save.replay)).toEqual(state);
  });

  it("includes Day 1 compatibility metadata in standalone replay data", () => {
    const replay = createSaveFile(createWorld(config)).replay;

    expect(replay).toMatchObject({
      saveSchemaVersion: SAVE_SCHEMA_VERSION,
      rulesetVersion: RULESET_VERSION,
      rngVersion: RNG_VERSION,
    });
  });

  it.each([
    ["saveSchemaVersion", 2],
    ["rulesetVersion", "retto-day2-v1"],
    ["rngVersion", 2],
  ] as const)(
    "rejects an incompatible standalone replay %s",
    (field, value) => {
      const replay = createSaveFile(createWorld(config)).replay;
      const incompatible = {
        ...replay,
        [field]: value,
      } as unknown as ReplayData;

      expect(() => replayGame(incompatible)).toThrow();
    },
  );

  it("never writes derived tick, speed, or pause commands to replay", () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageSaveRepository(storage);
    repository.save(createSaveFile(advanceTicks(createWorld(config), 5)));
    const serialized = storage.values.get("retto:save") ?? "";
    const replay = JSON.parse(serialized).replay;

    expect(replay.externalInputs).toEqual([]);
    expect(serialized).not.toContain('"kind":"tick"');
    expect(replay).not.toHaveProperty("speed");
    expect(replay).not.toHaveProperty("paused");
  });

  it("rejects corrupt and incompatible saves without returning state", () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageSaveRepository(storage);
    storage.setItem("retto:save", "{not-json");
    expect(() => repository.load()).toThrow("not valid JSON");

    const incompatible = createSaveFile(createWorld(config)) as unknown as {
      saveSchemaVersion: number;
    };
    incompatible.saveSchemaVersion = 2;
    storage.setItem("retto:save", JSON.stringify(incompatible));
    expect(() => repository.load()).toThrow();

    const inconsistent = createSaveFile(createWorld(config));
    const polity = inconsistent.snapshot.polities["polity:JP-01"];
    expect(polity).toBeDefined();
    if (!polity) throw new Error("Expected polity");
    storage.setItem(
      "retto:save",
      JSON.stringify({
        ...inconsistent,
        snapshot: {
          ...inconsistent.snapshot,
          polities: {
            ...inconsistent.snapshot.polities,
            [polity.id]: { ...polity, treasury: polity.treasury + 1 },
          },
        },
      }),
    );
    expect(() => repository.load()).toThrow("does not match");
  });
});
