import { useEffect, useState } from "react";

/** Creates an object URL for a Blob and releases it when it is replaced. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [current, setCurrent] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!blob) {
      setCurrent(null);
      return;
    }

    const nextUrl = URL.createObjectURL(blob);
    setCurrent({ blob, url: nextUrl });

    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  if (!current || current.blob !== blob) return null;
  return current.url;
}
