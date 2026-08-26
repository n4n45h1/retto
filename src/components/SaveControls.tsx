interface SaveControlsProps {
  hasSave: boolean;
  status: string | null;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
}

export function SaveControls({
  hasSave,
  status,
  onSave,
  onLoad,
  onNewGame,
}: SaveControlsProps) {
  return (
    <div className="save-controls">
      <button type="button" onClick={onSave}>
        <span aria-hidden="true">▣</span> SAVE
      </button>
      <button type="button" disabled={!hasSave} onClick={onLoad}>
        <span aria-hidden="true">▤</span> LOAD
      </button>
      <button type="button" onClick={onNewGame}>
        <span aria-hidden="true">↺</span> NEW GAME
      </button>
      <span className="save-status" role="status">
        {status}
      </span>
    </div>
  );
}
