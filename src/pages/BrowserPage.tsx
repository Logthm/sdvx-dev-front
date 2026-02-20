import { useBrowserMusic, type SortField, type SortDirection } from "@/api/music";
import {
    FilterBar,
    createDefaultFilters,
    type FilterState,
} from "@/components/browser/FilterBar";
import { MusicGrid } from "@/components/browser/MusicGrid";
import { SearchBar } from "@/components/browser/SearchBar";
import { Astrolabe } from "@/components/ui/Astrolabe";
import { Tutorial, useTutorialSteps } from "@/components/ui/Tutorial";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useTutorial } from "@/hooks/useTutorial";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, X, HelpCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function BrowserPage() {
  const { t } = useTranslation();
  const tutorialSteps = useTutorialSteps();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(() =>
    createDefaultFilters(),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const navigate = useNavigate();

  // Tutorial state
  const tutorial = useTutorial();

  function toggleSort(field: SortField) {
    if (sortField === field) {
      if (sortDirection === "desc") setSortDirection("asc");
      else { setSortField(null); setSortDirection("desc"); }
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  function clearSort() {
    setSortField(null);
    setSortDirection("desc");
  }

  const browserMusicQuery = useBrowserMusic({
    query,
    size: 40,
    levelMin: filters.levelMin,
    levelMax: filters.levelMax,
    difficulties: filters.difficulties,
    versions: filters.versions,
    bpmMin: filters.bpmMin,
    bpmMax: filters.bpmMax,
    radarPeaks: filters.radarPeaks,
    sortField,
    sortDirection,
  });

  const allMusic = useMemo(() => {
    if (!browserMusicQuery.data?.pages) return [];
    const items = browserMusicQuery.data.pages.flatMap((page) => page.items);
    const deduped = new Map<number, (typeof items)[number]>();
    for (const item of items) deduped.set(item.id, item);
    return Array.from(deduped.values());
  }, [browserMusicQuery.data?.pages]);

  const total = browserMusicQuery.data?.pages[0]?.total ?? 0;

  const hasActiveFilters =
    filters.levelMin !== null ||
    filters.levelMax !== null ||
    filters.difficulties.size > 0 ||
    filters.versions.size > 0 ||
    filters.bpmMin !== null ||
    filters.bpmMax !== null ||
    filters.radarPeaks.size > 0;

  const hasDifficultyFilters =
    filters.levelMin !== null ||
    filters.levelMax !== null ||
    filters.difficulties.size > 0 ||
    filters.radarPeaks.size > 0;

  const isLoading =
    browserMusicQuery.isLoading || browserMusicQuery.isFetchingNextPage;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-cosmos-950 stardust pt-[env(safe-area-inset-top)]">
      {/* Tutorial overlay */}
      <Tutorial
        isOpen={tutorial.isOpen}
        currentStep={tutorial.currentStep}
        steps={tutorialSteps}
        onNext={tutorial.nextStep}
        onPrev={tutorial.prevStep}
        onClose={tutorial.closeTutorial}
        onSkip={tutorial.skipTutorial}
      />

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 lg:w-60 shrink-0 border-r border-cosmos-600/20 bg-cosmos-900/50 relative z-10" data-tutorial="filter-sidebar">
        <div className="flex-1 overflow-y-auto">
          <FilterBar filters={filters} onChange={setFilters} sortField={sortField} sortDirection={sortDirection} onToggleSort={toggleSort} onClearSort={clearSort} />
        </div>
      </aside>

      {/* ── Mobile filter drawer ── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-cosmos-950/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-cosmos-900 border-r border-cosmos-600/30 flex flex-col animate-slide-in-left">
            <div className="shrink-0 flex items-center justify-end px-3 mt-3 h-12 border-b border-cosmos-600/20">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded text-text-muted hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FilterBar filters={filters} onChange={setFilters} sortField={sortField} sortDirection={sortDirection} onToggleSort={toggleSort} onClearSort={clearSort} />
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 coord-grid">
        {/* Astrolabe watermark */}
        <Astrolabe className="absolute -right-20 -top-20 w-[400px] h-[400px] hidden lg:block" opacity={0.04} />
        {/* Top bar */}
        <header className="shrink-0 flex items-center gap-2 px-4 my-4 h-14 md:h-12 border-b border-cosmos-600/20 bg-cosmos-900/40 backdrop-blur-sm relative z-20">
          {/* Mobile filter toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            data-tutorial="filter-button"
            className={cn(
              "md:hidden shrink-0 p-1.5 rounded-md border transition-colors",
              hasActiveFilters
                ? "border-gold-400/30 text-gold-400"
                : "border-cosmos-600/30 text-text-muted hover:text-text-primary",
            )}
          >
            <SlidersHorizontal size={16} />
          </button>

<SearchBar
            value={query}
            onChange={setQuery}
            className="flex-1 min-w-0"
            data-tutorial="search-bar"
          />

          <span className="hidden sm:block ml-3 text-xs font-mono text-text-muted whitespace-nowrap">
            {total} {t('common.records')}
          </span>

          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Tutorial button */}
          <button
            type="button"
            onClick={tutorial.resetTutorial}
            className="shrink-0 p-1.5 rounded-md border border-cosmos-600/30 text-text-muted hover:text-accent hover:border-accent/30 transition-colors"
            title={t('tutorial.viewTutorial')}
            data-tutorial="tutorial-button"
          >
            <HelpCircle size={16} />
          </button>
        </header>

        {/* Grid area */}
        <main className="flex-1 overflow-y-auto" data-tutorial="music-grid">
          <MusicGrid
            items={allMusic}
            filters={hasDifficultyFilters ? filters : undefined}
            onSelect={(music, difstr) =>
              navigate(
                difstr ? `/song/${music.id}?dif=${difstr}` : `/song/${music.id}`,
              )
            }
            onArtistClick={setQuery}
            isLoading={isLoading}
            hasMore={browserMusicQuery.hasNextPage}
            onLoadMore={() => browserMusicQuery.fetchNextPage()}
          />
        </main>
      </div>
    </div>
  );
}
