/**
 * PlaybackToolbar — transport controls, metronome, and BGM settings
 * for the "play" mode sidebar.
 */

import { usePlaybackStore } from "@/lib/playback-store";
import { cn } from "@/lib/utils";
import {
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const RATES = [0.5, 0.75, 1, 1.5, 2] as const;
const SUBDIVISIONS = [
  { value: 1, label: "1/4" },
  { value: 2, label: "1/8" },
  { value: 3, label: "1/12" },
  { value: 4, label: "1/16" },
  { value: 6, label: "1/24" },
  { value: 8, label: "1/32" },
] as const;

export function PlaybackToolbar() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const totalDurationSec = usePlaybackStore((s) => s.totalDurationSec);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const play = usePlaybackStore((s) => s.play);
  const pause = usePlaybackStore((s) => s.pause);
  const stop = usePlaybackStore((s) => s.stop);
  const seek = usePlaybackStore((s) => s.seek);
  const seekRelative = usePlaybackStore((s) => s.seekRelative);
  const setPlaybackRate = usePlaybackStore((s) => s.setPlaybackRate);

  const metronomeEnabled = usePlaybackStore((s) => s.metronomeEnabled);
  const metronomeVolume = usePlaybackStore((s) => s.metronomeVolume);
  const beatSubdivision = usePlaybackStore((s) => s.beatSubdivision);
  const toggleMetronome = usePlaybackStore((s) => s.toggleMetronome);
  const setMetronomeVolume = usePlaybackStore((s) => s.setMetronomeVolume);
  const setBeatSubdivision = usePlaybackStore((s) => s.setBeatSubdivision);

  const bgmFile = usePlaybackStore((s) => s.bgmFile);
  const bgmOffset = usePlaybackStore((s) => s.bgmOffset);
  const setBgmFile = usePlaybackStore((s) => s.setBgmFile);
  const setBgmOffset = usePlaybackStore((s) => s.setBgmOffset);

  return (
    <div className="flex flex-col gap-3">
      {/* Transport controls */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => seekRelative(-5)}
          className="p-2 rounded text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          title={t("playback.rewind")}
        >
          <SkipBack size={14} />
        </button>
        <button
          onClick={() => (isPlaying ? pause() : play())}
          className="p-2 rounded bg-gold-400/15 text-gold-400 hover:bg-gold-400/25 transition-colors"
          title={isPlaying ? t("playback.pause") : t("playback.play")}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={stop}
          className="p-2 rounded text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          title={t("playback.stop")}
        >
          <Square size={14} />
        </button>
        <button
          onClick={() => seekRelative(5)}
          className="p-2 rounded text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          title={t("playback.forward")}
        >
          <SkipForward size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={totalDurationSec || 1}
          step={0.1}
          value={currentTimeSec}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-cosmos-700 accent-gold-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-mono text-text-muted">
          <span>{formatTime(currentTimeSec)}</span>
          <span>{formatTime(totalDurationSec)}</span>
        </div>
      </div>

      {/* Playback rate */}
      <div className="flex items-center gap-1 flex-wrap">
        {RATES.map((r) => (
          <button
            key={r}
            onClick={() => setPlaybackRate(r)}
            className={cn(
              "px-2 py-1 rounded text-[11px] font-mono transition-colors",
              playbackRate === r
                ? "bg-gold-400/15 text-gold-400"
                : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
            )}
          >
            {r}x
          </button>
        ))}
      </div>

      {/* Metronome */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-cosmos-600/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Volume2 size={12} className="text-text-muted" />
            <span className="text-xs text-text-muted">
              {t("playback.metronome")}
            </span>
          </div>
          <button
            onClick={toggleMetronome}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              metronomeEnabled
                ? "bg-green-500/15 text-green-400"
                : "bg-cosmos-700/60 text-text-muted",
            )}
          >
            {metronomeEnabled ? "ON" : "OFF"}
          </button>
        </div>
        {metronomeEnabled && (
          <>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={metronomeVolume}
              onChange={(e) => setMetronomeVolume(parseFloat(e.target.value))}
              className="w-full h-1 rounded-full appearance-none bg-cosmos-700 accent-green-400 cursor-pointer"
            />
            <div className="flex items-center gap-1 flex-wrap">
              {SUBDIVISIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setBeatSubdivision(s.value)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors",
                    beatSubdivision === s.value
                      ? "bg-green-500/15 text-green-400"
                      : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* BGM */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-cosmos-600/20">
        <div className="flex items-center gap-1.5">
          <Music size={12} className="text-text-muted" />
          <span className="text-xs text-text-muted">BGM</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setBgmFile(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-3 py-1.5 rounded text-xs font-medium border transition-colors bg-cosmos-700/60 text-text-secondary hover:text-text-primary hover:bg-cosmos-600/60 border-cosmos-600/30 truncate"
        >
          {bgmFile ? bgmFile.name : t("playback.chooseFile")}
        </button>
        {bgmFile && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted shrink-0">
              {t("playback.offset")}:
            </span>
            <button
              onClick={() => setBgmOffset(+(bgmOffset - 0.1).toFixed(1))}
              className="px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
            >
              -
            </button>
            <span className="text-[10px] font-mono text-text-primary min-w-[40px] text-center">
              {bgmOffset >= 0 ? "+" : ""}
              {bgmOffset.toFixed(1)}s
            </span>
            <button
              onClick={() => setBgmOffset(+(bgmOffset + 0.1).toFixed(1))}
              className="px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
