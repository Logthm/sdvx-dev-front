import type { FilterState } from "@/components/browser/FilterBar";
import { cn } from "@/lib/utils";
import type { MusicSchema } from "@/types/music";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { MusicCard } from "./MusicCard";

interface MusicGridProps {
  items: MusicSchema[];
  filters?: FilterState;
  onSelect: (music: MusicSchema, difstr?: string) => void;
  onArtistClick?: (artist: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

export function MusicGrid({
  items,
  filters,
  onSelect,
  onArtistClick,
  isLoading,
  hasMore,
  onLoadMore,
  className,
}: MusicGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting) {
        onLoadMoreRef.current?.();
      }
    },
    [],
  );

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "400px",
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, handleIntersect]);

  if (!isLoading && items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-4">
        <div className="w-16 h-16 rounded-full border border-cosmos-600/40 flex items-center justify-center mb-4">
          <span className="text-2xl text-gold-600/40">&#9734;</span>
        </div>
        <p className="text-text-secondary text-sm">No music found</p>
        <p className="text-text-muted text-xs mt-1">
          Adjust your search parameters or filters
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "grid gap-2.5 p-3 sm:p-4",
          "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]",
        )}
      >
        {items.map((m) => (
          <MusicCard
            key={m.id}
            music={m}
            filters={filters}
            onClick={() => onSelect(m)}
            onDifficultyClick={(difstr) => onSelect(m, difstr)}
            onArtistClick={onArtistClick}
          />
        ))}
      </div>

      <div ref={sentinelRef} className="flex justify-center py-6 px-3">
        {isLoading ? (
          <Loader2 size={24} className="animate-spin text-gold-400" />
        ) : !hasMore && items.length > 0 ? (
          <span className="text-xs text-text-muted font-mono tracking-wider">
            &#8212; END OF ARCHIVE &#8212;
          </span>
        ) : null}
      </div>
    </div>
  );
}
