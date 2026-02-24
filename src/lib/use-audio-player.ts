/**
 * BGM audio player hook — decodes a File into an AudioBuffer
 * and plays it in sync with the chart playback.
 */

import { useEffect, useRef, useState } from "react";
import { getAudioContext } from "./use-metronome";

export function useAudioPlayer(
  bgmFile: File | null,
  isPlaying: boolean,
  currentTimeSec: number,
  playbackRate: number,
  bgmOffset: number,
): { audioReady: boolean; duration: number } {
  const [audioReady, setAudioReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const startChartTimeRef = useRef(0);

  // Decode file when it changes
  useEffect(() => {
    if (!bgmFile) {
      bufferRef.current = null;
      setAudioReady(false);
      setDuration(0);
      return;
    }

    let cancelled = false;
    const reader = new FileReader();
    reader.onload = async () => {
      if (cancelled) return;
      try {
        const ctx = getAudioContext();
        const buffer = await ctx.decodeAudioData(
          reader.result as ArrayBuffer,
        );
        if (cancelled) return;
        bufferRef.current = buffer;
        setDuration(buffer.duration);
        setAudioReady(true);
      } catch {
        bufferRef.current = null;
        setAudioReady(false);
      }
    };
    reader.readAsArrayBuffer(bgmFile);

    return () => {
      cancelled = true;
    };
  }, [bgmFile]);

  // Stop any playing source
  const stopSource = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  };

  // Play/pause/seek
  useEffect(() => {
    if (!isPlaying || !bufferRef.current) {
      stopSource();
      return;
    }

    const ctx = getAudioContext();
    const buffer = bufferRef.current;

    stopSource();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(ctx.destination);

    const bgmTime = currentTimeSec + bgmOffset;
    const offset = Math.max(0, bgmTime);
    const delay = bgmTime < 0 ? -bgmTime / playbackRate : 0;

    if (offset < buffer.duration) {
      source.start(ctx.currentTime + delay, offset);
    }

    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime;
    startChartTimeRef.current = currentTimeSec;

    return () => {
      stopSource();
    };
  }, [isPlaying, currentTimeSec, playbackRate, bgmOffset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopSource();
  }, []);

  return { audioReady, duration };
}
