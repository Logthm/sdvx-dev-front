import type { ButtonEvent, ChartData } from "@/types/chart";
import type { TimePosition } from "@/types/chart-domain";

const DEFAULT_RESOLUTION = 48;
const DEFAULT_BPM = 120;
const DEFAULT_TIME_SIGNATURE = [4, 4] as const;
const HIGH_BPM_THRESHOLD = 255;
const OPEN_SECTION_TICKS = 10_000;

export const HOLD_HEAD_WINDOW = {
  earlySeconds: 8 / 60,
  lateSeconds: 6 / 60,
} as const;

export const HOLD_SUSTAIN_WINDOW = {
  earlySeconds: 1 / 60,
  lateSeconds: 1 / 60,
} as const;

export interface HoldJudgementRun {
  trackName: string;
  head: TimePosition;
  sustain: TimePosition[];
}

interface TimedButtonEvent {
  event: ButtonEvent;
  tick: number;
}

/**
 * Reproduces the game's global HOLD timing grid. The grid starts at each
 * #BEAT INFO boundary, changes density with the BPM at every emitted point,
 * and is cached separately for every note step override.
 */
class HoldTickGrid {
  private readonly resolution: number;
  private readonly sections: Array<{
    time: TimePosition;
    numerator: number;
    denominator: number;
  }>;
  private readonly endPosition: TimePosition | null;
  private readonly measureStarts = new Map<number, number>([[1, 0]]);
  private readonly grids = new Map<number, number[]>();
  private readonly bpmTicks: number[] = [];
  private readonly bpmValues: number[] = [];
  private readonly sectionTicks: number[];

  constructor(chart: ChartData) {
    this.resolution = Math.max(1, chart.beat_resolution ?? DEFAULT_RESOLUTION);
    this.sections = chart.beat_info.length > 0
      ? chart.beat_info
        .map((entry) => ({
          time: [entry.measure, entry.beat, entry.cell] as TimePosition,
          numerator: entry.numerator,
          denominator: entry.denominator,
        }))
        .sort((a, b) => compareTime(a.time, b.time))
      : [{
        time: [1, 1, 0],
        numerator: DEFAULT_TIME_SIGNATURE[0],
        denominator: DEFAULT_TIME_SIGNATURE[1],
      }];
    this.endPosition = chart.end_position
      ? [chart.end_position.measure, chart.end_position.beat, chart.end_position.cell]
      : null;

    for (const entry of [...chart.bpm_info].sort((a, b) =>
      compareTime(
        [a.measure, a.beat, a.cell],
        [b.measure, b.beat, b.cell],
      ))) {
      this.bpmTicks.push(this.tickOf([entry.measure, entry.beat, entry.cell]));
      this.bpmValues.push(entry.bpm);
    }

    this.sectionTicks = this.sections.map((section) => this.tickOf(section.time));
  }

  tickOf(time: TimePosition): number {
    const [measure, beat, cell] = time;
    const [, denominator] = this.signatureAtMeasure(measure);
    return this.measureStart(measure)
      + Math.max(0, beat - 1) * this.unitsPerBeat(denominator)
      + cell;
  }

  timeOf(tick: number): TimePosition {
    let measure = 1;
    while (this.measureStart(measure + 1) <= tick) measure++;

    const [, denominator] = this.signatureAtMeasure(measure);
    const unitsPerBeat = this.unitsPerBeat(denominator);
    const offset = Math.max(0, tick - this.measureStart(measure));
    const beatOffset = Math.floor(offset / unitsPerBeat);
    return [measure, beatOffset + 1, offset - beatOffset * unitsPerBeat];
  }

  filter(stepParam: number, startTick: number, endTick: number): number[] {
    if (endTick < startTick) return [];

    const ticks = this.ticks(stepParam);
    const startIndex = lowerBound(ticks, startTick);
    const endIndex = upperBound(ticks, endTick);
    return ticks.slice(startIndex, endIndex);
  }

  private signatureAtMeasure(measure: number): [number, number] {
    let signature: [number, number] = [...DEFAULT_TIME_SIGNATURE];
    for (const section of this.sections) {
      if (section.time[0] > measure) break;
      signature = [section.numerator, section.denominator];
    }
    return signature;
  }

  private unitsPerBeat(denominator: number): number {
    return Math.floor((4 * this.resolution) / Math.max(1, denominator));
  }

