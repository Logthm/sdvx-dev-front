import { DEFAULT_BT_ORDER, type EditFlags, type RenderOptions } from "@/lib/editor-store";
import type { ChartData } from "@/types/chart";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

const BASE_URL = "/api";

export function useChartEditability(musicId: number | null) {
  return useQuery({
    queryKey: ["chart", "editable", musicId] as const,
    queryFn: async () => {
      return apiFetch<{ music_id: number; editable_difficulties: string[] }>(
        `/chart/editable/${musicId}`
      );
    },
    enabled: musicId !== null,
    staleTime: 10 * 60_000,
  });
}

export function useChartData(musicId: number | null, difstr: string | null) {
  return useQuery({
    queryKey: ["chart", "data", musicId, difstr] as const,
    queryFn: async () => {
      return apiFetch<ChartData>(`/chart/data/${musicId}/${difstr}`);
    },
    enabled: musicId !== null && difstr !== null && difstr.length > 0,
    staleTime: 10 * 60_000,
  });
}

function isCustomBtOrder(order: readonly string[]): boolean {
  return order.some((v, i) => v !== DEFAULT_BT_ORDER[i]);
}

/**
 * Fetch a backend-rendered chart image as a blob URL.
 */
export function useChartImage(
  musicId: number | null,
  difstr: string | null,
  options: RenderOptions,
) {
  const hasCustomMapping = isCustomBtOrder(options.btOrder) || options.fxSwap;

  return useQuery({
    queryKey: [
      "chart",
      "image",
      musicId,
      difstr,
      options.arrangementMode,
      options.btOrder.join(","),
      options.fxSwap,
      options.mirrorLaser,
      options.laserLColor,
      options.laserRColor,
      options.pxPerSecond,
      options.columnHeight,
    ] as const,
    queryFn: async () => {
      const body: Record<string, unknown> = {
        music_id: musicId,
        difstr: difstr,
        arrangement_mode: hasCustomMapping ? "normal" : options.arrangementMode,
        output_format: "WEBP",
        quality: 80,
        px_per_second: options.pxPerSecond,
        column_height: options.columnHeight,
        laser_l_color: options.laserLColor,
        laser_r_color: options.laserRColor,
      };

      if (hasCustomMapping) {
        body.bt_order = options.btOrder;
        body.fx_swap = options.fxSwap;
      }

      if (options.mirrorLaser) {
        body.mirror_laser = true;
      }

      const res = await fetch(`${BASE_URL}/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(detail);
      }

      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    enabled: musicId !== null && difstr !== null && difstr.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Render an edited chart via POST /chart/render_data.
 *
 * Triggers when editFlags are active OR manual edits have been made (editVersion > 0).
 */
export function useEditedChartImage(
  chartData: ChartData | null,
  editFlags: EditFlags,
  editVersion: number,
  options: RenderOptions,
) {
  const hasEdits = Object.values(editFlags).some(Boolean) || editVersion > 0;

  return useQuery({
    queryKey: ["chart", "edited_image", editFlags, editVersion, options.laserLColor, options.laserRColor, options.pxPerSecond, options.columnHeight] as const,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/chart/render_data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart_data: chartData,
          output_format: "WEBP",
          quality: 80,
          laser_l_color: options.laserLColor,
          laser_r_color: options.laserRColor,
          px_per_second: options.pxPerSecond,
          column_height: options.columnHeight,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(detail);
      }
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    enabled: hasEdits && chartData !== null,
    staleTime: 0,
    gcTime: 5 * 60_000,
  });
}
