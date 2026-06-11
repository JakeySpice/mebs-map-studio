"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Map as MapIcon,
  Plus,
  Sparkles,
  Trash2,
  Network,
  ShieldCheck,
  PencilRuler,
  Upload,
} from "lucide-react";
import type { MapMeta, MebsMap } from "@/types/graph";
import { mebsMapSchema } from "@/lib/schema";
import {
  createMap,
  deleteMap,
  describeStorageError,
  importMap,
  listMaps,
  requestPersistentStorage,
} from "@/lib/storage";
import { buildSampleMap } from "@/lib/sampleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function HomePage() {
  const router = useRouter();
  const [maps, setMaps] = React.useState<MapMeta[] | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [participant, setParticipant] = React.useState("");
  const [seedDomains, setSeedDomains] = React.useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  );
  const [importError, setImportError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setMaps(listMaps());
    });
    void requestPersistentStorage();
    return () => {
      active = false;
    };
  }, []);

  const handleImportFile = async (file: File) => {
    setImportError(null);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setImportError("Could not read that file as JSON.");
      return;
    }

    const parsed = mebsMapSchema.safeParse(json);
    if (!parsed.success) {
      setImportError(
        "That file does not look like a valid MEBS Map Studio JSON export."
      );
      return;
    }

    try {
      const map = importMap(parsed.data as MebsMap);
      router.push(`/map?id=${map.id}`);
    } catch (err) {
      setImportError(describeStorageError(err));
    }
  };

  const handleCreate = () => {
    setImportError(null);
    try {
      const map = createMap({
        title:
          title.trim() ||
          (participant.trim()
            ? `${participant.trim()} - MEBS map`
            : "Untitled MEBS map"),
        participantLabel: participant,
        seedDomains,
      });
      router.push(`/map?id=${map.id}`);
    } catch (err) {
      setImportError(describeStorageError(err));
    }
  };

  const handleSample = () => {
    setImportError(null);
    try {
      const map = importMap(buildSampleMap());
      router.push(`/map?id=${map.id}`);
    } catch (err) {
      setImportError(describeStorageError(err));
    }
  };

  const handleDelete = (id: string) => {
    setImportError(null);
    try {
      deleteMap(id);
      setMaps(listMaps());
    } catch (err) {
      setImportError(describeStorageError(err));
    }
    setConfirmDeleteId(null);
  };

  const deleting = maps?.find((m) => m.id === confirmDeleteId);

  return (
    <main className="min-h-screen w-full bg-[#161719] text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#cfc5f4] shadow-[0_4px_18px_rgba(170,150,240,0.35)]">
              <Network className="h-5 w-5 text-[#1f2430]" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              MEBS Map Studio
            </h1>
          </div>
          <p className="max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Visual case formulation for Positive Behaviour Support. Build an
            interactive MEBS map of quality of life, ecology, behaviour,
            hypotheses, supports and safeguards — then inspect the
            relationships between them.
          </p>
        </header>

        <div className="mb-12 flex flex-wrap gap-3">
          <Button
            size="lg"
            className="gap-2 bg-[#cfc5f4] text-[#1f2430] hover:bg-[#bdb0ef]"
            onClick={() => setNewOpen(true)}
          >
            <Plus /> New MEBS map
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-white/15 bg-transparent text-zinc-200 hover:bg-white/5"
            onClick={handleSample}
          >
            <Sparkles /> Explore the sample map
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-white/15 bg-transparent text-zinc-200 hover:bg-white/5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload /> Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
          {importError && (
            <p className="w-full text-[12.5px] text-rose-300">{importError}</p>
          )}
        </div>

        <section>
          <h2 className="mb-4 text-[13px] font-medium tracking-wide text-zinc-500 uppercase">
            Your maps
          </h2>
          {maps === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : maps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
              <MapIcon className="mx-auto mb-3 h-7 w-7 text-zinc-600" />
              <p className="text-sm text-zinc-400">
                No maps yet. Create a new one, or explore the sample to see how
                a finished formulation looks.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {maps.map((m) => (
                <li
                  key={m.id}
                  className="group relative rounded-2xl border border-white/10 bg-zinc-900/50 p-4 transition-colors hover:border-white/25 hover:bg-zinc-900"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/map?id=${m.id}`)}
                    className="block w-full cursor-pointer text-left"
                  >
                    <span className="block truncate pr-8 text-[14.5px] font-medium text-zinc-100">
                      {m.title}
                    </span>
                    <span className="mt-1 block text-[12px] text-zinc-500">
                      {m.participantLabel || "No participant label"} ·{" "}
                      {m.nodeCount} node{m.nodeCount === 1 ? "" : "s"}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-zinc-600">
                      Updated {new Date(m.updatedAt).toLocaleString()}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-3 right-3 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-300"
                    title="Delete map"
                    onClick={() => setConfirmDeleteId(m.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-16 flex items-start gap-2.5 rounded-2xl border border-white/8 bg-zinc-900/40 px-4 py-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" />
          <p className="text-[12.5px] leading-relaxed text-zinc-500">
            Local-first by design: everything you map stays in this browser’s
            storage — nothing is uploaded, synced, or logged. Export JSON from
            the map toolbar to back up or move a formulation, and delete maps
            here at any time.
          </p>
        </footer>
      </div>

      {/* new map dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New MEBS map</DialogTitle>
            <DialogDescription>
              Use initials or a pseudonym for the participant — this stays on
              your device, but de-identification is still good practice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="map-title">Map title</Label>
              <Input
                id="map-title"
                value={title}
                placeholder="e.g. J.S. — formulation review"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="participant">Participant label</Label>
              <Input
                id="participant"
                value={participant}
                placeholder="e.g. initials or pseudonym"
                onChange={(e) => setParticipant(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={seedDomains}
                onChange={(e) => setSeedDomains(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#cfc5f4]"
              />
              <span>
                <span className="block font-medium">
                  Start with the nine MEBS domains
                </span>
                <span className="block text-[12.5px] text-muted-foreground">
                  <PencilRuler className="mr-1 inline h-3 w-3" />
                  Person &amp; quality of life, ecology, behaviour patterns,
                  formulation, supports, skills, responses, safeguards, data.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create map</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm dialog */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this map?</DialogTitle>
            <DialogDescription>
              “{deleting?.title}” will be permanently removed from this
              browser. Export it as JSON first if you want a backup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete map
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
