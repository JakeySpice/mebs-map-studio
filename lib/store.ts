"use client";

import { create } from "zustand";
import type {
  EdgeType,
  LayoutMode,
  MebsEdge,
  MebsMap,
  MebsNode,
  NodeType,
} from "@/types/graph";
import {
  describeStorageError,
  loadMap,
  newId,
  saveMap,
} from "@/lib/storage";
import { suggestEdgeType } from "@/lib/edgeSuggest";

/** How much of the semantic relationship layer is drawn. */
export type LinkVisibility = "off" | "selected" | "all";

/**
 * One undo/redo entry. The map is copy-on-write everywhere in this store, so
 * holding a reference is cheap — no deep clone needed. Selection rides along so
 * undo restores exactly what was highlighted before the mutation.
 */
interface HistoryEntry {
  map: MebsMap;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
}

const HISTORY_LIMIT = 30;
/** Per-keystroke edits from the same field collapse if within this window. */
const COALESCE_MS = 1000;

interface MapState {
  map: MebsMap | null;
  mapMissing: boolean;
  storageError: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  /** node whose label is being edited inline on the canvas */
  editingNodeId: string | null;
  linkVisibility: LinkVisibility;
  /** whether the relationships review panel is open (ephemeral, not persisted) */
  relationshipsPanelOpen: boolean;
  /** asks the canvas to pan/zoom so these nodes are visible */
  focusRequest: { ids: string[]; nonce: number } | null;

  openMap: (id: string) => void;
  closeMap: () => void;
  clearStorageError: () => void;

  selectNode: (id: string | null, opts?: { reveal?: boolean }) => void;
  selectEdge: (id: string | null, opts?: { reveal?: boolean }) => void;
  clearSelection: () => void;
  setEditingNode: (id: string | null) => void;
  setLinkVisibility: (v: LinkVisibility) => void;
  setRelationshipsPanelOpen: (open: boolean) => void;
  setLayoutMode: (mode: LayoutMode) => void;

  updateMapTitle: (title: string) => void;

  addChild: (parentId: string, partial?: Partial<MebsNode>) => string | null;
  /** insert a new node directly after `id` among its siblings (root: no-op) */
  addSiblingAfter: (id: string, partial?: Partial<MebsNode>) => string | null;
  /** append several children under one parent as a single undo step */
  addChildren: (parentId: string, partials: Array<Partial<MebsNode>>) => void;
  updateNode: (id: string, patch: Partial<MebsNode>) => void;
  deleteNode: (id: string) => void;
  /** swap `id` with its previous (-1) or next (+1) sibling */
  moveNode: (id: string, delta: -1 | 1) => void;
  /** move `id` (and its subtree) under a new parent, appended last */
  reparentNode: (id: string, newParentId: string) => void;
  /** clone `id`'s subtree (incl. internal relationships) right after it */
  duplicateSubtree: (id: string) => string | null;
  toggleCollapsed: (id: string) => void;
  setAllCollapsed: (collapsed: boolean) => void;

  addCrossLink: (source: string, target: string, type?: EdgeType) => string | null;
  updateEdge: (id: string, patch: Partial<MebsEdge>) => void;
  deleteEdge: (id: string) => void;

  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
}

type CommitResult =
  | { map: MebsMap; storageError: null }
  | { storageError: string };

function commit(map: MebsMap): CommitResult {
  const next = { ...map, updatedAt: new Date().toISOString() };
  try {
    saveMap(next);
    return { map: next, storageError: null };
  } catch (err) {
    return { storageError: describeStorageError(err) };
  }
}

/**
 * In-memory undo/redo, intentionally outside the reactive store: history is
 * never persisted and pushing a snapshot shouldn't trigger React re-renders.
 * `undoStack` holds states to return *to*; `redoStack` holds states undone
 * away from. Each mutating action snapshots the current state before changing
 * it (see `pushHistory`), which also clears the redo stack.
 */
const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];
/** Identifies the last coalesced edit so rapid same-field edits collapse. */
let lastPush: { key: string; at: number } | null = null;

/**
 * Snapshot the current state before a mutation. `coalesceKey` (e.g.
 * "updateNode:<id>") lets consecutive keystroke-level edits to the same target
 * within COALESCE_MS share a single undo step: the first push captures the
 * pre-edit state, later ones are skipped. Pass no key for atomic actions
 * (delete, collapse, …) that should always be their own step.
 */
