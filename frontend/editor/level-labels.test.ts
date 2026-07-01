import { describe, expect, test } from "bun:test";

import { buildLevelOptions, CLASSIC_LEVEL_ID, labelForLevelId } from "./level-labels.ts";

describe("level labels", () => {
  test("classic gets a fixed friendly name", () => {
    const options = buildLevelOptions([CLASSIC_LEVEL_ID, "abc123"], {});
    expect(options[0]).toEqual({ id: CLASSIC_LEVEL_ID, label: "Classic" });
  });

  test("unnamed custom levels get numbered fallbacks", () => {
    const options = buildLevelOptions(["uuid-one", "uuid-two"], {});
    expect(options.map((o) => o.label)).toEqual(["Custom maze", "Custom maze 2"]);
  });

  test("remembered labels override uuid display", () => {
    const labels = { "uuid-one": "Generated 41×41 · seed 1" };
    expect(labelForLevelId("uuid-one", labels)).toBe("Generated 41×41 · seed 1");
  });
});
