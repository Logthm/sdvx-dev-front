/**
 * BGM audio player hook — decodes a File into an AudioBuffer
 * and plays it in sync with the chart playback.
 *
 * The audio source is created once when playback starts (or on seek),
 * and playbackRate changes are applied to the live node without
 * recreating it, so there is no audible gap on speed change.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaybackStore } from "./playback-store";
import { getAudioContext } from "./use-metronome";

export function useAudioPlayer(
  bgmFile: File | null,
  isPlaying: boolean,
  _currentTimeSec: number,
  playbackRate: number,
  bgmOffset: number,
  bgmVolume: number,
): { audioReady: boolean; duration: number } {
  const [decodedAudio, setDecodedAudio] = useState<{
    file: File;
    buffer: AudioBuffer;
  } | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const buffer = decodedAudio?.file === bgmFile ? decodedAudio.buffer : null;

  const seekVersion = usePlaybackStore((s) => s.seekVersion);

  // Decode file when it changes
  useEffect(() => {
    if (!bgmFile) {
      setDecodedAudio(null);
      return;
    }

    let cancelled = false;
    const decodeFile = async () => {
      try {
        const ctx = getAudioContext();
        const fileData = await bgmFile.arrayBuffer();
        const decodedBuffer = await ctx.decodeAudioData(fileData);
        if (cancelled) return;
        setDecodedAudio({ file: bgmFile, buffer: decodedBuffer });
      } catch {
        if (!cancelled) setDecodedAudio(null);
      }
    };
    void decodeFile();

    return () => {
      cancelled = true;
    };
  }, [bgmFile]);

  // Stop any playing source
  const stopSource = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    gainRef.current = null;
  }, []);

  // Create / destroy audio source on play, pause, seek, or offset change.
  // Does NOT depend on currentTimeSec (animation-frame updates) or playbackRate.
  useEffect(() => {
    if (!isPlaying || !buffer) {
      stopSource();
      return;
    }

    const ctx = getAudioContext();
    const currentTimeSec = usePlaybackStore.getState().currentTimeSec;
    const rate = usePlaybackStore.getState().playbackRate;

    stopSource();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = ctx.createGain();
    gain.gain.value = usePlaybackStore.getState().bgmVolume;
    source.connect(gain).connect(ctx.destination);

    const bgmTime = currentTimeSec + bgmOffset;
    const offset = Math.max(0, bgmTime);
    const delay = bgmTime < 0 ? -bgmTime / rate : 0;

    if (offset < buffer.duration) {
      source.start(ctx.currentTime + delay, offset);
    }

    sourceRef.current = source;
    gainRef.current = gain;

    return () => {
      stopSource();
    };
  }, [isPlaying, seekVersion, bgmOffset, buffer, stopSource]);

  // Update playback rate on the live source — no recreation, no gap.
  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate]);

  // Update volume on the live gain node.
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = bgmVolume;
    }
  }, [bgmVolume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopSource();
  }, [stopSource]);

  return {
    audioReady: buffer !== null,
    duration: buffer?.duration ?? 0,
  };
}
