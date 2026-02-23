import { useEffect, useRef, useState } from "react";

const CARD_MIN_W = 220;
const GAP = 10; // gap-2.5 = 10px
const SM_BP = 640;
const ROWS_PER_PAGE = 4;
const MIN_PAGE_SIZE = 12;

function calcColumns(containerW: number): number {
  if (containerW < SM_BP) return 2;
  // sm:p-4 = 16px each side
  const available = containerW - 32;
  return Math.max(1, Math.floor((available + GAP) / (CARD_MIN_W + GAP)));
}

export function useGridPageSize() {
  const ref = useRef<HTMLElement>(null);
  const [pageSize, setPageSize] = useState(40);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const cols = calcColumns(el.clientWidth);
      setPageSize(Math.max(MIN_PAGE_SIZE, cols * ROWS_PER_PAGE));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, pageSize };
}
