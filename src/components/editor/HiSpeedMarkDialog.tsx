import { useEditorStore } from "@/lib/editor-store";
import type { ChartHiSpeedRequest } from "@/lib/chart-interaction";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface HiSpeedMarkDialogProps {
  request: ChartHiSpeedRequest | null;
  onClose: () => void;
}

export function HiSpeedMarkDialog({
  request,
  onClose,
}: HiSpeedMarkDialogProps) {
  const { t } = useTranslation();
  const [hiSpeed, setHiSpeed] = useState("");
  const [duration, setDuration] = useState("");

  useEffect(() => {
    if (!request) return;
    if (request.type === "add") {
      setHiSpeed("");
      setDuration("");
      return;
    }
    const mark = useEditorStore.getState().hiSpeedMarks[request.index];
    if (!mark) {
      onClose();
      return;
    }
    setHiSpeed(mark.hiSpeed.toFixed(1));
    setDuration(String(mark.durationMs));
  }, [request, onClose]);

  if (!request) return null;

  const confirm = () => {
    const parsedHiSpeed = Number.parseFloat(hiSpeed);
    const parsedDuration = Number.parseFloat(duration);
    if (
      Number.isNaN(parsedHiSpeed)
      || parsedHiSpeed < 0.1
      || parsedHiSpeed > 20
      || Number.isNaN(parsedDuration)
      || parsedDuration <= 0
    ) {
      onClose();
      return;
    }

    const store = useEditorStore.getState();
    const normalizedHiSpeed = Math.min(20, Math.max(0.1, parsedHiSpeed));
    if (request.type === "add") {
      store.addHiSpeedMark({
        time: request.time,
        durationMs: parsedDuration,
        hiSpeed: normalizedHiSpeed,
      });
    } else {
      store.updateHiSpeedMark(request.index, {
        hiSpeed: normalizedHiSpeed,
        durationMs: parsedDuration,
      });
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
      <div className="bg-cosmos-800 border border-cosmos-600 rounded-lg p-4 flex flex-col gap-3 min-w-[200px]">
        <div className="text-xs font-medium text-text-primary">
          {request.type === "add"
            ? t("chart.addSpeedChangeMark")
            : t("chart.editSpeedChangeMark")}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted">
            {t("chart.hiSpeed")}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0.1"
            max="20.0"
            step="0.1"
            autoFocus
            value={hiSpeed}
            onChange={(event) => setHiSpeed(event.target.value)}
            onBlur={() => {
              const value = Number.parseFloat(hiSpeed);
              if (!Number.isNaN(value)) {
                setHiSpeed(Math.min(20, Math.max(0.1, value)).toFixed(1));
              }
            }}
            className="px-2 py-1 rounded bg-cosmos-900 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-blue-400/50"
            placeholder="0.1-20.0"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted">
            {t("chart.speedChangeDuration")}
          </span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="px-2 py-1 rounded bg-cosmos-900 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-blue-400/50"
            placeholder={t("chart.durationPlaceholder")}
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={confirm}
            className="px-3 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
