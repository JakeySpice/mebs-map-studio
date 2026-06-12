import type { MebsMap, MebsNode } from "@/types/graph";

export interface LaidOutNode {
  node: MebsNode;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  childCount: number;
  /** total nodes hidden beneath this node while collapsed */
  descendantCount: number;
}

export interface LayoutResult {
  items: LaidOutNode[];
  /** ids of nodes currently visible (not hidden under a collapsed ancestor) */
  visibleIds: Set<string>;
  childrenOf: Map<string | null, MebsNode[]>;
}

const WIDTH_BY_DEPTH = [340, 270, 240, 220];
const H_GAP = 72;
const SIBLING_GAP = 14;
const DOMAIN_GAP = 26; // breathing room between first-level branches

const FONT_PX = 13;
const AVG_CHAR_PX = FONT_PX * 0.52;
const LINE_HEIGHT = 18;
const PAD_Y = 11; // vertical padding inside a node (top or bottom)
const PAD_X = 14;
const CHIP_ROOM = 26; // space reserved for the expand chip on the right
const MAX_LINES = 3;

export function widthForDepth(depth: number): number {
  return WIDTH_BY_DEPTH[Math.min(depth, WIDTH_BY_DEPTH.length - 1)];
}

/** Estimate wrapped line count for the label inside a node of given width. */
export function estimateLines(label: string, width: number): number {
  const usable = width - PAD_X * 2 - CHIP_ROOM;
  const charsPerLine = Math.max(8, Math.floor(usable / AVG_CHAR_PX));
  // word-aware estimate: long words wrap whole
  const words = label.trim().split(/\s+/);
  let lines = 1;
  let current = 0;
  for (const word of words) {
    const len = word.length + (current > 0 ? 1 : 0);
    if (current + len > charsPerLine && current > 0) {
      lines += 1;
      current = word.length;
    } else {
      current += len;
    }
  }
  return Math.min(lines, MAX_LINES);
}

export function nodeHeight(label: string, width: number): number {
  return PAD_Y * 2 + estimateLines(label, width) * LINE_HEIGHT;
}

export function buildChildrenMap(
  nodes: MebsNode[]
): Map<string | null, MebsNode[]> {
  const childrenOf = new Map<string | null, MebsNode[]>();
  for (const n of nodes) {
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n);
    childrenOf.set(n.parentId, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }
  return childrenOf;
}

export function countDescendants(
  childrenOf: Map<string | null, MebsNode[]>,
  id: string
): number {
  let count = 0;
  const stack = [...(childrenOf.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    count += 1;
    stack.push(...(childrenOf.get(cur.id) ?? []));
  }
  return count;
}

/**
 * NotebookLM-style tidy tree: root at the left, children flowing right,
 * each parent vertically centred on its children, even sibling spacing.
 */
export function layoutMap(map: Pick<MebsMap, "nodes">): LayoutResult {
  const childrenOf = buildChildrenMap(map.nodes);
  const root = map.nodes.find((n) => n.type === "root" && n.parentId === null)
    ?? map.nodes.find((n) => n.parentId === null);
  if (!root) return { items: [], visibleIds: new Set(), childrenOf };

  const items: LaidOutNode[] = [];
  const visibleIds = new Set<string>();

  interface Block {
    node: MebsNode;
    depth: number;
    width: number;
    height: number;
    subtreeHeight: number;
    children: Block[];
  }

  const build = (node: MebsNode, depth: number): Block => {
    const width = widthForDepth(depth);
    const height = nodeHeight(node.label, width);
    const kids = node.collapsed ? [] : (childrenOf.get(node.id) ?? []);
    const children = kids.map((k) => build(k, depth + 1));
    const gap = depth === 0 ? DOMAIN_GAP : SIBLING_GAP;
    const childrenHeight =
      children.reduce((sum, c) => sum + c.subtreeHeight, 0) +
      Math.max(0, children.length - 1) * gap;
    return {
      node,
      depth,
      width,
      height,
      subtreeHeight: Math.max(height, childrenHeight),
      children,
    };
  };

  const place = (block: Block, x: number, yTop: number) => {
    const y = yTop + (block.subtreeHeight - block.height) / 2;
    visibleIds.add(block.node.id);
    items.push({
      node: block.node,
      x,
      y,
      width: block.width,
      height: block.height,
      depth: block.depth,
      childCount: (childrenOf.get(block.node.id) ?? []).length,
      descendantCount: countDescendants(childrenOf, block.node.id),
    });
    const gap = block.depth === 0 ? DOMAIN_GAP : SIBLING_GAP;
    let childY = yTop;
    // when a single child is shorter than its parent block, centre the run
    const childrenHeight =
      block.children.reduce((s, c) => s + c.subtreeHeight, 0) +
      Math.max(0, block.children.length - 1) * gap;
    if (childrenHeight < block.subtreeHeight) {
      childY += (block.subtreeHeight - childrenHeight) / 2;
    }
    for (const child of block.children) {
      place(child, x + block.width + H_GAP, childY);
      childY += child.subtreeHeight + gap;
    }
  };

  place(build(root, 0), 0, 0);
  return { items, visibleIds, childrenOf };
}
