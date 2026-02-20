import { X, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Grid3x3, Info, Eye, Pencil, Shuffle, Hand, ZoomIn, MousePointer, Move, Plus, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";

export interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlightSelector?: string;
  position?: "center" | "top" | "bottom" | "left" | "right";
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
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null);
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

    if (step.highlightSelector) {
      const element = document.querySelector(step.highlightSelector);
      if (element) {
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

            // Position card based on step position preference
            switch (step.position) {
              case "top":
                top = Math.max(20, rect.top - cardRect.height - 20);
                left = Math.max(20, Math.min(rect.left + rect.width / 2 - cardRect.width / 2, viewportWidth - cardRect.width - 20));
                break;
              case "bottom":
                top = Math.min(viewportHeight - cardRect.height - 20, rect.bottom + 20);
                left = Math.max(20, Math.min(rect.left + rect.width / 2 - cardRect.width / 2, viewportWidth - cardRect.width - 20));
                break;
              case "left":
                top = Math.max(20, Math.min(rect.top + rect.height / 2 - cardRect.height / 2, viewportHeight - cardRect.height - 20));
                left = Math.max(20, rect.left - cardRect.width - 20);
                break;
              case "right":
                top = Math.max(20, Math.min(rect.top + rect.height / 2 - cardRect.height / 2, viewportHeight - cardRect.height - 20));
                left = Math.min(viewportWidth - cardRect.width - 20, rect.right + 20);
                break;
              default:
                top = viewportHeight / 2 - cardRect.height / 2;
                left = viewportWidth / 2 - cardRect.width / 2;
            }

            setCardPosition({ top, left });
          }
        }, 50);
      } else {
        // Element not found - center the card
        setHighlightRect(null);
        setTimeout(() => {
          if (cardRef.current) {
            const cardRect = cardRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            setCardPosition({
              top: viewportHeight / 2 - cardRect.height / 2,
              left: viewportWidth / 2 - cardRect.width / 2,
            });
          }
        }, 50);
      }
    } else {
      // No highlight selector - center the card
      setHighlightRect(null);
      setTimeout(() => {
        if (cardRef.current) {
          const cardRect = cardRef.current.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          setCardPosition({
            top: viewportHeight / 2 - cardRect.height / 2,
            left: viewportWidth / 2 - cardRect.width / 2,
          });
        }
      }, 50);
    }
  }, [isOpen, currentStep, steps, isCardReady]);

  // Watch highlighted element for size changes (e.g. expanded toolbar)
  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) return;
    const sel = steps[currentStep].highlightSelector;
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    const padding = 8;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setHighlightRect({ top: r.top - padding, left: r.left - padding, width: r.width + padding * 2, height: r.height + padding * 2 });
    });
    ro.observe(el);
    return () => ro.disconnect();
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
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
              borderRadius: '8px',
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
          "fixed w-full max-w-md mx-4 bg-cosmos-900 border border-cosmos-600/30 rounded-lg shadow-2xl overflow-hidden transition-all duration-500 ease-out",
          cardPosition ? "opacity-100" : "opacity-0"
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
            aria-label={t('tutorial.closeTutorial')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-text-secondary leading-relaxed whitespace-pre-line">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-cosmos-600/20 bg-cosmos-800/30">
          <div className="flex items-center gap-1.5">
            {steps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === currentStep
                    ? "w-6 bg-accent"
                    : "w-1.5 bg-cosmos-600/40"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={onPrev}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-cosmos-700/50 transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                {t('tutorial.previous')}
              </button>
            )}
            {isLastStep ? (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-md text-sm font-medium bg-accent text-cosmos-950 hover:bg-accent/90 transition-colors"
              >
                {t('tutorial.start')}
              </button>
            ) : (
              <button
                onClick={onNext}
                className="px-4 py-1.5 rounded-md text-sm font-medium bg-accent text-cosmos-950 hover:bg-accent/90 transition-colors flex items-center gap-1.5"
              >
                {t('tutorial.next')}
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
      title: t('tutorial.welcome.title'),
      description: t('tutorial.welcome.description'),
      icon: <Info size={20} />,
      position: "center" as const,
    },
    {
      title: t('search.title'),
      description: t('search.description'),
      icon: <Search size={20} />,
      highlightSelector: "[data-tutorial='search-bar']",
      position: "bottom" as const,
    },
    {
      title: t('filter.title'),
      description: t('filter.description'),
      icon: <SlidersHorizontal size={20} />,
      highlightSelector: "[data-tutorial='filter-sidebar'], [data-tutorial='filter-button']",
      position: "right" as const,
    },
    {
      title: t('tutorial.musicGrid.title'),
      description: t('tutorial.musicGrid.description'),
      icon: <Grid3x3 size={20} />,
      highlightSelector: "[data-tutorial='music-grid']",
      position: "top" as const,
    },
    {
      title: t('tutorial.finish.title'),
      description: t('tutorial.finish.description'),
      icon: <HelpCircle size={20} />,
      highlightSelector: "[data-tutorial='tutorial-button']",
      position: "bottom" as const,
    },
  ];
}

