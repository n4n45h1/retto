import { z } from "zod";
import {
  assertGameState,
  type ExternalInput,
  type ExternalInputRecord,
  type GameState,
  type PolityId,
} from "../game";

export const SAVE_SCHEMA_VERSION = 1 as const;
export const RULESET_VERSION = "retto-day1-v1" as const;
export const RNG_VERSION = 1 as const;

const safeInteger = z.number().int().safe();
const nonNegativeInteger = safeInteger.nonnegative();
const prefectureIdSchema = z.string().regex(/^JP-(0[1-9]|[1-3][0-9]|4[0-7])$/);
const polityIdSchema = z.custom<PolityId>(
  (value) =>
    typeof value === "string" &&
    /^polity:JP-(0[1-9]|[1-3][0-9]|4[0-7])$/.test(value),
);
const governmentIdSchema = z
  .string()
  .regex(/^government:JP-(0[1-9]|[1-3][0-9]|4[0-7]):1$/);
const regionIdSchema = z
  .string()
  .regex(/^region:JP-(0[1-9]|[1-3][0-9]|4[0-7])$/);
const payloadValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const payloadSchema = z.record(z.string(), payloadValueSchema);

const initialConfigInputSchema = z
  .object({
    kind: z.literal("initial-config"),
    seed: z.string().min(1),
    playerPolityId: polityIdSchema,
  })
  .strict();

const acceptedExternalInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("player-command"),
      commandId: z.string(),
      payload: payloadSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("external-decision"),
      decisionId: z.string(),
      actorPolityId: polityIdSchema,
      basedOnStateVersion: nonNegativeInteger,
      payload: payloadSchema,
    })
    .strict(),
]);

const initialInputRecordSchema = z
  .object({
    appliedTick: z.literal(0),
    sequence: z.literal(0),
    input: initialConfigInputSchema,
  })
  .strict();

const acceptedInputRecordSchema = z
  .object({
    appliedTick: nonNegativeInteger,
    sequence: nonNegativeInteger,
    input: acceptedExternalInputSchema,
  })
  .strict();

const metadataSchema = z
  .object({
    saveSchemaVersion: z.literal(SAVE_SCHEMA_VERSION),
    rulesetVersion: z.literal(RULESET_VERSION),
    rngVersion: z.literal(RNG_VERSION),
    stateVersion: nonNegativeInteger,
    worldSeed: z.string().min(1),
  })
  .strict();

const politySchema = z
  .object({
    id: polityIdSchema,
    revision: nonNegativeInteger,
    name: z.string(),
    governmentId: governmentIdSchema,
    treasury: nonNegativeInteger,
  })
  .strict();

const governmentSchema = z
  .object({
    id: governmentIdSchema,
    revision: nonNegativeInteger,
    polityId: polityIdSchema,
    name: z.string(),
    establishedTick: nonNegativeInteger,
  })
  .strict();

const metricsSchema = z
  .object({
    population: nonNegativeInteger,
    gdp: nonNegativeInteger,
    food: nonNegativeInteger,
    foodProduction: nonNegativeInteger,
    stabilityBp: nonNegativeInteger.max(10_000),
    military: nonNegativeInteger,
  })
  .strict();

const regionSchema = z
  .object({
    id: regionIdSchema,
    revision: nonNegativeInteger,
    prefectureId: prefectureIdSchema,
    ownerPolityId: polityIdSchema,
    controllerPolityId: polityIdSchema,
    metrics: metricsSchema,
  })
  .strict();

const causeSchema = z
  .object({
    type: z.enum(["rule", "event", "external-input"]),
    id: z.string(),
  })
  .strict();

const eventSchema = z
  .object({
    id: z.string(),
    sequence: nonNegativeInteger,
    tick: nonNegativeInteger,
    type: z.enum([
      "FoodShortageDetected",
      "PrototypeEmergencyProcurement",
      "EmergencyTax",
      "Stabilize",
      "Invest",
    ]),
    actorPolityId: polityIdSchema,
    regionId: regionIdSchema,
    causes: z.array(causeSchema),
    effects: z.array(z.string()),
    visibility: z.literal("public"),
    importance: nonNegativeInteger.max(100),
  })
  .strict();

