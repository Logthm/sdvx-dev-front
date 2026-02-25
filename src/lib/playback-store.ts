/**
 * Zustand store — playback state for "play" mode.
 *
 * Manages transport controls, metronome settings, and BGM file state.
 */

import { create } from "zustand";

export interface PlaybackState {
  isPlaying: boolean;
  currentTimeSec: number;
  playbackRate: number;
  totalDurationSec: number;
  /** Incremented on explicit seek (not on animation-frame time updates). */
  seekVersion: number;

  metronomeEnabled: boolean;
  metronomeVolume: number;
  beatSubdivision: number;

  bgmFile: File | null;
  bgmOffset: number;
  bgmVolume: number;

  // actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (sec: number) => void;
  seekRelative: (deltaSec: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleMetronome: () => void;
  setMetronomeVolume: (v: number) => void;
  setBeatSubdivision: (sub: number) => void;
  setBgmFile: (file: File | null) => void;
  setBgmOffset: (offset: number) => void;
  setBgmVolume: (v: number) => void;
  setCurrentTime: (sec: number) => void;
  setTotalDuration: (sec: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  currentTimeSec: 0,
  playbackRate: 1,
  totalDurationSec: 0,
  seekVersion: 0,

  metronomeEnabled: true,
  metronomeVolume: 0.5,
  beatSubdivision: 1,

  bgmFile: null,
  bgmOffset: 0,
  bgmVolume: 0.5,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set((s) => ({ isPlaying: false, currentTimeSec: 0, seekVersion: s.seekVersion + 1 })),
  seek: (sec) =>
    set((s) => ({
      currentTimeSec: Math.max(0, Math.min(sec, s.totalDurationSec)),
      seekVersion: s.seekVersion + 1,
    })),
  seekRelative: (deltaSec) =>
    set((s) => ({
      currentTimeSec: Math.max(
        0,
        Math.min(s.currentTimeSec + deltaSec, s.totalDurationSec),
      ),
      seekVersion: s.seekVersion + 1,
    })),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  toggleMetronome: () => set((s) => ({ metronomeEnabled: !s.metronomeEnabled })),
  setMetronomeVolume: (v) => set({ metronomeVolume: v }),
  setBeatSubdivision: (sub) => set({ beatSubdivision: sub }),
  setBgmFile: (file) => set({ bgmFile: file }),
  setBgmOffset: (offset) => set({ bgmOffset: offset }),
  setBgmVolume: (v) => set({ bgmVolume: v }),
  setCurrentTime: (sec) => set({ currentTimeSec: sec }),
  setTotalDuration: (sec) => set({ totalDurationSec: sec }),
}));
