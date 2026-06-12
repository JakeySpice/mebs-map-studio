"use client";

import * as React from "react";
import { ViewportPortal } from "@xyflow/react";
import { ZONE_LABELS, type ZoneId } from "@/types/graph";
import type { ZoneRect } from "@/lib/layoutBotanical";

const ZONE_FILL: Record<ZoneId, string> = {
  canopy: "rgba(143, 208, 172, 0.045)",
  branches: "rgba(143, 208, 172, 0.03)",
  trunk: "rgba(169, 149, 236, 0.04)",
  behaviour: "rgba(229, 150, 168, 0.045)",
  roots: "rgba(168, 183, 205, 0.04)",
};

const ZONE_DOT: Record<ZoneId, string> = {
  canopy: "#8fd0ac",
  branches: "#8fd0ac",
  trunk: "#a995ec",
  behaviour: "#e596a8",
  roots: "#a8b7cd",
};

/** Soft region hints behind the botanical map. zIndex -1 paints them under
 *  edges and nodes but still above the dotted canvas background, which lives
 *  outside the transformed viewport. They ride along in PNG exports. */
function ZoneBackdropsComponent({ rects }: { rects: ZoneRect[] }) {
  if (rects.length === 0) return null;
  return (
    <ViewportPortal>
      {rects.map((r) => (
        <div
          key={r.zone}
          style={{
            position: "absolute",
            transform: `translate(${r.x}px, ${r.y}px)`,
            width: r.width,
            height: r.height,
            zIndex: -1,
            pointerEvents: "none",
            borderRadius: 28,
            border: "1px dashed rgba(255, 255, 255, 0.06)",
            background: ZONE_FILL[r.zone],
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 18,
              ...(r.zone === "roots" ? { bottom: 12 } : { top: 12 }),
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255, 255, 255, 0.38)",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: ZONE_DOT[r.zone],
                opacity: 0.7,
              }}
            />
            {ZONE_LABELS[r.zone]}
          </span>
        </div>
      ))}
    </ViewportPortal>
  );
}

export const ZoneBackdrops = React.memo(ZoneBackdropsComponent);
