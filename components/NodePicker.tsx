"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { nodeColors, type MebsNode } from "@/types/graph";
import { fuzzyScore } from "@/lib/fuzzy";
import { cn } from "@/lib/utils";

export interface NodePickerCandidate {
  node: MebsNode;
  /** small grey line under the label, e.g. "Setting event · in Home" */
  context?: string;
}

const MAX_RESULTS = 8;

/**
 * Inline fuzzy node chooser for inspector forms (link targets, move-to).
 * Same matcher as QuickFind, but rendered in-place rather than as an overlay:
 * type to filter, ↑/↓ + Enter or click to pick.
 */
export function NodePicker({
  candidates,
  onPick,
  placeholder,
  autoFocus,
}: {
  candidates: NodePickerCandidate[];
  onPick: (id: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const hits = React.useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return candidates.slice(0, MAX_RESULTS);
    const scored: Array<{ entry: NodePickerCandidate; score: number }> = [];
    for (const entry of candidates) {
      const score = fuzzyScore(trimmed, entry.node.label);
      if (score === -Infinity) continue;
      scored.push({ entry, score });
    }
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.node.label.localeCompare(b.entry.node.label)
    );
    return scored.slice(0, MAX_RESULTS).map((s) => s.entry);
  }, [candidates, query]);

  const activeIndex = hits.length === 0 ? 0 : Math.min(active, hits.length - 1);

  React.useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(hits.length ? (activeIndex + 1) % hits.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(hits.length ? (activeIndex - 1 + hits.length) % hits.length : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[activeIndex];
      if (hit) onPick(hit.node.id);
    }
    // Escape bubbles to whoever owns the form
  };

  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-zinc-900/60">
      <div className="flex items-center gap-2 border-b border-white/8 px-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? "Type to find a node…"}
          aria-label={placeholder ?? "Find a node"}
          className="h-8 w-full bg-transparent text-[12.5px] text-zinc-100 placeholder:text-zinc-500 outline-none"
        />
      </div>
      {hits.length === 0 ? (
        <p className="px-2.5 py-2.5 text-center text-[11.5px] text-zinc-500">
          No nodes match “{query.trim()}”.
        </p>
      ) : (
        <div ref={listRef} className="max-h-44 overflow-y-auto p-1">
          {hits.map((hit, i) => (
            <button
              key={hit.node.id}
              type="button"
              data-index={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(hit.node.id)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                i === activeIndex ? "bg-white/10" : "hover:bg-white/5"
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: nodeColors(hit.node.type).bg }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-zinc-100">
                  {hit.node.label || "Unnamed"}
                </span>
                {hit.context && (
                  <span className="block truncate text-[10px] text-zinc-500">
                    {hit.context}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
