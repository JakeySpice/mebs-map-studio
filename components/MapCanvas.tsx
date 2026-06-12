"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  useStoreApi,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  EDGE_TONE_COLORS,
  EDGE_TONES,
  edgeBadgeLabel,
  edgeDisplayLabel,
  layoutModeOf,
} from "@/types/graph";
import {
  APEX_ID,
  fitChromeOptions,
  layoutBotanical,
  layoutOutlineUnified,
  nearestVisibleAncestor,
  outlineViewport,
  type BotanicalLayout,
} from "@/lib/layoutBotanical";
import { useMapStore } from "@/lib/store";
import { MebsNode, type MebsFlowNode } from "@/components/MebsNode";
import { ApexNode } from "@/components/ApexNode";
import { SemanticEdge } from "@/components/SemanticEdge";
import { ZoneBackdrops } from "@/components/ZoneBackdrops";

const nodeTypes = { mebs: MebsNode, mebsApex: ApexNode };
const edgeTypes = { mebsSemantic: SemanticEdge };

const TREE_EDGE_STYLE: React.CSSProperties = {
  stroke: "rgba(255,255,255,0.18)",
  strokeWidth: 1.6,
};

const SPINE_EDGE_STYLE: React.CSSProperties = {
  stroke: "rgba(255,255,255,0.07)",
  strokeWidth: 5,
};

const CROSS_STROKE = "#dfb163";

/** Desaturated tone for links summarised onto a collapsed branch's ancestor —
 *  reads as "rolled up" against the live amber/mint/blue relationship palette. */
const SUMMARISED_TONE = "#8c8678";

/** Same-side C-curves park in lanes so stacked links don't overlap. */
const MAX_LANES = 6;

function isStructuralEdgeId(id: string) {
  return (
    id.startsWith("tree-") ||
    id.startsWith("rail-") ||
    id.startsWith("apex-") ||
    id.startsWith("asp-") ||
    id === "spine"
  );
}