const gameStateSchema = z
  .object({
    metadata: metadataSchema,
    tick: nonNegativeInteger,
    date: z.string(),
    playerPolityId: polityIdSchema,
    polities: z.record(z.string(), politySchema),
    governments: z.record(z.string(), governmentSchema),
    regions: z.record(z.string(), regionSchema),
    events: z.array(eventSchema),
    externalInputs: z
      .tuple([initialInputRecordSchema])
      .rest(acceptedInputRecordSchema),
  })
  .strict()
  .transform((state) => state as unknown as GameState);

export type AcceptedExternalInputRecord = ExternalInputRecord & {
  readonly input: Exclude<ExternalInput, { kind: "initial-config" }>;
};

export interface ReplayData {
  readonly saveSchemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly rulesetVersion: typeof RULESET_VERSION;
  readonly rngVersion: typeof RNG_VERSION;
  readonly initialConfig: Extract<ExternalInput, { kind: "initial-config" }>;
  readonly externalInputs: readonly AcceptedExternalInputRecord[];
  readonly finalTick: number;
}

export interface SaveFile {
  readonly saveSchemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly rulesetVersion: typeof RULESET_VERSION;
  readonly rngVersion: typeof RNG_VERSION;
  readonly snapshot: GameState;
  readonly replay: ReplayData;
}

export const replaySchema: z.ZodType<ReplayData> = z
  .object({
    saveSchemaVersion: z.literal(SAVE_SCHEMA_VERSION),
    rulesetVersion: z.literal(RULESET_VERSION),
    rngVersion: z.literal(RNG_VERSION),
    initialConfig: initialConfigInputSchema,
    externalInputs: z.array(acceptedInputRecordSchema),
    finalTick: nonNegativeInteger,
  })
  .strict();

export const saveFileSchema: z.ZodType<SaveFile> = z
  .object({
    saveSchemaVersion: z.literal(SAVE_SCHEMA_VERSION),
    rulesetVersion: z.literal(RULESET_VERSION),
    rngVersion: z.literal(RNG_VERSION),
    snapshot: gameStateSchema,
    replay: replaySchema,
  })
  .strict();

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateSaveFile(value: unknown): SaveFile {
  const save = saveFileSchema.parse(value);
  assertGameState(save.snapshot);

  const initialRecord = save.snapshot.externalInputs[0];
  if (
    save.snapshot.metadata.saveSchemaVersion !== save.saveSchemaVersion ||
    save.snapshot.metadata.rulesetVersion !== save.rulesetVersion ||
    save.snapshot.metadata.rngVersion !== save.rngVersion ||
    save.replay.saveSchemaVersion !== save.saveSchemaVersion ||
    save.replay.rulesetVersion !== save.rulesetVersion ||
    save.replay.rngVersion !== save.rngVersion ||
    save.snapshot.metadata.worldSeed !== save.replay.initialConfig.seed ||
    save.snapshot.playerPolityId !== save.replay.initialConfig.playerPolityId ||
    save.snapshot.tick !== save.replay.finalTick ||
    !initialRecord ||
    !sameJson(initialRecord.input, save.replay.initialConfig) ||
    !sameJson(save.snapshot.externalInputs.slice(1), save.replay.externalInputs)
  ) {
    throw new Error("Save snapshot and replay metadata are inconsistent");
  }

  let previousTick = 0;
  for (const [index, record] of save.replay.externalInputs.entries()) {
    if (
      record.sequence !== index + 1 ||
      record.appliedTick < previousTick ||
      record.appliedTick > save.replay.finalTick
    ) {
      throw new Error("Replay input ordering is invalid");
    }
    previousTick = record.appliedTick;
  }

  return save;
}
