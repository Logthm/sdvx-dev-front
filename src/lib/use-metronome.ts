/**
 * Web Audio metronome hook — pre-generates all click tick points at
 * 1/64-beat resolution, then schedules sample playback via a lookahead
 * scheduler. Handles BPM and time-signature changes naturally through
 * the TimeMapper grid system.
 */

import { useEffect, useMemo, useRef } from "react";
import type { ChartData, ChartTimingData } from "@/types/chart";
import { TimeMapper, type Time3 } from "@/lib/chart-renderer/time-mapper";

// ---------------------------------------------------------------------------
// AudioContext singleton (shared with audio player)
// ---------------------------------------------------------------------------
let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// ---------------------------------------------------------------------------
// Sample loading
// ---------------------------------------------------------------------------
let hiBuffer: AudioBuffer | null = null;
let midBuffer: AudioBuffer | null = null;
let loBuffer: AudioBuffer | null = null;
let buffersLoading = false;
let buffersLoaded = false;

async function loadMetronomeSamples(ctx: AudioContext): Promise<void> {
  if (buffersLoaded || buffersLoading) return;
  buffersLoading = true;
  try {
    const [hiResp, midResp, loResp] = await Promise.all([
      fetch("/metronome-hi.wav"),
      fetch("/metronome-mid.wav"),
      fetch("/metronome-lo.wav"),
    ]);
    const [hiArr, midArr, loArr] = await Promise.all([
      hiResp.arrayBuffer(),
      midResp.arrayBuffer(),
      loResp.arrayBuffer(),
    ]);
    [hiBuffer, midBuffer, loBuffer] = await Promise.all([
      ctx.decodeAudioData(hiArr),
      ctx.decodeAudioData(midArr),
      ctx.decodeAudioData(loArr),
    ]);
    buffersLoaded = true;
  } catch (e) {
    console.error("Failed to load metronome samples:", e);
  } finally {
    buffersLoading = false;
  }
}

// ---------------------------------------------------------------------------
// Accent classification
// ---------------------------------------------------------------------------

type AccentLevel = "strong" | "sub-strong" | "weak";

function isCompoundMeter(num: number, den: number): boolean {
  return num >= 6 && num % 3 === 0 && den === 8;
}

function classifyAccent(
  beat: number,
  cell: number,
  num: number,
  den: number,
): AccentLevel {
  if (cell !== 0) return "weak";
  if (beat === 1) return "strong";
  if (isCompoundMeter(num, den) && (beat - 1) % 3 === 0) return "sub-strong";
  return "weak";
}

// ---------------------------------------------------------------------------
// Tick point generation
// ---------------------------------------------------------------------------

/** A single pre-computed metronome tick. */
export interface MetronomeTick {
  /** Elapsed seconds from chart start */
  sec: number;
  /** Accent level: strong (beat 1), sub-strong (compound meter group heads), weak */
  accent: AccentLevel;
  /** True for the first tick of each beat (cell === 0) */
  isBeatHead: boolean;
}

const TICK_STEP_UNITS = 2; // 48 units/beat ÷ 2 = 24 ticks/beat, divisible by 1,2,3,4,6,8

/**
 * Pre-generate all metronome tick points for the chart at 1/64-beat
 * resolution. Only ticks that align with the requested subdivision are
 * marked; the rest are skipped at playback time via the subdivision
 * parameter so we can reuse the same tick list.
 *
 * Each beat is divided into 64 slots. subdivision=1 → only beat heads,
 * subdivision=2 → 8th notes, etc.
 */
function generateTicks(chartData: ChartTimingData): MetronomeTick[] {
  const tm = new TimeMapper(chartData);

  // Determine chart end in seconds
  let endTime: Time3;
  if (chartData.end_position) {
    const ep = chartData.end_position;
    endTime = [ep.measure, ep.beat, ep.cell];
  } else if ("tracks" in chartData && (chartData as ChartData).tracks) {
    // Fallback: scan all events for the latest position
    let maxM = 1;
    for (const events of Object.values((chartData as ChartData).tracks)) {
      for (const ev of events) {
        if (ev.time[0] > maxM) maxM = ev.time[0];
      }
    }
    endTime = [maxM + 1, 1, 0];
  } else {
    endTime = [2, 1, 0];
  }
  const endSec = tm.secondsOf(endTime);

  const ticks: MetronomeTick[] = [];
  let pos: Time3 = [1, 1, 0];

  // Walk through the chart in steps of UNITS_PER_64TH
  while (true) {
    const sec = tm.secondsOf(pos);
    if (sec > endSec + 1) break;

    const [num, den] = tm.getTimeSigAt(pos);
    const accent = classifyAccent(pos[1], pos[2], num, den);
    ticks.push({ sec, accent, isBeatHead: pos[2] === 0 });

    pos = tm.advanceUnits(pos, TICK_STEP_UNITS);
  }

  return ticks;
}

