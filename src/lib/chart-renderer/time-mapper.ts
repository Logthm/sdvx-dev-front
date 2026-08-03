/**
 * TimeMapper — port of backend chart_drawer.py TimeMapper.
 *
 * Maps music-theory grid positions (measure, beat, cell) to elapsed seconds,
 * handling BPM and time-signature changes via an internal breakpoint system.
 *
 * Grid rules:
 *   - ticks per beat = beat_res * 4 / denominator
 *   - default beat_res = 48 (can be overridden via beat_resolution)
 *
 * Duration rule: beat_length = 60/bpm * (4/denominator)
 */

import type { BeatEntry, BpmEntry, ChartTimingData } from "@/types/chart";
import {
  compareTimePositions,
  type TimePosition,
} from "@/types/chart-domain";

const DEFAULT_BEAT_RESOLUTION = 48;

function unitsPerBeat(beatRes: number, denominator: number): number {
  return (beatRes * 4) / Math.max(1, denominator);
}

function timeLe(a: TimePosition, b: TimePosition): boolean {
  return compareTimePositions(a, b) <= 0;
}

interface Breakpoint {
  time: TimePosition;
  seconds: number;
  bpm: number;
  timeSig: [number, number];
}

export class TimeMapper {
  private beatInfo: Array<{ time: TimePosition; numerator: number; denominator: number }>;
  private bpmInfo: Array<{ time: TimePosition; bpm: number }>;
  private beatRes: number;
  private breakpoints: Breakpoint[];

  constructor(chartData: ChartTimingData) {
    this.beatRes = chartData.beat_resolution ?? DEFAULT_BEAT_RESOLUTION;

    this.beatInfo = chartData.beat_info
      .map((e: BeatEntry) => ({
        time: [e.measure, e.beat, e.cell] as TimePosition,
        numerator: e.numerator,
        denominator: e.denominator,
      }))
      .sort((a, b) => compareTimePositions(a.time, b.time));

    this.bpmInfo = chartData.bpm_info
      .map((e: BpmEntry) => ({
        time: [e.measure, e.beat, e.cell] as TimePosition,
        bpm: e.bpm,
      }))
      .sort((a, b) => compareTimePositions(a.time, b.time));

    this.breakpoints = this.buildBreakpoints();
  }

  private upb(denominator: number): number {
    return unitsPerBeat(this.beatRes, denominator);
  }

  getTimeSigAt(time: TimePosition): [number, number] {
    let ts: [number, number] = [4, 4];
    for (const entry of this.beatInfo) {
      if (compareTimePositions(entry.time, time) <= 0) {
        ts = [entry.numerator, entry.denominator];
      } else {
        break;
      }
    }
    return ts;
  }

  private nextTimeSigChangeAfter(
    time: TimePosition,
  ): { time: TimePosition; numerator: number; denominator: number } | null {
    for (const entry of this.beatInfo) {
      if (compareTimePositions(entry.time, time) > 0) return entry;
    }
    return null;
  }

  private buildBreakpoints(): Breakpoint[] {
    const breakpoints: Breakpoint[] = [];
    let currentSeconds = 0;
    let currentBpm = 120;
    let currentTimeSig: [number, number] = [4, 4];

    type Event = { time: TimePosition; kind: "beat" | "bpm"; value: unknown };
    const events: Event[] = [];

    for (const e of this.beatInfo) {
      events.push({
        time: e.time,
        kind: "beat",
        value: [e.numerator, e.denominator] as [number, number],
      });
    }
    for (const e of this.bpmInfo) {
      events.push({ time: e.time, kind: "bpm", value: e.bpm });
    }

    events.sort((a, b) => {
      const tc = compareTimePositions(a.time, b.time);
      if (tc !== 0) return tc;
      return (a.kind === "beat" ? 0 : 1) - (b.kind === "beat" ? 0 : 1);
    });

    let prevTime: TimePosition = [1, 1, 0];

    for (const ev of events) {
      const delta = this.calculateInterval(
        prevTime,
        ev.time,
        currentBpm,
        currentTimeSig,
      );
      currentSeconds += delta;

      const bp: Breakpoint = {
        time: ev.time,
        seconds: currentSeconds,
        bpm: currentBpm,
        timeSig: [...currentTimeSig],
      };

      if (ev.kind === "bpm") {
        currentBpm = ev.value as number;
        bp.bpm = currentBpm;
      } else {
        currentTimeSig = ev.value as [number, number];
        bp.timeSig = [...currentTimeSig];
      }

      breakpoints.push(bp);
      prevTime = ev.time;
    }

    if (breakpoints.length === 0) {
      breakpoints.push({
        time: [1, 1, 0],
        seconds: 0,
        bpm: 120,
        timeSig: [4, 4],
      });
    }

    return breakpoints;
  }

