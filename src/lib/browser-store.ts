import { createDefaultFilters, type FilterState } from "@/components/browser/FilterBar";
import type { SortDirection, SortField } from "@/api/music";
import { create } from "zustand";

interface BrowserState {
  query: string;
  filters: FilterState;
  sortField: SortField | null;
  sortDirection: SortDirection;
  setQuery: (query: string) => void;
  setFilters: (filters: FilterState) => void;
  setSortField: (field: SortField | null) => void;
  setSortDirection: (direction: SortDirection) => void;
}

export const useBrowserStore = create<BrowserState>((set) => ({
  query: "",
  filters: createDefaultFilters(),
  sortField: "distribution_date",
  sortDirection: "desc",
  setQuery: (query) => set({ query }),
  setFilters: (filters) => set({ filters }),
  setSortField: (field) => set({ sortField: field }),
  setSortDirection: (direction) => set({ sortDirection: direction }),
}));