function pushHistory(state: MapState, coalesceKey?: string) {
  if (!state.map) return;
  const now = Date.now();
  if (
    coalesceKey &&
    lastPush &&
    lastPush.key === coalesceKey &&
    now - lastPush.at < COALESCE_MS &&
    undoStack.length > 0
  ) {
    lastPush.at = now;
    return;
  }
  undoStack.push({
    map: state.map,
    selectedNodeId: state.selectedNodeId,
    selectedEdgeId: state.selectedEdgeId,
  });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  lastPush = coalesceKey ? { key: coalesceKey, at: now } : null;
}

function resetHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  lastPush = null;
}

/** ids of `id` plus all its descendants */
export function subtreeIds(nodes: MebsNode[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const list = childrenOf.get(n.parentId) ?? [];
      list.push(n.id);
      childrenOf.set(n.parentId, list);
    }
  }
  const ids = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (ids.has(cur)) continue;
    ids.add(cur);
    for (const child of childrenOf.get(cur) ?? []) stack.push(child);
  }
  return ids;
}

export const useMapStore = create<MapState>((set, get) => ({
  map: null,
  mapMissing: false,
  storageError: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,
  linkVisibility: "selected",
  relationshipsPanelOpen: false,
  focusRequest: null,

  openMap: (id) => {
    resetHistory();
    const map = loadMap(id);
    set({
      map,
      mapMissing: !map,
      storageError: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      editingNodeId: null,
      linkVisibility: "selected",
      relationshipsPanelOpen: false,
    });
  },

  closeMap: () => {
    resetHistory();
    set({
      map: null,
      mapMissing: false,
      storageError: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      editingNodeId: null,
      linkVisibility: "selected",
      relationshipsPanelOpen: false,
    });
  },

  clearStorageError: () => set({ storageError: null }),

  selectNode: (id, opts) => {
    if (!id || !opts?.reveal) {
      set({ selectedNodeId: id, selectedEdgeId: null });
      return;
    }
    // Reveal: expand any collapsed ancestors so the node is on-screen, then
    // ask the canvas to centre it. Ancestor-expansion is treated as a
    // navigation side-effect, not a user edit, so it is NOT pushed onto the
    // undo stack — undo should reverse content changes, not re-hide a branch
    // the user just navigated into. It is still committed so the expanded
    // state survives a reload.
    const { map } = get();
    if (!map) {
      set({ selectedNodeId: id, selectedEdgeId: null });
      return;
    }
    const byId = new Map(map.nodes.map((n) => [n.id, n]));
    const toExpand = new Set<string>();
    let cur = byId.get(id)?.parentId
      ? byId.get(byId.get(id)!.parentId!)
      : undefined;
    let guard = 0;
    while (cur && guard++ <= map.nodes.length) {
      if (cur.collapsed) toExpand.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    const focusRequest = { ids: [id], nonce: Date.now() };
    if (toExpand.size === 0) {
      set({ selectedNodeId: id, selectedEdgeId: null, focusRequest });
      return;
    }
    const committed = commit({
      ...map,
      nodes: map.nodes.map((n) =>
        toExpand.has(n.id) ? { ...n, collapsed: false } : n
      ),
    });
    if (!("map" in committed)) {
      // Even if persistence fails, still select + focus so navigation works.
      set({ ...committed, selectedNodeId: id, selectedEdgeId: null, focusRequest });
      return;
    }
    set({ ...committed, selectedNodeId: id, selectedEdgeId: null, focusRequest });
  },

  selectEdge: (id, opts) => {
    // selecting an edge implies wanting to see it: lift visibility off "off"
    const liftVisibility = (v: LinkVisibility): LinkVisibility =>
      v === "off" ? "selected" : v;
    if (!id || !opts?.reveal) {
      set((s) => ({
        selectedEdgeId: id,
        selectedNodeId: null,
        linkVisibility: liftVisibility(s.linkVisibility),
      }));
      return;
    }
    // Reveal: mirror selectNode — expand any collapsed ancestors of BOTH
    // endpoints so the edge is on-screen, then frame the pair. Ancestor
    // expansion is navigation, not a content edit, so it is NOT pushed onto the
    // undo stack; it is still committed so the expanded state survives reload.
    const { map, linkVisibility } = get();
    const edge = map?.edges.find((e) => e.id === id);
    if (!map || !edge) {
      set((s) => ({
        selectedEdgeId: id,
        selectedNodeId: null,
        linkVisibility: liftVisibility(s.linkVisibility),
      }));
      return;
    }
    const byId = new Map(map.nodes.map((n) => [n.id, n]));
    const toExpand = new Set<string>();
    for (const endpoint of [edge.source, edge.target]) {
      let cur = byId.get(endpoint)?.parentId
        ? byId.get(byId.get(endpoint)!.parentId!)
        : undefined;
      let guard = 0;
      while (cur && guard++ <= map.nodes.length) {
        if (cur.collapsed) toExpand.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
    }
    const focusRequest = { ids: [edge.source, edge.target], nonce: Date.now() };
    const next = {
      selectedEdgeId: id,
      selectedNodeId: null,
      linkVisibility: liftVisibility(linkVisibility),
      focusRequest,
    };
    if (toExpand.size === 0) {
      set(next);
      return;
    }
    const committed = commit({
      ...map,
      nodes: map.nodes.map((n) =>
        toExpand.has(n.id) ? { ...n, collapsed: false } : n
      ),
    });
    // Even if persistence fails, still select + focus so navigation works.
    set({ ...committed, ...next });
  },

  clearSelection: () =>
    set({ selectedNodeId: null, selectedEdgeId: null, editingNodeId: null }),

  setEditingNode: (id) => set({ editingNodeId: id }),

  setLinkVisibility: (v) =>
    set((s) => ({
      linkVisibility: v,
      // an edge selection makes no sense once the edges are hidden
      selectedEdgeId: v === "off" ? null : s.selectedEdgeId,
    })),

  setRelationshipsPanelOpen: (open) => set({ relationshipsPanelOpen: open }),

  setLayoutMode: (mode) => {
    const state = get();
    const { map } = state;
    if (!map || (map.layoutMode ?? "botanical") === mode) return;
    pushHistory(state);
    set(commit({ ...map, layoutMode: mode }));
  },

  updateMapTitle: (title) => {
    const state = get();
    const { map } = state;
    if (!map) return;
    // Title is edited keystroke-by-keystroke in the toolbar → coalesce.
    pushHistory(state, "updateMapTitle");
    set(commit({ ...map, title: title.trim() || map.title }));
  },

  addChild: (parentId, partial) => {
    const state = get();
    const { map } = state;
    if (!map) return null;
    const parent = map.nodes.find((n) => n.id === parentId);
    if (!parent) return null;
    pushHistory(state);
    const siblings = map.nodes.filter((n) => n.parentId === parentId);
    const nextOrder =
      siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;
    const node: MebsNode = {
      id: newId(),
      type: (partial?.type ?? parent.childTypeHint ?? "domain") as NodeType,
      // empty = "not named yet": committing an empty rename deletes the node,
      // so abandoned adds don't litter the map (see MebsNode RenameInput)
      label: partial?.label ?? "",
      summary: partial?.summary,
      details: partial?.details,
      parentId,
      order: nextOrder,
      collapsed: false,
      childTypeHint: partial?.childTypeHint,
      templateId: partial?.templateId,
    };
    const nodes = map.nodes.map((n) =>
      // reveal the new child immediately
      n.id === parentId ? { ...n, collapsed: false } : n
    );
    const committed = commit({ ...map, nodes: [...nodes, node] });
    if (!("map" in committed)) {
      set(committed);
      return null;
    }
    set({
      ...committed,
      focusRequest: { ids: [parentId, node.id], nonce: Date.now() },
    });
    return node.id;
  },

  addSiblingAfter: (id, partial) => {
    const state = get();
    const { map } = state;
    if (!map) return null;
    const node = map.nodes.find((n) => n.id === id);
    // the root has no siblings
    if (!node || !node.parentId) return null;
    pushHistory(state);
    const sibling: MebsNode = {
      id: newId(),
      // chaining usually continues a run of like items, so inherit the type
      type: (partial?.type ?? node.type) as NodeType,
      label: partial?.label ?? "",
      summary: partial?.summary,
      details: partial?.details,
      parentId: node.parentId,
      order: node.order + 1,
      collapsed: false,
      childTypeHint: partial?.childTypeHint ?? node.childTypeHint,
      templateId: partial?.templateId,
    };
    const nodes = map.nodes.map((n) =>
      n.parentId === node.parentId && n.order > node.order
        ? { ...n, order: n.order + 1 }
        : n
    );
    const committed = commit({ ...map, nodes: [...nodes, sibling] });
    if (!("map" in committed)) {
      set(committed);
      return null;
    }
    set({
      ...committed,
      focusRequest: { ids: [id, sibling.id], nonce: Date.now() },
    });
    return sibling.id;
  },

  addChildren: (parentId, partials) => {
    const state = get();
    const { map } = state;
    if (!map || partials.length === 0) return;
    const parent = map.nodes.find((n) => n.id === parentId);
    if (!parent) return;
    pushHistory(state);
    const siblings = map.nodes.filter((n) => n.parentId === parentId);
    let nextOrder =
      siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;
    const added: MebsNode[] = partials.map((p) => ({
      id: newId(),
      type: (p.type ?? parent.childTypeHint ?? "domain") as NodeType,
      label: p.label ?? "",
      summary: p.summary,
      details: p.details,
      parentId,
      order: nextOrder++,
      collapsed: false,
      childTypeHint: p.childTypeHint,
      templateId: p.templateId,
    }));
    const nodes = map.nodes.map((n) =>
      n.id === parentId ? { ...n, collapsed: false } : n
    );
    const committed = commit({ ...map, nodes: [...nodes, ...added] });
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      focusRequest: {
        ids: [parentId, ...added.map((a) => a.id)],
        nonce: Date.now(),
      },
    });
  },

  updateNode: (id, patch) => {
    const state = get();
    const { map } = state;
    if (!map) return;
    // Inspector fields fire onChange per keystroke → coalesce per node so
    // typing a sentence is a single undo step.
    pushHistory(state, `updateNode:${id}`);
    set(
      commit({
        ...map,
        nodes: map.nodes.map((n) => (n.id === id ? { ...n, ...patch, id } : n)),
      })
    );
  },

  deleteNode: (id) => {
    const state = get();
    const { map, selectedNodeId, selectedEdgeId } = state;
    if (!map) return;
    const node = map.nodes.find((n) => n.id === id);
    if (!node || node.type === "root") return;
    pushHistory(state);
    const doomed = subtreeIds(map.nodes, id);
    const survivingEdges = map.edges.filter(
      (e) => !doomed.has(e.source) && !doomed.has(e.target)
    );
    const committed = commit({
      ...map,
      nodes: map.nodes.filter((n) => !doomed.has(n.id)),
      edges: survivingEdges,
    });
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      selectedNodeId:
        selectedNodeId && doomed.has(selectedNodeId) ? null : selectedNodeId,
      selectedEdgeId:
        selectedEdgeId && !survivingEdges.some((e) => e.id === selectedEdgeId)
          ? null
          : selectedEdgeId,
    });
  },

  moveNode: (id, delta) => {
    const state = get();
    const { map } = state;
    if (!map) return;
    const node = map.nodes.find((n) => n.id === id);
    if (!node || !node.parentId) return;
    const siblings = map.nodes
      .filter((n) => n.parentId === node.parentId)
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((s) => s.id === id);
    const swapWith = siblings[idx + delta];
    if (!swapWith) return;
    pushHistory(state);
    // renumber the whole sibling run (also normalises any legacy order ties)
    const reordered = [...siblings];
    reordered[idx] = swapWith;
    reordered[idx + delta] = node;
    const orderOf = new Map(reordered.map((s, i) => [s.id, i]));
    set(
      commit({
        ...map,
        nodes: map.nodes.map((n) =>
          orderOf.has(n.id) ? { ...n, order: orderOf.get(n.id)! } : n
        ),
      })
    );
  },

  reparentNode: (id, newParentId) => {
    const state = get();
    const { map } = state;
    if (!map || id === newParentId) return;
    const node = map.nodes.find((n) => n.id === id);
    const target = map.nodes.find((n) => n.id === newParentId);
    if (!node || !target || node.type === "root") return;
    if (node.parentId === newParentId) return;
    // a node cannot move into its own subtree
    if (subtreeIds(map.nodes, id).has(newParentId)) return;
    pushHistory(state);
    const siblings = map.nodes.filter((n) => n.parentId === newParentId);
    const order =
      siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;
    const committed = commit({
      ...map,
      nodes: map.nodes.map((n) =>
        n.id === id
          ? { ...n, parentId: newParentId, order }
          : n.id === newParentId
            ? { ...n, collapsed: false }
            : n
      ),
    });
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      focusRequest: { ids: [newParentId, id], nonce: Date.now() },
    });
  },

  duplicateSubtree: (id) => {
    const state = get();
    const { map } = state;
    if (!map) return null;
    const node = map.nodes.find((n) => n.id === id);
    if (!node || node.type === "root" || !node.parentId) return null;
    pushHistory(state);
    const ids = subtreeIds(map.nodes, id);
    const idMap = new Map<string, string>();
    for (const oldId of ids) idMap.set(oldId, newId());
    const clones = map.nodes
      .filter((n) => ids.has(n.id))
      .map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        parentId: n.id === id ? node.parentId : idMap.get(n.parentId!)!,
        order: n.id === id ? node.order + 1 : n.order,
        label:
          n.id === id && n.label.trim() ? `${n.label} (copy)` : n.label,
      }));
    // relationships fully inside the subtree travel with the copy
    const clonedEdges = map.edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({
        ...e,
        id: newId(),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));
    const shifted = map.nodes.map((n) =>
      n.parentId === node.parentId && n.order > node.order
        ? { ...n, order: n.order + 1 }
        : n
    );
    const cloneTopId = idMap.get(id)!;
    const committed = commit({
      ...map,
      nodes: [...shifted, ...clones],
      edges: [...map.edges, ...clonedEdges],
    });
    if (!("map" in committed)) {
      set(committed);
      return null;
    }
    set({
      ...committed,
      selectedNodeId: cloneTopId,
      selectedEdgeId: null,
      focusRequest: { ids: [id, cloneTopId], nonce: Date.now() },
    });
    return cloneTopId;
  },

  toggleCollapsed: (id) => {
    const state = get();
    const { map } = state;
    if (!map) return;
    const node = map.nodes.find((n) => n.id === id);
    if (!node) return;
    pushHistory(state);
    const expanding = node.collapsed;
    const committed = commit({
      ...map,
      nodes: map.nodes.map((n) =>
        n.id === id ? { ...n, collapsed: !n.collapsed } : n
      ),
    });
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      focusRequest: expanding
        ? {
            ids: [
              id,
              ...map.nodes.filter((n) => n.parentId === id).map((n) => n.id),
            ],
            nonce: Date.now(),
          }
        : null,
    });
  },

  setAllCollapsed: (collapsed) => {
    const state = get();
    const { map } = state;
    if (!map) return;
    pushHistory(state);
    set(
      commit({
        ...map,
        nodes: map.nodes.map((n) => {
          if (n.type === "root") return { ...n, collapsed: false };
          const hasChildren = map.nodes.some((c) => c.parentId === n.id);
          return hasChildren ? { ...n, collapsed } : n;
        }),
      })
    );
  },

  addCrossLink: (source, target, type) => {
    const state = get();
    const { map } = state;
    if (!map || source === target) return null;
    const sourceNode = map.nodes.find((n) => n.id === source);
    const targetNode = map.nodes.find((n) => n.id === target);
    if (!sourceNode || !targetNode) return null;
    // no explicit type (drag-to-connect) → clinically sensible default for
    // this endpoint pair, editable in the edge inspector afterwards
    const effectiveType =
      type ?? suggestEdgeType(sourceNode.type, targetNode.type);
    const exists = map.edges.some(
      (e) =>
        e.source === source && e.target === target && e.type === effectiveType
    );
    if (exists) return null;
    pushHistory(state);
    const edge: MebsEdge = { id: newId(), source, target, type: effectiveType };
    const committed = commit({ ...map, edges: [...map.edges, edge] });
    if (!("map" in committed)) {
      set(committed);
      return null;
    }
    set({
      ...committed,
      linkVisibility: "all",
      selectedEdgeId: edge.id,
      selectedNodeId: null,
    });
    return edge.id;
  },

  updateEdge: (id, patch) => {
    const state = get();
    const { map } = state;
    if (!map) return;
    // Custom-label / notes fields fire per keystroke → coalesce per edge.
    pushHistory(state, `updateEdge:${id}`);
    set(
      commit({
        ...map,
        edges: map.edges.map((e) => (e.id === id ? { ...e, ...patch, id } : e)),
      })
    );
  },

  deleteEdge: (id) => {
    const state = get();
    const { map, selectedEdgeId } = state;
    if (!map) return;
    pushHistory(state);
    const committed = commit({
      ...map,
      edges: map.edges.filter((e) => e.id !== id),
    });
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      selectedEdgeId: selectedEdgeId === id ? null : selectedEdgeId,
    });
  },

  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,

  undo: () => {
    const state = get();
    const prev = undoStack.pop();
    if (!prev || !state.map) return;
    // Park the present on the redo stack before restoring the past.
    redoStack.push({
      map: state.map,
      selectedNodeId: state.selectedNodeId,
      selectedEdgeId: state.selectedEdgeId,
    });
    lastPush = null;
    const committed = commit(prev.map);
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      selectedNodeId: prev.selectedNodeId,
      selectedEdgeId: prev.selectedEdgeId,
    });
  },

  redo: () => {
    const state = get();
    const next = redoStack.pop();
    if (!next || !state.map) return;
    undoStack.push({
      map: state.map,
      selectedNodeId: state.selectedNodeId,
      selectedEdgeId: state.selectedEdgeId,
    });
    lastPush = null;
    const committed = commit(next.map);
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      selectedNodeId: next.selectedNodeId,
      selectedEdgeId: next.selectedEdgeId,
    });
  },
}));
