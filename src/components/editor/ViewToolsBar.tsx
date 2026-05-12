import { useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

interface ViewToolsBarProps {
  musicId: number;
  difstr: string;
}

export function ViewToolsBar({ difstr: _difstr, musicId: _musicId }: ViewToolsBarProps) {
  const { t } = useTranslation();

  const arrangementMode = useEditorStore((s) => s.renderOptions.arrangementMode);
  const previewSimplifyLasers = useEditorStore((s) => s.previewSimplifyLasers);
  const setPreviewSimplifyLasers = useEditorStore((s) => s.setPreviewSimplifyLasers);
  const previewIntervalActive = useEditorStore((s) => s.previewIntervalActive);
  const setPreviewIntervalActive = useEditorStore((s) => s.setPreviewIntervalActive);
  const previewIntervalFirstTime = useEditorStore((s) => s.previewIntervalFirstTime);
  const setPreviewIntervalFirstTime = useEditorStore((s) => s.setPreviewIntervalFirstTime);
  const intervalInfo = useEditorStore((s) => s.intervalInfo);
  const setIntervalInfo = useEditorStore((s) => s.setIntervalInfo);

  const isDisabled = arrangementMode === "random" || arrangementMode === "s-random";

  if (isDisabled) {
    return (
      <div className="mt-3 px-3 py-2 rounded text-xs text-text-muted border border-cosmos-600/30 bg-cosmos-700/30">
        {t("chart.notAvailableRandom")}
      </div>
    );
  }

  const clearInterval = () => {
    setPreviewIntervalFirstTime(null);
    setIntervalInfo(null);
  };

  return (
    <div className="flex flex-col gap-2 mt-3">
      {/* Simplify Lasers */}
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

      {/* Interval Measurement */}
      <button
        onClick={() => {
          if (previewIntervalActive) {
            setPreviewIntervalActive(false);
            clearInterval();
          } else {
            setPreviewIntervalActive(true);
            clearInterval();
          }
        }}
        className={cn(
          "w-full px-3 py-1.5 rounded text-xs font-medium border transition-colors",
          previewIntervalActive
            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
            : "bg-cosmos-700/60 text-text-secondary hover:text-text-primary hover:bg-cosmos-600/60 border-cosmos-600/30",
        )}
      >
        {t("chart.intervalPreview")}
      </button>

      {previewIntervalActive && (
        <div className="h-[60px] overflow-hidden">
          {!previewIntervalFirstTime && !intervalInfo && (
            <div className="px-3 py-1 rounded text-xs border bg-cosmos-700/60 text-text-secondary border-cosmos-600/30 h-full flex flex-col justify-center">
              <div className="font-medium mb-1">{t("chart.intervalMeasurement")}</div>
              <div className="text-[10px] text-text-muted">{t("chart.clickTwoPoints")}</div>
            </div>
          )}
          {previewIntervalFirstTime && !intervalInfo && (
            <div className="px-3 py-1 rounded text-xs border bg-blue-500/15 text-blue-400 border-blue-500/30 h-full flex flex-col justify-center">
              <div className="font-medium mb-1">{t("chart.firstNoteSelected")}</div>
              <div className="text-[10px] text-blue-300">{t("chart.clickAnotherNote")}</div>
            </div>
          )}
          {intervalInfo && (
            <div className="px-3 py-1 rounded text-xs border bg-green-500/15 text-green-400 border-green-500/30 h-full flex flex-col justify-center">
              <div className="flex justify-between items-center mb-0.5">
                <span className="font-medium">{t("chart.interval")}</span>
                <button onClick={clearInterval} className="text-green-400/60 hover:text-green-400">
                  <X size={10} />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <span>{intervalInfo.ms.toFixed(2)} ms</span>
                <span className="font-mono">{intervalInfo.notation}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {previewIntervalActive && (
        <div className="text-[10px] text-yellow-500/70">{t("chart.estimateOnly")}</div>
      )}
    </div>
  );
}
