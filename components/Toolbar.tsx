"use client";

import * as React from "react";
import Link from "next/link";
import { getViewportForBounds, useReactFlow } from "@xyflow/react";
import { toPng } from "html-to-image";
import {
  Download,
  FileJson,
  FileText,
  FoldVertical,
  Home,
  Image as ImageIcon,
  Maximize,
  UnfoldVertical,
} from "lucide-react";
import type { MebsMap } from "@/types/graph";
import { useMapStore } from "@/lib/store";
import { exportMarkdown } from "@/lib/exportMarkdown";
import { downloadDataUrl, downloadText, safeFilename } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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

function ToolbarContent({ map }: { map: MebsMap }) {
  const relationshipMode = useMapStore((s) => s.relationshipMode);
  const setRelationshipMode = useMapStore((s) => s.setRelationshipMode);
  const setAllCollapsed = useMapStore((s) => s.setAllCollapsed);
  const updateMapTitle = useMapStore((s) => s.updateMapTitle);
  const { fitView, getNodes, getNodesBounds } = useReactFlow();

  const [titleDraft, setTitleDraft] = React.useState(map.title);

  const commitTitle = () => {
    if (titleDraft.trim() && titleDraft !== map.title) {
      updateMapTitle(titleDraft);
    } else {
      setTitleDraft(map.title);
    }
  };

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
    const bounds = getNodesBounds(getNodes());
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
        className="w-56 rounded-md bg-transparent px-2 py-1 text-[13.5px] font-medium text-zinc-100 outline-none transition-colors hover:bg-white/5 focus:bg-white/8"
      />

      <Separator orientation="vertical" className="h-5 bg-white/10" />

      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/5">
        <Switch
          checked={relationshipMode}
          onCheckedChange={(checked) => setRelationshipMode(Boolean(checked))}
        />
        <span className="select-none">
          Relationships
          {crossLinkCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-200">
              {crossLinkCount}
            </span>
          )}
        </span>
      </label>

      <Separator orientation="vertical" className="h-5 bg-white/10" />

      <Button
        variant="ghost"
        size="icon-sm"
        title="Expand all branches"
        className="text-zinc-400 hover:text-zinc-100"
        onClick={() => {
          setAllCollapsed(false);
          requestAnimationFrame(() =>
            fitView({ padding: 0.1, duration: 350 })
          );
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
          requestAnimationFrame(() =>
            fitView({ padding: 0.15, duration: 350 })
          );
        }}
      >
        <FoldVertical />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Fit map to view"
        className="text-zinc-400 hover:text-zinc-100"
        onClick={() => fitView({ padding: 0.12, duration: 350 })}
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
