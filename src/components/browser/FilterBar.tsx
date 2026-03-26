import { cn } from "@/lib/utils";
import {
    DIFFICULTY_LABELS,
    DIFFICULTY_ORDER,
    INF_VER_COLORS,
    INF_VER_LABELS,
    type DifficultyName,
    type RadarSchema,
} from "@/types/music";
import type { SortDirection, SortField } from "@/api/music";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

export type RadarPeakKey = keyof RadarSchema;

export const RADAR_PEAK_KEYS: RadarPeakKey[] = [
  "notes",
  "peak",
  "tsumami",
  "tricky",
  "hand_trip",
  "one_hand",
];

const VERSION_OPTIONS = Array.from({ length: 7 }, (_, idx) => idx + 1);

const VERSION_LABELS: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
};

export type LevelMode = 'exact' | 'int' | 'range';

export type SearchField = 'title' | 'artist' | 'reading' | 'alias';

export interface FilterState {
  levelMode: LevelMode;
  levelInput: string;
  levelMinRaw: string;
  levelMaxRaw: string;
  levelMin: number | null;
  levelMax: number | null;
  difficulties: Set<DifficultyName>;
  infVers: Set<number>;
  versions: Set<number>;
  bpmMinRaw: string;
  bpmMaxRaw: string;
  bpmMin: number | null;
  bpmMax: number | null;
  radarPeaks: Set<RadarPeakKey>;
  searchFields: Set<SearchField>;
  exactMatch: boolean;
}

export function createDefaultFilters(): FilterState {
  return {
    levelMode: 'exact',
    levelInput: '',
    levelMinRaw: '',
    levelMaxRaw: '',
    levelMin: null,
    levelMax: null,
    difficulties: new Set<DifficultyName>(),
    infVers: new Set<number>(),
    versions: new Set<number>(),
    bpmMinRaw: '',
    bpmMaxRaw: '',
    bpmMin: null,
    bpmMax: null,
    radarPeaks: new Set<RadarPeakKey>(),
    searchFields: new Set<SearchField>(['title', 'artist', 'reading', 'alias']),
    exactMatch: false,
  };
}

export const DEFAULT_FILTERS: FilterState = createDefaultFilters();

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  onClearSort: () => void;
  className?: string;
}

const DIF_BG: Record<DifficultyName, string> = {
  novice: "bg-diff-novice",
  advanced: "bg-diff-advanced",
  exhaust: "bg-diff-exhaust",
  infinite: "bg-diff-infinite",
  maximum: "bg-white",
  ultimate: "bg-diff-ultimate",
};

function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5 min-h-7">
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted select-none">
        {children}
      </span>
      {action}
    </div>
  );
}

function ClearBtn({
  hasSelection,
  onClear,
}: {
  hasSelection: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  if (!hasSelection) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      className="text-[11px] min-h-7 text-text-muted hover:text-gold-400 transition-colors"
    >
      {t('common.clear')}
    </button>
  );
}

const SEARCH_FIELD_OPTIONS: SearchField[] = ['title', 'artist', 'reading', 'alias'];

const SORT_OPTIONS: [SortField, string][] = [
  ["difficulty", "filter.sortBy.difficulty"],
  ["distribution_date", "filter.sortBy.date"],
  ["title_name", "filter.sortBy.title"],
  ["artist_name", "filter.sortBy.artist"],
];

