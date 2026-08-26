import type { PrefectureId } from "../map";
import { getPoliticalColor, PrefectureMap } from "../map";

interface NewGamePanelProps {
  selectedId: PrefectureId | null;
  seed: string;
  hasSave: boolean;
  status: string | null;
  onSelect: (id: PrefectureId) => void;
  onSeedChange: (seed: string) => void;
  onGenerateSeed: () => void;
  onStart: () => void;
  onLoad: () => void;
}

export function NewGamePanel({
  selectedId,
  seed,
  hasSave,
  status,
  onSelect,
  onSeedChange,
  onGenerateSeed,
  onStart,
  onLoad,
}: NewGamePanelProps) {
  return (
    <section className="setup-shell" aria-labelledby="new-game-title">
      <header className="setup-copy">
        <div className="title-logo" aria-hidden="true">
          <span>R</span>
          <span>E</span>
          <span>T</span>
          <span>T</span>
          <span>O</span>
        </div>
        <p className="eyebrow">{"// SCENARIO 01 // YEAR 2030 //"}</p>
        <h1 id="new-game-title">分裂列島</h1>
        <p className="scenario-copy">
          中央政府の統治能力は失われ、47都道府県は独立した。最初の政府を選び、
          変わり続ける日本へ踏み出してください。
        </p>
        <div className="pixel-rule" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </header>

      <div className="setup-grid">
        <div className="map-stage">
          <div className="window-title">
            <span className="window-icon" aria-hidden="true">
              ◆
            </span>
            開始する都道府県を選択
            <span className="window-code">MAP-01</span>
          </div>
          <PrefectureMap
            selectedId={selectedId}
            onSelect={onSelect}
            showLabels
            getFill={({ prefecture }) => getPoliticalColor(prefecture.code)}
            renderLabel={({ prefecture }) => prefecture.name}
            renderDetails={({ prefecture }) => (
              <span>
                {prefecture.name} / JIS {prefecture.code}
              </span>
            )}
          />
        </div>

        <aside className="setup-controls">
          <div className="window-title">
            <span className="window-icon" aria-hidden="true">
              ⚑
            </span>
            最初の国を選ぶ
          </div>
          <div>
            <span className="field-label">選択政府</span>
            <strong className="selection-name">
              {selectedId ? `都道府県コード ${selectedId.slice(3)}` : "未選択"}
            </strong>
          </div>

          <label className="seed-field">
            <span className="field-label">WORLD SEED</span>
            <input
              value={seed}
              onChange={(event) => onSeedChange(event.target.value)}
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className="button-secondary"
            onClick={onGenerateSeed}
          >
            <span aria-hidden="true">↻</span> Seedを再生成
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={!selectedId || seed.trim().length === 0}
            onClick={onStart}
          >
            <span aria-hidden="true">▶</span> この政府で開始
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={!hasSave}
            onClick={onLoad}
          >
            <span aria-hidden="true">▤</span> 保存済み世界をロード
          </button>
          <span className="setup-status" role="status">
            {status}
          </span>
          <p className="prototype-note">
            Day 1
            prototype。数値は実在統計ではなく、seedから決定論的に生成されます。
          </p>
        </aside>
      </div>
    </section>
  );
}
