import { useState, useEffect, useRef } from "react";
import { useEditorStore, type BpmDisplayMode } from "@/lib/editor-store";
import { cn } from "@/lib/utils";

export function EditorToolbar() {
  const simplifyLasers = useEditorStore((s) => s.editFlags.simplifyLasers);
  const toggleEdit = useEditorStore((s) => s.toggleEdit);
  const selectedPoint = useEditorStore((s) => s.selectedPoint);
  const deleteSelectedPoint = useEditorStore((s) => s.deleteSelectedPoint);
  const undo = useEditorStore((s) => s.undo);
  const resetAll = useEditorStore((s) => s.resetAll);
  const hasHistory = useEditorStore((s) => s.history.length > 0);

  const firstSelectedNote = useEditorStore((s) => s.firstSelectedNote);
  const intervalInfo = useEditorStore((s) => s.intervalInfo);

  const speed = useEditorStore((s) => s.speed);
  const setSpeed = useEditorStore((s) => s.setSpeed);
  const bpmDisplayMode = useEditorStore((s) => s.bpmDisplayMode);
  const setBpmDisplayMode = useEditorStore((s) => s.setBpmDisplayMode);

  const [speedInput, setSpeedInput] = useState(speed ? speed.toFixed(2) : "");
  const focusedRef = useRef(false);
  useEffect(() => { if (!focusedRef.current) setSpeedInput(speed ? speed.toFixed(2) : ""); }, [speed]);

  return (
    <div className="flex flex-col gap-2">
      {/* Speed input */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted font-mono">Speed</span>
        <input
          type="number"
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
              "px-1 py-1.5 rounded text-center text-[11px] transition-colors",
              bpmDisplayMode === v
                ? "bg-green-500/15 text-green-400"
                : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <button
        onClick={() => toggleEdit("simplifyLasers")}
        className={cn(
          "w-full px-3 py-1.5 rounded text-xs font-medium border transition-colors",
          simplifyLasers
            ? "bg-gold-400/15 text-gold-400 border-gold-400/30"
            : "bg-cosmos-700/60 text-text-secondary hover:text-text-primary hover:bg-cosmos-600/60 border-cosmos-600/30",
        )}
      >
        Simplify & Edit Lasers
      </button>
      {/* Interval info display - fixed height container */}
      <div className="h-[60px] overflow-hidden">
        {!firstSelectedNote && !intervalInfo && (
          <div className="px-3 py-1 rounded text-xs border bg-cosmos-700/60 text-text-secondary border-cosmos-600/30 h-full flex flex-col justify-center">
            <div className="font-medium mb-1">Interval Measurement</div>
            <div className="text-[10px] text-text-muted">Click two notes to measure interval</div>
          </div>
        )}
        {firstSelectedNote && !intervalInfo && (
          <div className="px-3 py-1 rounded text-xs border bg-blue-500/15 text-blue-400 border-blue-500/30 h-full flex flex-col justify-center">
            <div className="font-medium mb-1">First note selected</div>
            <div className="text-[10px] text-blue-300">Click another note to measure interval</div>
          </div>
        )}
        {intervalInfo && (
          <div className="px-3 py-1 rounded text-xs border bg-green-500/15 text-green-400 border-green-500/30 h-full flex flex-col justify-center">
            <div className="font-medium mb-1">Interval</div>
            <div className="flex justify-between items-center">
              <span>{intervalInfo.ms.toFixed(2)} ms</span>
              <span className="font-mono">{intervalInfo.notation}</span>
            </div>
          </div>
        )}
      </div>
      {selectedPoint && (
        <button
          onClick={deleteSelectedPoint}
          className="w-full px-3 py-1.5 rounded text-xs font-medium border transition-colors bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
        >
          Delete {selectedPoint.type === "laser" ? "Point" : selectedPoint.type === "hispeed" ? "Speed Mark" : "Note"}
        </button>
      )}
      {hasHistory && (
        <>
          <button
            onClick={undo}
            className="w-full px-3 py-1.5 rounded text-xs font-medium border transition-colors bg-cosmos-700/60 text-text-secondary hover:text-text-primary hover:bg-cosmos-600/60 border-cosmos-600/30"
          >
            Undo
          </button>
          <button
            onClick={resetAll}
            className="w-full px-3 py-1.5 rounded text-xs font-medium border transition-colors bg-cosmos-700/60 text-text-secondary hover:text-text-primary hover:bg-cosmos-600/60 border-cosmos-600/30"
          >
            Reset All
          </button>
        </>
      )}
    </div>
  );
}
