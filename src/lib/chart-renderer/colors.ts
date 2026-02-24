/** Chart renderer color palette */

import type { LaserColor } from "@/lib/editor-store";

/** Maps LaserColor enum to rgba strings (alpha=178/255≈0.70, matching backend). */
export const LASER_COLOR_MAP: Record<LaserColor, string> = {
  BLUE: "rgba(0, 130, 217, 0.70)",
  RED: "rgba(188, 0, 136, 0.70)",
  GREEN: "rgba(8, 190, 0, 0.70)",
  YELLOW: "rgba(239, 222, 0, 0.70)",
};

export const C = {
  // Background
  BG: "#080c18",
  LANE_BG: "#0c1224",
  LANE_BORDER: "rgba(60, 90, 160, 0.15)",

  // Grid lines
  MEASURE_LINE: "rgba(100, 160, 255, 0.5)",
  BEAT_LINE: "rgba(80, 120, 200, 0.18)",
  SUB_BEAT_LINE: "rgba(60, 90, 160, 0.08)",

  // Measure numbers
  MEASURE_TEXT: "rgba(100, 160, 255, 0.6)",

  // BPM text
  BPM_TEXT: "#97f851",

  // BT notes
  BT_CHIP: "#e8edf5",
  BT_HOLD: "rgba(200, 215, 240, 0.85)",

  // FX notes
  FX_CHIP: "#ff8c20",
  FX_HOLD: "rgba(255, 140, 32, 0.45)",

  // Hi-speed markers
  HISPEED_LINE: "#4488ff",
  HISPEED_SHADE: "rgba(68, 136, 255, 0.10)",
  HISPEED_TEXT: "#4488ff",

  // Lasers (matching backend LASER_COLOR_MAP, alpha=178/255≈0.70)
  LASER_L: "rgba(0, 130, 217, 0.70)",
  LASER_R: "rgba(188, 0, 136, 0.70)",
} as const;
