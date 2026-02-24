import { useEditorStore, type LaserColor } from "@/lib/editor-store";
import { cn } from "@/lib/utils";

const LASER_COLORS: { value: LaserColor; hex: string }[] = [
  { value: "BLUE", hex: "#0082D9" },
  { value: "RED", hex: "#BC0088" },
  { value: "GREEN", hex: "#08BE00" },
  { value: "YELLOW", hex: "#EFDE00" },
];

export function LaserColorPicker() {
  const opts = useEditorStore((s) => s.renderOptions);
  const setOpts = useEditorStore((s) => s.setRenderOptions);

  return (
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
  );
}
