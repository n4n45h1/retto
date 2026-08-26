import { replayGame } from "./replay";
import type { SaveFile } from "./schema";
import { validateSaveFile } from "./schema";

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (
      nested === null ||
      typeof nested !== "object" ||
      Array.isArray(nested)
    ) {
      return nested;
    }
    return Object.fromEntries(
      Object.entries(nested).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  });
}

export interface SaveRepository {
  save(save: SaveFile): void;
  load(): SaveFile | null;
  remove(): void;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageSaveRepository implements SaveRepository {
  constructor(
    private readonly storage: StorageLike,
    private readonly key = "retto:save",
  ) {}

  save(save: SaveFile): void {
    const validated = validateSaveFile(save);
    this.storage.setItem(this.key, JSON.stringify(validated));
  }

  load(): SaveFile | null {
    const serialized = this.storage.getItem(this.key);
    if (serialized === null) return null;

    let value: unknown;
    try {
      value = JSON.parse(serialized);
    } catch {
      throw new Error("Stored save is not valid JSON");
    }
    const save = validateSaveFile(value);
    if (
      canonicalJson(replayGame(save.replay)) !== canonicalJson(save.snapshot)
    ) {
      throw new Error("Save snapshot does not match its deterministic replay");
    }
    return save;
  }

  remove(): void {
    this.storage.removeItem(this.key);
  }
}
