import type {
  BrowserMusicListResponse,
  MusicSchema,
  SearchResponse,
} from "@/types/music";
import {
  useInfiniteQuery,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiFetch } from "./client";

// ── Search ──────────────────────────────────────────────────────
export interface SearchParams {
  query: string;
  size?: number;
  enable_fuzzy?: boolean;
  sources?: string;
}

export function useSearchMusic(params: SearchParams) {
  const size = params.size ?? 20;

  return useInfiniteQuery({
    queryKey: ["search", params] as const,
    queryFn: async ({ pageParam = 0 }) => {
      const sp = new URLSearchParams({
        query: params.query,
        size: String(size),
        offset: String(pageParam),
        enable_fuzzy: String(params.enable_fuzzy ?? true),
        sources: params.sources ?? "canonical,scraped",
      });
      return apiFetch<SearchResponse>(`/search?${sp}`);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.offset + lastPage.size : undefined,
    enabled: params.query.length > 0,
    staleTime: 60_000,
  });
}

// ── Frontend browser music feed ─────────────────────────────────
export type SortField = "difficulty" | "distribution_date" | "title_name" | "artist_name";
export type SortDirection = "asc" | "desc";

export interface BrowserMusicParams {
  query?: string;
  size?: number;
  levelMin?: number | null;
  levelMax?: number | null;
  difficulties?: Set<string>;
  infVers?: Set<number>;
  versions?: Set<number>;
  bpmMin?: number | null;
  bpmMax?: number | null;
  radarPeaks?: Set<string>;
  sortField?: SortField | null;
  sortDirection?: SortDirection;
  searchFields?: Set<string>;
  exactMatch?: boolean;
}

export function useBrowserMusic(params: BrowserMusicParams) {
  const size = params.size ?? 40;
  const query = (params.query ?? "").trim();
  const levelMin = params.levelMin ?? null;
  const levelMax = params.levelMax ?? null;
  const difficulties = params.difficulties
    ? [...params.difficulties].sort()
    : [];
  const infVers = params.infVers
    ? [...params.infVers].sort((a, b) => a - b)
    : [];
  const versions = params.versions
    ? [...params.versions].sort((a, b) => a - b)
    : [];
  const bpmMin = params.bpmMin ?? null;
  const bpmMax = params.bpmMax ?? null;
  const radarPeaks = params.radarPeaks ? [...params.radarPeaks].sort() : [];
  const sortField = params.sortField ?? null;
  const sortDirection = params.sortDirection ?? "desc";
  const searchFields = params.searchFields ? [...params.searchFields].sort() : [];
  const exactMatch = params.exactMatch ?? false;

  return useInfiniteQuery({
    queryKey: [
      "browser",
      "music",
      {
        query,
        size,
        levelMin,
        levelMax,
        difficulties,
        infVers,
        versions,
        bpmMin,
        bpmMax,
        radarPeaks,
        sortField,
        sortDirection,
        searchFields,
        exactMatch,
      },
    ] as const,
    queryFn: async ({ pageParam = 0 }) => {
      const sp = new URLSearchParams({
        query,
        size: String(size),
        offset: String(pageParam),
      });
      if (levelMin !== null) sp.set("level_min", String(levelMin));
      if (levelMax !== null) sp.set("level_max", String(levelMax));
      if (difficulties.length) sp.set("difficulties", difficulties.join(","));
      if (infVers.length) sp.set("inf_vers", infVers.join(","));
      if (versions.length) sp.set("versions", versions.join(","));
      if (bpmMin !== null) sp.set("bpm_min", String(bpmMin));
      if (bpmMax !== null) sp.set("bpm_max", String(bpmMax));
      if (radarPeaks.length) sp.set("radar_peaks", radarPeaks.join(","));
      if (searchFields.length) sp.set("fields", searchFields.join(","));
      if (exactMatch) sp.set("enable_fuzzy", "false");
      if (sortField) {
        sp.set("sort_field", sortField);
        sp.set("sort_direction", sortDirection);
      }
      return apiFetch<BrowserMusicListResponse>(
        `/frontend/browser/music?${sp}`,
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.offset + lastPage.size : undefined,
    staleTime: 60_000,
  });
}

// ── Batch music fetch ───────────────────────────────────────────
export function useMusicBatch(
  ids: number[],
  options?: Partial<UseQueryOptions<MusicSchema[]>>,
) {
  return useQuery({
    queryKey: ["music", "batch", ids] as const,
    queryFn: async () => {
      return apiFetch<MusicSchema[]>("/music", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    ...options,
  });
}

// ── Single music fetch ──────────────────────────────────────────
export function useMusic(id: number | null) {
  return useQuery({
    queryKey: ["music", "single", id] as const,
    queryFn: async () => {
      return apiFetch<MusicSchema[]>("/music", {
        method: "POST",
        body: JSON.stringify({ ids: [id] }),
      }).then((list) => list[0] ?? null);
    },
    enabled: id !== null,
    staleTime: 5 * 60_000,
  });
}
