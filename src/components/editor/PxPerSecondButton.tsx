/**
 * Inline button that shows current px/sec value.
 * Click to expand an input popover for editing.
 *
 * The safe upper bound comes from:
 *  1. Backend response header `X-Max-Px-Per-Second` (works for all songs)
 *  2. Frontend computation from chart data (editable songs only, as fallback)
 */

import { useEditorStore } from "@/lib/editor-store";
import { computeMaxPxPerSecond, DEFAULT_COLUMN_HEIGHT } from "@/lib/chart-renderer/layout";
import { cn } from "@/lib/utils";
import { Ruler } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const MIN_PX = 50;
const HARD_MAX_PX = 2000;

export function PxPerSecondButton() {
  const { t } = useTranslation();
  const pxPerSecond = useEditorStore((s) => s.renderOptions.pxPerSecond);
  const columnHeight = useEditorStore((s) => s.renderOptions.columnHeight);
  const chartData = useEditorStore((s) => s.chartData);
  const backendMax = useEditorStore((s) => s.maxPxPerSecond);
  const setOpts = useEditorStore((s) => s.setRenderOptions);

  // Prefer backend-provided max; fall back to frontend computation
  const safeMax = useMemo(() => {
    if (backendMax !== null) return Math.min(backendMax, HARD_MAX_PX);
    if (chartData) return Math.min(computeMaxPxPerSecond(chartData, columnHeight ?? DEFAULT_COLUMN_HEIGHT), HARD_MAX_PX);
    return HARD_MAX_PX;
  }, [backendMax, chartData, columnHeight]);

  const effectiveMax = Math.max(MIN_PX, safeMax);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(pxPerSecond));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when store changes externally
  useEffect(() => {
    setDraft(String(pxPerSecond));
  }, [pxPerSecond]);

  // Focus input when popover opens
  useEffect(() => {
    if (open) inputRef.current?.select();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const commit = useCallback(() => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n) || n < MIN_PX || n > effectiveMax) {
      setDraft(String(pxPerSecond));
    } else if (n !== pxPerSecond) {
      setOpts({ pxPerSecond: n });
    }
    setOpen(false);
  }, [draft, pxPerSecond, effectiveMax, setOpts]);

  const isOverLimit = pxPerSecond > effectiveMax;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded transition-colors",
          isOverLimit
            ? "text-diff-exhaust hover:text-diff-exhaust/80"
            : "hover:text-text-primary hover:bg-cosmos-700",
        )}
        title={t("chart.pxPerSecond")}
      >
        <Ruler size={14} />
        <span className="hidden sm:inline">{pxPerSecond}</span>
      </button>

      {/* Popover */}
      <div
        className={cn(
          "absolute top-full right-0 mt-1 z-50 flex flex-col gap-1 px-2 py-1.5 rounded-md bg-cosmos-800 border border-cosmos-600 shadow-lg transition-all duration-150 origin-top-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none",
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-muted whitespace-nowrap">{t("chart.pxPerSecond")}</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={MIN_PX}
            max={effectiveMax}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(String(pxPerSecond)); setOpen(false); }
            }}
            className="w-16 px-1.5 py-0.5 rounded bg-cosmos-900 border border-cosmos-600 text-base text-text-primary text-right font-mono outline-none focus:border-gold-400/50"
          />
        </div>
        <span className="text-[10px] text-text-muted whitespace-nowrap">
          {t("chart.pxRange", { min: MIN_PX, max: effectiveMax })}
        </span>
      </div>
    </div>
  );
}