  private toTotalUnits(time: TimePosition, timeSig: [number, number]): number {
    const [measure, beat, cell] = time;
    const [numerator, denominator] = timeSig;
    const u = this.upb(denominator);
    const measureIdx = Math.max(0, measure - 1);
    const beatIdx = Math.max(0, beat - 1);
    const totalBeats = measureIdx * numerator + beatIdx;
    return totalBeats * u + cell;
  }

  private calculateInterval(
    start: TimePosition,
    end: TimePosition,
    bpm: number,
    timeSig: [number, number],
  ): number {
    const [, denominator] = timeSig;
    const u = this.upb(denominator);

    const startUnits = this.toTotalUnits(start, timeSig);
    const endUnits = this.toTotalUnits(end, timeSig);
    const deltaUnits = endUnits - startUnits;
    if (deltaUnits <= 0) return 0;

    const deltaBeats = deltaUnits / u;
    const quarterDuration = 60 / bpm;
    const beatValue = denominator;

    if (beatValue === 4) {
      return deltaBeats * quarterDuration;
    } else if (beatValue === 8) {
      return deltaBeats * (quarterDuration / 2);
    }
    return deltaBeats * quarterDuration * (4 / beatValue);
  }

  /** Inverse of secondsOf: convert seconds to a cell-snapped chart time within a known measure. */
  secToTime3(sec: number, measure: number): TimePosition {
    const start: TimePosition = [measure, 1, 0];
    const sec0 = this.secondsOf(start);
    const ts = this.getTimeSigAt(start);
    const [, den] = ts;
    const u = this.upb(den);

    let bpm = 120;
    for (const bp of this.breakpoints) {
      if (compareTimePositions(bp.time, start) <= 0) bpm = bp.bpm;
      else break;
    }

    const beatDur = (60 / bpm) * (4 / den);
    if (beatDur <= 0) return start;

    const deltaCells = Math.round(Math.max(0, sec - sec0) / beatDur * u);
    const beat = Math.floor(deltaCells / u);
    const cell = deltaCells - beat * u;
    return [measure, beat + 1, cell];
  }

  secondsOf(time: TimePosition): number {
    let prevBp: Breakpoint | null = null;
    for (const bp of this.breakpoints) {
      if (timeLe(bp.time, time)) {
        prevBp = bp;
      } else {
        break;
      }
    }

    if (prevBp === null) {
      prevBp = { time: [1, 1, 0], seconds: 0, bpm: 120, timeSig: [4, 4] };
    }

    const delta = this.calculateInterval(
      prevBp.time,
      time,
      prevBp.bpm,
      prevBp.timeSig,
    );
    return prevBp.seconds + delta;
  }

  advanceUnits(time: TimePosition, deltaUnits: number): TimePosition {
    if (deltaUnits <= 0) return [...time];

    let [curM, curB, curC] = time;
    let remaining = deltaUnits;

    while (remaining > 0) {
      const ts = this.getTimeSigAt([curM, curB, curC]);
      const nxt = this.nextTimeSigChangeAfter([curM, curB, curC]);

      if (nxt === null) {
        [curM, curB, curC] = this.advanceWithinSig(
          [curM, curB, curC],
          remaining,
          ts,
        );
        remaining = 0;
        break;
      }

      const toNxt = this.unitsBetweenSameSig(
        [curM, curB, curC],
        nxt.time,
        ts,
      );

      if (remaining < toNxt) {
        [curM, curB, curC] = this.advanceWithinSig(
          [curM, curB, curC],
          remaining,
          ts,
        );
        remaining = 0;
        break;
      }

      [curM, curB, curC] = nxt.time;
      remaining -= toNxt;
    }

    return [curM, curB, curC];
  }

  private advanceWithinSig(
    time: TimePosition,
    du: number,
    timeSig: [number, number],
  ): TimePosition {
    const [num, den] = timeSig;
    const u = this.upb(den);

    const startUnits = this.toTotalUnits(time, timeSig);
    const totalUnits = startUnits + du;

    const totalBeats = Math.floor(totalUnits / u);
    const cell = totalUnits % u;
    const measureIdx = Math.floor(totalBeats / num);
    const beatIdx = totalBeats % num;

    return [measureIdx + 1, beatIdx + 1, cell];
  }

  private unitsBetweenSameSig(
    start: TimePosition,
    end: TimePosition,
    timeSig: [number, number],
  ): number {
    const su = this.toTotalUnits(start, timeSig);
    const eu = this.toTotalUnits(end, timeSig);
    return Math.max(0, eu - su);
  }

  /** Public: compute signed unit distance from `from` to `to`. */
  unitsBetween(from: TimePosition, to: TimePosition): number {
    const ts = this.getTimeSigAt(from);
    const su = this.toTotalUnits(from, ts);
    const eu = this.toTotalUnits(to, ts);
    return eu - su;
  }
}
