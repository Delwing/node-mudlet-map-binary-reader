This project adheres to [Semantic Versioning](https://semver.org/).

# 2.0.0
- **(breaking)** `MudletRoom.mSpecialExitLocks` is now `string[]` — the **commands** whose special exit is locked — instead of `number[]` of destination room ids. This matches Mudlet, whose `TRoom` holds `QSet<QString> mSpecialExitLocks` keyed by command (`TRoom.h:220`), and it fixes a case the old shape could not represent: a room with two special exits to the *same* destination, only one of them locked. Reading `{99: ["0open door", "1squeeze through"]}` recorded "destination 99 is locked", and writing it back produced `1open door` as well — inventing a lock and breaking the byte round-trip. Rare enough to have gone unnoticed (the 27k-room Arkadia map has 774 rooms with several special exits to one destination and none with mixed locks), and silent when it happened.
  - `readerExport` keeps `mSpecialExitLocks` as destination ids on `RendererRoom`, converting from the commands, because mudlet-map-renderer tests membership with the exit's target (`new Set(room.mSpecialExitLocks).has(targetId)`). Rendering is unaffected. That shape cannot express a per-command lock, so a mixed room still reads as locked there — a limit of the renderer's contract, not of the model.
  - `exportMap` (JSON) now marks an exit `locked` when the **command** is locked, where it previously matched on the destination id.
  - Consumers reading `room.mSpecialExitLocks` directly must switch from destination ids to commands; `room.mSpecialExits[command]` gives the destination if they need it.

# 1.3.0
- **match Mudlet's handling of `system.fallback_*` user-data keys on read**, so the model this library hands back equals the one Mudlet holds in memory (mirrors `TRoom::restore` / `TMap::restore`). Mudlet copies a field into user data under a `system.fallback_*` key only when saving a format too old to carry it in the stream, and takes the key back out on load:
  - **v19 and up**: the stream is authoritative, so a `system.fallback_symbol` (room) or `system.fallback_mapSymbolFont` / `…FontFudgeFactor` / `…onlyUseMapSymbolFont` (map) still present in the file is a stale leak from an older save — it is now removed instead of surfacing as user data nobody set. Every Mudlet before 2026 (PR Mudlet/Mudlet#9469, unreleased as of 4.22.0) wrote these into the live map and saved them back, so real files do carry them: the 7.8 MB Arkadia map had 751 rooms affected. Keys that are still authoritative at the version being read (`system.fallback_symbol_color`, `system.fallback_hidden`, `system.fallback_map2DZoom` below v21) are deliberately kept.
  - **v17/v18**: the map symbol font, its fudge factor and the only-use-this-font flag are now recovered from those keys instead of being replaced by a hardcoded stand-in font and left in `mUserData` — a v17/v18 → v20 upgrade previously lost the map's real symbol font. Only the first ten comma-separated fields of the font description are read: `QFont::toString()`/`fromString()` round-tripping in older Qt re-appends the trailing nine fields on every cycle, so a long-lived map carries hundreds of them (the Arkadia map: 1531 fields, i.e. 170 old-format saves). Mudlet applies the same cut.
  - the v16-v18 room symbol fallback keeps its existing behaviour; it now shares one implementation (`src/models/fallback-keys.ts`) with everything above.
- **narrow `QVector3D` coordinates to float precision on read** (label `pos`, area `pos`/`span`). Qt serialises the vector as three doubles — `QDataStream` defaults to `DoublePrecision` — but its components are floats, so Mudlet narrows every coordinate it loads and writes the narrowed value back. Keeping the extra precision left coordinates that a Mudlet load quietly rewrites, which then surfaced as a diff nobody made (18 of 388 labels in the Arkadia map).
- **round-trip fidelity is unchanged for any file Mudlet itself wrote**: `readMapFromBuffer` → `writeMapToBuffer` on a current Mudlet save is still byte-for-byte identical. A file carrying data Mudlet cannot represent (stale fallback keys, sub-float precision) is now normalised to what Mudlet would write — once, and stably: re-saving the result reproduces the same bytes.
- no public API change; 134 tests pass (10 new).

# 1.2.0
- add `streamRooms(buf, onRoom, onHeader)`: decodes the header eagerly, then walks the rooms blob one room at a time so a caller never holds the full object graph. Peak memory is buffer + one room instead of the whole parsed map, which is what makes multi-hundred-MB maps processable at all. `MapModel` gained `readHeader` / `readRoom` (each version's fields split into header + trailing rooms blob, same effective schema), and `convertRoom` / `convertLabel` are now exported.

# 1.1.0
- read-only support for legacy map formats **v16-v19** (v20 remains the only version this library writes). Reads dispatch on the on-disk version; fields a legacy layout doesn't carry are backfilled so `MudletMap` stays version-agnostic for consumers. Package description and README updated to match.

# 1.0.3
- **~3.3× faster decode** of maps with labels (Arkadia map: `readBuffer` + `export` ~857 ms → ~261 ms), via two fixes:
  - `readBuffer` ~590 ms → ~90 ms: `QPixMap.read` found each embedded PNG's end by scanning byte-by-byte and hex-stringifying a fresh 4-byte slice at every position (`toHex`) — hundreds of millions of tiny allocations across all labels. Replaced with allocation-free `readUInt32BE()` integer compares against the PNG magic (`0x89504e47`) and `IEND` (`0x49454e44`) markers. Identical behavior, no hot-loop allocations.
  - `export()` ~267 ms → ~175 ms: dropped the defensive `structuredClone` of the whole map model. The export is a read-only pass that builds entirely new output objects, so the deep copy was pure overhead. **Note:** the returned export now shares nested values (`userData`, `doors`, `stubs`, …) by reference with the input model — treat both as read-only after the call (output *values* are unchanged; verified byte-identical).
- No public API change; all 99 tests pass.

# 1.0.2
- drop the `lodash` runtime dependency (and `@types/lodash`), resolving 3 Dependabot advisories (1 high `_.template` code injection, 2 `_.unset`/`_.omit` prototype pollution) that flagged the pinned, deprecated `lodash@4.18.0`. The handful of uses (`cloneDeep`, `map`, `isEmpty`, `find`, `flatMap`) are now native JS (`structuredClone`, `Object.entries`/`Object.values`, `Array` methods, a small local `isEmpty`). No API or output change; all 99 tests pass. The library now has a single runtime dependency (`qtdatastream-web`).

# 1.0.1
- **the library is now fully browser-pure** — no remaining dependency on Node's global `Buffer` on any path (read, export, *and* write). Previously `export()`/`exportJson` and `writeBuffer` threw `ReferenceError: Buffer is not defined` in the browser.
  - label `pixMap` base64 now uses a dependency-free encoder (`src/base64.ts`) instead of `Buffer.from(...).toString('base64')`.
  - the qstream/Mudlet serializers (`toBuffer()` in `qstream-types.ts`, `qstream-containers.ts`, `mudlet-types.ts`) build `Uint8Array`s via `qtdatastream-web/bytes` (`concat` / `fromInt8` / `fromUint16BE`) instead of `Buffer.alloc` / `Buffer.concat` / `Buffer.from`.
  - `writeBuffer` now returns a plain `Uint8Array`. Output is byte-for-byte identical to the previous `Buffer`-based serialization (verified by round-tripping the real 7.8 MB map with `globalThis.Buffer` nulled — same byte length, re-reads identically).

# 1.0.0
First stable release. Contains breaking changes — see below.

- **(breaking)** migrate Qt serialization to the published `qtdatastream-web` package; drop the bundled `qtdatastream.d.ts` typings. The library now ships as ESM only, bundled with `tsdown` and tested with Vitest.
- **(breaking)** version-keyed map model registry: reads dispatch on the map's on-disk format version and writes on `map.version`; an unsupported version now throws a clear error instead of silently mis-parsing. v20 is the supported version, and `MudletMap` remains the canonical, version-agnostic model.

# 0.9.0
- recompute `mAreaExits` on every `writeMap` / `writeMapToBuffer` call so cross-area routing data stays in sync with the room graph. Mirrors Mudlet's `TArea::determineAreaExits`: cardinal exits encode as `[targetId, DIR_*]` with DIR_NORTH=1..DIR_OUT=12, string-named special exits encode as `[targetId, DIR_OTHER=13]`, and dangling or same-area exits are excluded.
- recompute per-area spatial extents (`zLevels`, `min_x`/`max_x`/`min_y`/`max_y`/`min_z`/`max_z`, and the per-Z `xminForZ`/`xmaxForZ`/`yminForZ`/`ymaxForZ` maps) on every `writeMap` / `writeMapToBuffer` call so Mudlet's renderer gets the right bounding box and Z-level list after any editor mutation. Mirrors `TArea::calcSpan` in Mudlet's `src/TArea.cpp`, including two C++ quirks: y is negated when stored on the area (`area.min_y = -room.y`), and the `span` / `pos` `QVector3D` fields are deliberately left untouched because C++ never writes them either. Areas with zero rooms have their per-Z maps and `zLevels` cleared but their min/max preserved, again matching C++.
- recompute `mpRoomDbHashToRoomId` on every `writeMap` / `writeMapToBuffer` call so the room content-hash index stays in sync with the room graph. Mirrors `TRoomDB::hashToRoomID` in Mudlet's C++ source. On load, `room.hash` is populated from the inverse of the on-disk index (the binary format carries hashes only on the map, not per room), so callers can treat `room.hash` as the source of truth. On save, the index is rebuilt from each room's `hash` field: rooms with `undefined` / `''` / `null` are skipped, and colliding hashes log a warning with last-write-wins. `mRoomIdHash` (per-profile player cursor) is deliberately left alone — do not confuse the two.
- callers that were maintaining `mAreaExits`, per-area spatial extents, or `mpRoomDbHashToRoomId` by hand will have their values overwritten — the computed values are now authoritative.

# 0.8.0
- remove `fs` dependency from core modules; file I/O is now the caller's responsibility
- add `readMapFromBuffer` and `writeMapToBuffer` for buffer-based read/write without touching the filesystem
- `readMap` and `writeMap` still accept file paths but no longer bundle `fs` internally
- fix CJS named-export compatibility with Vite 8 / oxc pre-bundler

# 0.7.3
- fix export for Mudlet Map Renderer

# 0.7.2
- add area ID to reader-export room output and preserve it through export

# 0.7.1
- include `mudlet-colors.json` in the published package files

# 0.7.0
- complete TS rewrite. !!! Broken export for Mudlet Map Renderer !!!

# 0.6.0
- json export will not remove pathwalking locks

# 0.5.2
- correct exports (so they will not break backward compatibility)

# 0.5.1
- correct docs picking up

# 0.5.0
- add room hash to reader export

# 0.4.0
- fix errors when pixmap is empty

# 0.2.1
- fix typo in .ts definition

# 0.2.0
- export for reader will export model and colors
- document export function
- package.json - switch "export" to "main"

# 0.1.2
- furhter exporting fixes

# 0.1.1
- fix json export

# 0.1.0
- code reorganization
- reading will now be based directly on qtdatastream user type
- added write method - it is now possible to write Mudlet map into binary from its model
- model map definition

# 0.0.5
- clone map model before doing export to prevent any changes to original model so it can be reused

# 0.0.4
- export map to Mudlet JSON map file

# 0.0.3

- adjust colors generation to adjust for envColors

# 0.0.2

- fix reading `mEnvColors`
- correct colors to match updated values

# 0.0.1

- initial relese