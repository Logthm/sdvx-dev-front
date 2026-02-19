import type { ButtonEvent, ChartData, ChartEvent, LaserEvent, TimePos } from "@/types/chart";
import type { TimeMapper, Time3 } from "./chart-renderer/time-mapper";

export interface EditFlags {
  simplifyLasers: boolean;
}

export const DEFAULT_EDIT_FLAGS: EditFlags = {
  simplifyLasers: false,
};

/** Recompute chartData from original by applying all active edit flags. */
export function applyEdits(original: ChartData, flags: EditFlags): ChartData {
  let data = original;
  if (flags.simplifyLasers) data = simplifyLasers(data);
  return data;
}

/** Remove intermediate relay points within same-direction runs of each laser segment. */
export function simplifyLasers(chartData: ChartData): ChartData {
  const newTracks: Record<string, ChartEvent[]> = {};

  for (const [trackName, events] of Object.entries(chartData.tracks)) {
    if (trackName !== "1" && trackName !== "8") {
      newTracks[trackName] = events;
      continue;
    }

    const simplified: LaserEvent[] = [];
    let segment: LaserEvent[] = [];

    for (const event of events as LaserEvent[]) {
      segment.push(event);
      if (event.flag === 2) {
        simplified.push(...simplifySegment(segment));
        segment = [];
      }
    }
    if (segment.length > 0) simplified.push(...segment);

    newTracks[trackName] = simplified;
  }

  return { ...chartData, tracks: newTracks };
}

function simplifySegment(segment: LaserEvent[]): LaserEvent[] {
  if (segment.length <= 2) return segment;

  const result: LaserEvent[] = [segment[0]];
  let lastDir = 0;
  let lastKeptIdx = 0;

  for (let i = 1; i < segment.length; i++) {
    const dir = Math.sign(segment[i].offset - segment[i - 1].offset);

    if (dir !== lastDir) {
      if (i - 1 !== lastKeptIdx) {
        result.push(segment[i - 1]);
        lastKeptIdx = i - 1;
      }
    }
    lastDir = dir;
  }

  const lastIdx = segment.length - 1;
  if (lastKeptIdx !== lastIdx) {
    result.push(segment[lastIdx]);
  }

  return result;
}

// ── Point mutation helpers ───────────────────────────────────────

export function moveLaserPoint(
  chartData: ChartData, track: string, index: number,
  newTime: TimePos, newOffset: number,
): ChartData {
  const events = [...(chartData.tracks[track] ?? [])];
  const ev = events[index] as LaserEvent;
  events[index] = { ...ev, time: newTime, offset: Math.max(0, Math.min(1, newOffset)) };
  return { ...chartData, tracks: { ...chartData.tracks, [track]: events } };
}

export function deleteLaserPoint(
  chartData: ChartData, track: string, index: number,
): ChartData {
  const events = [...(chartData.tracks[track] ?? [])];
  events.splice(index, 1);
  return { ...chartData, tracks: { ...chartData.tracks, [track]: events } };
}

// ── Button mutation helpers ──────────────────────────────────────

export function moveButtonEvent(
  chartData: ChartData, track: string, index: number, newTime: TimePos,
): ChartData {
  const events = [...(chartData.tracks[track] ?? [])];
  const ev = events[index] as ButtonEvent;
  events[index] = { ...ev, time: newTime };
  return { ...chartData, tracks: { ...chartData.tracks, [track]: events } };
}

export function deleteButtonEvent(
  chartData: ChartData, track: string, index: number,
): ChartData {
  const events = [...(chartData.tracks[track] ?? [])];
  events.splice(index, 1);
  return { ...chartData, tracks: { ...chartData.tracks, [track]: events } };
}

export function addButtonEvent(
  chartData: ChartData, trackNum: number, event: ButtonEvent,
): ChartData {
  const key = String(trackNum);
  const events = [...(chartData.tracks[key] ?? []), event];
  events.sort((a, b) => {
    const ta = a.time, tb = b.time;
    return ta[0] - tb[0] || ta[1] - tb[1] || ta[2] - tb[2];
  });
  return { ...chartData, tracks: { ...chartData.tracks, [key]: events } };
}

// ── Interval calculation ─────────────────────────────────────────

const WHOLE_UNITS = 192;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Calculate the interval between two Time3 positions.
 * Returns milliseconds and musical notation (e.g., "1/16", "1/24").
 */
export function calculateInterval(
  time1: Time3,
  time2: Time3,
  timeMapper: TimeMapper,
  beatResolution: number | null,
): { ms: number; notation: string } {
  const sec1 = timeMapper.secondsOf(time1);
  const sec2 = timeMapper.secondsOf(time2);
  const ms = Math.abs(sec2 - sec1) * 1000;

  // Calculate units difference
  const [m1, b1, c1] = time1;
  const [m2, b2, c2] = time2;

  // Get time signature at the first time
  const timeSig = timeMapper.getTimeSigAt(time1);
  const [, denominator] = timeSig;

  // Calculate units per beat
  const unitsPerBeat = beatResolution ?? (WHOLE_UNITS / denominator);

  // Convert both times to total units
  const totalUnits1 = ((m1 - 1) * timeSig[0] + (b1 - 1)) * unitsPerBeat + c1;
  const totalUnits2 = ((m2 - 1) * timeSig[0] + (b2 - 1)) * unitsPerBeat + c2;
  const unitsDiff = Math.abs(totalUnits2 - totalUnits1);

  // Express as fraction of whole note
  if (unitsDiff === 0) {
    return { ms, notation: "0" };
  }

  const divisor = gcd(WHOLE_UNITS, unitsDiff);
  const numerator = unitsDiff / divisor;
  const denomFraction = WHOLE_UNITS / divisor;

  if (numerator === 1) {
    return { ms, notation: `1/${denomFraction}` };
  }

  return { ms, notation: `${numerator}/${denomFraction}` };
}
