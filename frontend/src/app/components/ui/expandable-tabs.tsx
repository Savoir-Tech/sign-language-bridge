import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

interface Tab {
  title: string;
  icon: LucideIcon;
}

interface ExpandableTabsProps {
  tabs: Tab[];
  activeIndex: number | null;
  onChange: (index: number) => void;
  className?: string;
  activeColor?: string;
}

export function ExpandableTabs({
  tabs,
  activeIndex,
  onChange,
  className,
  activeColor = "bg-brand-saffron text-brand-arctic",
}: ExpandableTabsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Click-outside to collapse
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpandedIndex(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  const handleTabClick = (index: number) => {
    onChange(index);
    setExpandedIndex(index);

    // Auto-collapse after 1 second
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      setExpandedIndex(null);
    }, 1000);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center gap-1 bg-brand-oceanic-deep rounded-xl p-1",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeIndex === index;
        const isExpanded = expandedIndex === index;

        return (
          <motion.button
            key={tab.title}
            layout
            onClick={() => handleTabClick(index)}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className={cn(
              "flex items-center gap-2 rounded-lg transition-colors cursor-pointer",
              isExpanded ? "px-4 py-2" : "px-3 py-2",
              isActive
                ? activeColor
                : "text-brand-mystic hover:text-brand-forsytha",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{
                    type: "spring",
                    duration: 0.5,
                    bounce: 0.15,
                    opacity: { delay: 0.1 },
                  }}
                  className="overflow-hidden whitespace-nowrap text-sm"
                >
                  {tab.title}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