// Chart preview tutorial steps
export function useChartTutorialSteps() {
  const { t } = useTranslation();

  return [
    {
      title: t('chartTutorial.welcome.title'),
      description: t('chartTutorial.welcome.description'),
      icon: <Info size={20} />,
      position: "center" as const,
    },
    {
      title: t('chartTutorial.difficulty.title'),
      description: t('chartTutorial.difficulty.description'),
      icon: <MousePointer size={20} />,
      highlightSelector: "[data-tutorial='chart-difficulty']",
      position: "bottom" as const,
    },
    {
      title: t('chartTutorial.sidebar.title'),
      description: t('chartTutorial.sidebar.description'),
      icon: <Info size={20} />,
      highlightSelector: "[data-tutorial='chart-sidebar']",
      position: "right" as const,
    },
    {
      title: t('chartTutorial.modeToggle.title'),
      description: t('chartTutorial.modeToggle.description'),
      icon: <Eye size={20} />,
      highlightSelector: "[data-tutorial='chart-mode-toggle']",
      position: "right" as const,
    },
    {
      title: t('chartTutorial.previewMode.title'),
      description: t('chartTutorial.previewMode.description'),
      icon: <Shuffle size={20} />,
      highlightSelector: "[data-tutorial='chart-render-options']",
      position: "right" as const,
    },
    {
      title: t('chartTutorial.editMode.title'),
      description: t('chartTutorial.editMode.description'),
      icon: <Pencil size={20} />,
      highlightSelector: "[data-tutorial='chart-render-options']",
      position: "right" as const,
    },
    {
      title: t('chartTutorial.drawArea.title'),
      description: t('chartTutorial.drawArea.description'),
      icon: <ZoomIn size={20} />,
      highlightSelector: "[data-tutorial='chart-zoom-controls']",
      position: "left" as const,
    },
    {
      title: t('chartTutorial.panMode.title'),
      description: t('chartTutorial.panMode.description'),
      icon: <Hand size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "right" as const,
    },
    {
      title: t('chartTutorial.moveMode.title'),
      description: t('chartTutorial.moveMode.description'),
      icon: <Move size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "right" as const,
    },
    {
      title: t('chartTutorial.editPointerMode.title'),
      description: t('chartTutorial.editPointerMode.description'),
      icon: <Pencil size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "right" as const,
    },
    {
      title: t('chartTutorial.addMode.title'),
      description: t('chartTutorial.addMode.description'),
      icon: <Plus size={20} />,
      highlightSelector: "[data-tutorial='chart-pointer-tools']",
      position: "right" as const,
    },
    {
      title: t('tutorial.finish.title'),
      description: t('tutorial.finish.description'),
      icon: <HelpCircle size={20} />,
      highlightSelector: "[data-tutorial='tutorial-button']",
      position: "bottom" as const,
    },
  ];
}

// Legacy export for backward compatibility
export const tutorialSteps: TutorialStep[] = [];
