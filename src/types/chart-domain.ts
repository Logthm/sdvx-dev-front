/** A position on the VOX timing grid: [measure, beat, cell]. */
export type TimePosition = [
  measure: number,
  beat: number,
  cell: number,
];

export type BtTrackName = "BT-A" | "BT-B" | "BT-C" | "BT-D";
export type FxTrackName = "FX-L" | "FX-R";
export type LaserTrackName = "LASER-L" | "LASER-R";
export type ButtonTrackName = BtTrackName | FxTrackName;
export type TrackName = ButtonTrackName | LaserTrackName;

const TRACK_NAMES: ReadonlySet<string> = new Set<TrackName>([
  "BT-A",
  "BT-B",
  "BT-C",
  "BT-D",
  "FX-L",
  "FX-R",
  "LASER-L",
  "LASER-R",
]);

const BUTTON_TRACK_NAMES: ReadonlySet<string> = new Set<ButtonTrackName>([
  "BT-A",
  "BT-B",
  "BT-C",
  "BT-D",
  "FX-L",
  "FX-R",
]);

export function parseTrackName(value: string): TrackName | null {
  return TRACK_NAMES.has(value) ? (value as TrackName) : null;
}

export function isButtonTrackName(value: string): value is ButtonTrackName {
  return BUTTON_TRACK_NAMES.has(value);
}

export function isLaserTrackName(value: string): value is LaserTrackName {
  return value === "LASER-L" || value === "LASER-R";
}

export function compareTimePositions(
  left: TimePosition,
  right: TimePosition,
): number {
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] - right[1];
  return left[2] - right[2];
}
