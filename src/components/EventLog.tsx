import type { GameEvent, PolityProjection } from "../game";

interface EventLogProps {
  events: readonly GameEvent[];
  polities: readonly PolityProjection[];
}

const labels: Record<GameEvent["type"], string> = {
  FoodShortageDetected: "食料不足",
  PrototypeEmergencyProcurement: "緊急食料調達（試作）",
  EmergencyTax: "緊急徴税",
  Stabilize: "国内安定化",
  Invest: "経済投資",
};

export function EventLog({ events, polities }: EventLogProps) {
  const names = new Map(polities.map((polity) => [polity.id, polity.name]));
  return (
    <section className="event-log" aria-labelledby="event-log-title">
      <header>
        <div>
          <span className="panel-kicker">WORLD FEED</span>
          <h2 id="event-log-title">通知</h2>
        </div>
        <span className="event-count">
          LOG:{String(events.length).padStart(3, "0")}
        </span>
      </header>
      {events.length === 0 ? (
        <p className="empty-log">世界はまだ静かです。時間を進めてください。</p>
      ) : (
        <ol>
          {[...events]
            .slice(-3)
            .reverse()
            .map((event) => (
              <li key={event.id}>
                <span className="event-marker" aria-hidden="true">
                  !
                </span>
                <span className="event-sequence">
                  [{String(event.tick).padStart(4, "0")}]
                </span>
                <strong>{labels[event.type]}</strong>
                <span className="event-actor">
                  {names.get(event.actorPolityId) ?? event.actorPolityId}
                </span>
                <span className="event-importance">LV.{event.importance}</span>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
