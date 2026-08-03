import { useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import {
  Hand,
  Move,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export function ChartPointerToolbar() {
  const { t } = useTranslation();
  const mouseTool = useEditorStore((state) => state.mouseTool);
  const setMouseTool = useEditorStore((state) => state.setMouseTool);
  const dragRange = useEditorStore((state) => state.dragRange);
  const setDragRange = useEditorStore((state) => state.setDragRange);
  const expandedTool = useEditorStore((state) => state.expandedTool);
  const setExpandedTool = useEditorStore((state) => state.setExpandedTool);
  const selectedPoint = useEditorStore((state) => state.selectedPoint);
  const resetSelectedPoint = useEditorStore((state) => state.resetSelectedPoint);
  const deleteSelectedPoint = useEditorStore((state) => state.deleteSelectedPoint);

  return (
    <div
      className="absolute top-3 left-3 flex flex-col gap-1 px-2 py-1 rounded-md bg-surface/80 backdrop-blur-sm border border-border"
      data-tutorial="chart-pointer-tools"
    >
      <button
        onClick={() => {
          setMouseTool("pan");
          setExpandedTool(null);
        }}
        className={cn(
          "p-3 md:p-1.5 rounded transition-colors touch-manipulation",
          mouseTool === "pan"
            ? "bg-gold-400/15 text-gold-400"
            : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
        )}
        title={t("chart.panView")}
      >
        <Hand size={16} />
      </button>

      <button
        onClick={() => {
          setMouseTool("move");
          setExpandedTool(expandedTool === "drag" ? null : "drag");
        }}
        className={cn(
          "p-3 md:p-1.5 rounded transition-colors touch-manipulation",
          mouseTool === "move"
            ? dragRange === "s-critical" ? "bg-gold-300/15 text-gold-300"
              : dragRange === "critical" ? "bg-gold-600/15 text-gold-600"
              : dragRange === "near" ? "bg-green-400/15 text-green-400"
              : dragRange === "error" ? "bg-red-400/15 text-red-400"
              : "bg-gold-400/15 text-gold-400"
            : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
        )}
        title={t("chart.moveSelect")}
      >
        <Move size={16} />
      </button>

      {expandedTool === "drag" && (
        <div className={cn(
          "flex flex-col gap-0.5 pl-1 border-l-2 ml-1",
          dragRange === "s-critical" ? "border-gold-300/30"
            : dragRange === "critical" ? "border-gold-600/30"
            : dragRange === "near" ? "border-green-400/30"
            : dragRange === "error" ? "border-red-400/30"
            : "border-gold-400/30",
        )}>
          {([
            ["off", "Off", "bg-gold-400/15 text-gold-400"],
            ["s-critical", "S-Crit", "bg-gold-300/15 text-gold-300"],
            ["critical", "Crit", "bg-gold-600/15 text-gold-600"],
            ["near", "Near", "bg-green-400/15 text-green-400"],
            ["error", "Error", "bg-red-400/15 text-red-400"],
          ] as const).map(([value, label, activeClass]) => (
            <button
              key={value}
              onClick={() => setDragRange(value)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium transition-colors text-left",
                dragRange === value
                  ? activeClass
                  : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          setMouseTool("edit-hs");
          setExpandedTool(null);
        }}
        className={cn(
          "p-3 md:p-1.5 rounded transition-colors touch-manipulation",
          mouseTool === "edit-hs"
            ? "bg-gold-400/15 text-gold-400"
            : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
        )}
        title={t("chart.editHs")}
      >
        <Pencil size={16} />
      </button>

      <button
        onClick={() => setExpandedTool(expandedTool === "add" ? null : "add")}
        className={cn(
          "p-3 md:p-1.5 rounded transition-colors touch-manipulation",
          mouseTool === "add-bt" || mouseTool === "add-fx" || mouseTool === "add-hispeed"
            ? mouseTool === "add-bt" ? "bg-slate-200/15 text-slate-200"
              : mouseTool === "add-fx" ? "bg-orange-400/15 text-orange-400"
              : "bg-blue-400/15 text-blue-400"
            : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
        )}
        title={t("chart.addNotes")}
      >
        <Plus size={16} />
      </button>

      {expandedTool === "add" && (
        <div className={cn(
          "flex flex-col gap-0.5 pl-1 border-l-2 ml-1",
          mouseTool === "add-bt" ? "border-slate-200/30"
            : mouseTool === "add-fx" ? "border-orange-400/30"
            : mouseTool === "add-hispeed" ? "border-blue-400/30"
            : "border-gold-400/30",
        )}>
          {([
            ["add-bt", "BT", "bg-slate-200/15 text-slate-200"],
            ["add-fx", "FX", "bg-orange-400/15 text-orange-400"],
            ["add-hispeed", "HS", "bg-blue-400/15 text-blue-400"],
          ] as const).map(([tool, label, activeClass]) => (
            <button
              key={tool}
              onClick={() => {
                setMouseTool(tool);
                setExpandedTool(null);
              }}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium transition-colors text-left",
                mouseTool === tool
                  ? activeClass
                  : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {selectedPoint && (
        <button
          onClick={resetSelectedPoint}
          className="p-3 md:p-1.5 rounded transition-colors touch-manipulation text-blue-400 hover:bg-blue-500/15"
          title={t("chart.resetToOriginal")}
          data-tutorial="chart-reset-selected"
        >
          <RotateCcw size={16} />
        </button>
      )}
      {selectedPoint && (
        <button
          onClick={deleteSelectedPoint}
          className="p-3 md:p-1.5 rounded transition-colors touch-manipulation text-red-400 hover:bg-red-500/15"
          title={t("chart.deleteSelected")}
          data-tutorial="chart-delete-selected"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
