import { coverUrl } from "@/api/client";
import {
    RADAR_PEAK_KEYS,
    type FilterState,
    type RadarPeakKey,
} from "@/components/browser/FilterBar";
import { cn } from "@/lib/utils";
import {
    DIFFICULTY_COLORS,
    DIFFICULTY_LABELS,
    DIFFICULTY_ORDER,
    INF_VER_COLORS,
    formatBpm,
    getInfLabel,
    type DifficultyName,
    type DifficultySchema,
    type MusicSchema,
    type RadarSchema,
} from "@/types/music";
import { useState } from "react";

interface MusicCardProps {
  music: MusicSchema;
  filters?: FilterState;
  onClick?: () => void;
  onDifficultyClick?: (difstr: string) => void;
  onArtistClick?: (artist: string) => void;
}

const RADAR_LABEL: Record<RadarPeakKey, string> = {
  notes: "NOTES",
  peak: "PEAK",
  tsumami: "TSUMAMI",
  tricky: "TRICKY",
  hand_trip: "HAND-TRIP",
  one_hand: "ONE-HAND",
};

function getHighestRadarKey(radar: RadarSchema): RadarPeakKey {
  let highestKey = RADAR_PEAK_KEYS[0];
  let highestValue = radar[highestKey];
  for (const key of RADAR_PEAK_KEYS.slice(1)) {
    if (radar[key] > highestValue) {
      highestKey = key;
      highestValue = radar[key];
    }
  }
  return highestKey;
}

function diffMatchesFilters(
  d: DifficultySchema,
  filters: FilterState,
  infVer: number,
): boolean {
  const hasDifFilter = filters.difficulties.size > 0 || filters.infVers.size > 0;
  if (hasDifFilter) {
    if (d.difstr === "infinite") {
      if (!filters.infVers.has(infVer)) return false;
    } else if (!filters.difficulties.has(d.difstr as DifficultyName)) {
      return false;
    }
  }
  const level = Number.parseFloat(d.difnum);
  if (filters.levelMin !== null && level < filters.levelMin) return false;
  if (filters.levelMax !== null && level > filters.levelMax) return false;
  if (filters.radarPeaks.size > 0) {
    if (!filters.radarPeaks.has(getHighestRadarKey(d.radar))) return false;
  }
  return true;
}

export function MusicCard({
  music,
  filters,
  onClick,
  onDifficultyClick,
  onArtistClick,
}: MusicCardProps) {
  const [imgError, setImgError] = useState(false);

  const sortedDiffs = [...music.difficulty].sort(
    (a, b) =>
      DIFFICULTY_ORDER.indexOf(a.difstr) - DIFFICULTY_ORDER.indexOf(b.difstr),
  );

  const primaryDif = sortedDiffs[sortedDiffs.length - 1];
  const imgSrc = primaryDif ? coverUrl(music.id, primaryDif.difstr) : undefined;

  const visibleDiffs = filters
    ? sortedDiffs.filter((d) => diffMatchesFilters(d, filters, music.inf_ver))
    : sortedDiffs;

  const radarPeak = primaryDif ? getHighestRadarKey(primaryDif.radar) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-lg text-left cursor-pointer overflow-hidden",
        "bg-cosmos-900/40 border border-cosmos-600/20",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-[0_8px_24px_oklch(0.72_0.155_70/0.12)]",
        "hover:border-gold-400/30",
        "active:scale-[0.97]",
      )}
    >
      {/* Cover image */}
      <div className="relative w-full aspect-square overflow-hidden bg-cosmos-800">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl font-bold text-cosmos-600">
              {music.title_name.charAt(0)}
            </span>
          </div>
        )}
        {/* BPM overlay */}
        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-cosmos-950/70 text-xs font-mono text-text-muted backdrop-blur-sm">
          {formatBpm(music.bpm_max, music.bpm_min)}
        </span>
        {radarPeak && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-cosmos-950/70 text-xs font-mono font-semibold text-lavender-400/80 backdrop-blur-sm">
            {RADAR_LABEL[radarPeak]}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3 corner-brackets relative">
        <span className="gold-fill-bg" />
        <h3 className="text-base font-semibold text-text-primary truncate leading-tight relative z-[2] font-ja">
          {music.title_name}
        </h3>
        <p
          className="text-sm text-text-muted truncate relative z-[2] hover:text-gold-400 cursor-pointer transition-colors font-ja"
          onClick={(e) => { e.stopPropagation(); onArtistClick?.(music.artist_name); }}
        >
          {music.artist_name}
        </p>
        {/* Difficulty color blocks */}
        <div className="flex flex-wrap gap-1 mt-1 relative z-[2]">
          {visibleDiffs.map((d) => {
            const difName = d.difstr as DifficultyName;
            const color = difName === "infinite"
              ? (INF_VER_COLORS[music.inf_ver] ?? DIFFICULTY_COLORS[difName])
              : DIFFICULTY_COLORS[difName];
            return (
              <span
                key={d.difstr}
                onClick={(e) => {
                  e.stopPropagation();
                  onDifficultyClick?.(d.difstr);
                }}
                className="flex-1 flex flex-col items-center py-1.5 rounded cursor-pointer transition-all border-2 border-transparent hover:!border-current"
                style={{ backgroundColor: `color-mix(in oklch, ${color} 18%, #0a0a0f)`, color }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider leading-none"
                  style={{ color }}
                >
                  {difName === "infinite" ? getInfLabel(music.inf_ver) : DIFFICULTY_LABELS[difName]}
                </span>
                <span
                  className="text-sm font-mono font-bold leading-tight"
                  style={{ color }}
                >
                  {d.difnum}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </button>
  );
}
