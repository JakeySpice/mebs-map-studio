"use client";

import * as React from "react";
import Link from "next/link";
import { getViewportForBounds, useReactFlow, useStoreApi } from "@xyflow/react";
import { toPng } from "html-to-image";
import {
  Download,
  FileJson,
  FileText,
  FoldVertical,
  Home,
  Image as ImageIcon,
  ListTree,
  Maximize,
  UnfoldVertical,
} from "lucide-react";
import { layoutModeOf, type LayoutMode, type MebsMap } from "@/types/graph";
import { BACKDROP_PAD, fitChromeOptions } from "@/lib/layoutBotanical";
import { useMapStore, type LinkVisibility } from "@/lib/store";
import { exportMarkdown } from "@/lib/exportMarkdown";
import { downloadDataUrl, downloadText, safeFilename } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Toolbar() {
  const map = useMapStore((s) => s.map);
  if (!map) return null;
  return <ToolbarContent key={map.id} map={map} />;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-zinc-900/70 p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "cursor-pointer rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-colors",
            value === opt.value
              ? "bg-zinc-700 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToolbarContent({ map }: { map: MebsMap }) {
  const linkVisibility = useMapStore((s) => s.linkVisibility);
  const setLinkVisibility = useMapStore((s) => s.setLinkVisibility);
  const relationshipsPanelOpen = useMapStore((s) => s.relationshipsPanelOpen);
  const setRelationshipsPanelOpen = useMapStore(
    (s) => s.setRelationshipsPanelOpen
  );
  const setLayoutMode = useMapStore((s) => s.setLayoutMode);
  const setAllCollapsed = useMapStore((s) => s.setAllCollapsed);
  const updateMapTitle = useMapStore((s) => s.updateMapTitle);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const selectedEdgeId = useMapStore((s) => s.selectedEdgeId);
  const { fitView, getNodes, getNodesBounds } = useReactFlow();
  const rfStore = useStoreApi();

  const layoutMode = layoutModeOf(map);
  // inspector aside occupies the right edge while a node/edge is selected — fit
  // must clear it (shared helper, same insets as MapCanvas)
  const inspectorOpen = selectedNodeId !== null || selectedEdgeId !== null;
  const fitOpts = (extra: { duration: number }) => {
    const { width, height } = rfStore.getState();
    return fitChromeOptions({
      inspectorOpen,
      mode: layoutMode,
      paneWidth: width,
      paneHeight: height,
      extra,
    });
  };
  const [titleDraft, setTitleDraft] = React.useState(map.title);

  const commitTitle = () => {
    if (titleDraft.trim() && titleDraft !== map.title) {
      updateMapTitle(titleDraft);
    } else {
      setTitleDraft(map.title);
    }
  };

  // MapCanvas refits automatically when layoutMode changes
  const handleLayoutMode = (mode: LayoutMode) => setLayoutMode(mode);

  const handleExportJson = () => {
    downloadText(
      JSON.stringify(map, null, 2),
      `${safeFilename(map.title)}.mebs.json`,
      "application/json"
    );
  };

  const handleExportMarkdown = () => {
    downloadText(
      exportMarkdown(map),
      `${safeFilename(map.title)}.md`,
      "text/markdown"
    );
  };

  const handleExportPng = async () => {
    const viewportEl = document.querySelector<HTMLElement>(
      ".react-flow__viewport"
    );
    if (!viewportEl) return;
    let bounds = getNodesBounds(getNodes());
    if (layoutMode === "botanical") {
      // keep the zone backdrops (which extend past the nodes) in frame
      const pad = BACKDROP_PAD + 16;
      bounds = {
        x: bounds.x - pad,
        y: bounds.y - pad,
        width: bounds.width + pad * 2,
        height: bounds.height + pad * 2,
      };
    }
    const aspect = bounds.height / Math.max(1, bounds.width);
    const imageWidth = Math.min(
      4096,
      Math.max(1400, Math.round(bounds.width * 1.1))
    );
    const imageHeight = Math.min(8192, Math.max(800, Math.round(imageWidth * aspect)));
    const viewport = getViewportForBounds(
      bounds,
      imageWidth,
      imageHeight,
      0.05,
      4,
      0.06
    );
    const dataUrl = await toPng(viewportEl, {
      backgroundColor: "#161719",
      width: imageWidth,
      height: imageHeight,
      pixelRatio: 2,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });
    downloadDataUrl(dataUrl, `${safeFilename(map.title)}.png`);
  };

  const crossLinkCount = map.edges.length;

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950/85 px-2.5 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-zinc-400 hover:text-zinc-100"
        nativeButton={false}
        render={<Link href="/" aria-label="Back to home" />}
      >
        <Home />
      </Button>

      <Separator orientation="vertical" className="h-5 bg-white/10" />

      <input
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setTitleDraft(map.title);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Map title"
        size={1}
        className="rounded-md bg-transparent px-2 py-1 text-[13.5px] font-medium text-zinc-100 outline-none transition-colors hover:bg-white/5 focus:bg-white/8"
        // grow with the title text, clamped so it can't crowd the toolbar
        style={{ width: `clamp(7rem, ${titleDraft.length + 2}ch, 22rem)` }}
      />

      <Separator orientation="vertical" className="h-5 bg-white/10" />

      <Segmented<LayoutMode>
        label="Layout"
        value={layoutMode}
        onChange={handleLayoutMode}
        options={[
          { value: "botanical", label: "Botanical" },
          { value: "outline", label: "Outline" },
        ]}
      />

      <div className="flex items-center gap-1.5">
        <span className="pl-1 text-[11px] text-zinc-500">Links</span>
        <Segmented<LinkVisibility>
          label="Relationship visibility"
          value={linkVisibility}
          onChange={setLinkVisibility}
          options={[
            { value: "off", label: "Off" },
            { value: "selected", label: "Selected" },
            { value: "all", label: "All" },
          ]}
        />
        {crossLinkCount > 0 && (
          <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-200">
            {crossLinkCount}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          title="Review relationships"
          aria-pressed={relationshipsPanelOpen}
          className={cn(
            "text-zinc-400 hover:text-zinc-100",
            relationshipsPanelOpen && "bg-white/10 text-zinc-100"
          )}
          onClick={() => setRelationshipsPanelOpen(!relationshipsPanelOpen)}
        >
          <ListTree />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-5 bg-white/10" />

      <Button
        variant="ghost"
        size="icon-sm"
        title="Expand all branches"
        className="text-zinc-400 hover:text-zinc-100"
        onClick={() => {
          setAllCollapsed(false);
          requestAnimationFrame(() => fitView(fitOpts({ duration: 350 })));
        }}
      >
        <UnfoldVertical />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Collapse to domains"
        className="text-zinc-400 hover:text-zinc-100"
        onClick={() => {
          setAllCollapsed(true);
          requestAnimationFrame(() => fitView(fitOpts({ duration: 350 })));
        }}
      >
        <FoldVertical />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Fit map to view"
        className="text-zinc-400 hover:text-zinc-100"
        onClick={() => fitView(fitOpts({ duration: 350 }))}
      >
        <Maximize />
      </Button>

      <Separator orientation="vertical" className="h-5 bg-white/10" />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-zinc-300 hover:text-zinc-100"
            />
          }
        >
          <Download data-icon="inline-start" /> Export
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportJson}>
            <FileJson /> JSON (full map data)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportMarkdown}>
            <FileText /> Markdown formulation summary
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportPng}>
            <ImageIcon /> PNG image
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
