import { Download, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (startMeasure: number, endMeasure: number) => void;
  maxMeasure: number;
}

export function ExportDialog({ isOpen, onClose, onExport, maxMeasure }: ExportDialogProps) {
  const { t } = useTranslation();
  const [startMeasure, setStartMeasure] = useState("1");
  const [endMeasure, setEndMeasure] = useState(maxMeasure.toString());

  if (!isOpen) return null;

  const handleExport = () => {
    const start = parseInt(startMeasure, 10);
    const end = parseInt(endMeasure, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > maxMeasure) {
      return;
    }

    onExport(start, end);
    onClose();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
      <div className="bg-cosmos-800 border border-cosmos-600 rounded-lg p-4 flex flex-col gap-3 min-w-[280px] max-w-[90vw]">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-text-primary">{t('chart.exportChart')}</div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">{t('chart.startMeasure')}</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={maxMeasure}
              value={startMeasure}
              onChange={(e) => setStartMeasure(e.target.value)}
              className="px-2 py-1.5 rounded bg-cosmos-900 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-blue-400/50"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">{t('chart.endMeasure')}</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={maxMeasure}
              value={endMeasure}
              onChange={(e) => setEndMeasure(e.target.value)}
              className="px-2 py-1.5 rounded bg-cosmos-900 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-blue-400/50"
            />
          </label>

          <div className="text-xs text-text-muted">
            {t('chart.measureRange', { max: maxMeasure })}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center gap-1.5"
          >
            <Download size={14} />
            {t('chart.export')}
          </button>
        </div>
      </div>
    </div>
  );
}
