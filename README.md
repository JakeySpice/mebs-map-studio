# MEBS Map Studio

A local-first visual case formulation tool for Positive Behaviour Support
practitioners. Build an interactive, NotebookLM-style MEBS mind map of quality
of life, ecology, behaviour patterns, formulation hypotheses, supports, skills,
safeguards and data — then toggle on the relationship layer to inspect the
clinical logic between branches.

## Running it

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

Maps are saved per-browser (localStorage), so a map made on one computer
won't appear on another — use **Export → JSON** on the map toolbar, then
**Import JSON** on the home screen of the other machine.

## Desktop app (Windows exe)

The app ships as a self-contained portable exe — no Node, no install:

```bash
npm run app:dist
```

This statically exports the Next.js app to `out/`, regenerates the icon
(`scripts/make-icon.js`), and packages everything with electron-builder into
`dist-app/MEBS-Map-Studio-<version>.exe`. Copy that one file anywhere and
double-click it. Maps are stored per Windows user (in `%APPDATA%/MEBS Map
Studio`), so they survive moving or updating the exe itself.

Useful while developing:

```bash
npm run app:dev   # build the static export and open it in the Electron shell
node scripts/smoke.js 9223 shot.png   # CDP smoke test against a shell started
                                      # with --remote-debugging-port=9223
```

The exe is unsigned, so Windows SmartScreen will show "Windows protected your
PC" the first time someone runs a downloaded copy — **More info → Run anyway**.
Copies shared via USB or network drive usually skip that warning.

## Desktop app (macOS)

The project is Mac-ready (universal dmg config, `build/icon.icns`), but Apple
only allows macOS apps to be **built on a Mac** — this command must run there:

```bash
npm install
npm run app:dist:mac   # -> dist-app/MEBS-Map-Studio-<version>.dmg
```

The dmg is universal (Apple Silicon + Intel). Unsigned Mac apps hit Gatekeeper
harder than Windows: on macOS 15 (Sequoia) and later, the recipient must
attempt to open the app once, then go to **System Settings → Privacy &
Security → Open Anyway** (older macOS: right-click the app → Open). Removing
that friction requires an Apple Developer ID ($99 USD/yr) plus notarization.

No Mac handy? Options: build in CI on a free GitHub Actions macOS runner, or
skip packaging entirely — `out/` is a fully static site, so Mac users can run
the app in any browser from any static host (data still stays in their
browser, consistent with the privacy model).

## What it does

- **Home screen** — create a new map (optionally pre-seeded with the nine MEBS
  domains) or explore a fully worked, de-identified sample case.
- **Botanical formulation view** (default) — the map is arranged like the
  clinical logic of MEBS: contextual **roots** spread downward, the
  **formulation trunk** stands centre with maintaining variables flanking it,
  **behaviour patterns** sit beside the trunk as pressure points (visible, not
  central), the **support plan branches** fan upward out of the formulation,
  and **quality-of-life outcomes** form the canopy on top. Quality-of-life
  goals are automatically lifted into the canopy wherever they live in the
  hierarchy. Soft zone backdrops label each region.
- **Outline view** — the original NotebookLM-style left-to-right tree remains
  one click away in the toolbar (per map, remembered).
- **GUI-first input** — click a node to open the inspector (label, type, zone,
  summary, notes); quick-add suggestion chips seeded from the MEBS framework;
  hover **+** to add a branch; double-click to rename inline.
- **Relationship layer** — *Off / Selected / All* in the toolbar. Clinical
  cross-links render as curved side-routed edges with compact badges
  (*risk ↑*, *maintains*, *replaces*, *toward QoL*…). Click any node to
  spotlight its relationships and dim everything unrelated; click a badge or
  link to edit its type, label and notes; drag from a node's lower dot (in
  *All*) to draw a new link.
- **Export** — JSON (full data, practitioner-owned), Markdown formulation
  summary, or PNG image of the map (zone backdrops and badges included).

## Privacy

Everything stays in the browser's localStorage. No accounts, no sync, no
analytics, no network calls with case content. Use initials or pseudonyms,
export JSON for backups, and delete maps from the home screen at any time.

This is a thinking tool for practitioners — it does not generate or validate
Behaviour Support Plans.

## Stack

Next.js 16 (App Router) · TypeScript · @xyflow/react (React Flow 12) ·
Tailwind CSS 4 · shadcn/ui (Base UI) · Zustand · Zod
