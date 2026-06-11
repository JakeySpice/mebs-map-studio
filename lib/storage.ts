import type { MapMeta, MebsMap, MebsNode } from "@/types/graph";
import { mapIndexSchema, mebsMapSchema } from "@/lib/schema";
import { DOMAIN_TEMPLATES, ROOT_LABEL } from "@/lib/templates";

const INDEX_KEY = "mebs-map-studio:index";
const mapKey = (id: string) => `mebs-map-studio:map:${id}`;

export const STORAGE_WRITE_ERROR_MESSAGE =
  "Could not save changes in this browser. Check private browsing, storage permissions, or available disk space before continuing.";

export class StorageWriteError extends Error {
  constructor() {
    super(STORAGE_WRITE_ERROR_MESSAGE);
    this.name = "StorageWriteError";
  }
}

export function describeStorageError(error: unknown): string {
  return error instanceof StorageWriteError
    ? error.message
    : STORAGE_WRITE_ERROR_MESSAGE;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn("MEBS Map Studio: failed to write to localStorage", err);
    return false;
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    !navigator.storage.persist
  ) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch (err) {
    console.warn("MEBS Map Studio: failed to request persistent storage", err);
    return false;
  }
}

export function listMaps(): MapMeta[] {
  const parsed = mapIndexSchema.safeParse(readJson(INDEX_KEY));
  if (!parsed.success) return [];
  return [...parsed.data].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  ) as MapMeta[];
}

export function loadMap(id: string): MebsMap | null {
  const parsed = mebsMapSchema.safeParse(readJson(mapKey(id)));
  if (!parsed.success) {
    console.warn("MEBS Map Studio: stored map failed validation", parsed.error);
    return null;
  }
  return parsed.data as MebsMap;
}

export function saveMap(map: MebsMap) {
  const meta: MapMeta = {
    id: map.id,
    title: map.title,
    participantLabel: map.participantLabel,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    nodeCount: map.nodes.length,
  };
  const index = listMaps().filter((m) => m.id !== map.id);
  index.unshift(meta);
  const wroteMap = writeJson(mapKey(map.id), map);
  const wroteIndex = writeJson(INDEX_KEY, index);
  if (!wroteMap || !wroteIndex) {
    throw new StorageWriteError();
  }
}

export function deleteMap(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(mapKey(id));
  } catch (err) {
    console.warn("MEBS Map Studio: failed to remove map from localStorage", err);
    throw new StorageWriteError();
  }
  const wroteIndex = writeJson(
    INDEX_KEY,
    listMaps().filter((m) => m.id !== id)
  );
  if (!wroteIndex) throw new StorageWriteError();
}

export interface CreateMapOptions {
  title: string;
  participantLabel: string;
  seedDomains: boolean;
}

export function createMap(options: CreateMapOptions): MebsMap {
  const now = new Date().toISOString();
  const rootId = newId();
  const nodes: MebsNode[] = [
    {
      id: rootId,
      type: "root",
      label: options.participantLabel.trim()
        ? `${options.participantLabel.trim()}: Good Life, Behaviour Formulation & Support Map`
        : ROOT_LABEL,
      parentId: null,
      order: 0,
      collapsed: false,
    },
  ];

  if (options.seedDomains) {
    DOMAIN_TEMPLATES.forEach((template, i) => {
      nodes.push({
        id: newId(),
        type: "domain",
        label: template.label,
        summary: template.purpose,
        parentId: rootId,
        order: i,
        collapsed: true,
        childTypeHint: template.childTypeHint,
        templateId: template.id,
      });
    });
  }

  const map: MebsMap = {
    id: newId(),
    title: options.title.trim() || "Untitled MEBS map",
    participantLabel: options.participantLabel.trim(),
    framework: "MEBS",
    version: "1.0",
    createdAt: now,
    updatedAt: now,
    nodes,
    edges: [],
  };
  saveMap(map);
  return map;
}

/** Imports a prebuilt map definition (e.g. the sample) under a fresh id. */
export function importMap(map: Omit<MebsMap, "id" | "createdAt" | "updatedAt">): MebsMap {
  const now = new Date().toISOString();
  const copy: MebsMap = { ...map, id: newId(), createdAt: now, updatedAt: now };
  saveMap(copy);
  return copy;
}
