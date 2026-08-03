import type {
  ButtonTrackName,
  LaserTrackName,
  TimePosition,
  TrackName,
} from "./chart-domain";

export interface BpmEntry {
  measure: number;
  beat: number;
  cell: number;
  bpm: number;
}

export interface BeatEntry {
  measure: number;
  beat: number;
  cell: number;
  numerator: number;
  denominator: number;
}

export interface TimePosObj {
  measure: number;
  beat: number;
  cell: number;
}

export interface ButtonEvent {
  type: "button";
  track_name: ButtonTrackName;
  time: TimePosition;
  hold_len: number;
  /** Optional VOX override for the HOLD judgement-point grid step. */
  step_param?: number;
}

export interface LaserEvent {
  type: "laser";
  track_name: LaserTrackName;
  time: TimePosition;
  offset: number;
  flag: number; // 0=relay, 1=start, 2=terminate
  is_out_of_bounds: boolean;
}

export type ChartEvent = ButtonEvent | LaserEvent;

export interface ChartData {
  format_version: number;
  beat_resolution: number | null;
  bpm_info: BpmEntry[];
  beat_info: BeatEntry[];
  end_position: TimePosObj | null;
  max_measure: number;
  tracks: Record<string, ChartEvent[]>;
}

/** Timing-only subset of ChartData — no track/note information. */
export interface ChartTimingData {
  format_version: number;
  beat_resolution: number | null;
  bpm_info: BpmEntry[];
  beat_info: BeatEntry[];
  end_position: TimePosObj | null;
  max_measure: number;
}

// Track layout constants
export const TRACK_NAMES: Record<number, TrackName> = {
  1: "LASER-L",
  2: "FX-L",
  3: "BT-A",
  4: "BT-B",
  5: "BT-C",
  6: "BT-D",
  7: "FX-R",
  8: "LASER-R",
};

export const LASER_TRACKS = new Set([1, 8]);
export const FX_TRACKS = new Set([2, 7]);
export const BT_TRACKS = new Set([3, 4, 5, 6]);
