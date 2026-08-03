import {
  Download,
  Maximize,
  Minimize,
  UnfoldVertical,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PxPerSecondButton } from "./PxPerSecondButton";

interface ChartViewToolbarProps {
  zoom: number;
  isFullscreen: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onExport: () => void;
  onFitHeight: () => void;
  onToggleFullscreen: () => void;
}

export function ChartViewToolbar({
  zoom,
  isFullscreen,
  onZoomOut,
  onZoomIn,
  onExport,
  onFitHeight,
  onToggleFullscreen,
}: ChartViewToolbarProps) {
  const { t } = useTranslation();
  return (
    <div
      className="absolute top-3 right-3 flex flex-row items-center gap-1 px-2 py-1 rounded-md bg-surface/80 backdrop-blur-sm border border-border text-xs font-mono text-text-muted"
      data-tutorial="chart-zoom-controls"
    >
      <button
        onClick={onZoomOut}
        className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors hidden sm:block"
      >
        &minus;
      </button>
      <span className="w-10 text-center hidden sm:block">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors hidden sm:block"
      >
        +
      </button>
      <span className="w-px h-4 bg-border mx-0.5 hidden sm:block" />
      <PxPerSecondButton />
      <span className="w-px h-4 bg-border mx-0.5" />
      <button
        onClick={onExport}
        className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
        title={t("chart.exportChart")}
      >
        <Download size={14} />
      </button>
      <button
        onClick={onFitHeight}
        className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
        title={t("chart.fitHeight")}
      >
        <UnfoldVertical size={14} />
      </button>
      <button
        onClick={onToggleFullscreen}
        className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
        title={isFullscreen
          ? t("chart.exitFullscreen")
          : t("chart.fullscreen")}
      >
        {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
      </button>
    </div>
  );
}
