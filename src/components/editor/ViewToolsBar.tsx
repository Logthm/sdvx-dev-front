import { useState, useEffect, useRef, useMemo } from "react";
import { useEditorStore, type BpmDisplayMode } from "@/lib/editor-store";
import { useChartTimingData } from "@/api/chart";
import { TimeMapper, type Time3 } from "@/lib/chart-renderer/time-mapper";
import { effectiveHiSpeedAt } from "@/lib/chart-renderer/grid-drawer";
import { calculateInterval } from "@/lib/chart-edit";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";

interface ViewToolsBarProps {
  musicId: number;
  difstr: string;
}

function PosInput({
  value,
  onChange,
  disabled,
}: {
  value: [number, number, number] | null;
  onChange: (pos: [number, number, number]) => void;
  disabled?: boolean;
}) {
  const [m, setM] = useState(value?.[0]?.toString() ?? "1");
  const [b, setB] = useState(value?.[1]?.toString() ?? "1");
  const [c, setC] = useState(value?.[2]?.toString() ?? "0");
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    if (!value) return;
    setM(value[0].toString());
    setB(value[1].toString());
    setC(value[2].toString());
  }, [value]);

  const commit = () => {
    const mv = parseInt(m, 10) || 1;
    const bv = parseInt(b, 10) || 1;
    const cv = parseInt(c, 10) || 0;
    onChange([Math.max(1, mv), Math.max(1, bv), Math.max(0, cv)]);
  };

  const handleBlur = () => { focusedRef.current = false; commit(); };
  const handleFocus = () => { focusedRef.current = true; };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="1"
        value={m}
        onChange={(e) => setM(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-10 px-1 py-0.5 rounded bg-cosmos-800 border border-cosmos-600 text-xs font-mono text-text-primary outline-none focus:border-gold-400/50 text-center"
      />
      <span className="text-[10px] text-text-muted">.</span>
      <input
        type="number"
        min="1"
        value={b}
        onChange={(e) => setB(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-8 px-1 py-0.5 rounded bg-cosmos-800 border border-cosmos-600 text-xs font-mono text-text-primary outline-none focus:border-gold-400/50 text-center"
      />
      <span className="text-[10px] text-text-muted">.</span>
      <input
        type="number"
        min="0"
        value={c}
        onChange={(e) => setC(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-8 px-1 py-0.5 rounded bg-cosmos-800 border border-cosmos-600 text-xs font-mono text-text-primary outline-none focus:border-gold-400/50 text-center"
      />
    </div>
  );
}

export function ViewToolsBar({ musicId, difstr }: ViewToolsBarProps) {
  const { t } = useTranslation();

  const arrangementMode = useEditorStore((s) => s.renderOptions.arrangementMode);
  const previewSimplifyLasers = useEditorStore((s) => s.previewSimplifyLasers);
  const setPreviewSimplifyLasers = useEditorStore((s) => s.setPreviewSimplifyLasers);

  const speed = useEditorStore((s) => s.speed);
  const setSpeed = useEditorStore((s) => s.setSpeed);
  const bpmDisplayMode = useEditorStore((s) => s.bpmDisplayMode);
  const setBpmDisplayMode = useEditorStore((s) => s.setBpmDisplayMode);

  const hiSpeedMarks = useEditorStore((s) => s.hiSpeedMarks);
  const addHiSpeedMark = useEditorStore((s) => s.addHiSpeedMark);
  const removeHiSpeedMark = useEditorStore((s) => s.removeHiSpeedMark);

  const intervalPosA = useEditorStore((s) => s.intervalPosA);
  const intervalPosB = useEditorStore((s) => s.intervalPosB);
  const setIntervalPosA = useEditorStore((s) => s.setIntervalPosA);
  const setIntervalPosB = useEditorStore((s) => s.setIntervalPosB);
  const intervalInfo = useEditorStore((s) => s.intervalInfo);
  const setIntervalInfo = useEditorStore((s) => s.setIntervalInfo);

  const timingQuery = useChartTimingData(musicId, difstr);
  const timingData = timingQuery.data ?? null;

  const timeMapper = useMemo(
    () => (timingData ? new TimeMapper(timingData) : null),
    [timingData],
  );

  const isDisabled = arrangementMode === "random" || arrangementMode === "s-random";

  // Speed input local state
  const [speedInput, setSpeedInput] = useState(speed ? speed.toFixed(2) : "");
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setSpeedInput(speed ? speed.toFixed(2) : "");
  }, [speed]);

  // HS mark add form state
  const [hsAddPos, setHsAddPos] = useState<[number, number, number]>([1, 1, 0]);
  const [hsAddValue, setHsAddValue] = useState("2.50");
  const [hsAddDuration, setHsAddDuration] = useState("0");

  // Deduplicated BPM change list
  const bpmChanges = useMemo(() => {
    if (!timingData) return [];
    const changes: Array<{ time: Time3; bpm: number }> = [];
    let lastBpm = -1;
    for (const entry of timingData.bpm_info) {
      if (Math.abs(entry.bpm - lastBpm) > 0.001) {
        changes.push({
          time: [entry.measure, entry.beat, entry.cell],
          bpm: entry.bpm,
        });
        lastBpm = entry.bpm;
      }
    }
    return changes;
  }, [timingData]);

  const handleCalculateInterval = () => {
    if (!intervalPosA || !intervalPosB || !timeMapper || !timingData) return;
    const result = calculateInterval(
      intervalPosA,
      intervalPosB,
      timeMapper,
      timingData.beat_resolution ?? null,
    );
    setIntervalInfo(result);
  };

  if (isDisabled) {
    return (
      <div className="mt-3 px-3 py-2 rounded text-xs text-text-muted border border-cosmos-600/30 bg-cosmos-700/30">
        {t("chart.notAvailableRandom")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 mt-3">
      {/* ── Simplify Lasers ── */}
      <button
        onClick={() => setPreviewSimplifyLasers(!previewSimplifyLasers)}
        className={cn(
          "w-full px-3 py-1.5 rounded text-xs font-medium border transition-colors",
          previewSimplifyLasers
            ? "bg-gold-400/15 text-gold-400 border-gold-400/30"
            : "bg-cosmos-700/60 text-text-secondary hover:text-text-primary hover:bg-cosmos-600/60 border-cosmos-600/30",
        )}
      >
        {t("chart.simplifyLasersPreview")}
      </button>

      {/* ── Hi-Speed Calculator ── */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
          {t("chart.hsCalculator")}
        </span>

        {/* Base HS input */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-mono">{t("chart.speed")}</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            max="10"
            step="0.01"
            value={speedInput}
            onChange={(e) => {
              setSpeedInput(e.target.value);
              const v = parseFloat(e.target.value);
              setSpeed(isNaN(v) ? 0 : Math.min(10, Math.max(0, v)));
            }}
            onFocus={() => { focusedRef.current = true; }}
            onBlur={() => { focusedRef.current = false; setSpeedInput(speed ? speed.toFixed(2) : ""); }}
            placeholder="1.00-10.00"
            className="flex-1 px-2 py-1 rounded bg-cosmos-800 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-gold-400/50 w-20"
          />
        </div>

        {/* BPM display mode toggle */}
        <div className="grid grid-cols-3 gap-1">
          {([["bpm", "BPM"], ["hispeed", "HS"], ["speed", "Speed"]] as [BpmDisplayMode, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setBpmDisplayMode(v)}
              className={cn(
                "px-1 py-1 rounded text-center text-[11px] transition-colors",
                bpmDisplayMode === v
                  ? "bg-green-500/15 text-green-400"
                  : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {/* BPM changes table */}
        {bpmChanges.length > 0 && timeMapper && (
          <div className="max-h-48 overflow-y-auto rounded border border-cosmos-600/30">
            <table className="w-full text-[10px] font-mono">
              <thead className="sticky top-0 bg-cosmos-800">
                <tr className="text-text-muted">
                  <th className="px-1 py-0.5 text-left">{t("chart.position")}</th>
                  <th className="px-1 py-0.5 text-right">BPM</th>
                  <th className="px-1 py-0.5 text-right">HS</th>
                  <th className="px-1 py-0.5 text-right">{t("chart.effectiveSpeed")}</th>
                </tr>
              </thead>
              <tbody>
                {bpmChanges.map((entry, i) => {
                  const hs = effectiveHiSpeedAt(entry.time, timeMapper, speed > 0 ? speed : undefined, hiSpeedMarks);
                  return (
                    <tr key={i} className="border-t border-cosmos-700/50 text-text-secondary">
                      <td className="px-1 py-0.5">
                        {entry.time[0]}.{entry.time[1]}.{entry.time[2]}
                      </td>
                      <td className="px-1 py-0.5 text-right">{entry.bpm}</td>
                      <td className="px-1 py-0.5 text-right text-blue-400">
                        {hs ? `x${hs.toFixed(1)}` : "-"}
                      </td>
                      <td className="px-1 py-0.5 text-right text-green-400">
                        {hs ? (entry.bpm * hs / 100).toFixed(2) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Custom HS marks list */}
        {hiSpeedMarks.length > 0 && (
          <div className="flex flex-col gap-1">
            {hiSpeedMarks.map((mark, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px] font-mono text-blue-300 bg-blue-500/10 rounded px-1.5 py-0.5">
                <span>{mark.time[0]}.{mark.time[1]}.{mark.time[2]}</span>
                <span className="text-text-muted">|</span>
                <span>x{mark.hiSpeed.toFixed(1)}</span>
                <span className="text-text-muted">|</span>
                <span>{mark.durationMs}ms</span>
                <button
                  onClick={() => removeHiSpeedMark(i)}
                  className="ml-auto text-red-400/60 hover:text-red-400"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add HS mark */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <PosInput value={hsAddPos} onChange={setHsAddPos} />
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={hsAddValue}
              onChange={(e) => setHsAddValue(e.target.value)}
              className="w-12 px-1 py-0.5 rounded bg-cosmos-800 border border-cosmos-600 text-xs font-mono text-text-primary outline-none focus:border-gold-400/50 text-center"
              placeholder="HS"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted">{t("chart.duration")}(ms)</span>
            <input
              type="number"
              step="100"
              min="0"
              value={hsAddDuration}
              onChange={(e) => setHsAddDuration(e.target.value)}
              className="flex-1 w-14 px-1 py-0.5 rounded bg-cosmos-800 border border-cosmos-600 text-xs font-mono text-text-primary outline-none focus:border-gold-400/50 text-center"
            />
            <button
              onClick={() => {
                const hs = parseFloat(hsAddValue);
                const dur = parseInt(hsAddDuration, 10);
                if (isNaN(hs) || hs <= 0) return;
                addHiSpeedMark({ time: hsAddPos, hiSpeed: hs, durationMs: isNaN(dur) ? 0 : dur });
              }}
              className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-xs transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Interval Measurement ── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
          {t("chart.intervalPreview")}
        </span>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted w-3">A</span>
          <PosInput value={intervalPosA ?? [1, 1, 0]} onChange={setIntervalPosA} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted w-3">B</span>
          <PosInput value={intervalPosB ?? [1, 1, 0]} onChange={setIntervalPosB} />
        </div>

        <button
          onClick={handleCalculateInterval}
          disabled={!intervalPosA || !intervalPosB || !timeMapper}
          className={cn(
            "w-full px-3 py-1 rounded text-xs font-medium border transition-colors",
            intervalPosA && intervalPosB && timeMapper
              ? "bg-cosmos-700/60 text-text-secondary hover:text-text-primary hover:bg-cosmos-600/60 border-cosmos-600/30"
              : "bg-cosmos-800/40 text-text-muted border-cosmos-700/20 cursor-not-allowed",
          )}
        >
          {t("chart.calculate")}
        </button>

        {intervalInfo && (
          <div className="px-3 py-1 rounded text-xs border bg-green-500/15 text-green-400 border-green-500/30">
            <div className="flex justify-between items-center">
              <span>{intervalInfo.ms.toFixed(2)} ms</span>
              <span className="font-mono">{intervalInfo.notation}</span>
            </div>
          </div>
        )}

        <div className="text-[10px] text-yellow-500/70">
          {t("chart.estimateOnly")}
        </div>
      </div>
    </div>
  );
}
