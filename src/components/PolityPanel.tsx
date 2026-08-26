import type { CSSProperties } from "react";
import type { PolityProjection, RegionProjection } from "../game";

interface PolityPanelProps {
  polity: PolityProjection;
  region: RegionProjection;
  isPlayer: boolean;
  displayName: string;
}

const number = new Intl.NumberFormat("ja-JP");

export function PolityPanel({
  polity,
  region,
  isPlayer,
  displayName,
}: PolityPanelProps) {
  const metrics = region.metrics;
  return (
    <section className="polity-panel" aria-labelledby="polity-title">
      <div className="polity-header">
        <span className="polity-emblem" aria-hidden="true">
          {displayName.slice(0, 1)}
        </span>
        <div>
          <div className="panel-kicker">
            {isPlayer ? "// PLAYER STATE //" : "// STATE DATA //"}
          </div>
          <h2 id="polity-title">{displayName}</h2>
        </div>
      </div>
      <p className="government-name">{displayName}政府</p>
      <dl className="metric-grid">
        <div>
          <dt>人口</dt>
          <dd>{number.format(metrics.population)}</dd>
        </div>
        <div>
          <dt>GDP</dt>
          <dd>{number.format(metrics.gdp)}</dd>
        </div>
        <div>
          <dt>資金</dt>
          <dd>{number.format(polity.treasury)}</dd>
        </div>
        <div>
          <dt>食料</dt>
          <dd>{number.format(metrics.food)}</dd>
        </div>
        <div>
          <dt>安定度</dt>
          <dd>{(metrics.stabilityBp / 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt>軍事力</dt>
          <dd>{number.format(metrics.military)}</dd>
        </div>
      </dl>
      <div className="status-meter">
        <div className="status-meter__label">
          <span>STABILITY</span>
          <strong>{(metrics.stabilityBp / 100).toFixed(1)}%</strong>
        </div>
        <div
          className="status-meter__track"
          style={
            { "--meter": `${metrics.stabilityBp / 100}%` } as CSSProperties
          }
        >
          <span />
        </div>
      </div>
      <div className="territory-status">
        <span>所有</span>
        <code>{region.ownerPolityId}</code>
        <span>実効支配</span>
        <code>{region.controllerPolityId}</code>
      </div>
    </section>
  );
}
