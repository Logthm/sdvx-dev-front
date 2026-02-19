import { useChartData, useChartEditability } from "@/api/chart";
import { coverUrl } from "@/api/client";
import { useMusic } from "@/api/music";
import { ChartCanvas } from "@/components/editor/ChartCanvas";
import { ChartPreview } from "@/components/editor/ChartPreview";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { RenderOptionsBar } from "@/components/editor/RenderOptionsBar";
import { Astrolabe } from "@/components/ui/Astrolabe";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { RadarChart } from "@/components/ui/RadarChart";
import { useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import {
    DIFFICULTY_ORDER,
    formatBpm,
    type DifficultyName,
    type DifficultySchema,
} from "@/types/music";
import { ArrowLeft, ChevronDown, ChevronUp, Eye, Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

function DataRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </span>
      <span className="text-sm font-mono text-text-primary">
        {value}
      </span>
    </div>
  );
}

export function SongDetailPage() {
  const { musicId } = useParams<{ musicId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const numericId = musicId ? parseInt(musicId, 10) : null;
  const initialDif = searchParams.get("dif");
  const musicQuery = useMusic(numericId);
  const music = musicQuery.data;

  const sortedDiffs = music
    ? [...music.difficulty].sort(
        (a, b) =>
          DIFFICULTY_ORDER.indexOf(a.difstr) -
          DIFFICULTY_ORDER.indexOf(b.difstr),
      )
    : [];

  const [selectedDif, setSelectedDif] = useState<DifficultySchema | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(true);

  useEffect(() => {
    if (sortedDiffs.length > 0 && !selectedDif) {
      const fromUrl = initialDif
        ? sortedDiffs.find((d) => d.difstr === initialDif)
        : undefined;
      setSelectedDif(fromUrl ?? sortedDiffs[sortedDiffs.length - 1]);
    }
  }, [sortedDiffs, selectedDif, initialDif]);

  const activeDif = selectedDif ?? sortedDiffs[sortedDiffs.length - 1] ?? null;
  const editabilityQuery = useChartEditability(numericId);
  const canEdit =
    editabilityQuery.data?.editable_difficulties?.includes(activeDif?.difstr ?? "") ?? false;

  const chartQuery = useChartData(
    canEdit ? numericId : null,
    canEdit ? (activeDif?.difstr ?? null) : null,
  );
  const chart = chartQuery.data;

  const setOriginalChartData = useEditorStore((s) => s.setOriginalChartData);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const renderOptions = useEditorStore((s) => s.renderOptions);
  const mobileFullscreen = useEditorStore((s) => s.mobileFullscreen);

  useEffect(() => {
    if (!canEdit && mode === "edit") setMode("preview");
  }, [canEdit, mode, setMode]);

  useEffect(() => {
    if (chart) setOriginalChartData(chart);
  }, [chart, setOriginalChartData]);

  const coverSrc =
    music && activeDif ? coverUrl(music.id, activeDif.difstr) : undefined;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-cosmos-950 stardust">
      {/* ── Top bar ── */}
      <header className="shrink-0 relative z-20 flex items-center gap-2 px-3 py-4 border-b border-cosmos-600/20 bg-cosmos-900/40 backdrop-blur-sm">
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded text-text-muted hover:text-gold-400 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        {music ? (
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <h1 className="text-sm font-semibold text-text-primary truncate">
              {music.title_name}
            </h1>
            <span className="text-xs text-text-muted truncate hidden sm:block">
              {music.artist_name}
            </span>
          </div>
        ) : (
          <div className="h-3 w-32 bg-cosmos-700 rounded animate-pulse" />
        )}
        {/* Difficulty selector */}
        <div className="hidden md:flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {sortedDiffs.map((d) => (
            <DifficultyBadge
              key={d.difstr}
              difstr={d.difstr as DifficultyName}
              level={d.difnum}
              selected={activeDif?.difstr === d.difstr}
              onClick={() => setSelectedDif(d)}
            />
          ))}
        </div>
      </header>

      {/* ── Main content ── */}
      {musicQuery.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-accent" />
        </div>
      ) : !music ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-text-muted">Song not found</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative coord-grid">
          {/* Astrolabe watermark */}
          <Astrolabe className="absolute right-4 bottom-4 w-[300px] h-[300px] hidden md:block" opacity={0.05} />
          {/* ── Metadata sidebar ── */}
          <aside className={cn("shrink-0 md:w-60 lg:w-64 border-b md:border-b-0 md:border-r border-cosmos-600/20 bg-cosmos-900/30 relative z-10 flex flex-col max-h-[50vh] md:max-h-none md:overflow-y-auto", mobileFullscreen && "hidden md:flex")}>
            {/* Scrollable info section (mobile only scrolls independently) */}
            <div className="flex-1 overflow-y-auto min-h-0 md:flex-none md:overflow-visible">
            {/* Cover + title + collapse toggle */}
            <div className="obs-panel-section flex md:flex-col gap-3">
              <div className="w-16 h-16 md:w-full md:h-auto md:aspect-square rounded overflow-hidden bg-cosmos-800 shrink-0">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={music.title_name}
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xl font-bold text-cosmos-600">{music.title_name.charAt(0)}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex flex-col justify-center md:justify-start flex-1">
                <h2 className="text-sm font-bold text-text-primary leading-tight break-words">{music.title_name}</h2>
                {music.sub_title_name && (
                  <p className="text-xs text-text-muted break-words">{music.sub_title_name}</p>
                )}
                <p className="text-xs text-text-secondary break-words mt-0.5">{music.artist_name}</p>
              </div>
              <button
                onClick={() => { setSidebarCollapsed((v) => !v); setToolbarCollapsed(true); }}
                className="md:hidden p-1 rounded text-text-muted hover:text-gold-400 transition-colors self-center shrink-0"
              >
                {sidebarCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>

            {/* Mobile difficulty selector */}
            {!sidebarCollapsed && (
              <div className="obs-panel-section flex items-center gap-2 flex-wrap md:hidden">
                {sortedDiffs.map((d) => (
                  <DifficultyBadge
                    key={d.difstr}
                    difstr={d.difstr as DifficultyName}
                    level={d.difnum}
                    selected={activeDif?.difstr === d.difstr}
                    onClick={() => setSelectedDif(d)}
                  />
                ))}
              </div>
            )}

            {/* Collapsible content (mobile only collapses) */}
            <div className={cn(sidebarCollapsed && "hidden md:block")}>
            {/* Data rows */}
            <div className="obs-panel-section">
              <DataRow label="BPM" value={formatBpm(music.bpm_max, music.bpm_min)} />
              <DataRow label="Version" value={music.version} />
              <DataRow label="Genre" value={music.genre_name[0] ?? "—"} />
              {activeDif && (
                <>
                  <DataRow label="EX Score" value={activeDif.max_exscore.toLocaleString()} />
                  <DataRow label="Chain" value={activeDif.max_chain.toLocaleString()} />
                  <DataRow label="Chips" value={activeDif.chip_count} />
                  <DataRow label="Holds" value={activeDif.hold_count} />
                  <DataRow label="Tsumami" value={activeDif.tsumami_count} />
                </>
              )}
            </div>

            {/* Credits */}
            {activeDif && (
              <div className="obs-panel-section text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">Illust.</span>
                  <span className="text-text-secondary text-right break-words ml-2">{activeDif.illustrator || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">Effector</span>
                  <span className="text-text-secondary text-right break-words ml-2">{activeDif.effected_by || "—"}</span>
                </div>
              </div>
            )}

            {/* Radar */}
            {activeDif && (
              <div className="obs-panel-section">
                <div className="w-full aspect-square max-w-[220px] mx-auto">
                  <RadarChart data={activeDif.radar} size={220} />
                </div>
              </div>
            )}

            </div>{/* end collapsible */}

            </div>{/* end scrollable info section */}

            {/* ── Controls (always visible, fixed at bottom) ── */}
            <div className="shrink-0 obs-panel-section flex flex-col gap-3 bg-cosmos-800/25 border-t-2 border-gold-400/25">
              <div className="flex bg-cosmos-800/60 rounded-md p-0.5 border border-cosmos-600/20">
                <button
                  onClick={() => setMode("preview")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all",
                    mode === "preview" ? "bg-gold-400/15 text-gold-400" : "text-text-muted hover:text-text-primary",
                  )}
                >
                  <Eye size={14} /> Preview
                </button>
                {canEdit && (
                  <button
                    onClick={() => setMode("edit")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all",
                      mode === "edit" ? "bg-gold-400/15 text-gold-400" : "text-text-muted hover:text-text-primary",
                    )}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                )}
                <button
                  onClick={() => { setToolbarCollapsed((v) => !v); setSidebarCollapsed(true); }}
                  className="md:hidden px-2 flex items-center text-text-muted hover:text-gold-400 transition-colors"
                >
                  {toolbarCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
              <div className={cn(toolbarCollapsed ? "hidden md:block" : "block")}>
                {mode === "preview" && <RenderOptionsBar />}
                {mode === "edit" && <EditorToolbar />}
              </div>
            </div>
          </aside>

          {/* ── Chart area (main focus) ── */}
          <div className="flex-1 overflow-hidden relative z-10">
            {mode === "preview" ? (
              numericId && activeDif ? (
                <ChartPreview
                  musicId={numericId}
                  difstr={activeDif.difstr}
                  renderOptions={renderOptions}
                  className="w-full h-full"
                />
              ) : null
            ) : chartQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 size={24} className="animate-spin text-accent" />
                <span className="text-sm text-text-muted">Loading chart...</span>
              </div>
            ) : chartQuery.isError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <span className="text-sm text-diff-exhaust">Failed to load chart</span>
                <button onClick={() => chartQuery.refetch()} className="text-xs text-accent hover:underline">Retry</button>
              </div>
            ) : chart ? (
              <ChartCanvas chartData={chart} className="w-full h-full" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
