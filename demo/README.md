# mudlet-map-binary-reader — demo

A small Vite + React + Tailwind app demonstrating the `mudlet-map-binary-reader`
library: it reads a Mudlet binary map file (v20) entirely in the browser and
shows statistics about it. It imports the library straight from `../src`, so any
change to the parser is reflected live.

## Run

```bash
cd demo
yarn          # install
yarn dev      # start the dev server
```

Then open the printed URL and drop a Mudlet map file (usually a `.dat` file)
onto the page.

## What it shows

- Headline counts: areas, rooms, labels, Z levels, normal/special exits,
  exit stubs, doors, locked rooms, rooms with a symbol / user data, and
  environment colors.
- Largest areas by room count and most common environments (bar lists).
- The set of Z levels present in the map.

Stat computation lives in [`src/stats.ts`](src/stats.ts) — add to `MapStats`
there to surface more.
