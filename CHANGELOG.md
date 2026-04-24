# 0.11.0
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