export function MapCanvas() {
  const map = useMapStore((s) => s.map);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const selectedEdgeId = useMapStore((s) => s.selectedEdgeId);
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const linkVisibility = useMapStore((s) => s.linkVisibility);
  const selectNode = useMapStore((s) => s.selectNode);
  const selectEdge = useMapStore((s) => s.selectEdge);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const addCrossLink = useMapStore((s) => s.addCrossLink);
  const focusRequest = useMapStore((s) => s.focusRequest);
  const { fitView, getZoom, setViewport } = useReactFlow();
  const rfStore = useStoreApi();

  const layoutMode = map ? layoutModeOf(map) : "botanical";
  const mapNodes = map?.nodes ?? null;
  // the inspector aside is mounted whenever something is selected; fitView must
  // clear the ~360px it occupies on the right so content isn't parked under it
  const inspectorOpen = selectedNodeId !== null || selectedEdgeId !== null;
  // read inside fit effects without making them re-fire on mere selection /
  // mode changes (each effect has its own intended trigger). Kept current in an
  // effect — writing refs during render is disallowed by react-hooks rules.
  const inspectorOpenRef = React.useRef(inspectorOpen);
  const layoutModeRef = React.useRef(layoutMode);
  // (the keeping-current effect lives below the layout memo, so it can track
  // the layout ref too)

  // pan (without zooming in) so freshly revealed nodes are on screen
  React.useEffect(() => {
    if (!focusRequest) return;
    const timer = setTimeout(() => {
      fitView(
        fitChromeOptions({
          inspectorOpen: inspectorOpenRef.current,
          mode: layoutModeRef.current,
          paneWidth: rfStore.getState().width,
          paneHeight: rfStore.getState().height,
          // pan only (keep current zoom) so a freshly revealed node just
          // scrolls into the unobstructed area rather than zooming
          extra: {
            nodes: focusRequest.ids.map((id) => ({ id })),
            duration: 380,
            maxZoom: getZoom(),
          },
        })
      );
    }, 40);
    return () => clearTimeout(timer);
  }, [focusRequest, fitView, getZoom, rfStore]);

  // keyed on the nodes array + mode: edge-only commits reuse the nodes
  // reference (see store commit), so edge edits skip the relayout entirely
  const layout = React.useMemo<BotanicalLayout | null>(() => {
    if (!mapNodes) return null;
    return layoutMode === "botanical"
      ? layoutBotanical({ nodes: mapNodes })
      : layoutOutlineUnified({ nodes: mapNodes });
  }, [mapNodes, layoutMode]);

  const layoutRef = React.useRef<BotanicalLayout | null>(null);
  React.useEffect(() => {
    inspectorOpenRef.current = inspectorOpen;
    layoutModeRef.current = layoutMode;
    layoutRef.current = layout;
  }, [inspectorOpen, layoutMode, layout]);

  // refit when the layout mode flips — the geometry changes completely.
  // Outline never fit-alls (a tall column collapses to a sliver): it frames
  // via outlineViewport instead, both on first render and on switching to it.
  // The first botanical run re-issues the fitView-prop fit: by effect time the
  // pane is measured, so fitChromeOptions can clamp its paddings on narrow
  // panes (the prop's options can't — they're built before the first measure).
  const firstModeRun = React.useRef(true);
  React.useEffect(() => {
    const first = firstModeRun.current;
    firstModeRun.current = false;
    const frame = requestAnimationFrame(() => {
      const duration = first ? 0 : 400;
      if (layoutMode === "outline") {
        const vp = layoutRef.current
          ? outlineViewport(
              layoutRef.current,
              rfStore.getState().width,
              inspectorOpenRef.current
            )
          : null;
        if (vp) {
          setViewport(vp, { duration });
          return;
        }
      }
      fitView(
        fitChromeOptions({
          inspectorOpen: inspectorOpenRef.current,
          mode: layoutMode,
          paneWidth: rfStore.getState().width,
          paneHeight: rfStore.getState().height,
          extra: { duration },
        })
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [layoutMode, fitView, setViewport, rfStore]);

  // focus: when the selected node participates in relationships, spotlight
  // its clinical neighbourhood and let everything else recede
  const focus = React.useMemo(() => {
    if (!map || !selectedNodeId) return null;
    const incident = map.edges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    );
    if (incident.length === 0) return null;
    const related = new Set<string>([selectedNodeId]);
    for (const e of incident) {
      related.add(e.source);
      related.add(e.target);
    }
    const sel = map.nodes.find((n) => n.id === selectedNodeId);
    if (sel?.parentId) related.add(sel.parentId);
    for (const n of map.nodes) {
      if (n.parentId === selectedNodeId) related.add(n.id);
    }
    return { related, incidentIds: new Set(incident.map((e) => e.id)) };
  }, [map, selectedNodeId]);

  const nodes = React.useMemo<Node[]>(() => {
    if (!layout) return [];
    const result: Node[] = layout.items.map(
      (item): MebsFlowNode => ({
        id: item.node.id,
        type: "mebs" as const,
        position: { x: item.x, y: item.y },
        draggable: false,
        connectable: linkVisibility === "all",
        selected: item.node.id === selectedNodeId,
        data: {
          mebs: item.node,
          width: item.width,
          height: item.height,
          depth: item.depth,
          childCount: item.childCount,
          descendantCount: item.descendantCount,
          isEditing: item.node.id === editingNodeId,
          relationshipMode: linkVisibility === "all",
          dir: item.dir,
          dimmed: focus ? !focus.related.has(item.node.id) : false,
        },
      })
    );
    if (layout.apex) {
      result.push({
        id: APEX_ID,
        type: "mebsApex",
        position: layout.apex,
        draggable: false,
        selectable: false,
        focusable: false,
        connectable: false,
        style: { pointerEvents: "none" },
        data: {},
      });
    }
    return result;
  }, [layout, selectedNodeId, editingNodeId, linkVisibility, focus]);

  // semantic relationship edges, gated by the tri-state. Edges whose endpoints
  // sit inside collapsed branches are *lifted* to the nearest visible ancestor
  // (drawn muted = "summarised") rather than silently dropped; ones that can't
  // be drawn meaningfully (both ends roll up to the same visible node, or a
  // lifted pair already on screen) are counted for the on-canvas notice so the
  // toolbar badge total never contradicts what's visible.
  const semanticPlan = React.useMemo<{ edges: Edge[]; hiddenCount: number }>(() => {
    if (!layout || !map) return { edges: [], hiddenCount: 0 };
    const rectOf = new Map(
      layout.items.map((i) => [
        i.node.id,
        { x: i.x, y: i.y, w: i.width, h: i.height },
      ])
    );
    const parentOf = new Map(map.nodes.map((n) => [n.id, n.parentId]));
    const liftId = (id: string) =>
      nearestVisibleAncestor(id, parentOf, layout.visibleIds);

    const semVisible =
      linkVisibility === "all"
        ? map.edges
        : linkVisibility === "selected"
          ? map.edges.filter(
              (e) =>
                e.source === selectedNodeId ||
                e.target === selectedNodeId ||
                e.id === selectedEdgeId
            )
          : map.edges.filter((e) => e.id === selectedEdgeId);

    // resolve each visible edge to drawable endpoints; tally the rest
    interface Resolved {
      edge: (typeof semVisible)[number];
      source: string;
      target: string;
      summarised: boolean;
    }
    const resolved: Resolved[] = [];
    const liftedPairSeen = new Set<string>();
    let hiddenCount = 0;
    for (const edge of semVisible) {
      const s = liftId(edge.source);
      const t = liftId(edge.target);
      if (!s || !t || s === t) {
        // whole chain hidden, or both ends collapse to the same visible node
        hiddenCount++;
        continue;
      }
      const summarised = s !== edge.source || t !== edge.target;
      if (summarised) {
        // a real (un-lifted) edge always draws; a lifted edge that duplicates an
        // already-summarised connection between the same visible pair would just
        // stack invisibly — fold it into the notice instead
        const key = s < t ? `${s}|${t}` : `${t}|${s}`;
        if (liftedPairSeen.has(key)) {
          hiddenCount++;
          continue;
        }
        liftedPairSeen.add(key);
      }
      resolved.push({ edge, source: s, target: t, summarised });
    }

    const result: Edge[] = [];

    if (layoutMode === "outline") {
      // v0.1 rendering, unchanged: amber dashed default bezier with a label.
      // Lifted edges read as summarised via a muted stroke; click still selects
      // the real edge (id is preserved).
      for (const r of resolved) {
        const { edge } = r;
        const isSelected = edge.id === selectedEdgeId;
        const stroke = r.summarised ? SUMMARISED_TONE : CROSS_STROKE;
        result.push({
          id: edge.id,
          source: r.source,
          target: r.target,
          sourceHandle: "link-out",
          targetHandle: "link-in",
          type: "default",
          label: edgeDisplayLabel(edge),
          selected: isSelected,
          zIndex: isSelected ? 1200 : 1000,
          style: {
            stroke,
            strokeWidth: isSelected ? 2.4 : 1.6,
            strokeDasharray: "7 5",
            opacity: isSelected ? 1 : r.summarised ? 0.55 : 0.8,
          },
          labelStyle: { fill: "#f3ddae", fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: "#262019", fillOpacity: 0.95 },
          labelBgPadding: [7, 4] as [number, number],
          labelBgBorderRadius: 7,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: stroke,
            width: 16,
            height: 16,
          },
        });
      }
      return { edges: result, hiddenCount };
    }

    // botanical: side-ported curves with lanes, parallel offsets and badges
    interface SemSpec {
      edge: (typeof semVisible)[number];
      source: string;
      target: string;
      summarised: boolean;
      sSide: -1 | 1;
      tSide: -1 | 1;
      sourceHandle: string;
      targetHandle: string;
      par: number;
      lane: number;
      y0: number;
      y1: number;
    }
    const pairSeen = new Map<string, number>();
    const specs: SemSpec[] = [];
    for (const r of resolved) {
      const s = rectOf.get(r.source);
      const t = rectOf.get(r.target);
      if (!s || !t) continue;
      const scx = s.x + s.w / 2;
      const tcx = t.x + t.w / 2;
      const dx = tcx - scx;
      let sSide: -1 | 1, tSide: -1 | 1, sourceHandle: string, targetHandle: string;
      if (dx > 80) {
        sSide = 1;
        tSide = -1;
        sourceHandle = "tree-out";
        targetHandle = "tree-in";
      } else if (dx < -80) {
        sSide = -1;
        tSide = 1;
        sourceHandle = "out-l";
        targetHandle = "in-r";
      } else {
        // near-vertical: bow out to the side, away from the central axis
        const side: -1 | 1 = (scx + tcx) / 2 >= 0 ? 1 : -1;
        sSide = tSide = side;
        sourceHandle = side === 1 ? "tree-out" : "out-l";
        targetHandle = side === 1 ? "in-r" : "tree-in";
      }
      const pairKey =
        r.source < r.target
          ? `${r.source}|${r.target}`
          : `${r.target}|${r.source}`;
      const i = pairSeen.get(pairKey) ?? 0;
      pairSeen.set(pairKey, i + 1);
      const par = i === 0 ? 0 : i % 2 ? Math.ceil(i / 2) : -Math.ceil(i / 2);
      const sy = s.y + s.h / 2;
      const ty = t.y + t.h / 2;
      specs.push({
        edge: r.edge,
        source: r.source,
        target: r.target,
        summarised: r.summarised,
        sSide,
        tSide,
        sourceHandle,
        targetHandle,
        par,
        lane: 0,
        y0: Math.min(sy, ty),
        y1: Math.max(sy, ty),
      });
    }

    // lane assignment: same-side C-curves with overlapping vertical spans
    // step outwards one lane at a time (greedy interval colouring)
    for (const side of [-1, 1] as const) {
      const cs = specs
        .filter((sp) => sp.sSide === sp.tSide && sp.sSide === side)
        .sort((a, b) => a.y0 - b.y0);
      const laneEnds: number[] = [];
      for (const sp of cs) {
        let lane = laneEnds.findIndex((end) => sp.y0 > end);
        if (lane === -1) lane = Math.min(laneEnds.length, MAX_LANES - 1);
        laneEnds[lane] = Math.max(laneEnds[lane] ?? -Infinity, sp.y1);
        sp.lane = lane;
      }
    }

    for (const sp of specs) {
      const { edge } = sp;
      const isSelected = edge.id === selectedEdgeId;
      const incident = focus?.incidentIds.has(edge.id) ?? false;
      const tone = sp.summarised
        ? SUMMARISED_TONE
        : EDGE_TONE_COLORS[EDGE_TONES[edge.type]];
      const badge = sp.summarised
        ? `${edgeBadgeLabel(edge)} ↗`
        : edgeBadgeLabel(edge);
      result.push({
        id: edge.id,
        source: sp.source,
        target: sp.target,
        sourceHandle: sp.sourceHandle,
        targetHandle: sp.targetHandle,
        type: "mebsSemantic",
        selected: isSelected,
        zIndex: isSelected || incident ? 1200 : 1000,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: tone,
          width: 14,
          height: 14,
        },
        data: {
          sSide: sp.sSide,
          tSide: sp.tSide,
          lane: sp.lane,
          par: sp.par,
          tone,
          badge,
          dimmed: focus ? !incident : false,
          emphasized: isSelected || incident,
          showBadge: true,
        },
      });
    }

    return { edges: result, hiddenCount };
  }, [layout, map, layoutMode, linkVisibility, selectedNodeId, selectedEdgeId, focus]);

  const edges = React.useMemo<Edge[]>(() => {
    if (!layout || !map) return [];
    const result: Edge[] = [];
    const isDim = (id: string) =>
      focus ? id !== APEX_ID && !focus.related.has(id) : false;

    // ---- structural edges (spine first so it stays underneath) ----------
    const ordered = [...layout.structEdges].sort(
      (a, b) => (a.kind === "spine" ? -1 : 0) - (b.kind === "spine" ? -1 : 0)
    );
    for (const spec of ordered) {
      if (spec.kind === "aspiration") {
        result.push({
          id: spec.id,
          source: spec.source,
          target: spec.target,
          sourceHandle: spec.sourceHandle,
          targetHandle: spec.targetHandle,
          type: "mebsSemantic",
          selectable: false,
          focusable: false,
          data: {
            sSide: spec.side ?? -1,
            tSide: spec.side ?? -1,
            lane: 1,
            par: 0,
            tone: "#8fd0ac",
            badge: "",
            dimmed: false,
            emphasized:
              selectedNodeId === spec.source || selectedNodeId === spec.target,
            showBadge: false,
            aspiration: true,
          },
        });
        continue;
      }
      const dimmed = isDim(spec.source) || isDim(spec.target);
      const base: Edge = {
        id: spec.id,
        source: spec.source,
        target: spec.target,
        sourceHandle: spec.sourceHandle,
        targetHandle: spec.targetHandle,
        type: "default",
        style: { ...TREE_EDGE_STYLE, opacity: dimmed ? 0.3 : 1 },
        selectable: false,
        focusable: false,
      };
      if (spec.kind === "spine") {
        base.type = "straight";
        base.style = { ...SPINE_EDGE_STYLE, opacity: dimmed ? 0.5 : 1 };
      } else if (spec.kind === "rail") {
        base.type = "smoothstep";
        (base as Edge & { pathOptions?: { borderRadius: number } }).pathOptions =
          { borderRadius: 8 };
      }
      result.push(base);
    }

    return [...result, ...semanticPlan.edges];
  }, [layout, map, focus, selectedNodeId, semanticPlan]);

  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addCrossLink(connection.source, connection.target);
      }
    },
    [addCrossLink]
  );

  if (!map) return null;

  const botanical = layoutMode === "botanical";

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) => {
        if (node.id !== APEX_ID) selectNode(node.id);
      }}
      onEdgeClick={(_, edge) => {
        if (!isStructuralEdgeId(edge.id)) selectEdge(edge.id);
      }}
      onPaneClick={() => clearSelection()}
      onConnect={onConnect}
      fitView={botanical}
      // no pane size at render time, so no clamping here — the layout-mode
      // effect above re-fits once with clamped paddings right after mount
      fitViewOptions={fitChromeOptions({ inspectorOpen, mode: layoutMode })}
      minZoom={botanical ? 0.08 : 0.15}
      maxZoom={1.8}
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      deleteKeyCode={null}
      connectionLineStyle={{
        stroke: CROSS_STROKE,
        strokeWidth: 1.8,
        strokeDasharray: "7 5",
      }}
      proOptions={{ hideAttribution: false }}
      className="bg-[#161719]"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.4}
        color="#27292e"
      />
      {botanical && layout && <ZoneBackdrops rects={layout.zoneRects} />}
      <Controls
        position="bottom-left"
        showInteractive={false}
        className="mebs-controls"
      />
      {linkVisibility !== "off" && semanticPlan.hiddenCount > 0 && (
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2"
          style={{ marginRight: inspectorOpen ? 360 : 0 }}
        >
          <div className="rounded-full border border-amber-300/25 bg-zinc-950/85 px-3 py-1.5 text-[11.5px] font-medium text-amber-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
            {semanticPlan.hiddenCount}{" "}
            {semanticPlan.hiddenCount === 1 ? "link" : "links"} hidden in
            collapsed branches — expand to view
          </div>
        </div>
      )}
    </ReactFlow>
  );
}
