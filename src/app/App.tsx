import { useEffect, useState } from "react";
import { EventLog } from "../components/EventLog";
import { NewGamePanel } from "../components/NewGamePanel";
import { PolityPanel } from "../components/PolityPanel";
import { SaveControls } from "../components/SaveControls";
import { type SimulationSpeed, TimeControls } from "../components/TimeControls";
import {
  advanceOneTick,
  createWorld,
  type GameState,
  type PolityId,
  projectGameState,
} from "../game";
import {
  getPoliticalColor,
  getPrefectureName,
  type PrefectureId,
  PrefectureMap,
} from "../map";
import { createSaveFile, LocalStorageSaveRepository } from "../persistence";

function createSeed(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(36)).join("-");
}

function toPolityId(id: PrefectureId): PolityId {
  return `polity:JP-${id.slice(3)}` as PolityId;
}

function toMapId(prefectureId: string): PrefectureId {
  return `jp-${prefectureId.slice(-2)}` as PrefectureId;
}

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedId, setSelectedId] = useState<PrefectureId | null>("jp-13");
  const [seed, setSeed] = useState(createSeed);
  const [speed, setSpeed] = useState<SimulationSpeed>(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState(
    () => window.localStorage.getItem("retto:save") !== null,
  );
  const [mapMode, setMapMode] = useState<"political" | "stability">(
    "political",
  );

  useEffect(() => {
    if (speed === 0) return;
    const timer = window.setInterval(() => {
      setGame((current) => (current ? advanceOneTick(current) : current));
    }, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [speed]);

  const repository = new LocalStorageSaveRepository(window.localStorage);

  const loadGame = () => {
    try {
      const save = repository.load();
      if (!save) return;
      setGame(save.snapshot);
      setSelectedId(toMapId(save.snapshot.playerPolityId));
      setSpeed(0);
      setSaveStatus(`Day ${save.snapshot.tick} をロードしました`);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Load failed");
    }
  };

  if (!game) {
    return (
      <NewGamePanel
        selectedId={selectedId}
        seed={seed}
        hasSave={hasSave}
        status={saveStatus}
        onSelect={setSelectedId}
        onSeedChange={setSeed}
        onGenerateSeed={() => setSeed(createSeed())}
        onLoad={loadGame}
        onStart={() => {
          if (!selectedId || seed.trim().length === 0) return;
          setGame(
            createWorld({
              seed: seed.trim(),
              playerPolityId: toPolityId(selectedId),
            }),
          );
          setSpeed(0);
          setSaveStatus(null);
        }}
      />
    );
  }

  const projection = projectGameState(game, 120);
  const activeMapId = selectedId ?? toMapId(game.playerPolityId);
  const activeRegion = projection.regions.find(
    (region) => toMapId(region.prefectureId) === activeMapId,
  );
  const activePolity = activeRegion
    ? projection.polities.find(
        (polity) => polity.id === activeRegion.ownerPolityId,
      )
    : undefined;
  const stabilityMetrics = Object.fromEntries(
    projection.regions.map((region) => [
      toMapId(region.prefectureId),
      region.metrics.stabilityBp,
    ]),
  ) as Partial<Record<PrefectureId, number>>;

  return (
    <main className="game-shell">
      <header className="top-bar">
        <div className="brand-block">
          <span className="brand-mark">R</span>
          <div>
            <strong>RETTO</strong>
            <span className="brand-subtitle">列島シミュレーター</span>
          </div>
        </div>
        <div className="world-clock">
          <span className="world-date">{projection.date}</span>
          <strong>DAY:{String(projection.tick).padStart(4, "0")}</strong>
        </div>
        <div className="world-meta">
          <span>STATE v{projection.stateVersion}</span>
          <code>{game.metadata.worldSeed}</code>
        </div>
      </header>

      <div className="game-grid">
        <section className="world-map-panel" aria-label="世界地図">
          <div className="section-heading">
            <span>
              {mapMode === "political" ? "政治マップ" : "安定度マップ"}
            </span>
            <small>STATE SIGNAL: 47 / 47</small>
          </div>
          <PrefectureMap
            selectedId={activeMapId}
            onSelect={setSelectedId}
            metrics={stabilityMetrics}
            showLabels
            renderLabel={({ prefecture, metric }) =>
              `${prefecture.name} ${Math.round((metric ?? 0) / 100)}`
            }
            getFill={({ prefecture, metric }) => {
              if (mapMode === "political") {
                return getPoliticalColor(prefecture.code);
              }
              if ((metric ?? 0) < 4_000) return "#b6533f";
              if ((metric ?? 0) < 6_000) return "#e5bd55";
              return "#82c65d";
            }}
            renderDetails={({ prefecture, metric }) => (
              <span>
                {prefecture.name} / 安定度 {((metric ?? 0) / 100).toFixed(1)}%
              </span>
            )}
          />
          <p className="map-attribution">
            地図: 国土交通省
            <a
              href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html"
              target="_blank"
              rel="noreferrer"
            >
              国土数値情報 行政区域データ（N03・2025年版）
            </a>
            を加工。政府作成の原図ではありません。
          </p>
        </section>

        <aside className="right-rail">
          {activeRegion && activePolity ? (
            <PolityPanel
              polity={activePolity}
              region={activeRegion}
              displayName={getPrefectureName(activeRegion.prefectureId)}
              isPlayer={activePolity.id === projection.playerPolityId}
            />
          ) : null}
          <div className="legend-panel">
            <span className="legend-item">
              <i className="stable" />
              安定
            </span>
            <span className="legend-item">
              <i className="strained" />
              緊張
            </span>
            <span className="legend-item">
              <i className="critical" />
              危機
            </span>
          </div>
        </aside>

        <EventLog
          events={projection.recentEvents}
          polities={projection.polities}
        />
      </div>

      <footer className="command-bar">
        <TimeControls speed={speed} onChange={setSpeed} />
        <nav className="map-mode-controls" aria-label="地図モード">
          <button
            type="button"
            aria-pressed={mapMode === "political"}
            onClick={() => setMapMode("political")}
          >
            <span aria-hidden="true">▦</span>
            国境
          </button>
          <button
            type="button"
            aria-pressed={mapMode === "stability"}
            onClick={() => setMapMode("stability")}
          >
            <span aria-hidden="true">♢</span>
            安定度
          </button>
          <span className="toolbar-divider" aria-hidden="true" />
          <button type="button" disabled title="今後のアップデートで追加予定">
            <span aria-hidden="true">♜</span>
            政府
          </button>
          <button type="button" disabled title="今後のアップデートで追加予定">
            <span aria-hidden="true">⚑</span>
            外交
          </button>
          <button type="button" disabled title="今後のアップデートで追加予定">
            <span aria-hidden="true">◆</span>
            軍事
          </button>
          <button type="button" disabled title="今後のアップデートで追加予定">
            <span aria-hidden="true">●</span>
            経済
          </button>
          <span className="map-drag-hint">DRAG / PINCH / WHEEL</span>
        </nav>
        <SaveControls
          hasSave={hasSave}
          status={saveStatus}
          onSave={() => {
            try {
              repository.save(createSaveFile(game));
              setHasSave(true);
              setSaveStatus(`Day ${game.tick} を保存しました`);
            } catch (error) {
              setSaveStatus(
                error instanceof Error ? error.message : "Save failed",
              );
            }
          }}
          onLoad={() => {
            loadGame();
          }}
          onNewGame={() => {
            setSpeed(0);
            setGame(null);
            setSaveStatus(null);
          }}
        />
      </footer>
    </main>
  );
}