export function FilterBar({ filters, onChange, sortField, sortDirection, onToggleSort, onClearSort, className }: FilterBarProps) {
  const { t } = useTranslation();
  function clampLevel(n: number) {
    return Math.round(Math.max(1, Math.min(n, 20.9)) * 10) / 10;
  }

  function setLevelMode(mode: LevelMode) {
    onChange({ ...filters, levelMode: mode, levelInput: '', levelMinRaw: '', levelMaxRaw: '', levelMin: null, levelMax: null });
  }

  function updateLevelInput(raw: string) {
    if (raw === "") {
      onChange({ ...filters, levelInput: '', levelMin: null, levelMax: null });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const v = clampLevel(parsed);
    if (filters.levelMode === 'exact') {
      // "18" → 18.0, "18.5" → 18.5
      const exact = raw.includes(".") ? v : Math.floor(v);
      onChange({ ...filters, levelInput: raw, levelMin: exact, levelMax: exact });
    } else {
      // int mode: "18" → 18.0~18.9
      const base = Math.floor(v);
      onChange({ ...filters, levelInput: raw, levelMin: base, levelMax: Math.min(base + 0.9, 20.9) });
    }
  }

  function updateLevelMin(raw: string) {
    onChange({ ...filters, levelMinRaw: raw });
  }

  function updateLevelMax(raw: string) {
    onChange({ ...filters, levelMaxRaw: raw });
  }

  function handleLevelMinBlur() {
    const raw = filters.levelMinRaw;
    if (raw === "") {
      onChange({ ...filters, levelMin: null });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      onChange({ ...filters, levelMinRaw: '' });
      return;
    }
    const clamped = clampLevel(parsed);

    // If both values exist and min > max, swap them
    if (filters.levelMax !== null && clamped > filters.levelMax) {
      onChange({
        ...filters,
        levelMinRaw: String(filters.levelMax),
        levelMin: filters.levelMax,
        levelMaxRaw: String(clamped),
        levelMax: clamped
      });
    } else {
      onChange({ ...filters, levelMinRaw: String(clamped), levelMin: clamped });
    }
  }

  function handleLevelMaxBlur() {
    const raw = filters.levelMaxRaw;
    if (raw === "") {
      onChange({ ...filters, levelMax: null });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      onChange({ ...filters, levelMaxRaw: '' });
      return;
    }
    const clamped = clampLevel(parsed);

    // If both values exist and max < min, swap them
    if (filters.levelMin !== null && clamped < filters.levelMin) {
      onChange({
        ...filters,
        levelMinRaw: String(clamped),
        levelMin: clamped,
        levelMaxRaw: String(filters.levelMin),
        levelMax: filters.levelMin
      });
    } else {
      onChange({ ...filters, levelMaxRaw: String(clamped), levelMax: clamped });
    }
  }

  function updateBpmMin(raw: string) {
    onChange({ ...filters, bpmMinRaw: raw });
  }

  function updateBpmMax(raw: string) {
    onChange({ ...filters, bpmMaxRaw: raw });
  }

  function handleBpmMinBlur() {
    const raw = filters.bpmMinRaw;
    if (raw === "") {
      onChange({ ...filters, bpmMin: null });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      onChange({ ...filters, bpmMinRaw: '' });
      return;
    }
    const clamped = Math.max(0, Math.min(parsed, 400));

    // If both values exist and min > max, swap them
    if (filters.bpmMax !== null && clamped > filters.bpmMax) {
      onChange({
        ...filters,
        bpmMinRaw: String(filters.bpmMax),
        bpmMin: filters.bpmMax,
        bpmMaxRaw: String(clamped),
        bpmMax: clamped
      });
    } else {
      onChange({ ...filters, bpmMinRaw: String(clamped), bpmMin: clamped });
    }
  }

  function handleBpmMaxBlur() {
    const raw = filters.bpmMaxRaw;
    if (raw === "") {
      onChange({ ...filters, bpmMax: null });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      onChange({ ...filters, bpmMaxRaw: '' });
      return;
    }
    const clamped = Math.max(0, Math.min(parsed, 400));

    // If both values exist and max < min, swap them
    if (filters.bpmMin !== null && clamped < filters.bpmMin) {
      onChange({
        ...filters,
        bpmMinRaw: String(clamped),
        bpmMin: clamped,
        bpmMaxRaw: String(filters.bpmMin),
        bpmMax: filters.bpmMin
      });
    } else {
      onChange({ ...filters, bpmMaxRaw: String(clamped), bpmMax: clamped });
    }
  }

  function toggleDif(d: DifficultyName) {
    const next = new Set(filters.difficulties);
    if (next.has(d)) next.delete(d); else next.add(d);
    onChange({ ...filters, difficulties: next });
  }

  function toggleInfVer(v: number) {
    const next = new Set(filters.infVers);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange({ ...filters, infVers: next });
  }

  function toggleVersion(v: number) {
    const next = new Set(filters.versions);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange({ ...filters, versions: next });
  }

  function toggleRadarPeak(key: RadarPeakKey) {
    const next = new Set(filters.radarPeaks);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ ...filters, radarPeaks: next });
  }

  function toggleSearchField(field: SearchField) {
    const next = new Set(filters.searchFields);
    if (next.has(field)) next.delete(field); else next.add(field);

    // If enabling reading or alias, disable exact match
    if ((field === 'reading' || field === 'alias') && next.has(field)) {
      onChange({ ...filters, searchFields: next, exactMatch: false });
    } else {
      onChange({ ...filters, searchFields: next });
    }
  }

  function toggleExactMatch() {
    const newExactMatch = !filters.exactMatch;

    // If enabling exact match, disable reading and alias
    if (newExactMatch) {
      const next = new Set(filters.searchFields);
      next.delete('reading');
      next.delete('alias');
      onChange({ ...filters, searchFields: next, exactMatch: true });
    } else {
      onChange({ ...filters, exactMatch: false });
    }
  }

  const inputCls =
    "w-full h-8 rounded border border-cosmos-600/40 bg-cosmos-950/60 px-2.5 text-base text-text-primary font-mono outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30";

  return (
    <div className={cn("flex flex-col md:pt-4", className)}>
      {/* Search Fields */}
      <div className="obs-panel-section">
        <SectionLabel>{t('filter.searchFields')}</SectionLabel>
        <div className="grid grid-cols-2 gap-1">
          {SEARCH_FIELD_OPTIONS.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => toggleSearchField(field)}
              className={cn(
                "h-8 rounded text-[11px] font-semibold border transition-colors touch-manipulation",
                filters.searchFields.has(field)
                  ? "bg-gold-400/15 border-gold-400/35 text-gold-300 hover:bg-gold-400/25"
                  : "bg-transparent border-cosmos-600/30 text-text-muted hover:text-text-primary hover:border-cosmos-600/60 hover:bg-cosmos-800/40",
              )}
            >
              {t(`filter.searchField.${field}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleExactMatch}
          className={cn(
            "w-full h-8 rounded text-[11px] font-semibold border transition-colors touch-manipulation mt-1",
            filters.exactMatch
              ? "bg-lavender-400/20 border-lavender-400/35 text-lavender-300 hover:bg-lavender-400/30"
              : "bg-transparent border-cosmos-600/30 text-text-muted hover:text-text-primary hover:border-cosmos-600/60 hover:bg-cosmos-800/40",
          )}
        >
          {t('filter.exactMatch')}
        </button>
      </div>

      {/* Sort */}
      <div className="obs-panel-section">
        <SectionLabel
          action={<ClearBtn hasSelection={sortField !== null} onClear={onClearSort} />}
        >{t('filter.sort')}</SectionLabel>
        <div className="grid grid-cols-2 gap-1">
          {SORT_OPTIONS.map(([field, labelKey]) => (
            <button
              key={field}
              type="button"
              onClick={() => onToggleSort(field)}
              className={cn(
                "flex items-center justify-center gap-0.5 h-8 rounded text-[11px] font-semibold border transition-colors touch-manipulation",
                sortField === field
                  ? "bg-gold-400/15 border-gold-400/35 text-gold-300 hover:bg-gold-400/25"
                  : "bg-transparent border-cosmos-600/30 text-text-muted hover:text-text-primary hover:border-cosmos-600/60 hover:bg-cosmos-800/40",
              )}
            >
              {t(labelKey)}
              {sortField === field && (
                sortDirection === "desc"
                  ? <ArrowDownWideNarrow size={12} />
                  : <ArrowUpNarrowWide size={12} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Version */}
      <div className="obs-panel-section">
        <SectionLabel
          action={<ClearBtn hasSelection={filters.versions.size > 0} onClear={() => onChange({ ...filters, versions: new Set<number>() })} />}
        >
          {t('filter.version')}
        </SectionLabel>
        <div className="grid grid-cols-4 gap-1">
          {VERSION_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => toggleVersion(v)}
              className={cn(
                "h-8 rounded text-xs font-semibold border transition-colors touch-manipulation",
                filters.versions.has(v)
                  ? "bg-gold-400/15 border-gold-400/35 text-gold-300 hover:bg-gold-400/25"
                  : "bg-transparent border-cosmos-600/30 text-text-muted hover:text-text-primary hover:border-cosmos-600/60 hover:bg-cosmos-800/40",
              )}
            >
              {VERSION_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div className="obs-panel-section">
        <SectionLabel
          action={<ClearBtn hasSelection={filters.difficulties.size > 0 || filters.infVers.size > 0} onClear={() => onChange({ ...filters, difficulties: new Set<DifficultyName>(), infVers: new Set<number>() })} />}
        >
          {t('filter.difficulty')}
        </SectionLabel>
        <div className="grid grid-cols-3 gap-1">
          {DIFFICULTY_ORDER.filter((d) => d !== "infinite").map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDif(d)}
              className={cn(
                "h-8 rounded text-[11px] font-bold uppercase tracking-wider border transition-colors touch-manipulation",
                filters.difficulties.has(d)
                  ? cn(d === "ultimate" ? "bg-amber-500" : DIF_BG[d], "text-cosmos-950 border-transparent hover:brightness-110")
                  : "bg-transparent text-text-muted border-cosmos-600/30 hover:border-cosmos-600/60 hover:bg-cosmos-800/40 hover:text-text-primary",
              )}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
          {Object.entries(INF_VER_LABELS).map(([ver, label]) => {
            const v = Number(ver);
            const active = filters.infVers.has(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleInfVer(v)}
                className={cn(
                  "h-8 rounded text-[11px] font-bold uppercase tracking-wider border transition-colors touch-manipulation",
                  !active && "bg-transparent text-text-muted border-cosmos-600/30 hover:border-cosmos-600/60 hover:bg-cosmos-800/40 hover:text-text-primary",
                  active && "border-transparent hover:brightness-110",
                )}
                style={active ? {
                  backgroundColor: INF_VER_COLORS[v],
                  color: "var(--color-cosmos-950)",
                } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Radar Peak */}
      <div className="obs-panel-section">
        <SectionLabel
          action={<ClearBtn hasSelection={filters.radarPeaks.size > 0} onClear={() => onChange({ ...filters, radarPeaks: new Set<RadarPeakKey>() })} />}
        >{t('filter.radarPeak')}</SectionLabel>
        <div className="grid grid-cols-2 gap-1">
          {RADAR_PEAK_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleRadarPeak(key)}
              className={cn(
                "h-8 rounded text-[11px] font-bold border tracking-wide transition-colors touch-manipulation",
                filters.radarPeaks.has(key)
                  ? "bg-lavender-400/20 border-lavender-400/35 text-lavender-300 hover:bg-lavender-400/30"
                  : "bg-transparent border-cosmos-600/30 text-text-muted hover:text-text-primary hover:border-cosmos-600/60 hover:bg-cosmos-800/40",
              )}
            >
              {t(`filter.radarPeaks.${key === 'hand_trip' ? 'handTrip' : key === 'one_hand' ? 'oneHand' : key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Level */}
      <div className="obs-panel-section">
        <SectionLabel
          action={<ClearBtn hasSelection={filters.levelMin !== null || filters.levelMax !== null} onClear={() => onChange({ ...filters, levelInput: '', levelMinRaw: '', levelMaxRaw: '', levelMin: null, levelMax: null })} />}
        >
          {t('filter.level')}
        </SectionLabel>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {([['exact', 'filter.levelMode.exact'], ['int', 'filter.levelMode.int'], ['range', 'filter.levelMode.range']] as const).map(([mode, labelKey]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setLevelMode(mode)}
              className={cn(
                "h-7 rounded text-[11px] font-semibold border transition-colors touch-manipulation",
                filters.levelMode === mode
                  ? "bg-gold-400/15 border-gold-400/35 text-gold-300 hover:bg-gold-400/25"
                  : "bg-transparent border-cosmos-600/30 text-text-muted hover:text-text-primary hover:border-cosmos-600/60 hover:bg-cosmos-800/40",
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        {filters.levelMode === 'range' ? (
          <div className="flex items-center gap-1.5">
            <input type="text" inputMode="decimal" value={filters.levelMinRaw} onChange={(e) => updateLevelMin(e.target.value)} onBlur={handleLevelMinBlur} placeholder={t('filter.placeholder.min')} className={inputCls} />
            <span className="text-xs text-cosmos-600 shrink-0">—</span>
            <input type="text" inputMode="decimal" value={filters.levelMaxRaw} onChange={(e) => updateLevelMax(e.target.value)} onBlur={handleLevelMaxBlur} placeholder={t('filter.placeholder.max')} className={inputCls} />
          </div>
        ) : (
          <input
            type="text"
            inputMode={filters.levelMode === 'int' ? 'numeric' : 'decimal'}
            value={filters.levelInput}
            onChange={(e) => updateLevelInput(e.target.value)}
            placeholder={t(filters.levelMode === 'exact' ? 'filter.placeholder.exactLevel' : 'filter.placeholder.intLevel')}
            className={inputCls}
          />
        )}
      </div>

      {/* BPM range */}
      <div className="obs-panel-section">
        <SectionLabel
          action={<ClearBtn hasSelection={filters.bpmMin !== null || filters.bpmMax !== null} onClear={() => onChange({ ...filters, bpmMinRaw: '', bpmMaxRaw: '', bpmMin: null, bpmMax: null })} />}
        >{t('filter.bpm')}</SectionLabel>
        <div className="flex items-center gap-1.5">
          <input type="text" inputMode="numeric" value={filters.bpmMinRaw} onChange={(e) => updateBpmMin(e.target.value)} onBlur={handleBpmMinBlur} placeholder={t('filter.placeholder.min')} className={inputCls} />
          <span className="text-xs text-cosmos-600 shrink-0">—</span>
          <input type="text" inputMode="numeric" value={filters.bpmMaxRaw} onChange={(e) => updateBpmMax(e.target.value)} onBlur={handleBpmMaxBlur} placeholder={t('filter.placeholder.max')} className={inputCls} />
        </div>
      </div>

      {/* Reset */}
      <div className="obs-panel-section flex justify-center">
        <button
          type="button"
          onClick={() => onChange(createDefaultFilters())}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs text-text-muted hover:text-gold-400 hover:bg-cosmos-800/40 transition-colors touch-manipulation"
        >
          <RotateCcw size={14} />
          {t('common.resetAll')}
        </button>
      </div>
    </div>
  );
}
