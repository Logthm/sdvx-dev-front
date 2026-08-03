import { useCallback, useEffect, useState } from "react";

interface WebKitDocument extends Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}

interface WebKitHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function fullscreenElement(doc: WebKitDocument): Element | null {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function ignoreFullscreenError(result: Promise<void> | void): void {
  if (result) {
    void result.catch(() => undefined);
  }
}

/**
 * Keeps native fullscreen state in sync and falls back to an app-level
 * fullscreen mode on narrow screens, where browser fullscreen APIs are
 * inconsistent (especially on iOS).
 */
export function useResponsiveFullscreen(
  mobileFullscreen: boolean,
  toggleMobileFullscreen: () => void,
  mobileBreakpoint = 768,
) {
  const [nativeFullscreen, setNativeFullscreen] = useState(() =>
    typeof document === "undefined"
      ? false
      : fullscreenElement(document as WebKitDocument) !== null,
  );

  useEffect(() => {
    const doc = document as WebKitDocument;
    const syncFullscreenState = () => {
      setNativeFullscreen(fullscreenElement(doc) !== null);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (window.innerWidth < mobileBreakpoint) {
      toggleMobileFullscreen();
      return;
    }

    const doc = document as WebKitDocument;
    if (fullscreenElement(doc)) {
      const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
      if (exit) ignoreFullscreenError(exit.call(doc));
      return;
    }

    const root = document.documentElement as WebKitHTMLElement;
    const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
    if (request) ignoreFullscreenError(request.call(root));
  }, [mobileBreakpoint, toggleMobileFullscreen]);

  return {
    isFullscreen: nativeFullscreen || mobileFullscreen,
    toggleFullscreen,
  };
}
