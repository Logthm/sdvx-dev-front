export interface RadarSchema {
  notes: number;
  peak: number;
  tsumami: number;
  tricky: number;
  hand_trip: number;
  one_hand: number;
}

export interface DifficultySchema {
  difstr: DifficultyName;
  difnum: string;
  raw_illustrator: string;
  illustrator: string;
  raw_effected_by: string;
  effected_by: string;
  price: number;
  limited: number;
  jacket_print: number;
  jacket_mask: number;
  max_exscore: number;
  max_chain: number;
  chip_count: number;
  hold_count: number;
  tsumami_count: number;
  radar: RadarSchema;
  cover_url: string;
  chart_url: string;
}

export interface MusicSchema {
  id: number;
  raw_title_name: string;
  title_name: string;
  main_title_name: string;
  sub_title_name: string;
  title_yomigana: string;
  title_romaji: string;
  raw_artist_name: string;
  artist_name: string;
  artist_yomigana: string;
  artist_romaji: string;
  ascii: string;
  bpm_max: string;
  bpm_min: string;
  distribution_date: string;
  volume: number;
  bg_no: number;
  genre: number;
  genre_name: string[];
  is_fixed: number;
  version: number;
  demo_pri: number;
  inf_ver: number;
  difficulty: DifficultySchema[];
}

export type DifficultyName =
  | "novice"
  | "advanced"
  | "exhaust"
  | "infinite"
  | "maximum"
  | "ultimate";

export const DIFFICULTY_ORDER: DifficultyName[] = [
  "novice",
  "advanced",
  "exhaust",
  "infinite",
  "maximum",
  "ultimate",
];

export const DIFFICULTY_LABELS: Record<DifficultyName, string> = {
  novice: "NOV",
  advanced: "ADV",
  exhaust: "EXH",
  infinite: "INF",
  maximum: "MXM",
  ultimate: "ULT",
};

export const DIFFICULTY_COLORS: Record<DifficultyName, string> = {
  novice: "var(--color-diff-novice)",
  advanced: "var(--color-diff-advanced)",
  exhaust: "var(--color-diff-exhaust)",
  infinite: "var(--color-diff-infinite)",
  maximum: "var(--color-diff-maximum)",
  ultimate: "var(--color-diff-ultimate)",
};

export interface SearchResultItem {
  id: number | null;
  external_key: string | null;
  source: "canonical" | "scraped";
  title_name: string;
  title_romaji: string;
  artist_name: string;
  bpm_max: string;
  bpm_min: string;
  genre_name: string[];
  match_type: string;
  rank: number | null;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  query: string;
  size: number;
  offset: number;
  has_more: boolean;
}

export interface BrowserMusicListResponse {
  items: MusicSchema[];
  total: number;
  query: string;
  size: number;
  offset: number;
  has_more: boolean;
}

export function formatBpm(bpmMax: string, bpmMin: string): string {
  const max = Number(bpmMax) / 100;
  const min = Number(bpmMin) / 100;
  if (max === min) return String(max);
  return `${min}-${max}`;
}
