import { useArrangedChartData, useChartData, useChartEditability } from "@/api/chart";
import { coverUrl } from "@/api/client";
import { useMusic } from "@/api/music";
import { ChartCanvas } from "@/components/editor/ChartCanvas";
import { ChartPreview } from "@/components/editor/ChartPreview";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { PlaybackCanvas } from "@/components/editor/PlaybackCanvas";
import { PlaybackToolbar } from "@/components/editor/PlaybackToolbar";
import { RenderOptionsBar } from "@/components/editor/RenderOptionsBar";
import { Astrolabe } from "@/components/ui/Astrolabe";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { RadarChart } from "@/components/ui/RadarChart";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Tutorial, useChartTutorialSteps } from "@/components/ui/Tutorial";
import { useTutorial } from "@/hooks/useTutorial";
import { useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import {
    DIFFICULTY_LABELS,
    DIFFICULTY_ORDER,
    formatBpm,
    getInfLabel,
    type DifficultyName,
    type DifficultySchema,
} from "@/types/music";
import { ArrowLeft, ChevronDown, ChevronUp, Eye, HelpCircle, Loader2, Pencil, Play, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

function DataRow({ label, value, valueClassName }: { label: string; value: string | number; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </span>
      <span className={cn("text-sm font-mono text-text-primary", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export function SongDetailPage() {
  const { t, i18n } = useTranslation();
  const allChartSteps = useChartTutorialSteps();
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

  // Combined tutorial: preview steps + edit steps (if canEdit), one continuous flow
  const chartTutorial = useTutorial("sdvx-chart-tutorial");
  const chartTutorialSteps = canEdit
    ? [...allChartSteps.slice(0, 5), allChartSteps[6], allChartSteps[5], ...allChartSteps.slice(7)]
    : [...allChartSteps.slice(0, 5), allChartSteps[6], allChartSteps[allChartSteps.length - 1]];

  const chartQuery = useChartData(
    canEdit ? numericId : null,
    canEdit ? (activeDif?.difstr ?? null) : null,
  );
  const chart = chartQuery.data;

  const setOriginalChartData = useEditorStore((s) => s.setOriginalChartData);
  const setArrangedBaseData = useEditorStore((s) => s.setArrangedBaseData);
  const clearArrangedBaseData = useEditorStore((s) => s.clearArrangedBaseData);
  const editorChartData = useEditorStore((s) => s.chartData);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const renderOptions = useEditorStore((s) => s.renderOptions);
  const setRenderOptions = useEditorStore((s) => s.setRenderOptions);
  const setMouseTool = useEditorStore((s) => s.setMouseTool);
  const setExpandedTool = useEditorStore((s) => s.setExpandedTool);
  const mobileFullscreen = useEditorStore((s) => s.mobileFullscreen);

  // Fetch backend-arranged chart data when arrangement is non-normal and song is editable
  const arrangedQuery = useArrangedChartData(
    canEdit ? numericId : null,
    canEdit ? (activeDif?.difstr ?? null) : null,
    renderOptions,
    canEdit && renderOptions.arrangementMode !== "normal",
  );

  useEffect(() => {
    if (!canEdit && (mode === "edit" || mode === "play")) setMode("preview");
  }, [canEdit, mode, setMode]);

  useEffect(() => {
    if (chart) setOriginalChartData(chart);
  }, [chart, setOriginalChartData]);

  // When backend-arranged data arrives, push it into the store
  useEffect(() => {
    if (arrangedQuery.data) {
      setArrangedBaseData(arrangedQuery.data);
    } else if (renderOptions.arrangementMode === "normal") {
      clearArrangedBaseData();
    }
  }, [arrangedQuery.data, renderOptions.arrangementMode, setArrangedBaseData, clearArrangedBaseData]);

  // Auto-switch mode/arrangement/mouseTool based on tutorial step
  // canEdit: 0=welcome,1=difficulty,2=sidebar,3=modeToggle,4=previewOptions,5=drawArea,6=editMode,7=pan,8=move,9=move2,10=editPointer,11=add,12=reset,13=delete,14=finish
  // !canEdit: 0=welcome,1=difficulty,2=sidebar,3=modeToggle,4=previewOptions,5=drawArea,6=finish
  useEffect(() => {
    if (!chartTutorial.isOpen) return;
    const step = chartTutorial.currentStep;
    // Sidebar/toolbar visibility
    if (step >= 1 && step <= 2) {
      setSidebarCollapsed(false); setToolbarCollapsed(true);
    } else if (step >= 3) {
      setSidebarCollapsed(true); setToolbarCollapsed(false);
    }
    // Mode & tools
    if (canEdit && step >= 6 && step <= 13) {
      if (mode !== "edit") setMode("edit");
      if (step === 7) { setMouseTool("pan"); setExpandedTool(null); }
      else if (step === 8 || step === 9) { setMouseTool("move"); setExpandedTool("drag"); }
      else if (step === 10) { setMouseTool("edit-hs"); setExpandedTool(null); }
      else if (step === 11) { setMouseTool("add-bt"); setExpandedTool("add"); }
      else if (step === 12 || step === 13) { setMouseTool("move"); setExpandedTool(null); }
      else { setExpandedTool(null); }
    } else if (step === 4) {
      setMode("preview");
      if (renderOptions.arrangementMode !== "random") setRenderOptions({ arrangementMode: "random" });
    } else {
      if (mode === "edit" || mode === "play") setMode("preview");
      if (renderOptions.arrangementMode !== "normal") setRenderOptions({ arrangementMode: "normal" });
    }
  }, [chartTutorial.isOpen, chartTutorial.currentStep, canEdit, setMode, setRenderOptions, setMouseTool, setExpandedTool]);

  const coverSrc =
    music && activeDif ? coverUrl(music.id, activeDif.difstr) : undefined;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-cosmos-950 stardust">
      {/* Tutorial overlay */}
      <Tutorial
        isOpen={chartTutorial.isOpen}
        currentStep={chartTutorial.currentStep}
        steps={chartTutorialSteps}
        onNext={chartTutorial.nextStep}
        onPrev={chartTutorial.prevStep}
        onClose={chartTutorial.closeTutorial}
        onSkip={chartTutorial.skipTutorial}
      />

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
            <h1 className="text-sm font-semibold text-text-primary truncate font-ja">
              {music.title_name}
            </h1>
            <span className="text-xs text-text-muted truncate hidden sm:block font-ja">
              {music.artist_name}
            </span>
          </div>
        ) : (
          <div className="h-3 w-32 bg-cosmos-700 rounded animate-pulse" />
        )}
        {/* Difficulty selector */}
        <div className="hidden md:flex items-center gap-2 shrink-0 flex-wrap justify-end" data-tutorial="chart-difficulty">
          {sortedDiffs.map((d) => (
            <DifficultyBadge
              key={d.difstr}
              difstr={d.difstr as DifficultyName}
              level={d.difnum}
              infVer={music?.inf_ver}
              selected={activeDif?.difstr === d.difstr}
              onClick={() => setSelectedDif(d)}
            />
          ))}
        </div>
        {/* Mobile YouTube button */}
        {activeDif && music && (
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`sdvx ${music.title_name} ${activeDif.difstr === "infinite" ? getInfLabel(music.inf_ver) : DIFFICULTY_LABELS[activeDif.difstr]}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="md:hidden shrink-0 p-1.5 rounded-md border border-cosmos-600/30 text-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
            title={t('chart.chartPreview')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </a>
        )}
        {/* Language switcher */}
        <LanguageSwitcher />

        {/* Tutorial button */}
        <button
          type="button"
          onClick={() => {
            chartTutorial.resetTutorial();
          }}
          className="shrink-0 p-1.5 rounded-md border border-cosmos-600/30 text-text-muted hover:text-accent hover:border-accent/30 transition-colors"
          title={t('tutorial.viewTutorial')}
          data-tutorial="tutorial-button"
        >
          <HelpCircle size={16} />
        </button>
      </header>

      {/* ── Main content ── */}
      {musicQuery.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-accent" />
        </div>
      ) : !music ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-text-muted">{t('chart.songNotFound')}</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative coord-grid">
          {/* Astrolabe watermark */}
          <Astrolabe className="absolute right-4 bottom-4 w-[300px] h-[300px] hidden md:block" opacity={0.05} />
          {/* ── Metadata sidebar ── */}
          <aside className={cn("shrink-0 md:w-60 lg:w-64 border-b md:border-b-0 md:border-r border-cosmos-600/20 bg-cosmos-900/30 relative z-10 flex flex-col max-h-[50vh] md:max-h-none md:overflow-y-auto", mobileFullscreen && "hidden md:flex")}>
            {/* Scrollable info section (mobile only scrolls independently) */}
            <div className="flex-1 overflow-y-auto min-h-0 md:flex-none md:overflow-visible" data-tutorial="chart-sidebar">
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
                <h2 className="text-sm font-bold text-text-primary leading-tight break-words font-ja">{music.title_name}</h2>
                {music.title_yomigana && music.title_yomigana !== music.title_name && (() => {
                  const displayText = i18n.language === "ja" ? music.title_yomigana : (music.title_romaji || music.title_yomigana);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const utterance = new SpeechSynthesisUtterance(music.title_yomigana);
                        utterance.lang = "ja-JP";
                        utterance.rate = 0.9;
                        speechSynthesis.cancel();
                        speechSynthesis.speak(utterance);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors cursor-pointer mt-0.5 font-ja text-left"
                      title={t('chart.speakTitle')}
                    >
                      <Volume2 size={11} className="shrink-0" />
                      <span>{displayText}</span>
                    </button>
                  );
                })()}
                {music.sub_title_name && (
                  <p className="text-xs text-text-muted break-words font-ja">{music.sub_title_name}</p>
                )}
                <p className="text-xs text-text-secondary break-words mt-0.5 font-ja">{music.artist_name}</p>
                {music.artist_yomigana && music.artist_yomigana !== music.artist_name && (() => {
                  const displayText = i18n.language === "ja" ? music.artist_yomigana : (music.artist_romaji || music.artist_yomigana);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const utterance = new SpeechSynthesisUtterance(music.artist_yomigana);
                        utterance.lang = "ja-JP";
                        utterance.rate = 0.9;
                        speechSynthesis.cancel();
                        speechSynthesis.speak(utterance);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors cursor-pointer mt-0.5 font-ja text-left"
                      title={t('chart.speakArtist')}
                    >
                      <Volume2 size={11} className="shrink-0" />
                      <span>{displayText}</span>
                    </button>
                  );
                })()}
              </div>
              <button
                onClick={() => { setSidebarCollapsed((v) => !v); setToolbarCollapsed(true); }}
                className="md:hidden p-1 rounded text-text-muted hover:text-gold-400 transition-colors self-center shrink-0"
              >
                {sidebarCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
              {activeDif && (
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`sdvx ${music.title_name} ${activeDif.difstr === "infinite" ? getInfLabel(music.inf_ver) : DIFFICULTY_LABELS[activeDif.difstr]}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-red-400 border border-cosmos-600/20 hover:border-red-400/30 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  {t('chart.chartPreview')}
                </a>
              )}
            </div>

            {/* Mobile difficulty selector */}
            {!sidebarCollapsed && (
              <div className="obs-panel-section flex items-center gap-2 flex-wrap md:hidden" data-tutorial="chart-difficulty-mobile">
                {sortedDiffs.map((d) => (
                  <DifficultyBadge
                    key={d.difstr}
                    difstr={d.difstr as DifficultyName}
                    level={d.difnum}
                    infVer={music?.inf_ver}
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
              <DataRow label={t('chart.version')} value={music.version} />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{t('chart.genre')}</span>
                <span className="text-sm font-mono text-text-primary font-ja text-right">
                  {music.genre_name.length > 0 ? music.genre_name.map((g, i) => <div key={i}>{g}</div>) : "—"}
                </span>
              </div>
              {activeDif && (
                <>
                  <DataRow label={t('chart.exScore')} value={activeDif.max_exscore.toLocaleString()} />
                  <DataRow label={t('chart.chain')} value={activeDif.max_chain.toLocaleString()} />
                  <DataRow label={t('chart.chips')} value={activeDif.chip_count} />
                  <DataRow label={t('chart.holds')} value={activeDif.hold_count} />
                  <DataRow label={t('chart.tsumami')} value={activeDif.tsumami_count} />
                </>
              )}
            </div>

            {/* Credits */}
            {activeDif && (
              <div className="obs-panel-section text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">{t('chart.illustrator')}</span>
                  <span className="text-text-secondary text-right break-words ml-2 font-ja">{activeDif.illustrator || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">{t('chart.effector')}</span>
                  <span className="text-text-secondary text-right break-words ml-2 font-ja">{activeDif.effected_by || "—"}</span>
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
            <div className="shrink-0 obs-panel-section flex flex-col gap-3 bg-cosmos-800/25 border-t-2 border-gold-400/25 !pb-3 md:!pb-6">
              <div className="flex bg-cosmos-800/60 rounded-md p-0.5 border border-cosmos-600/20" data-tutorial="chart-mode-toggle">
                <button
                  onClick={() => setMode("preview")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all",
                    mode === "preview" ? "bg-gold-400/15 text-gold-400" : "text-text-muted hover:text-text-primary",
                  )}
                >
                  <Eye size={14} /> {t('chart.preview')}
                </button>
                {canEdit && (
                  <button
                    onClick={() => setMode("edit")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all",
                      mode === "edit" ? "bg-gold-400/15 text-gold-400" : "text-text-muted hover:text-text-primary",
                    )}
                  >
                    <Pencil size={14} /> {t('chart.edit')}
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => setMode("play")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all",
                      mode === "play" ? "bg-gold-400/15 text-gold-400" : "text-text-muted hover:text-text-primary",
                    )}
                  >
                    <Play size={14} /> {t('chart.play')}
                  </button>
                )}
                <button
                  onClick={() => { setToolbarCollapsed((v) => !v); setSidebarCollapsed(true); }}
                  className="md:hidden px-2 flex items-center text-text-muted hover:text-gold-400 transition-colors"
                >
                  {toolbarCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
              <div className={cn(toolbarCollapsed ? "hidden md:block" : "block")} data-tutorial="chart-render-options">
                {mode === "preview" && <RenderOptionsBar />}
                {mode === "edit" && (
                  <>
                    <RenderOptionsBar />
                    <div className="border-t border-cosmos-600/20 my-2" />
                    <EditorToolbar />
                  </>
                )}
                {mode === "play" && <PlaybackToolbar />}
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
                <span className="text-sm text-text-muted">{t('chart.loadingChart')}</span>
              </div>
            ) : chartQuery.isError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <span className="text-sm text-diff-exhaust">{t('chart.loadFailed')}</span>
                <button onClick={() => chartQuery.refetch()} className="text-xs text-accent hover:underline">{t('chart.retry')}</button>
              </div>
            ) : chart ? (
              mode === "play" ? (
                <PlaybackCanvas chartData={editorChartData ?? chart} className="w-full h-full" />
              ) : (
                <ChartCanvas chartData={editorChartData ?? chart} className="w-full h-full" />
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
