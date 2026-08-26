import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import mapData from "../data/maps/prefectures.json";
import { isSelectionKey, PrefectureMap } from "./PrefectureMap";

describe("prefecture map asset", () => {
  it("contains exactly the 47 stable JIS prefecture IDs", () => {
    expect(mapData.features).toHaveLength(47);
    expect(mapData.features.map(({ id }) => id)).toEqual(
      Array.from(
        { length: 47 },
        (_, index) => `jp-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(mapData.features.every(({ path }) => path.length > 0)).toBe(true);
  });

  it("renders every prefecture as a labelled selectable control", () => {
    const markup = renderToStaticMarkup(
      <PrefectureMap selectedId="jp-13" onSelect={() => undefined} />,
    );
    expect(markup.match(/role="button"/g)).toHaveLength(47);
    expect(markup).toContain('id="jp-13"');
    expect(markup).toContain('aria-pressed="true"');
  });

  it("accepts Enter and Space as selection keys", () => {
    expect(isSelectionKey("Enter")).toBe(true);
    expect(isSelectionKey(" ")).toBe(true);
    expect(isSelectionKey("ArrowRight")).toBe(false);
  });
});
