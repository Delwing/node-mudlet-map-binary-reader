# Mudlet Map Binary Reader

[![NPM](https://nodei.co/npm/mudlet-map-binary-reader.png)](https://nodei.co/npm/mudlet-map-binary-reader/)

Reads and writes Mudlet's map binary file (v20), and additionally reads the older formats v16–v19 (read-only). Can also convert a map to the [JS Mudlet Map Renderer](https://github.com/Delwing/js-mudlet-map-renderer) format or to Mudlet's JSON format.

The library works with **bytes** and never touches the filesystem — you handle reading and writing files yourself.

This project follows [Semantic Versioning](https://semver.org/).

## Supported map versions

| Version   | Read | Write |
| --------- | :--: | :---: |
| v20       |  ✅  |  ✅   |
| v16 – v19 |  ✅  |  ❌   |

Older maps (v16–v19) are read into the same canonical model as v20, so all the
read examples below work unchanged. To save a legacy map, set `map.version = 20`
before calling `writeBuffer` — reading backfills every field the v20 writer
needs, so the round-trip preserves areas, rooms, and converted legacy fields
(symbol char, custom-line colour and style).

## Usage

The library is browser-pure: it reads and writes **bytes** (`Uint8Array`), and never touches the filesystem itself. You supply the bytes — from Node's `fs`, a `fetch`/`Blob`, a file input, etc.

### Reading a map

```ts
import { readFileSync } from "node:fs";
import { MudletMapReader } from "mudlet-map-binary-reader";

// In Node, read the bytes yourself; in the browser, use fetch/File instead.
const map = MudletMapReader.readBuffer(readFileSync("map.dat"));

console.log(`Map version: ${map.version}`);
console.log(`Areas: ${Object.keys(map.areas).length}`);
console.log(`Rooms: ${Object.keys(map.rooms).length}`);
```

### Inspecting rooms and exits

```ts
const map = MudletMapReader.readBuffer(readFileSync("map.dat"));

for (const [id, room] of Object.entries(map.rooms)) {
  console.log(`Room ${id}: ${room.name} (env ${room.environment})`);

  if (room.north !== -1) console.log(`  north -> ${room.north}`);
  if (room.south !== -1) console.log(`  south -> ${room.south}`);

  for (const [exitName, destId] of Object.entries(room.mSpecialExits)) {
    const locked = room.mSpecialExitLocks.includes(destId) ? " [locked]" : "";
    console.log(`  special: ${exitName} -> ${destId}${locked}`);
  }
}
```

### Modifying and saving

```ts
import { readFileSync, writeFileSync } from "node:fs";

const map = MudletMapReader.readBuffer(readFileSync("map.dat"));

// Rename a room
map.rooms[1].name = "Grand Hall";

// Add user data to a room
map.rooms[1].userData["notes"] = "quest start";

// Move a room
map.rooms[1].x = 10;
map.rooms[1].y = -5;

// Serialize back to bytes, then persist them however you like
const bytes = MudletMapReader.writeBuffer(map);
writeFileSync("map-modified.dat", bytes);
```

### Exporting for JS Mudlet Map Renderer

Converts the map into the data structure used by [js-mudlet-map-renderer](https://github.com/Delwing/js-mudlet-map-renderer). It returns the data — persisting it is up to you.

```ts
import { writeFileSync } from "node:fs";

const map = MudletMapReader.readBuffer(readFileSync("map.dat"));

const { mapData, colors } = MudletMapReader.export(map);
console.log(`Exported ${mapData.length} areas, ${colors.length} colors`);

// Persist however you like:
writeFileSync("mapExport.json", JSON.stringify(mapData));
writeFileSync("colors.json", JSON.stringify(colors));
```

### Exporting to Mudlet JSON format

`exportJson` returns the JSON as a string — write it out yourself.

```ts
import { writeFileSync } from "node:fs";

const map = MudletMapReader.readBuffer(readFileSync("map.dat"));

// Pretty-printed
writeFileSync("map.json", MudletMapReader.exportJson(map));

// Minified
writeFileSync("map.min.json", MudletMapReader.exportJson(map, true));
```

### Working with areas and labels

```ts
const map = MudletMapReader.readBuffer(readFileSync("map.dat"));

for (const [id, name] of Object.entries(map.areaNames)) {
  const area = map.areas[id as unknown as number];
  console.log(`Area ${id}: ${name} (${area.rooms.length} rooms)`);

  const labels = map.labels[id as unknown as number] ?? [];
  for (const label of labels) {
    console.log(`  Label: "${label.text}" at (${label.pos.join(", ")})`);
  }
}
```

### Using with TypeScript types

All model types are exported for use in your own code:

```ts
import { MudletMapReader } from "mudlet-map-binary-reader";
import type { MudletMap, MudletRoom, MudletColor } from "mudlet-map-binary-reader";

function getRoomsByEnvironment(map: MudletMap, envId: number): MudletRoom[] {
  return Object.values(map.rooms).filter((room) => room.environment === envId);
}

function formatColor(color: MudletColor): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha})`;
}

const map = MudletMapReader.readBuffer(readFileSync("map.dat"));
const outdoorRooms = getRoomsByEnvironment(map, 1);
console.log(`Found ${outdoorRooms.length} outdoor rooms`);
```