/**
 * Filter ticks to only those matching the subdivision.
 * subdivision=1 → only beat heads
 * subdivision=N → N evenly-spaced clicks per beat
 *
 * The actual number of raw ticks per beat depends on the time signature
 * denominator (e.g. 16 for /4, 8 for /8), so we measure it dynamically
 * from the first two beat heads rather than assuming a fixed count.
 */
function filterBySubdivision(
  ticks: MetronomeTick[],
  subdivision: number,
): MetronomeTick[] {
  if (subdivision <= 1) {
    // Only beat heads
    return ticks.filter((t) => t.isBeatHead);
  }

  // Measure ticks-per-beat from the first two beat heads
  let ticksPerBeat = 16; // fallback
  let firstHead = -1;
  for (let i = 0; i < ticks.length; i++) {
    if (ticks[i].isBeatHead) {
      if (firstHead === -1) {
        firstHead = i;
      } else {
        ticksPerBeat = i - firstHead;
        break;
      }
    }
  }

  const step = Math.max(1, Math.round(ticksPerBeat / subdivision));
  let indexInBeat = 0;
  const result: MetronomeTick[] = [];
  for (const tick of ticks) {
    if (tick.isBeatHead) indexInBeat = 0;
    if (indexInBeat % step === 0) {
      result.push(tick);
    }
    indexInBeat++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Click scheduling
// ---------------------------------------------------------------------------

function scheduleClick(
  ctx: AudioContext,
  when: number,
  accent: AccentLevel,
  volume: number,
) {
  const buffer =
    accent === "strong" ? hiBuffer : accent === "sub-strong" ? midBuffer : loBuffer;
  if (!buffer) return;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = volume;
  source.start(when);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMetronome(
  chartData: ChartTimingData | null,
  currentTimeSec: number,
  isPlaying: boolean,
  subdivision: number,
  volume: number,
  enabled: boolean,
  playbackRate: number,
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextIndexRef = useRef(0);
  const currentTimeRef = useRef(currentTimeSec);
  currentTimeRef.current = currentTimeSec;

  // Pre-generate all tick points once per chart
  const allTicks = useMemo(
    () => (chartData ? generateTicks(chartData) : []),
    [chartData],
  );

  // Filter by subdivision
  const ticks = useMemo(
    () => filterBySubdivision(allTicks, subdivision),
    [allTicks, subdivision],
  );

  // Pre-load samples
  useEffect(() => {
    if (enabled) {
      loadMetronomeSamples(getAudioContext());
    }
  }, [enabled]);

  // Reset index on play/pause toggle
  useEffect(() => {
    // Binary search for the first tick >= currentTimeSec
    const t = currentTimeRef.current;
    let lo = 0;
    let hi = ticks.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (ticks[mid].sec < t) lo = mid + 1;
      else hi = mid;
    }
    nextIndexRef.current = lo;
  }, [isPlaying, ticks]);

  // Scheduler
  useEffect(() => {
    if (!enabled || !isPlaying || ticks.length === 0 || volume <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const ctx = getAudioContext();
    const baseAudioTime = ctx.currentTime;
    const startChartTime = currentTimeRef.current;

    // Seek nextIndexRef to correct position
    {
      let lo = 0;
      let hi = ticks.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (ticks[mid].sec < startChartTime) lo = mid + 1;
        else hi = mid;
      }
      nextIndexRef.current = lo;
    }

    const LOOKAHEAD_SEC = 0.15;
    const SCHEDULE_INTERVAL_MS = 25;

    intervalRef.current = setInterval(() => {
      if (!buffersLoaded) return;

      const elapsed = (ctx.currentTime - baseAudioTime) * playbackRate;
      const chartNow = startChartTime + elapsed;
      const scheduleUntil = chartNow + LOOKAHEAD_SEC * playbackRate;

      while (nextIndexRef.current < ticks.length) {
        const tick = ticks[nextIndexRef.current];
        if (tick.sec > scheduleUntil) break;

        const deltaFromNow = (tick.sec - chartNow) / playbackRate;
        const audioTime = ctx.currentTime + deltaFromNow;

        if (audioTime >= ctx.currentTime - 0.01) {
          scheduleClick(
            ctx,
            Math.max(ctx.currentTime, audioTime),
            tick.accent,
            volume,
          );
        }

        nextIndexRef.current++;
      }
    }, SCHEDULE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isPlaying, ticks, volume, playbackRate]);
}
