export type SimulationSpeed = 0 | 1 | 5 | 20;

interface TimeControlsProps {
  speed: SimulationSpeed;
  onChange: (speed: SimulationSpeed) => void;
}

const speeds = [
  { value: 0, icon: "Ⅱ", label: "PAUSE" },
  { value: 1, icon: "▶", label: "x1" },
  { value: 5, icon: "▶▶", label: "x5" },
  { value: 20, icon: "▶▶▶", label: "x20" },
] as const;

export function TimeControls({ speed, onChange }: TimeControlsProps) {
  return (
    <fieldset className="time-controls">
      <legend className="visually-hidden">シミュレーション速度</legend>
      {speeds.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={speed === option.value}
          onClick={() => onChange(option.value)}
        >
          <span className="control-icon" aria-hidden="true">
            {option.icon}
          </span>
          <span>{option.label}</span>
        </button>
      ))}
    </fieldset>
  );
}
