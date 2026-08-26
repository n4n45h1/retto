import { applyStateTransaction } from "./transaction";
import type { ExternalInput, GameState, StateTransaction } from "./types";

export function recordAcceptedExternalInput(
  state: GameState,
  input: Exclude<ExternalInput, { kind: "initial-config" }>,
): GameState {
  if (
    input.kind === "external-decision" &&
    input.basedOnStateVersion !== state.metadata.stateVersion
  ) {
    throw new Error("Stale external decision");
  }
  const sequence = (state.externalInputs.at(-1)?.sequence ?? -1) + 1;
  const id =
    input.kind === "player-command" ? input.commandId : input.decisionId;
  const transaction: StateTransaction = {
    id: `transaction:external-input:${sequence}:${id}`,
    baseStateVersion: state.metadata.stateVersion,
    source: { type: "external-input", id },
    changes: [
      {
        type: "append-external-input",
        record: { appliedTick: state.tick, sequence, input },
      },
    ],
    events: [],
  };
  return applyStateTransaction(state, transaction);
}