  private measureStart(measure: number): number {
    const cached = this.measureStarts.get(measure);
    if (cached !== undefined) return cached;

    let knownMeasure = measure - 1;
    while (!this.measureStarts.has(knownMeasure)) knownMeasure--;
    let tick = this.measureStarts.get(knownMeasure)!;
    for (let current = knownMeasure; current < measure; current++) {
      const [numerator, denominator] = this.signatureAtMeasure(current);
      tick += numerator * this.unitsPerBeat(denominator);
      this.measureStarts.set(current + 1, tick);
    }
    return tick;
  }

  private bpmAt(tick: number): number {
    if (this.bpmValues.length === 0) return DEFAULT_BPM;
    const index = upperBound(this.bpmTicks, tick) - 1;
    return this.bpmValues[Math.max(0, index)];
  }

  private ticks(rawStepParam: number): number[] {
    const stepParam = Math.max(0, Math.trunc(rawStepParam));
    const cached = this.grids.get(stepParam);
    if (cached) return cached;

    const ticks: number[] = [];
    const halfResolution = Math.max(1, this.resolution >> 1);
    const quarterResolution = Math.max(1, this.resolution >> 2);

    for (let index = 0; index < this.sectionTicks.length; index++) {
      let currentTick = this.sectionTicks[index];
      const endTick = index + 1 < this.sectionTicks.length
        ? this.sectionTicks[index + 1]
        : this.endPosition
          ? this.tickOf(this.endPosition)
          : currentTick + OPEN_SECTION_TICKS;

      while (currentTick < endTick) {
        ticks.push(currentTick);
        const step = stepParam !== 0
          ? stepParam
          : this.bpmAt(currentTick) >= HIGH_BPM_THRESHOLD
            ? halfResolution
            : quarterResolution;
        currentTick += step;
      }
    }

    ticks.sort((a, b) => a - b);
    this.grids.set(stepParam, ticks);
    return ticks;
  }
}

/**
 * Returns one HEAD and the trimmed SUSTAIN points for every contiguous HOLD
 * run on the six button tracks.
 */
export function calculateHoldJudgements(chart: ChartData): HoldJudgementRun[] {
  const grid = new HoldTickGrid(chart);
  const runs: HoldJudgementRun[] = [];

  for (const track of ["2", "3", "4", "5", "6", "7"]) {
    const entries: TimedButtonEvent[] = (chart.tracks[track] ?? [])
      .filter((event): event is ButtonEvent => event.type === "button")
      .map((event) => ({ event, tick: grid.tickOf(event.time) }))
      .sort((a, b) => a.tick - b.tick);

    let pendingHead: TimePosition | null = null;
    let pendingPoints: number[][] = [];

    for (let index = 0; index < entries.length; index++) {
      const current = entries[index];
      const { event, tick } = current;
      if (event.hold_len <= 0) continue;

      const previous = entries[index - 1];
      const next = entries[index + 1];
      const continuesPrevious = Boolean(
        previous
        && previous.event.hold_len > 0
        && previous.tick + previous.event.hold_len === tick,
      );
      const continuesNext = Boolean(
        next
        && next.event.hold_len > 0
        && tick + event.hold_len === next.tick,
      );

      if (!continuesPrevious || pendingHead === null) {
        pendingHead = [...event.time] as TimePosition;
        pendingPoints = [];
      }

      pendingPoints.push(grid.filter(
        event.step_param ?? 0,
        tick + (continuesPrevious ? 0 : 1),
        tick + event.hold_len - 1,
      ));

      if (continuesNext) continue;

      let total = pendingPoints.reduce((sum, points) => sum + points.length, 0);
      let removed = 0;
      while (total > 4 && removed < 2) {
        while (pendingPoints.length > 0 && pendingPoints.at(-1)!.length === 0) {
          pendingPoints.pop();
        }
        if (pendingPoints.length === 0) break;
        pendingPoints.at(-1)!.pop();
        total--;
        removed++;
      }

      runs.push({
        trackName: event.track_name,
        head: pendingHead,
        sustain: pendingPoints.flat().map((point) => grid.timeOf(point)),
      });
      pendingHead = null;
      pendingPoints = [];
    }
  }

  return runs;
}

function compareTime(a: readonly number[], b: readonly number[]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function lowerBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}
