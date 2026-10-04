import type { ReactNode } from "react";

export type MobileTab<T extends string> = {
  id: T;
  label: string;
  icon: ReactNode;
  count?: number;
};

type Props<T extends string> = {
  tabs: MobileTab<T>[];
  active: T;
  onChange: (tab: T) => void;
};

/** Below the lg breakpoint only one column fits, so these tabs switch between them. */
export default function MobileTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div role="tablist" aria-label="Planner sections" className="flex gap-1 border-b border-lavender-soft/70 bg-white/70 p-2 backdrop-blur lg:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors ${
            active === tab.id ? "bg-ink text-white" : "text-ink hover:bg-lavender-soft/50"
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && <span className="text-xs opacity-70">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
