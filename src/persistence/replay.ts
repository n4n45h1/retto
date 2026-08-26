import {
  advanceTicks,
  createWorld,
  type GameState,
  recordAcceptedExternalInput,
} from "../game";
import { type ReplayData, replaySchema } from "./schema";

export function replayGame(value: ReplayData): GameState {
  const replay = replaySchema.parse(value);
  let state = createWorld({
    seed: replay.initialConfig.seed,
    playerPolityId: replay.initialConfig.playerPolityId,
  });

  for (const record of replay.externalInputs) {
    if (record.appliedTick < state.tick) {
      throw new Error("Replay inputs are not ordered by applied tick");
    }
    state = advanceTicks(state, record.appliedTick - state.tick);
    state = recordAcceptedExternalInput(state, record.input);
    const accepted = state.externalInputs.at(-1);
    if (accepted?.sequence !== record.sequence) {
      throw new Error("Replay input sequence is invalid");
    }
  }

  if (replay.finalTick < state.tick) {
    throw new Error("Replay final tick precedes an external input");
  }
  return advanceTicks(state, replay.finalTick - state.tick);
}
