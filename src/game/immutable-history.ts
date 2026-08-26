import type { ExternalInput, ExternalInputRecord } from "./types";

function cloneAndFreezeExternalInput(input: ExternalInput): ExternalInput {
  if (input.kind === "initial-config") {
    return Object.freeze({ ...input });
  }
  return Object.freeze({
    ...input,
    payload: Object.freeze({ ...input.payload }),
  });
}

export function cloneAndFreezeExternalInputRecord(
  record: ExternalInputRecord,
): ExternalInputRecord {
  return Object.freeze({
    ...record,
    input: cloneAndFreezeExternalInput(record.input),
  });
}
