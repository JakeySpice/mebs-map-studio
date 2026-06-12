"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";

/**
 * Invisible 1×1 junction sitting above the formulation trunk: the spine edge
 * ends here and the support-plan branches fan out from it. Render-array only —
 * it must never be written into map.nodes, and any future select-all /
 * export-nodes feature must exclude it (see APEX_ID in lib/layoutBotanical).
 */
function ApexNodeComponent() {
  return (
    <div style={{ width: 1, height: 1, pointerEvents: "none" }}>
      <Handle
        id="in"
        type="target"
        position={Position.Bottom}
        className="!pointer-events-none !h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        id="out"
        type="source"
        position={Position.Top}
        isConnectable={false}
        className="!pointer-events-none !h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
}

export const ApexNode = React.memo(ApexNodeComponent);
