import { useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Grid3x3,
  Hand,
  HelpCircle,
  Info,
  Keyboard,
  MousePointer,
  Move,
  Music,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Volume2,
  X,
  ZoomIn,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlightSelector?: string;
  position?: "center" | "top" | "bottom" | "left" | "right";
  positionDelay?: number;
  onEnter?: () => void;
}

interface TutorialProps {
  isOpen: boolean;
  currentStep: number;
  steps: TutorialStep[];
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onSkip: () => void;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function queryVisible(selector: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if ((el as HTMLElement).offsetParent !== null) return el;
  }
  return document.querySelector(selector);
}

export function Tutorial({
  isOpen,
  currentStep,
  steps,
  onNext,
  onPrev,
  onClose,
  onSkip,
}: TutorialProps) {
  const { t } = useTranslation();
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(
    null,
  );
  const [cardPosition, setCardPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isCardReady, setIsCardReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Initialize card position on mount
  useEffect(() => {
    if (isOpen && cardRef.current && !isCardReady) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const cardRect = cardRef.current.getBoundingClientRect();

      setCardPosition({
        top: viewportHeight / 2 - cardRect.height / 2,
        left: viewportWidth / 2 - cardRect.width / 2,
      });
      setIsCardReady(true);
    }
  }, [isOpen, isCardReady]);

  useEffect(() => {
    if (!isOpen || currentStep >= steps.length || !isCardReady) return;

    const step = steps[currentStep];
    step.onEnter?.();
    const measure = () => {
      if (step.highlightSelector) {
        const element = queryVisible(step.highlightSelector);
        if (element) {
          const el = element as HTMLElement;
          const prev = el.style.scrollMargin;
          el.style.scrollMargin = "16px";
          el.scrollIntoView({ block: "nearest" });
          el.style.scrollMargin = prev;
          const rect = element.getBoundingClientRect();
          const padding = 8;

          setHighlightRect({
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          });

          // Calculate card position based on highlight position
          setTimeout(() => {
            if (cardRef.current) {
              const cardRect = cardRef.current.getBoundingClientRect();
              const viewportWidth = window.innerWidth;
              const viewportHeight = window.innerHeight;

              let top = 0;
              let left = 0;

              switch (step.position) {
                case "top":
                  top = Math.max(20, rect.top - cardRect.height - 20);
                  left = Math.max(
                    20,
                    Math.min(
                      rect.left + rect.width / 2 - cardRect.width / 2,
                      viewportWidth - cardRect.width - 20,
                    ),
                  );
                  break;
                case "bottom":
                  top = Math.min(
                    viewportHeight - cardRect.height - 20,
                    rect.bottom + 20,
                  );
                  left = Math.max(
                    20,
                    Math.min(
                      rect.left + rect.width / 2 - cardRect.width / 2,
                      viewportWidth - cardRect.width - 20,
                    ),
                  );
                  break;
                case "left":
                  top = Math.max(
                    20,
                    Math.min(
                      rect.top + rect.height / 2 - cardRect.height / 2,
                      viewportHeight - cardRect.height - 20,
                    ),
                  );
                  left = Math.max(20, rect.left - cardRect.width - 20);
                  break;
                case "right":
                  top = Math.max(
                    20,
                    Math.min(
                      rect.top + rect.height / 2 - cardRect.height / 2,
                      viewportHeight - cardRect.height - 20,
                    ),
                  );
                  left = Math.min(
                    viewportWidth - cardRect.width - 20,
                    rect.right + 20,
                  );
                  break;
                default:
                  top = viewportHeight / 2 - cardRect.height / 2;
                  left = viewportWidth / 2 - cardRect.width / 2;
              }

              top = Math.max(
                16,
                Math.min(top, viewportHeight - cardRect.height - 16),
              );
              left = Math.max(
                16,
                Math.min(left, viewportWidth - cardRect.width - 16),
              );

              // If card overlaps highlight, reposition below it
              if (
                top < rect.bottom + 8 &&
                top + cardRect.height > rect.top - 8 &&
                left < rect.right + 8 &&
                left + cardRect.width > rect.left - 8
              ) {
                top = Math.min(
                  viewportHeight - cardRect.height - 16,
                  rect.bottom + 20,
                );
                left = Math.max(
                  16,
                  Math.min(
                    rect.left + rect.width / 2 - cardRect.width / 2,
                    viewportWidth - cardRect.width - 16,
                  ),
                );
              }

              setCardPosition({ top, left });
            }
          }, 50);
        } else {
          setHighlightRect(null);
          centerCard();
        }
      } else {
        setHighlightRect(null);
        centerCard();
      }
    };

    function centerCard() {
      setTimeout(() => {
        if (cardRef.current) {
          const cardRect = cardRef.current.getBoundingClientRect();
          setCardPosition({
            top: window.innerHeight / 2 - cardRect.height / 2,
            left: window.innerWidth / 2 - cardRect.width / 2,
          });
        }
      }, 50);
    }

    if (step.positionDelay) {
      setHighlightRect(null);
      const timer = setTimeout(measure, step.positionDelay);
      return () => clearTimeout(timer);
    } else {
      measure();
    }
  }, [isOpen, currentStep, steps, isCardReady]);

  // Watch highlighted element for size changes (e.g. expanded toolbar)
  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) return;
    const step = steps[currentStep];
    const sel = step.highlightSelector;
    if (!sel) return;
    const padding = 8;

    const setup = () => {
      const el = queryVisible(sel);
      if (!el) return;
      const update = () => {
        const r = el.getBoundingClientRect();
        setHighlightRect({
          top: r.top - padding,
          left: r.left - padding,
          width: r.width + padding * 2,
          height: r.height + padding * 2,
        });
      };
      const ro = new ResizeObserver(update);
      ro.observe(el);
      document.addEventListener("scroll", update, {
        capture: true,
        passive: true,
      });
      cleanupRef = () => {
        ro.disconnect();
        document.removeEventListener("scroll", update, { capture: true });
      };
    };

    let cleanupRef: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (step.positionDelay) {
      timer = setTimeout(setup, step.positionDelay);
    } else {
      setup();
    }

    return () => {
      if (timer) clearTimeout(timer);
      cleanupRef?.();
    };
  }, [isOpen, currentStep, steps]);

  if (!isOpen || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Spotlight overlay */}
      {highlightRect ? (
        <>
          {/* Darkened overlay with cutout for highlight */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              zIndex: 101,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7)",
              borderRadius: "8px",
            }}
          />

          {/* Highlight border */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              zIndex: 102,
            }}
          >
            <div className="absolute inset-0 rounded-lg border-2 border-accent shadow-glow-accent" />
            <div className="absolute inset-0 rounded-lg border border-accent/50" />

            {/* Corner accents */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent rounded-br-lg" />
          </div>
        </>
      ) : (
        /* No highlight - full screen backdrop */
        <div className="absolute inset-0 bg-cosmos-950/70 backdrop-blur-md" />
      )}

      {/* Tutorial card */}
      <div
        ref={cardRef}
        className={cn(
          "fixed w-[calc(100vw-32px)] max-w-md bg-cosmos-900 border border-cosmos-600/30 rounded-lg shadow-2xl overflow-hidden transition-all duration-500 ease-out",
          cardPosition ? "opacity-100" : "opacity-0",
        )}
        style={{
          top: cardPosition ? `${cardPosition.top}px` : "50%",
          left: cardPosition ? `${cardPosition.left}px` : "50%",
          transform: cardPosition ? "none" : "translate(-50%, -50%)",
          zIndex: 103,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cosmos-600/20 bg-cosmos-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              {step.icon}
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              {step.title}
            </h2>
          </div>
          <button
            onClick={onSkip}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-cosmos-700/50 transition-colors"
            aria-label={t("tutorial.closeTutorial")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 md:py-6">
          <div className="hidden md:block">
            <p className="text-text-secondary leading-relaxed whitespace-pre-line">
              {step.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {step.description.split("\n\n").map((para, i) => (
              <p key={i} className="text-text-secondary leading-snug whitespace-pre-line">
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-cosmos-600/20 bg-cosmos-800/30">
          <div className="hidden sm:flex items-center">
            <span className="text-xs font-mono text-text-muted">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          <div className="flex-1 sm:flex-none flex items-center gap-2 justify-between sm:justify-end">
            {!isFirstStep && (
              <button
                onClick={onPrev}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-cosmos-700/50 transition-colors flex items-center justify-center gap-1.5"
              >
                <ChevronLeft size={16} />
                {t("tutorial.previous")}
              </button>
            )}
            {isLastStep ? (
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium bg-accent text-cosmos-950 hover:bg-accent/90 transition-colors"
              >
                {t("tutorial.start")}
              </button>
            ) : (
              <button
                onClick={onNext}
                className="flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium bg-accent text-cosmos-950 hover:bg-accent/90 transition-colors flex items-center justify-center gap-1.5"
              >
                {t("tutorial.next")}
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tutorial steps configuration - now uses translation keys
export function useTutorialSteps() {
  const { t } = useTranslation();

  return [
    {
      title: t("tutorial.welcome.title"),
      description: t("tutorial.welcome.description"),
      icon: <Info size={20} />,
      position: "center" as const,
    },
    {
      title: t("search.title"),
      description: t("search.description"),
      icon: <Search size={20} />,
      highlightSelector: "[data-tutorial='search-bar']",
      position: "bottom" as const,
    },
    {
      title: t("filter.title"),
      description: t("filter.description"),
      icon: <SlidersHorizontal size={20} />,
      highlightSelector:
        "[data-tutorial='filter-sidebar'], [data-tutorial='filter-button']",
      position: "right" as const,
    },
    {
      title: t("tutorial.musicGrid.title"),
      description: t("tutorial.musicGrid.description"),
      icon: <Grid3x3 size={20} />,
      highlightSelector: "[data-tutorial='music-grid']",
      position: "top" as const,
    },
    {
      title: t("tutorial.finish.title"),
      description: t("tutorial.finish.description"),
      icon: <HelpCircle size={20} />,
      highlightSelector: "[data-tutorial='tutorial-button']",
      position: "bottom" as const,
    },
  ];
}

// Chart preview tutorial steps
export function useChartTutorialSteps() {
  const { t } = useTranslation();

  const selectFirstNote = () => {
    const s = useEditorStore.getState();
    if (s.selectedPoint) return;
    const chart = s.chartData;
    if (!chart) return;
    for (const track of ["3", "4", "5", "6", "2", "7"]) {
      if ((chart.tracks[track] ?? []).some((e) => e.type === "button")) {
        s.setSelectedPoint({ type: "button", track, index: 0 });
        return;
      }
    }
  };

  return [
    {
      title: t("chartTutorial.welcome.title"),
      description: t("chartTutorial.welcome.description"),
      icon: <Info size={20} />,
      position: "center" as const,
    },
    {
      title: t("chartTutorial.difficulty.title"),
      description: t("chartTutorial.difficulty.description"),
      icon: <MousePointer size={20} />,
      highlightSelector:
        "[data-tutorial='chart-difficulty'], [data-tutorial='chart-difficulty-mobile']",
      position: "bottom" as const,
      positionDelay: 180,
    },
    {
      title: t("chartTutorial.sidebar.title"),
      description: t("chartTutorial.sidebar.description"),
      icon: <Info size={20} />,
      highlightSelector: "[data-tutorial='chart-sidebar']",
      position: "right" as const,
      positionDelay: 180,
    },
    {
      title: t("chartTutorial.modeToggle.title"),
      description: t("chartTutorial.modeToggle.description"),
      icon: <Eye size={20} />,
      highlightSelector: "[data-tutorial='chart-mode-toggle']",
      position: "right" as const,
    },
    {
      title: t("chartTutorial.previewMode.title"),
      description: t("chartTutorial.previewMode.description"),
      icon: <Shuffle size={20} />,
      highlightSelector: "[data-tutorial='chart-render-options']",
      position: "right" as const,
    },
    {
      title: t("chartTutorial.editMode.title"),
      description: t("chartTutorial.editMode.description"),
      icon: <Pencil size={20} />,
      highlightSelector: "[data-tutorial='chart-render-options']",
      position: "right" as const,
    },
    {
      title: t("chartTutorial.drawArea.title"),
      description: t("chartTutorial.drawArea.description"),
      icon: <ZoomIn size={20} />,
      highlightSelector: "[data-tutorial='chart-zoom-controls']",
      position: "left" as const,
    },
    {
      title: t("chartTutorial.panMode.title"),
      description: t("chartTutorial.panMode.description"),
      icon: <Hand size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "top" as const,
    },
    {
      title: t("chartTutorial.moveMode.title"),
      description: t("chartTutorial.moveMode.description"),
      icon: <Move size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "top" as const,
      positionDelay: 20,
    },
    {
      title: t("chartTutorial.moveMode2.title"),
      description: t("chartTutorial.moveMode2.description"),
      icon: <Move size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "top" as const,
      positionDelay: 20,
    },
    {
      title: t("chartTutorial.editPointerMode.title"),
      description: t("chartTutorial.editPointerMode.description"),
      icon: <Pencil size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "top" as const,
      positionDelay: 20,
    },
    {
      title: t("chartTutorial.addMode.title"),
      description: t("chartTutorial.addMode.description"),
      icon: <Plus size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "top" as const,
      positionDelay: 20,
    },
    {
      title: t("chartTutorial.resetSelected.title"),
      description: t("chartTutorial.resetSelected.description"),
      icon: <RotateCcw size={20} />,
      highlightSelector: "[data-tutorial='chart-reset-selected']",
      position: "top" as const,
      positionDelay: 20,
      onEnter: selectFirstNote,
    },
    {
      title: t("chartTutorial.deleteSelected.title"),
      description: t("chartTutorial.deleteSelected.description"),
      icon: <Trash2 size={20} />,
      highlightSelector: "[data-tutorial='chart-delete-selected']",
      position: "top" as const,
      positionDelay: 20,
      onEnter: selectFirstNote,
    },
    // Play mode steps
    {
      title: t("chartTutorial.playMode.title"),
      description: t("chartTutorial.playMode.description"),
      icon: <Play size={20} />,
      highlightSelector: "[data-tutorial='chart-render-options']",
      position: "right" as const,
    },
    {
      title: t("chartTutorial.playTransport.title"),
      description: t("chartTutorial.playTransport.description"),
      icon: <Play size={20} />,
      highlightSelector: "[data-tutorial='playback-transport']",
      position: "right" as const,
      positionDelay: 20,
    },
    {
      title: t("chartTutorial.playRate.title"),
      description: t("chartTutorial.playRate.description"),
      icon: <Play size={20} />,
      highlightSelector: "[data-tutorial='playback-rate']",
      position: "right" as const,
      positionDelay: 20,
    },
    {
      title: t("chartTutorial.playMetronome.title"),
      description: t("chartTutorial.playMetronome.description"),
      icon: <Volume2 size={20} />,
      highlightSelector: "[data-tutorial='playback-metronome']",
      position: "right" as const,
      positionDelay: 20,
    },
    {
      title: t("chartTutorial.playBgm.title"),
      description: t("chartTutorial.playBgm.description"),
      icon: <Music size={20} />,
      highlightSelector: "[data-tutorial='playback-bgm']",
      position: "right" as const,
      positionDelay: 20,
    },
    {
      title: t("chartTutorial.playKeyboard.title"),
      description: t("chartTutorial.playKeyboard.description"),
      icon: <Keyboard size={20} />,
      position: "center" as const,
    },
    {
      title: t("tutorial.finish.title"),
      description: t("tutorial.finish.description"),
      icon: <HelpCircle size={20} />,
      highlightSelector: "[data-tutorial='tutorial-button']",
      position: "bottom" as const,
    },
  ];
}

// Legacy export for backward compatibility
export const tutorialSteps: TutorialStep[] = [];
