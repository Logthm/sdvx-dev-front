import { cn } from "@/lib/utils";
import type { DifficultyName } from "@/types/music";
import { DIFFICULTY_LABELS } from "@/types/music";

const BG_CLASSES: Record<DifficultyName, string> = {
  novice: "bg-diff-novice/15 text-diff-novice border-diff-novice/25",
  advanced: "bg-diff-advanced/15 text-diff-advanced border-diff-advanced/25",
  exhaust: "bg-diff-exhaust/15 text-diff-exhaust border-diff-exhaust/25",
  infinite: "bg-diff-infinite/15 text-diff-infinite border-diff-infinite/25",
  maximum: "bg-white/10 text-white border-white/15",
  ultimate: "bg-diff-ultimate/15 text-diff-ultimate border-diff-ultimate/25",
};

interface DifficultyBadgeProps {
  difstr: DifficultyName;
  level: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function DifficultyBadge({
  difstr,
  level,
  selected,
  onClick,
  className,
}: DifficultyBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-semibold font-mono",
        "transition-all duration-200 overflow-hidden",
        BG_CLASSES[difstr],
        selected && "ring-1 ring-gold-400/60 scale-105 shadow-[0_0_12px_oklch(0.72_0.155_70/0.15)]",
        onClick && "cursor-pointer hover:brightness-125 active:scale-95",
        !onClick && "cursor-default",
        className,
      )}
    >
      <span className="uppercase tracking-wide text-[10px] opacity-80">
        {DIFFICULTY_LABELS[difstr]}
      </span>
      <span>{level}</span>
    </button>
  );
}
