import type { PrefectureId } from "../data/prefectures.schema";

export type PolityId = `polity:${PrefectureId}`;
export type GovernmentId = `government:${PrefectureId}:1`;
export type RegionId = `region:${PrefectureId}`;

export interface GameMetadata {
  readonly saveSchemaVersion: 1;
  readonly rulesetVersion: "retto-day1-v1";
  readonly rngVersion: 1;
  readonly stateVersion: number;
  readonly worldSeed: string;
}

export interface Polity {
  readonly id: PolityId;
  readonly revision: number;
  readonly name: string;
  readonly governmentId: GovernmentId;
  readonly treasury: number;
}

export interface Government {
  readonly id: GovernmentId;
  readonly revision: number;
  readonly polityId: PolityId;
  readonly name: string;
  readonly establishedTick: number;
}

export interface RegionMetrics {
  readonly population: number;
  readonly gdp: number;
  readonly food: number;
  readonly foodProduction: number;
  readonly stabilityBp: number;
  readonly military: number;
}

export interface Region {
  readonly id: RegionId;
  readonly revision: number;
  readonly prefectureId: PrefectureId;
  readonly ownerPolityId: PolityId;
  readonly controllerPolityId: PolityId;
  readonly metrics: RegionMetrics;
}

export interface CauseRef {
  readonly type: "rule" | "event" | "external-input";
  readonly id: string;
}

export interface GameEvent {
  readonly id: string;
  readonly sequence: number;
  readonly tick: number;
  readonly type:
    | "FoodShortageDetected"
    | "PrototypeEmergencyProcurement"
    | "EmergencyTax"
    | "Stabilize"
    | "Invest";
  readonly actorPolityId: PolityId;
  readonly regionId: RegionId;
  readonly causes: readonly CauseRef[];
  /** Descriptive summaries only; StateTransaction changes are authoritative. */
  readonly effects: readonly string[];
  readonly visibility: "public";
  readonly importance: number;
}

export interface InitialWorldConfig {
  readonly seed: string | number;
  readonly playerPolityId: PolityId;
}

export type ExternalInput =
  | {
      readonly kind: "initial-config";
      readonly seed: string;
      readonly playerPolityId: PolityId;
    }
  | {
      readonly kind: "player-command";
      readonly commandId: string;
      readonly payload: Readonly<Record<string, string | number | boolean>>;
    }
  | {
      readonly kind: "external-decision";
      readonly decisionId: string;
      readonly actorPolityId: PolityId;
      readonly basedOnStateVersion: number;
      readonly payload: Readonly<Record<string, string | number | boolean>>;
    };

export interface ExternalInputRecord {
  readonly appliedTick: number;
  readonly sequence: number;
  readonly input: ExternalInput;
}

export interface GameState {
  readonly metadata: GameMetadata;
  readonly tick: number;
  readonly date: string;
  readonly playerPolityId: PolityId;
  readonly polities: Readonly<Record<PolityId, Polity>>;
  readonly governments: Readonly<Record<GovernmentId, Government>>;
  readonly regions: Readonly<Record<RegionId, Region>>;
  readonly events: readonly GameEvent[];
  readonly externalInputs: readonly ExternalInputRecord[];
}

export type StateChange =
  | {
      readonly type: "set-region-metrics";
      readonly regionId: RegionId;
      readonly metrics: RegionMetrics;
    }
  | {
      readonly type: "set-polity-treasury";
      readonly polityId: PolityId;
      readonly treasury: number;
    }
  | {
      readonly type: "advance-day";
      readonly fromTick: number;
      readonly toTick: number;
      readonly date: string;
    }
  | {
      readonly type: "append-external-input";
      readonly record: ExternalInputRecord;
    };

export interface StateTransaction {
  readonly id: string;
  readonly baseStateVersion: number;
  readonly source: CauseRef;
  readonly changes: readonly StateChange[];
  readonly events: readonly GameEvent[];
}
