/**
 * Render options toolbar — arrangement mode, track mapping, laser colors.
 *
 * Normal / Mirror / S-Random send arrangement_mode directly to backend.
 * Random shows manual track controls: BT order, FX swap, laser mirror, shuffle.
 * Laser color pickers are always visible.
 */

import {
    DEFAULT_BT_ORDER,
    useEditorStore,
    type ArrangementMode,
    type BtTrack,
    type LaserColor,
} from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, Shuffle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const ARRANGEMENT_MODES: { value: ArrangementMode; labelKey: string }[] = [
  { value: "normal", labelKey: "chart.normal" },
  { value: "mirror", labelKey: "chart.mirror" },
  { value: "random", labelKey: "chart.random" },
  { value: "s-random", labelKey: "chart.sRandom" },
];

const LASER_COLORS: { value: LaserColor; hex: string }[] = [
  { value: "BLUE", hex: "#0082D9" },
  { value: "RED", hex: "#BC0088" },
  { value: "GREEN", hex: "#08BE00" },
  { value: "YELLOW", hex: "#EFDE00" },
];

const BT_LABELS: Record<BtTrack, string> = {
  "BT-A": "A",
  "BT-B": "B",
  "BT-C": "C",
  "BT-D": "D",
};

function BtDropdown({
  value,
  onChange,
}: {
  value: BtTrack;
  onChange: (v: BtTrack) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded font-mono font-bold text-sm bg-white/90 text-cosmos-950 flex items-center justify-center hover:bg-white transition-colors"
      >
        {BT_LABELS[value]}
      </button>
      <div
        className={cn(
          "absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 flex flex-col rounded bg-cosmos-800 border border-cosmos-600 shadow-lg overflow-hidden transition-all duration-200 origin-top",
          open
            ? "opacity-100 scale-y-100 pointer-events-auto"
            : "opacity-0 scale-y-0 pointer-events-none",
        )}
      >
        {(["BT-A", "BT-B", "BT-C", "BT-D"] as BtTrack[]).map((bt) => (
          <button
            key={bt}
            onClick={() => {
              onChange(bt);
              setOpen(false);
            }}
            className={cn(
              "px-3 py-1 font-mono font-bold text-sm text-center transition-colors",
              bt === value
                ? "bg-white/20 text-white"
                : "text-text-muted hover:bg-white/10 hover:text-white",
            )}
          >
            {BT_LABELS[bt]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RenderOptionsBar() {
  const { t } = useTranslation();
  const opts = useEditorStore((s) => s.renderOptions);
  const setOpts = useEditorStore((s) => s.setRenderOptions);
  const isRandom = opts.arrangementMode === "random";

  const handleSetBt = useCallback(
    (idx: number, target: BtTrack) => {
      const next = [...opts.btOrder] as [BtTrack, BtTrack, BtTrack, BtTrack];
      const otherIdx = next.indexOf(target);
      if (otherIdx !== -1 && otherIdx !== idx) {
        next[otherIdx] = next[idx];
      }
      next[idx] = target;
      setOpts({ btOrder: next });
    },
    [opts.btOrder, setOpts],
  );

  const handleShuffle = useCallback(() => {
    const arr = [...DEFAULT_BT_ORDER] as [BtTrack, BtTrack, BtTrack, BtTrack];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setOpts({
      btOrder: arr,
      fxSwap: Math.random() < 0.5,
      mirrorLaser: Math.random() < 0.5,
    });
  }, [setOpts]);

  const handleModeChange = useCallback(
    (value: ArrangementMode) => {
      if (value === "random") {
        const arr = [...DEFAULT_BT_ORDER] as [
          BtTrack,
          BtTrack,
          BtTrack,
          BtTrack,
        ];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        setOpts({
          arrangementMode: value,
          btOrder: arr,
          fxSwap: Math.random() < 0.5,
          mirrorLaser: Math.random() < 0.5,
        });
      } else {
        setOpts({
          arrangementMode: value,
          btOrder: [...DEFAULT_BT_ORDER],
          fxSwap: false,
          mirrorLaser: false,
        });
      }
    },
    [setOpts],
  );

  return (
    <div className="flex flex-col gap-3 text-sm w-full">
      {/* Arrangement mode */}
      <div className="grid grid-cols-4 gap-1">
        {ARRANGEMENT_MODES.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => handleModeChange(value)}
            className={cn(
              "px-1 py-2 rounded text-center text-[11px] transition-colors",
              opts.arrangementMode === value
                ? "bg-gold-400/15 text-gold-400"
                : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Random track mapping */}
      {isRandom && (
        <div className="flex flex-col gap-1.5">
          {/* BT order row */}
          <div className="flex items-center justify-center gap-1.5">
            <span
              className={cn(
                "text-xs font-mono font-bold px-2 py-1 rounded",
                opts.fxSwap ? "bg-orange-500/30 text-orange-300" : "bg-orange-500/15 text-orange-400/60",
              )}
            >
              {opts.fxSwap ? "R" : "L"}
            </span>
            {opts.btOrder.map((track, idx) => (
              <BtDropdown
                key={idx}
                value={track}
                onChange={(v) => handleSetBt(idx, v)}
              />
            ))}
            <span
              className={cn(
                "text-xs font-mono font-bold px-2 py-1 rounded",
                opts.fxSwap ? "bg-orange-500/30 text-orange-300" : "bg-orange-500/15 text-orange-400/60",
              )}
            >
              {opts.fxSwap ? "L" : "R"}
            </span>
          </div>
          {/* Action buttons row */}
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => setOpts({ fxSwap: !opts.fxSwap })}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded transition-colors",
                opts.fxSwap ? "bg-gold-400/15 text-gold-400" : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
              )}
              title={t('chart.swapFx')}
            >
              <ArrowLeftRight size={14} />
              <span>FX</span>
            </button>
            <button
              onClick={() => setOpts({ mirrorLaser: !opts.mirrorLaser })}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded transition-colors",
                opts.mirrorLaser ? "bg-gold-400/15 text-gold-400" : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
              )}
              title={t('chart.mirrorLasers')}
            >
              <ArrowLeftRight size={14} />
              <span>Laser</span>
            </button>
            <button
              onClick={handleShuffle}
              className="px-3 py-1.5 rounded text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
              title={t('chart.randomizeAll')}
            >
              <Shuffle size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Laser colors */}
      <div className="flex flex-col gap-1.5">
        {(["L", "R"] as const).map((side) => {
          const key = side === "L" ? "laserLColor" : "laserRColor";
          return (
            <div key={side} className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted font-mono w-4 text-center">{side}</span>
              {LASER_COLORS.map(({ value, hex }) => (
                <button
                  key={value}
                  onClick={() => setOpts({ [key]: value })}
                  className={cn(
                    "w-6 h-6 rounded-full border-[1.5px] transition-all",
                    opts[key] === value
                      ? "border-white scale-125"
                      : "border-transparent opacity-50 hover:opacity-100",
                  )}
                  style={{ backgroundColor: hex }}
                  title={`VOL-${side}: ${value}`}
                />
              ))}
            </div>
          );
        })}
      </div>

    </div>
  );
}
