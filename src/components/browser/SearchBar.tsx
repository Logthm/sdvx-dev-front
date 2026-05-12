import { useSearchSuggestions } from "@/api/music";
import { coverUrl } from "@/api/client";
import { cn } from "@/lib/utils";
import type { SearchResultItem } from "@/types/music";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSuggestionSelect?: (item: SearchResultItem) => void;
  className?: string;
  "data-tutorial"?: string;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChange, onSuggestionSelect, className, "data-tutorial": dataTutorial, autoFocus }: SearchBarProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(value);
  const [suggestQuery, setSuggestQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const composingRef = useRef(false);

  const { data: suggestionsData } = useSearchSuggestions(
    onSuggestionSelect ? suggestQuery : "",
  );
  const suggestions = suggestionsData?.results?.filter(r => r.id !== null) ?? [];

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function updateSuggestions(v: string) {
    clearTimeout(suggestDebounceRef.current);
    if (!v.trim()) {
      setSuggestQuery("");
      setShowSuggestions(false);
      return;
    }
    suggestDebounceRef.current = setTimeout(() => {
      setSuggestQuery(v);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    }, 150);
  }

  function handleChange(v: string) {
    setLocal(v);
    if (!composingRef.current) {
      updateSuggestions(v);
    }
    if (!v.trim()) {
      clearTimeout(debounceRef.current);
      onChange("");
      return;
    }
    if (composingRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 600);
  }

  function handleCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    composingRef.current = false;
    const v = e.currentTarget.value;
    updateSuggestions(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 600);
  }

  function submitSearch() {
    setShowSuggestions(false);
    clearTimeout(debounceRef.current);
    onChange(local);
  }

  function handleClear() {
    setLocal("");
    setSuggestQuery("");
    setShowSuggestions(false);
    clearTimeout(debounceRef.current);
    onChange("");
    inputRef.current?.focus();
  }

  function handleSelect(item: SearchResultItem) {
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onSuggestionSelect?.(item);
  }

  const totalItems = suggestions.length + 1;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || !local.trim()) {
      if (e.key === "Enter") {
        submitSearch();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case "Enter":
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          handleSelect(suggestions[selectedIndex]);
        } else {
          submitSearch();
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  }

  function handleFocus() {
    if (suggestQuery.trim()) {
      setShowSuggestions(true);
    }
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 150);
  }

  return (
    <div className={cn("relative group", className)} data-tutorial={dataTutorial}>
      <Search
        size={16}
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted",
          "group-focus-within:text-gold-400 transition-colors",
          "sm:left-4",
        )}
      />
      <input
        ref={inputRef}
        type="text"
        autoFocus={autoFocus}
        placeholder={t('search.placeholder')}
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        role="combobox"
        aria-expanded={showSuggestions && suggestions.length > 0}
        aria-autocomplete="list"
        aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
        enterKeyHint="search"
        className={cn(
          "w-full h-9 pl-9 pr-9 rounded-lg",
          "sm:h-11 sm:pl-11 sm:pr-10",
          "bg-cosmos-900/80 border border-cosmos-600/40",
          "text-text-primary placeholder:text-text-muted",
          "outline-none transition-all duration-200",
          "hover:border-cosmos-600/70 hover:bg-cosmos-900/95",
          "focus:border-gold-400/50 focus:shadow-[0_0_0_3px_var(--color-accent-glow)]",
          "text-base font-medium",
        )}
      />
      {local.length > 0 && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-gold-400 transition-colors sm:right-3"
        >
          <X size={16} />
        </button>
      )}

      {showSuggestions && onSuggestionSelect && local.trim() && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-cosmos-600/40 bg-cosmos-900/95 backdrop-blur-md shadow-lg overflow-hidden"
        >
          {suggestions.map((item, index) => (
            <li
              key={item.id}
              id={`suggestion-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                "sm:px-4 sm:py-2.5",
                index === selectedIndex
                  ? "bg-cosmos-800/80"
                  : "hover:bg-cosmos-800/50",
                index > 0 && "border-t border-cosmos-600/20",
              )}
            >
              <img
                src={coverUrl(item.id!, "exhaust")}
                alt=""
                className="w-8 h-8 rounded object-cover shrink-0 bg-cosmos-800"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text-primary">{item.title_name}</div>
                <div className="truncate text-xs text-text-muted">{item.artist_name}</div>
              </div>
            </li>
          ))}
          <li
            id={`suggestion-${suggestions.length}`}
            role="option"
            aria-selected={selectedIndex === suggestions.length}
            onMouseDown={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            onMouseEnter={() => setSelectedIndex(suggestions.length)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
              "sm:px-4 sm:py-2.5",
              selectedIndex === suggestions.length
                ? "bg-cosmos-800/80"
                : "hover:bg-cosmos-800/50",
              suggestions.length > 0 && "border-t border-cosmos-600/20",
            )}
          >
            <Search size={14} className="shrink-0 text-text-muted" />
            <span className="truncate text-sm text-text-muted">
              {t('search.searchFor', { query: local.trim() })}
            </span>
          </li>
        </ul>
      )}
    </div>
  );
}
