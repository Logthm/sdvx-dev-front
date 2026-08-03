import { describe, expect, it } from "vitest";
import {
  compareTimePositions,
  isButtonTrackName,
  isLaserTrackName,
  parseTrackName,
  type TimePosition,
} from "./chart-domain";

describe("chart time positions", () => {
  it("sorts positions chronologically across measures, beats, and cells", () => {
    const positions: TimePosition[] = [
      [2, 1, 0],
      [1, 2, 0],
      [1, 1, 24],
      [1, 1, 0],
    ];

    expect([...positions].sort(compareTimePositions)).toEqual([
      [1, 1, 0],
      [1, 1, 24],
      [1, 2, 0],
      [2, 1, 0],
    ]);
  });
});

describe("chart track names", () => {
  it("parses backend track names into their domain categories", () => {
    expect(parseTrackName("BT-C")).toBe("BT-C");
    expect(parseTrackName("LASER-R")).toBe("LASER-R");
    expect(parseTrackName("BT-Z")).toBeNull();

    expect(isButtonTrackName("FX-L")).toBe(true);
    expect(isButtonTrackName("LASER-L")).toBe(false);
    expect(isLaserTrackName("LASER-L")).toBe(true);
    expect(isLaserTrackName("BT-A")).toBe(false);
  });
});
