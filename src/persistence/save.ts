import type { GameState } from "../game";
import {
  type AcceptedExternalInputRecord,
  RNG_VERSION,
  RULESET_VERSION,
  SAVE_SCHEMA_VERSION,
  type SaveFile,
  validateSaveFile,
} from "./schema";

export function createSaveFile(state: GameState): SaveFile {
  const initialRecord = state.externalInputs[0];
  if (initialRecord?.input.kind !== "initial-config") {
    throw new Error("Game state has no initial configuration");
  }

  return validateSaveFile({
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    rngVersion: RNG_VERSION,
    snapshot: state,
    replay: {
      saveSchemaVersion: SAVE_SCHEMA_VERSION,
      rulesetVersion: RULESET_VERSION,
      rngVersion: RNG_VERSION,
      initialConfig: initialRecord.input,
      externalInputs: state.externalInputs.slice(
        1,
      ) as readonly AcceptedExternalInputRecord[],
      finalTick: state.tick,
    },
  });
}
