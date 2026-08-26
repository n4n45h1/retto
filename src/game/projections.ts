import { PREFECTURES } from "../data/prefectures";
import type { GameState, GovernmentId, PolityId, RegionMetrics } from "./types";

export interface PolityProjection {
  readonly id: PolityId;
  readonly revision: number;
  readonly name: string;
  readonly governmentId: GovernmentId;
  readonly governmentRevision: number;
  readonly governmentName: string;
  readonly treasury: number;
}

export interface RegionProjection {
  readonly id: string;
  readonly revision: number;
  readonly prefectureId: string;
  readonly name: string;
  readonly ownerPolityId: PolityId;
  readonly controllerPolityId: PolityId;
  readonly metrics: RegionMetrics;
}

export interface GameProjection {
  readonly stateVersion: number;
  readonly tick: number;
  readonly date: string;
  readonly playerPolityId: PolityId;
  readonly polities: readonly PolityProjection[];
  readonly regions: readonly RegionProjection[];
  readonly recentEvents: GameState["events"];
}

export function projectGameState(
  state: GameState,
  recentEventLimit = 100,
): GameProjection {
  if (!Number.isSafeInteger(recentEventLimit) || recentEventLimit < 0)
    throw new Error("Invalid event limit");
  return {
    stateVersion: state.metadata.stateVersion,
    tick: state.tick,
    date: state.date,
    playerPolityId: state.playerPolityId,
    polities: PREFECTURES.map((prefecture) => {
      const polity = state.polities[`polity:${prefecture.id}`];
      if (!polity) throw new Error(`Missing polity ${prefecture.id}`);
      const government = state.governments[polity.governmentId];
      if (!government)
        throw new Error(`Missing government ${polity.governmentId}`);
      return {
        id: polity.id,
        revision: polity.revision,
        name: polity.name,
        governmentId: government.id,
        governmentRevision: government.revision,
        governmentName: government.name,
        treasury: polity.treasury,
      };
    }),
    regions: PREFECTURES.map((prefecture) => {
      const region = state.regions[`region:${prefecture.id}`];
      if (!region) throw new Error(`Missing region ${prefecture.id}`);
      return {
        id: region.id,
        revision: region.revision,
        prefectureId: prefecture.id,
        name: prefecture.name,
        ownerPolityId: region.ownerPolityId,
        controllerPolityId: region.controllerPolityId,
        metrics: { ...region.metrics },
      };
    }),
    recentEvents: state.events.slice(-recentEventLimit),
  };
}
