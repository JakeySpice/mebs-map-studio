import type { FitViewOptions } from "@xyflow/react";
import type { MebsMap, MebsNode, ZoneId } from "@/types/graph";
import {
  buildChildrenMap,
  countDescendants,
  layoutMap,
  nodeHeight,
  widthForDepth,
  type LaidOutNode,
} from "@/lib/layout";
import { classifyZones, type ZoneTree } from "@/lib/zones";

/* ----------------------------------------------------------------------- *
 * Botanical layout: five zones stacked on a central vertical axis.
 *
 *   canopy (QoL/goals)            grows up
 *   branches (support plan)       grows up, fans from the apex
 *   trunk (formulation spine)     axis-centred column, leaves flank L/R
 *   behaviour (pressure points)   beside the trunk, grows right
 *   [map root node = ground line at (0, 0)]
 *   roots (person & context)      grows down
 * ----------------------------------------------------------------------- */

export type GrowDir = "right" | "left" | "up" | "down";

export interface BotanicalItem extends LaidOutNode {
  zone?: ZoneId;
  /** direction this node's children grow — drives the collapse chevron */
  dir: GrowDir;
  /** rendered as a tip-over list item under its parent */
  listItem: boolean;
}

export interface StructEdgeSpec {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  kind: "tree" | "rail" | "spine" | "apex" | "aspiration";
  /** aspiration only: which side the C-curve bows (-1 left, +1 right) */
  side?: -1 | 1;
}

