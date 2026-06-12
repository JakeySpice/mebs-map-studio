"use client";

import * as React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useMapStore } from "@/lib/store";

export interface SemanticEdgeData extends Record<string, unknown> {
  /** which way the curve leaves / enters (-1 left, +1 right) */
  sSide: -1 | 1;
  tSide: -1 | 1;
  /** parallel same-side curves get pushed out a lane at a time */
  lane: number;
  /** offset for multiple edges between the same pair of nodes */
  par: number;
  /** tone colour (resolved hex) */
  tone: string;
  badge: string;
  /** focus mode: this edge is not part of the selection's neighbourhood */
  dimmed: boolean;
  /** selected, or incident to the selected node */
  emphasized: boolean;
  showBadge: boolean;
  /** faint person → promoted-QoL line */
  aspiration?: boolean;
}

export type SemanticFlowEdge = Edge<SemanticEdgeData, "mebsSemantic">;

const LANE_STEP = 28;
const PAR_STEP = 22;

/**
 * Hand-rolled cubic: @xyflow's getBezierPath ignores curvature for
 * forward-facing pairs and produces no bow for same-side pairs, so neither
 * lanes nor parallel offsets are expressible with it (verified against
 * @xyflow/system 12.x). The control-point extension scales with distance,
 * clamped so short links stay tight and long links don't balloon.
 */
function semanticPath(
  sx: number,
  sy: number,
  sSide: -1 | 1,
  tx: number,
  ty: number,
  tSide: -1 | 1,
  lane: number,
  par: number
) {
  const ext =
    Math.min(260, Math.max(48, Math.hypot(tx - sx, ty - sy) * 0.35)) +
    LANE_STEP * lane;
  const c1x = sx + sSide * ext;
  const c1y = sy + PAR_STEP * par;
  const c2x = tx + tSide * ext;
  const c2y = ty + PAR_STEP * par;
  return {
    path: `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`,
    // cubic midpoint (t = 0.5)
    labelX: (sx + 3 * c1x + 3 * c2x + tx) / 8,
    labelY: (sy + 3 * c1y + 3 * c2y + ty) / 8,
  };
}

function SemanticEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps<SemanticFlowEdge>) {
  const selectEdge = useMapStore((s) => s.selectEdge);
  if (!data) return null;

  const { path, labelX, labelY } = semanticPath(
    sourceX,
    sourceY,
    data.sSide,
    targetX,
    targetY,
    data.tSide,
    data.lane,
    data.par
  );

  const style: React.CSSProperties = data.aspiration
    ? {
        stroke: "rgba(143, 208, 172, 1)",
        strokeWidth: 1.4,
        strokeDasharray: "2 6",
        opacity: data.emphasized ? 0.5 : 0.16,
      }
    : {
        stroke: data.tone,
        strokeWidth: data.emphasized ? 2.4 : 1.6,
        strokeDasharray: "6 5",
        opacity: data.dimmed ? 0.15 : data.emphasized ? 1 : 0.75,
      };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={data.aspiration ? undefined : markerEnd}
      />
      {data.showBadge && !data.dimmed && !data.aspiration && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="nopan"
            onClick={(e) => {
              e.stopPropagation();
              selectEdge(id);
            }}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              cursor: "pointer",
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(32, 28, 22, 0.94)",
              border: `1px solid ${data.tone}59`,
              color: data.tone,
              fontSize: 10.5,
              fontWeight: 500,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              opacity: data.emphasized ? 1 : 0.92,
            }}
          >
            {data.badge}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SemanticEdge = React.memo(SemanticEdgeComponent);
