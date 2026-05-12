import { DEFAULT_BT_ORDER, type EditFlags, type RenderOptions } from "@/lib/editor-store";
import { useEditorStore } from "@/lib/editor-store";
import type { ChartData, ChartTimingData } from "@/types/chart";
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
 * Fetch arranged chart data from the backend (for s-random and custom random modes).
 * Returns the full ChartData with arrangement already applied by the backend.
 */
export function useArrangedChartData(
  musicId: number | null,
  difstr: string | null,
  options: RenderOptions,
  enabled: boolean,
) {
  const hasCustomMapping = isCustomBtOrder(options.btOrder) || options.fxSwap;

  return useQuery({
    queryKey: [
      "chart",
      "arranged_data",
      musicId,
      difstr,
      options.arrangementMode,
      options.btOrder.join(","),
      options.fxSwap,
      options.mirrorLaser,
      options.rngSeed,
    ] as const,
    queryFn: async () => {
      const body: Record<string, unknown> = {
        music_id: musicId,
        difstr: difstr,
        arrangement_mode: hasCustomMapping ? "normal" : options.arrangementMode,
      };

      if (options.rngSeed !== null) {
        body.rng_seed = options.rngSeed;
      }

      if (hasCustomMapping) {
        body.bt_order = options.btOrder;
        body.fx_swap = options.fxSwap;
      }

      if (options.mirrorLaser) {
        body.mirror_laser = true;
      }

      return apiFetch<ChartData>("/chart/data/arranged", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    enabled:
      enabled &&
      musicId !== null &&
      difstr !== null &&
      difstr.length > 0 &&
      options.arrangementMode !== "normal",
    staleTime: 10 * 60_000,
  });
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
  const simplifyLasers = useEditorStore((s) => s.previewSimplifyLasers);

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
      options.rngSeed,
      options.laserLColor,
      options.laserRColor,
      options.pxPerSecond,
      options.columnHeight,
      simplifyLasers,
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

      if (options.rngSeed !== null) {
        body.rng_seed = options.rngSeed;
      }

      if (hasCustomMapping) {
        body.bt_order = options.btOrder;
        body.fx_swap = options.fxSwap;
      }

      if (options.mirrorLaser) {
        body.mirror_laser = true;
      }

      if (simplifyLasers) {
        body.simplify_lasers = true;
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

      const maxPps = res.headers.get("X-Max-Px-Per-Second");
      if (maxPps) {
        useEditorStore.getState().setMaxPxPerSecond(parseInt(maxPps, 10));
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
 * Render an edited/arranged chart via POST /chart/render_data.
 *
 * Triggers when editFlags are active, manual edits have been made (editVersion > 0),
 * or arrangement is applied (chartData already contains the arrangement).
 */
export function useEditedChartImage(
  musicId: number | null,
  difstr: string | null,
  chartData: ChartData | null,
  editFlags: EditFlags,
  editVersion: number,
  options: RenderOptions,
) {
  const hasEdits = Object.values(editFlags).some(Boolean) || editVersion > 0;
  const hasArrangement = options.arrangementMode !== "normal";

  return useQuery({
    queryKey: ["chart", "edited_image", musicId, difstr, editFlags, editVersion, options.arrangementMode, options.btOrder.join(","), options.fxSwap, options.mirrorLaser, options.laserLColor, options.laserRColor, options.pxPerSecond, options.columnHeight] as const,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/chart/render_data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          music_id: musicId,
          difstr: difstr,
          chart_data: chartData,
          output_format: "JPEG",
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
      const maxPps = res.headers.get("X-Max-Px-Per-Second");
      if (maxPps) {
        useEditorStore.getState().setMaxPxPerSecond(parseInt(maxPps, 10));
      }
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    enabled: (hasEdits || hasArrangement) && chartData !== null && musicId !== null && difstr !== null,
    staleTime: 0,
    gcTime: 5 * 60_000,
  });
}

/**
 * Fetch timing-only chart data (no tracks) — safe for non-editable charts.
 */
export function useChartTimingData(
  musicId: number | null,
  difstr: string | null,
) {
  return useQuery({
    queryKey: ["chart", "timing", musicId, difstr] as const,
    queryFn: async () => {
      return apiFetch<ChartTimingData>(`/chart/timing/${musicId}/${difstr}`);
    },
    enabled: musicId !== null && difstr !== null && difstr.length > 0,
    staleTime: 10 * 60_000,
  });
}

/**
 * Fetch a single-column playback image as a blob URL.
 */
export function usePlaybackImage(
  musicId: number | null,
  difstr: string | null,
  options: RenderOptions,
  enabled: boolean,
) {
  const hasCustomMapping = isCustomBtOrder(options.btOrder) || options.fxSwap;

  return useQuery({
    queryKey: [
      "chart",
      "playback_image",
      musicId,
      difstr,
      options.arrangementMode,
      options.btOrder.join(","),
      options.fxSwap,
      options.mirrorLaser,
      options.rngSeed,
      options.laserLColor,
      options.laserRColor,
      options.pxPerSecond,
    ] as const,
    queryFn: async () => {
      const body: Record<string, unknown> = {
        music_id: musicId,
        difstr: difstr,
        arrangement_mode: hasCustomMapping ? "normal" : options.arrangementMode,
        output_format: "WEBP",
        quality: 80,
        px_per_second: options.pxPerSecond,
        laser_l_color: options.laserLColor,
        laser_r_color: options.laserRColor,
        single_column: true,
      };

      if (options.rngSeed !== null) {
        body.rng_seed = options.rngSeed;
      }
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

      const maxPps = res.headers.get("X-Max-Px-Per-Second");
      if (maxPps) {
        useEditorStore.getState().setMaxPxPerSecond(parseInt(maxPps, 10));
      }

      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    enabled:
      enabled &&
      musicId !== null &&
      difstr !== null &&
      difstr.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Export a chart image with specified measure range.
 * Downloads the image directly instead of returning a blob URL.
 */
export async function exportChartImage(
  musicId: number,
  difstr: string,
  options: RenderOptions,
  startMeasure: number,
  endMeasure: number,
): Promise<void> {
  const hasCustomMapping = isCustomBtOrder(options.btOrder) || options.fxSwap;

  const body: Record<string, unknown> = {
    music_id: musicId,
    difstr: difstr,
    arrangement_mode: hasCustomMapping ? "normal" : options.arrangementMode,
    output_format: "PNG",
    px_per_second: options.pxPerSecond,
    column_height: options.columnHeight,
    laser_l_color: options.laserLColor,
    laser_r_color: options.laserRColor,
    start_measure: startMeasure,
    end_measure: endMeasure,
  };

  if (options.rngSeed !== null) {
    body.rng_seed = options.rngSeed;
  }

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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chart_measure_${startMeasure}-${endMeasure}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export an edited chart image with specified measure range.
 * Downloads the image directly instead of returning a blob URL.
 */
export async function exportEditedChartImage(
  musicId: number,
  difstr: string,
  chartData: ChartData,
  options: RenderOptions,
  startMeasure: number,
  endMeasure: number,
): Promise<void> {
  const body: Record<string, unknown> = {
    music_id: musicId,
    difstr: difstr,
    chart_data: chartData,
    output_format: "PNG",
    px_per_second: options.pxPerSecond,
    column_height: options.columnHeight,
    laser_l_color: options.laserLColor,
    laser_r_color: options.laserRColor,
    start_measure: startMeasure,
    end_measure: endMeasure,
  };

  const res = await fetch(`${BASE_URL}/chart/render_data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(detail);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chart_measure_${startMeasure}-${endMeasure}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
