"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { NODE_TYPE_INFO, nodeColors, type MebsNode } from "@/types/graph";
import { useMapStore } from "@/lib/store";

/**
 * Subsequence fuzzy score of `query` against `text`. Returns -Infinity when
 * `query` isn't a subsequence of `text`; higher is better. Rewards consecutive
 * runs, matches at word starts (space / punctuation / camelCase boundaries),
 * and an early first match. Case-insensitive. Plenty for a node picker — no
 * external matcher.
 */
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let qi = 0;
  let run = 0;
  let firstIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      run = 0;
      continue;
    }
    if (firstIdx === -1) firstIdx = ti;
    let bonus = 1;
    run += 1;
    bonus += (run - 1) * 4; // consecutive characters are worth much more
    const prev = ti > 0 ? text[ti - 1] : " ";
    const isWordStart =
      ti === 0 ||
      /[\s\-_/.,()]/.test(prev) ||
      (/[a-z]/.test(prev) && /[A-Z]/.test(text[ti]));
    if (isWordStart) bonus += 6;
    score += bonus;
    qi += 1;
  }
  if (qi < q.length) return -Infinity; // not all query chars consumed
  // bias toward earlier first hits and shorter haystacks (tighter match)
  score -= firstIdx * 0.5;
  score -= t.length * 0.05;
  return score;
}

interface Hit {
  node: MebsNode;
  parentLabel: string | null;
  score: number;
}

const MAX_RESULTS = 12;

export function QuickFind({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const map = useMapStore((s) => s.map);
  const selectNode = useMapStore((s) => s.selectNode);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Autofocus the field on open. Pure DOM side-effect (no setState): the parent
  // only mounts this while open, so each invocation already starts from the
  // initial query/active state — no reset needed here.
  React.useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const labelById = React.useMemo(
    () => new Map((map?.nodes ?? []).map((n) => [n.id, n.label])),
    [map]
  );

  const hits = React.useMemo<Hit[]>(() => {
    if (!map) return [];
    const nodes = map.nodes.filter((n) => n.type !== "root");
    const trimmed = query.trim();
    if (!trimmed) {
      // no query yet → show a stable slice so arrows/Enter still work
      return nodes.slice(0, MAX_RESULTS).map((node) => ({
        node,
        parentLabel: node.parentId ? labelById.get(node.parentId) ?? null : null,
        score: 0,
      }));
    }
    const scored: Hit[] = [];
    for (const node of nodes) {
      // label hits beat summary-only hits, so weight the label channel
      const labelScore = fuzzyScore(trimmed, node.label);
      const summaryScore = node.summary
        ? fuzzyScore(trimmed, node.summary) - 8
        : -Infinity;
      const score = Math.max(labelScore, summaryScore);
      if (score === -Infinity) continue;
      scored.push({
        node,
        parentLabel: node.parentId ? labelById.get(node.parentId) ?? null : null,
        score,
      });
    }
    scored.sort((a, b) => b.score - a.score || a.node.label.localeCompare(b.node.label));
    return scored.slice(0, MAX_RESULTS);
  }, [map, query, labelById]);

  // Clamp at use-time rather than storing a corrected index in an effect: as
  // results shrink the raw `active` may exceed the list, so the rendered
  // highlight follows `activeIndex`.
  const activeIndex = hits.length === 0 ? 0 : Math.min(active, hits.length - 1);

  // scroll the active row into view
  React.useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const jump = (hit: Hit | undefined) => {
    if (!hit) return;
    selectNode(hit.node.id, { reveal: true });
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(hits.length ? (activeIndex + 1) % hits.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(hits.length ? (activeIndex - 1 + hits.length) % hits.length : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      jump(hits[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open || !map) return null;

  return (
    // overlay: click-away closes; click inside doesn't
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/8 px-3.5">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Find a node by name or summary…"
            aria-label="Quick find"
            className="h-12 w-full bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-500 outline-none"
          />
        </div>

        {hits.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-zinc-500">
            No nodes match “{query.trim()}”.
          </div>
        ) : (
          <div ref={listRef} className="max-h-[48vh] overflow-y-auto p-1.5">
            {hits.map((hit, i) => (
              <button
                key={hit.node.id}
                type="button"
                data-index={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => jump(hit)}
                className={
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors " +
                  (i === activeIndex ? "bg-white/10" : "hover:bg-white/5")
                }
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: nodeColors(hit.node.type).bg }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-zinc-100">
                    {hit.node.label}
                  </span>
                  <span className="block truncate text-[10.5px] text-zinc-500">
                    {NODE_TYPE_INFO[hit.node.type].label}
                    {hit.parentLabel ? ` · in ${hit.parentLabel}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
