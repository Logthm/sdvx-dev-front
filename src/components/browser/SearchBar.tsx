import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SearchBar({ value, onChange, className }: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const composingRef = useRef(false);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function handleChange(v: string) {
    setLocal(v);
    if (composingRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 300);
  }

  function handleCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    composingRef.current = false;
    const v = e.currentTarget.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 300);
  }

  function handleClear() {
    setLocal("");
    onChange("");
    inputRef.current?.focus();
  }

  return (
    <div className={cn("relative group", className)}>
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
        placeholder="Search music..."
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={handleCompositionEnd}
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
    </div>
  );
}
