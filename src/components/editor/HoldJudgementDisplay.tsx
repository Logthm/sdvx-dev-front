import { useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function HoldJudgementDisplay() {
  const { t } = useTranslation();
  const showHoldJudgement = useEditorStore((s) => s.showHoldJudgement);
  const setShowHoldJudgement = useEditorStore((s) => s.setShowHoldJudgement);

  return (
    <button
      type="button"
      onClick={() => setShowHoldJudgement(!showHoldJudgement)}
      aria-pressed={showHoldJudgement}
      title={t("chart.holdJudgementDesc")}
      data-tutorial="chart-hold-judgement"
      className={cn(
        "w-full px-3 py-1.5 rounded text-xs font-medium border transition-colors",
        showHoldJudgement
          ? "bg-gold-400/15 text-gold-400 border-gold-400/30"
          : "bg-cosmos-700/60 text-text-secondary hover:text-text-primary hover:bg-cosmos-600/60 border-cosmos-600/30",
      )}
    >
      {t("chart.holdJudgement")}
    </button>
  );
}