export interface ZoneRect {
  zone: ZoneId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BotanicalLayout {
  items: BotanicalItem[];
  visibleIds: Set<string>;
  /** children map of the VISUAL forest (promoted QoL subtrees detached) */
  childrenOf: Map<string | null, MebsNode[]>;
  structEdges: StructEdgeSpec[];
  zoneRects: ZoneRect[];
  apex: { x: number; y: number } | null;
}

/** Synthetic node the branch fan grows from. Render-array only — never in
 *  map.nodes; any future select-all/export-nodes feature must exclude it. */
export const APEX_ID = "__mebs_apex__";

/** Handle ids on every MebsNode, by role and side. */
export const HANDLES = {
  src: { top: "out-t", bottom: "link-out", left: "out-l", right: "tree-out" },
  tgt: { top: "link-in", bottom: "in-b", left: "tree-in", right: "in-r" },
} as const;

const V_GAP = 60; // parent -> child along the growth axis, vertical zones
const H_GAP = 72; // behaviour zone (matches outline)
const SIBLING_GAP = 14;
const DOMAIN_GAP = 26;
const TREE_GAP = 56; // between domain trees packed in one band
const ZONE_GAP_Y = 140; // vertical gap between zone bands
const ZONE_PAD_Y = 48; // map root node <-> trunk / roots band
const BEHAVIOUR_GAP = 200; // trunk right extent -> behaviour band
const MIN_TRUNK_HALF = 320; // behaviour never hugs the axis
const TRUNK_ROW_GAP = 18;
const TRUNK_FLANK_GAP = 56;
const FORMULATION_W = 360;
const LIST_INDENT = 24; // tip-over list indent (cross axis)
const LIST_GAP = 10; // between stacked list items
const MAX_BAND_WIDTH = 3200; // shelf-wrap safety valve
const SHELF_ROW_GAP = 120;
export const BACKDROP_PAD = 36;

/** Order of formulation clusters on the spine, bottom (near roots) to top. */
const TRUNK_PRIORITY_SORT = true;
const TRUNK_PRIORITY: Partial<Record<string, number>> = {
  setting_event: 0,
  antecedent: 1,
  consequence: 2,
  communication_factor: 3,
  skill_gap: 4,
  trauma_factor: 5,
  sensory_factor: 5,
  health_factor: 5,
  function_hypothesis: 8,
  protective_factor: 9,
  open_question: 10,
};
const TRUNK_PRIORITY_DEFAULT = 6;

/** Person -> promoted-QoL "aspiration" line stays visible (faint). */
export const SHOW_ASPIRATION = true;

interface LocalItem {
  node: MebsNode;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  dir: GrowDir;
  listItem: boolean;
}

interface LocalLayout {
  items: LocalItem[];
  edges: StructEdgeSpec[];
}

function bboxOf(items: LocalItem[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x);
    minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + it.width);
    maxY = Math.max(maxY, it.y + it.height);
  }
  if (items.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function translate(items: LocalItem[], dx: number, dy: number) {
  for (const it of items) {
    it.x += dx;
    it.y += dy;
  }
}

/* ------------------------- oriented tidy tree -------------------------- */

interface Block {
  node: MebsNode;
  depth: number;
  w: number;
  h: number;
  /** node extents on (growth, sibling) axes */
  main: number;
  cross: number;
  /** children rendered as an indented tip-over list (vertical zones only) */
  list: boolean;
  children: Block[];
  mainExtent: number;
  crossExtent: number;
}

function isVertical(o: GrowDir) {
  return o === "up" || o === "down";
}

function mainGapFor(o: GrowDir) {
  return isVertical(o) ? V_GAP : H_GAP;
}

function buildBlock(
  node: MebsNode,
  depth: number,
  o: GrowDir,
  childrenOf: Map<string | null, MebsNode[]>,
  treeRootDepth: number
): Block {
  const w = widthForDepth(depth);
  const h = nodeHeight(node.label, w);
  const [main, cross] = isVertical(o) ? [h, w] : [w, h];
  const kids = node.collapsed ? [] : (childrenOf.get(node.id) ?? []);
  const children = kids.map((k) =>
    buildBlock(k, depth + 1, o, childrenOf, treeRootDepth)
  );
  const list =
    isVertical(o) &&
    children.length > 0 &&
    children.every((c) => c.children.length === 0);

  if (list) {
    const listMain =
      children.reduce((s, c) => s + c.main, 0) +
      (children.length - 1) * LIST_GAP;
    return {
      node,
      depth,
      w,
      h,
      main,
      cross,
      list,
      children,
      mainExtent: main + LIST_GAP + listMain,
      crossExtent: Math.max(
        cross,
        LIST_INDENT + Math.max(...children.map((c) => c.cross))
      ),
    };
  }

  const gap = depth === treeRootDepth ? DOMAIN_GAP : SIBLING_GAP;
  const childrenCross =
    children.reduce((s, c) => s + c.crossExtent, 0) +
    Math.max(0, children.length - 1) * gap;
  return {
    node,
    depth,
    w,
    h,
    main,
    cross,
    list,
    children,
    mainExtent:
      main +
      (children.length
        ? mainGapFor(o) + Math.max(...children.map((c) => c.mainExtent))
        : 0),
    crossExtent: Math.max(cross, childrenCross),
  };
}

/** Map (mainPos, crossPos) — distance along growth axis to the node's near
 *  edge, and position along the sibling axis — to canvas coordinates. */
function emitAt(
  o: GrowDir,
  mainPos: number,
  crossPos: number,
  w: number,
  h: number
): { x: number; y: number } {
  switch (o) {
    case "right":
      return { x: mainPos, y: crossPos };
    case "left":
      return { x: -(mainPos + w), y: crossPos };
    case "down":
      return { x: crossPos, y: mainPos };
    case "up":
      return { x: crossPos, y: -(mainPos + h) };
  }
}

function structHandles(o: GrowDir): { sourceHandle: string; targetHandle: string } {
  switch (o) {
    case "right":
      return { sourceHandle: HANDLES.src.right, targetHandle: HANDLES.tgt.left };
    case "left":
      return { sourceHandle: HANDLES.src.left, targetHandle: HANDLES.tgt.right };
    case "down":
      return { sourceHandle: HANDLES.src.bottom, targetHandle: HANDLES.tgt.top };
    case "up":
      return { sourceHandle: HANDLES.src.top, targetHandle: HANDLES.tgt.bottom };
  }
}

function placeBlock(
  block: Block,
  o: GrowDir,
  mainPos: number,
  crossPos: number,
  treeRootDepth: number,
  out: LocalLayout,
  asListItem = false
) {
  const nodeCross = block.list
    ? crossPos
    : crossPos + (block.crossExtent - block.cross) / 2;
  const pos = emitAt(o, mainPos, nodeCross, block.w, block.h);
  out.items.push({
    node: block.node,
    x: pos.x,
    y: pos.y,
    width: block.w,
    height: block.h,
    depth: block.depth,
    dir: o,
    listItem: asListItem,
  });

  if (block.list) {
    // tip-over list: one indented column along the growth axis; in "up"
    // zones place in reverse so sibling order still reads top-to-bottom
    const ordered =
      o === "up" ? [...block.children].reverse() : block.children;
    let itemMain = mainPos + block.main + LIST_GAP;
    for (const child of ordered) {
      const itemPos = emitAt(
        o,
        itemMain,
        crossPos + LIST_INDENT,
        child.w,
        child.h
      );
      out.items.push({
        node: child.node,
        x: itemPos.x,
        y: itemPos.y,
        width: child.w,
        height: child.h,
        depth: child.depth,
        dir: o,
        listItem: true,
      });
      out.edges.push({
        id: `rail-${child.node.id}`,
        source: block.node.id,
        target: child.node.id,
        sourceHandle: HANDLES.src.left,
        targetHandle: HANDLES.tgt.left,
        kind: "rail",
      });
      itemMain += child.main + LIST_GAP;
    }
    return;
  }

  const gap = block.depth === treeRootDepth ? DOMAIN_GAP : SIBLING_GAP;
  const childrenCross =
    block.children.reduce((s, c) => s + c.crossExtent, 0) +
    Math.max(0, block.children.length - 1) * gap;
  let childCross = crossPos;
  if (childrenCross < block.crossExtent) {
    childCross += (block.crossExtent - childrenCross) / 2;
  }
  const handles = structHandles(o);
  for (const child of block.children) {
    placeBlock(
      child,
      o,
      mainPos + block.main + mainGapFor(o),
      childCross,
      treeRootDepth,
      out
    );
    out.edges.push({
      id: `tree-${child.node.id}`,
      source: block.node.id,
      target: child.node.id,
      ...handles,
      kind: "tree",
    });
    childCross += child.crossExtent + gap;
  }
}

function layoutTree(
  tree: ZoneTree,
  o: GrowDir,
  childrenOf: Map<string | null, MebsNode[]>
): LocalLayout {
  const rootDepth = tree.promotedFrom ? 2 : 1;
  const out: LocalLayout = { items: [], edges: [] };
  const block = buildBlock(tree.node, rootDepth, o, childrenOf, rootDepth);
  placeBlock(block, o, 0, 0, rootDepth, out);
  return out;
}

/* ------------------------------ bands ---------------------------------- */

interface BandLayout extends LocalLayout {
  w: number;
  h: number;
}

/** Pack a zone's trees into a band normalised to a (0,0)–(w,h) box. */
function layoutBand(
  trees: ZoneTree[],
  o: GrowDir,
  childrenOf: Map<string | null, MebsNode[]>
): BandLayout {
  const out: BandLayout = { items: [], edges: [], w: 0, h: 0 };
  if (trees.length === 0) return out;

  if (o === "right") {
    // behaviour: trees stack vertically, all growing rightward
    let cursorY = 0;
    let maxW = 0;
    for (const tree of trees) {
      const local = layoutTree(tree, o, childrenOf);
      const bb = bboxOf(local.items);
      translate(local.items, -bb.minX, cursorY - bb.minY);
      out.items.push(...local.items);
      out.edges.push(...local.edges);
      cursorY += bb.maxY - bb.minY + TREE_GAP;
      maxW = Math.max(maxW, bb.maxX - bb.minX);
    }
    out.w = maxW;
    out.h = Math.max(0, cursorY - TREE_GAP);
    return out;
  }

  // vertical zones: trees pack horizontally, wrapping to shelf rows
  interface Placed {
    local: LocalLayout;
    w: number;
    h: number;
  }
  const rows: Placed[][] = [[]];
  let rowW = 0;
  for (const tree of trees) {
    const local = layoutTree(tree, o, childrenOf);
    const bb = bboxOf(local.items);
    translate(local.items, -bb.minX, -bb.minY); // normalise tree to 0,0
    const tw = bb.maxX - bb.minX;
    const th = bb.maxY - bb.minY;
    if (rowW > 0 && rowW + TREE_GAP + tw > MAX_BAND_WIDTH) {
      rows.push([]);
      rowW = 0;
    }
    rows[rows.length - 1].push({ local, w: tw, h: th });
    rowW += (rowW > 0 ? TREE_GAP : 0) + tw;
  }

  const rowDims = rows.map((row) => ({
    w:
      row.reduce((s, p) => s + p.w, 0) +
      Math.max(0, row.length - 1) * TREE_GAP,
    h: Math.max(0, ...row.map((p) => p.h)),
  }));
  const bandW = Math.max(...rowDims.map((r) => r.w));
  const bandH =
    rowDims.reduce((s, r) => s + r.h, 0) +
    Math.max(0, rows.length - 1) * SHELF_ROW_GAP;

  // For "up" zones row 0 sits nearest the trunk (bottom of the band);
  // for "down" zones row 0 sits nearest the root (top of the band).
  let rowEdge = o === "up" ? bandH : 0;
  for (let r = 0; r < rows.length; r++) {
    const { w: rW, h: rH } = rowDims[r];
    let x = (bandW - rW) / 2; // centre each row in the band
    const top = o === "up" ? rowEdge - rH : rowEdge;
    for (const placed of rows[r]) {
      // align bottoms within the row for "up", tops for "down"
      const dy = o === "up" ? top + (rH - placed.h) : top;
      translate(placed.local.items, x, dy);
      out.items.push(...placed.local.items);
      out.edges.push(...placed.local.edges);
      x += placed.w + TREE_GAP;
    }
    rowEdge = o === "up" ? top - SHELF_ROW_GAP : top + rH + SHELF_ROW_GAP;
  }
  out.w = bandW;
  out.h = bandH;
  return out;
}

/* ------------------------------ spine ---------------------------------- */

interface SpineLayout extends LocalLayout {
  /** extents from the axis (x = 0) */
  minX: number;
  maxX: number;
  h: number;
}

function clusterPriority(cluster: MebsNode): number {
  const key = cluster.childTypeHint ?? cluster.type;
  return TRUNK_PRIORITY[key] ?? TRUNK_PRIORITY_DEFAULT;
}

/** Trunk: axis-centred column. Domain at the base, clusters stacked above
 *  it (setting events nearest the roots, hypotheses nearest the branches),
 *  each cluster's children flanking left/right. Local coords: axis at
 *  x = 0, column bottom at y = 0, growing upward (negative y). */
function layoutSpine(
  trees: ZoneTree[],
  childrenOf: Map<string | null, MebsNode[]>
): SpineLayout {
  const out: SpineLayout = { items: [], edges: [], minX: 0, maxX: 0, h: 0 };
  if (trees.length === 0) return out;

  let cursor = 0;
  for (const tree of trees) {
    const domain = tree.node;
    const dw = FORMULATION_W;
    const dh = nodeHeight(domain.label, dw);
    out.items.push({
      node: domain,
      x: -dw / 2,
      y: cursor - dh,
      width: dw,
      height: dh,
      depth: 1,
      dir: "up",
      listItem: false,
    });

    const clusters = domain.collapsed
      ? []
      : [...(childrenOf.get(domain.id) ?? [])];
    if (TRUNK_PRIORITY_SORT) {
      clusters.sort(
        (a, b) =>
          clusterPriority(a) - clusterPriority(b) || a.order - b.order
      );
    }

    let rowBottom = cursor - dh - TRUNK_ROW_GAP;
    for (const cluster of clusters) {
      const cw = widthForDepth(2);
      const ch = nodeHeight(cluster.label, cw);
      const kids = cluster.collapsed
        ? []
        : (childrenOf.get(cluster.id) ?? []);

      // greedy split: each child joins the currently-shorter flank
      const flanks: { side: -1 | 1; blocks: Block[]; height: number }[] = [
        { side: -1, blocks: [], height: 0 },
        { side: 1, blocks: [], height: 0 },
      ];
      for (const kid of kids) {
        const side = flanks[0].height <= flanks[1].height ? 0 : 1;
        const o: GrowDir = flanks[side].side === -1 ? "left" : "right";
        const block = buildBlock(kid, 3, o, childrenOf, 99);
        flanks[side].blocks.push(block);
        flanks[side].height +=
          block.crossExtent + (flanks[side].blocks.length > 1 ? SIBLING_GAP : 0);
      }

      const rowH = Math.max(ch, flanks[0].height, flanks[1].height);
      const centerY = rowBottom - rowH / 2;
      out.items.push({
        node: cluster,
        x: -cw / 2,
        y: centerY - ch / 2,
        width: cw,
        height: ch,
        depth: 2,
        dir: "right",
        listItem: false,
      });
      // No domain -> cluster edges on the spine: the spine graphic carries
      // the structure (edges here would overlap every intermediate cluster).

      for (const flank of flanks) {
        if (flank.blocks.length === 0) continue;
        const o: GrowDir = flank.side === -1 ? "left" : "right";
        const anchorX = flank.side * (cw / 2 + TRUNK_FLANK_GAP);
        const handles = structHandles(o);
        let fy = centerY - flank.height / 2;
        for (const block of flank.blocks) {
          const local: LocalLayout = { items: [], edges: [] };
          placeBlock(block, o, 0, 0, 99, local);
          const bb = bboxOf(local.items);
          // near edge of the subtree sits at the anchor; centre its breadth on fy
          translate(local.items, anchorX, fy - bb.minY);
          out.items.push(...local.items);
          out.edges.push(...local.edges);
          out.edges.push({
            id: `tree-${block.node.id}`,
            source: cluster.id,
            target: block.node.id,
            ...handles,
            kind: "tree",
          });
          fy += bb.maxY - bb.minY + SIBLING_GAP;
        }
      }
      rowBottom -= rowH + TRUNK_ROW_GAP;
    }
    cursor = rowBottom + TRUNK_ROW_GAP - TREE_GAP;
  }

  const bb = bboxOf(out.items);
  out.minX = bb.minX;
  out.maxX = bb.maxX;
  out.h = -bb.minY;
  return out;
}

/* --------------------------- composition -------------------------------- */

export function layoutBotanical(map: Pick<MebsMap, "nodes">): BotanicalLayout {
  const { root, trees, visualChildrenOf } = classifyZones(map);
  if (!root) {
    return {
      items: [],
      visibleIds: new Set(),
      childrenOf: visualChildrenOf,
      structEdges: [],
      zoneRects: [],
      apex: null,
    };
  }

  const rootW = widthForDepth(0);
  const rootH = nodeHeight(root.label, rootW);
  const items: BotanicalItem[] = [];
  const structEdges: StructEdgeSpec[] = [];

  const finalise = (local: LocalItem[], zone: ZoneId) => {
    for (const it of local) {
      items.push({
        ...it,
        zone,
        childCount: (visualChildrenOf.get(it.node.id) ?? []).length,
        descendantCount: countDescendants(visualChildrenOf, it.node.id),
      });
    }
  };

  // ground line: map root node top-centre at (0, 0)
  items.push({
    node: root,
    x: -rootW / 2,
    y: 0,
    width: rootW,
    height: rootH,
    depth: 0,
    dir: "down",
    listItem: false,
    zone: undefined,
    childCount: (visualChildrenOf.get(root.id) ?? []).length,
    // the root chip hides the entire map, promoted subtrees included
    descendantCount: map.nodes.length - 1,
  });

  if (!root.collapsed) {
    const spine = layoutSpine(trees.trunk, visualChildrenOf);
    const rootsBand = layoutBand(trees.roots, "down", visualChildrenOf);
    const branchesBand = layoutBand(trees.branches, "up", visualChildrenOf);
    const canopyBand = layoutBand(trees.canopy, "up", visualChildrenOf);
    const behaviourBand = layoutBand(
      trees.behaviour,
      "right",
      visualChildrenOf
    );

    // trunk: bottom of the spine column just above the root node
    const trunkBase = -ZONE_PAD_Y;
    translate(spine.items, 0, trunkBase);
    const trunkTop = trunkBase - spine.h;
    finalise(spine.items, "trunk");
    structEdges.push(...spine.edges);

    // behaviour: beside the trunk, vertically centred on it — but clamped
    // so a tall behaviour band never dips below the ground line into the
    // roots region
    const hasBehaviour = behaviourBand.items.length > 0;
    let behaviourTop = trunkTop;
    if (hasBehaviour) {
      const trunkHalf = Math.max(spine.maxX, -spine.minX, MIN_TRUNK_HALF);
      const trunkMidY = trunkBase - spine.h / 2;
      behaviourTop = Math.min(
        trunkMidY - behaviourBand.h / 2,
        -ZONE_PAD_Y - behaviourBand.h
      );
      translate(
        behaviourBand.items,
        trunkHalf + BEHAVIOUR_GAP,
        behaviourTop
      );
      finalise(behaviourBand.items, "behaviour");
      structEdges.push(...behaviourBand.edges);
    }

    const midTop = Math.min(trunkTop, behaviourTop);

    // branches fan upward from a synthetic apex above the trunk
    const hasBranches = branchesBand.items.length > 0;
    const apex = hasBranches
      ? { x: 0, y: midTop - ZONE_GAP_Y / 2 }
      : null;
    let branchesTop = midTop;
    if (hasBranches) {
      const branchesBase = midTop - ZONE_GAP_Y;
      branchesTop = branchesBase - branchesBand.h;
      translate(branchesBand.items, -branchesBand.w / 2, branchesTop);
      finalise(branchesBand.items, "branches");
      structEdges.push(...branchesBand.edges);
    }

    // canopy on top
    const hasCanopy = canopyBand.items.length > 0;
    if (hasCanopy) {
      const canopyBase = (hasBranches ? branchesTop : midTop) - ZONE_GAP_Y;
      translate(canopyBand.items, -canopyBand.w / 2, canopyBase - canopyBand.h);
      finalise(canopyBand.items, "canopy");
      structEdges.push(...canopyBand.edges);
    }

    // roots below the ground line
    if (rootsBand.items.length > 0) {
      translate(rootsBand.items, -rootsBand.w / 2, rootH + ZONE_PAD_Y);
      finalise(rootsBand.items, "roots");
      structEdges.push(...rootsBand.edges);
    }

    // ---- zone-tree anchor edges -------------------------------------
    for (const tree of trees.roots) {
      structEdges.push({
        id: `tree-${tree.node.id}`,
        source: root.id,
        target: tree.node.id,
        sourceHandle: HANDLES.src.bottom,
        targetHandle: HANDLES.tgt.top,
        kind: "tree",
      });
    }
    for (const tree of trees.behaviour) {
      structEdges.push({
        id: `tree-${tree.node.id}`,
        source: root.id,
        target: tree.node.id,
        sourceHandle: HANDLES.src.right,
        targetHandle: HANDLES.tgt.left,
        kind: "tree",
      });
    }
    // the spine: one strong line from the root through the trunk column
    if (apex) {
      structEdges.push({
        id: "spine",
        source: root.id,
        target: APEX_ID,
        sourceHandle: HANDLES.src.top,
        targetHandle: "in",
        kind: "spine",
      });
    } else if (trees.trunk.length > 0) {
      structEdges.push({
        id: "spine",
        source: root.id,
        target: trees.trunk[0].node.id,
        sourceHandle: HANDLES.src.top,
        targetHandle: HANDLES.tgt.bottom,
        kind: "spine",
      });
    }
    for (const tree of trees.branches) {
      structEdges.push({
        id: `apex-${tree.node.id}`,
        source: APEX_ID,
        target: tree.node.id,
        sourceHandle: "out",
        targetHandle: HANDLES.tgt.bottom,
        kind: "apex",
      });
    }
    for (const tree of trees.canopy) {
      if (tree.promotedFrom) {
        if (!SHOW_ASPIRATION) continue;
        // bow away from the axis, on the person tree's side
        const person = items.find((i) => i.node.id === tree.promotedFrom!.id);
        const side: -1 | 1 =
          person && person.x + person.width / 2 > 0 ? 1 : -1;
        structEdges.push({
          id: `asp-${tree.node.id}`,
          source: tree.promotedFrom.id,
          target: tree.node.id,
          sourceHandle: side === 1 ? HANDLES.src.right : HANDLES.src.left,
          targetHandle: side === 1 ? HANDLES.tgt.right : HANDLES.tgt.left,
          kind: "aspiration",
          side,
        });
      } else {
        structEdges.push({
          id: `apex-${tree.node.id}`,
          source: apex ? APEX_ID : root.id,
          target: tree.node.id,
          sourceHandle: apex ? "out" : HANDLES.src.top,
          targetHandle: HANDLES.tgt.bottom,
          kind: "apex",
        });
      }
    }

    const visibleIds = new Set(items.map((i) => i.node.id));
    const zoneRects: ZoneRect[] = [];
    for (const zone of ["canopy", "branches", "trunk", "behaviour", "roots"] as ZoneId[]) {
      const zoneItems = items.filter((i) => i.zone === zone);
      if (zoneItems.length === 0) continue;
      const bb = bboxOf(zoneItems as unknown as LocalItem[]);
      zoneRects.push({
        zone,
        x: bb.minX - BACKDROP_PAD,
        y: bb.minY - BACKDROP_PAD,
        width: bb.maxX - bb.minX + BACKDROP_PAD * 2,
        height: bb.maxY - bb.minY + BACKDROP_PAD * 2,
      });
    }

    // drop edges whose endpoints aren't rendered (collapsed ancestors)
    const renderable = structEdges.filter(
      (e) =>
        (e.source === APEX_ID || visibleIds.has(e.source)) &&
        (e.target === APEX_ID || visibleIds.has(e.target))
    );

    return {
      items,
      visibleIds,
      childrenOf: visualChildrenOf,
      structEdges: renderable,
      zoneRects,
      apex,
    };
  }

  // root collapsed: just the root pill
  return {
    items,
    visibleIds: new Set([root.id]),
    childrenOf: visualChildrenOf,
    structEdges: [],
    zoneRects: [],
    apex: null,
  };
}

/* --------------------- outline mode, unified shape ---------------------- */

/** The existing outline layout, adapted to the botanical render contract so
 *  MapCanvas has a single code path. Geometry is byte-identical to v0.1. */
export function layoutOutlineUnified(map: Pick<MebsMap, "nodes">): BotanicalLayout {
  const res = layoutMap(map);
  const items: BotanicalItem[] = res.items.map((it) => ({
    ...it,
    zone: undefined,
    dir: "right" as GrowDir,
    listItem: false,
  }));
  const structEdges: StructEdgeSpec[] = [];
  for (const it of res.items) {
    const parentId = it.node.parentId;
    if (parentId && res.visibleIds.has(parentId)) {
      structEdges.push({
        id: `tree-${it.node.id}`,
        source: parentId,
        target: it.node.id,
        sourceHandle: HANDLES.src.right,
        targetHandle: HANDLES.tgt.left,
        kind: "tree",
      });
    }
  }
  return {
    items,
    visibleIds: res.visibleIds,
    childrenOf: res.childrenOf,
    structEdges,
    zoneRects: [],
    apex: null,
  };
}

/* ------------------- fit-to-view chrome compensation -------------------- *
 * The floating toolbar (top) and the inspector aside (right, when open) sit
 * on top of the canvas. xyflow 12.11's FitViewOptions.padding accepts a
 * per-side object with px-string values that reserve literal screen pixels on
 * that side (see parsePadding in @xyflow/system), so we inset the fit by the
 * chrome's real footprint instead of a symmetric proportional pad. One helper
 * builds the options for every fitView call in MapCanvas and the Toolbar.
 * ----------------------------------------------------------------------- */

/** top-4 (16px) + ~52px toolbar + breathing room */
const CHROME_TOP_PX = 76;
/** right-4 (16px) + 340px inspector + breathing room */
const CHROME_RIGHT_PX = 360;
/** comfortable base inset on the unobstructed sides */
const CHROME_BASE_PX = 32;

export interface FitChromeOpts {
  /** inspector aside is mounted (a node or edge is selected) */
  inspectorOpen: boolean;
  mode: LayoutModeArg;
  /** merged into the result (duration, nodes, maxZoom overrides, …) */
  extra?: FitViewOptions;
}

type LayoutModeArg = "botanical" | "outline";

/**
 * Build fitView options whose padding clears the floating chrome. maxZoom only
 * stops a fit from zooming IN past readable scale — it cannot stop a fit-all
 * from zooming OUT (outline's sliver problem; that default framing is handled
 * by outlineViewport below).
 */
export function fitChromeOptions({
  inspectorOpen,
  mode,
  extra,
}: FitChromeOpts): FitViewOptions {
  const padding = {
    top: `${CHROME_TOP_PX}px`,
    bottom: `${CHROME_BASE_PX}px`,
    left: `${CHROME_BASE_PX}px`,
    right: `${inspectorOpen ? CHROME_RIGHT_PX : CHROME_BASE_PX}px`,
  } as const;
  const base: FitViewOptions =
    mode === "botanical"
      ? { padding, maxZoom: 0.85 }
      : { padding, maxZoom: 0.95 };
  return { ...base, ...extra };
}

/* ----------------------- outline default framing ------------------------ *
 * The outline is one tall narrow column. A fit-all zooms out until the whole
 * column fits → an unreadable vertical sliver in a half-empty canvas (spec
 * v0.3 P2.5). Default framing instead fits the column's WIDTH (capped at
 * 0.95) and anchors its top just below the toolbar, letting the height
 * overflow for the user to pan through.
 * ------------------------------------------------------------------------ */

export function outlineViewport(
  layout: BotanicalLayout,
  paneWidth: number,
  inspectorOpen: boolean
): { x: number; y: number; zoom: number } | null {
  if (layout.items.length === 0 || paneWidth <= 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  for (const it of layout.items) {
    if (it.x < minX) minX = it.x;
    if (it.y < minY) minY = it.y;
    if (it.x + it.width > maxX) maxX = it.x + it.width;
  }
  const left = CHROME_BASE_PX;
  const right = inspectorOpen ? CHROME_RIGHT_PX : CHROME_BASE_PX;
  const availW = Math.max(1, paneWidth - left - right);
  const colW = Math.max(1, maxX - minX);
  const zoom = Math.min(0.95, availW / colW);
  return {
    x: left + (availW - colW * zoom) / 2 - minX * zoom,
    y: CHROME_TOP_PX - minY * zoom,
    zoom,
  };
}

/* ----------------------- hidden-link lifting --------------------------- *
 * Relationship edges that dive into a collapsed branch are summarised onto
 * the nearest visible ancestor of each hidden endpoint, so "All" mode never
 * silently drops links the toolbar badge still counts.
 * ----------------------------------------------------------------------- */

/**
 * Walk parentId from `id` until an ancestor is in `visibleIds`. Returns the id
 * itself when already visible, or null if the whole chain is hidden (shouldn't
 * happen once a root is rendered, but guarded for safety).
 */
export function nearestVisibleAncestor(
  id: string,
  parentOf: Map<string, string | null>,
  visibleIds: Set<string>
): string | null {
  let cur: string | null = id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (visibleIds.has(cur)) return cur;
    seen.add(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return null;
}

// re-export for canvas convenience
export { buildChildrenMap };
