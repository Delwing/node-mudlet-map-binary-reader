# Mudlet Map Binary Reader

[![NPM](https://nodei.co/npm/mudlet-map-binary-reader.png)](https://nodei.co/npm/mudlet-map-binary-reader/)

Reads Mudlet's map binary file (v20 only!). Can output .js/.json files needed for Mudlet Map Reader.
Mudlet map JSON format export is also available.

*API until version `1.0.0` is subject to change! Use with caution.*

I am no Node developer, so any hints and suggestions are more then welcome.

## TODOs and plans

- [x] Convert to .ts
- [x] Document map model
- [x] Document classes
- [x] Add Mudlet's JSON exporter
- [x] Correct QFont read
- [x] Add test
- [x] Add linting

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

Exports the map into the format used by [js-mudlet-map-renderer](https://github.com/Delwing/js-mudlet-map-renderer).

```ts
const map = MudletMapReader.readBuffer(readFileSync("map.dat"));

// Without a directory — returns data without writing files
const { mapData, colors } = MudletMapReader.export(map);
console.log(`Exported ${mapData.length} areas, ${colors.length} colors`);

// With a directory — also writes mapExport.js, colors.js, mapExport.json, colors.json
MudletMapReader.export(map, "output");
```

### Exporting to Mudlet JSON format

```ts
const map = MudletMapReader.readBuffer(readFileSync("map.dat"));

// Pretty-printed
MudletMapReader.exportJson(map, "map.json");

// Minified
MudletMapReader.exportJson(map, "map.min.json", true);
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