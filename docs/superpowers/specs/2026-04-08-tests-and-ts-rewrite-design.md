# Test Suite Design (pre-TypeScript rewrite)

**Date:** 2026-04-08  
**Scope:** Add a Jest test suite that covers the current JS codebase and will survive a TypeScript rewrite with no test changes.

---

## Goals

- Cover the public API (`MudletMapReader.read`, `.write`, `.export`, `.exportJson`) with behavioral tests
- Tests must work before and after the TypeScript rewrite — no test should reference internal implementation details or file paths inside modules
- No real Mudlet binary files required — all test data is constructed in-memory

---

## Approach: Layered tests

**Round-trip tests** for `read`/`write` (binary layer), plus **unit tests** for `export` and `exportJson` (pure transformation layer).

---

## Infrastructure

- **Test framework:** Jest + `ts-jest` (installed as dev dependencies)
  - `ts-jest` means tests run as-is in JS now, and natively in TS after the rewrite without changing test files
- **Test directory:** `test/`
- **Fixtures:** `test/fixtures.js` (later `fixtures.ts`) exports factory functions returning minimal valid `MudletMap` objects:
  - `makeMinimalMap()` — smallest valid map (1 area, 1 room)
  - `makeRoomWithSpecialExits()` — room with `mSpecialExits` and `mSpecialExitLocks`
  - `makeRoomWithCustomLines()` — room with `customLines`, `customLinesArrow`, `customLinesColor`, `customLinesStyle`
- **Config:** `jest.config.js` at root, configured for `.js` and (later) `.ts`
- **Temp files:** `os.tmpdir()` for round-trip write/read, cleaned up in `afterEach`

---

## Round-trip tests (`test/map-operations.test.js`)

Tests call `MudletMapReader.write` then `MudletMapReader.read` through a temp file.

| Test | What it validates |
|------|-------------------|
| Basic round-trip | `makeMinimalMap()` survives write → read with deep equality |
| Special exits round-trip | `mSpecialExits` and `mSpecialExitLocks` survive write → read correctly (targets `map-operations.js:22–39`) |
| Multi-area/multi-room round-trip | 2 areas, several rooms each — room-to-area assignments preserved |

---

## Export unit tests

### `test/reader-export.test.js`

Input: constructed `MudletMap` object. `fs` is mocked where directory output is tested.

| Test | What it validates |
|------|-------------------|
| Room conversion | Standard exits, special exits, custom lines → correct output shape |
| Omitted exits | Exits set to `-1` are excluded from `exits` object |
| Color generation | ANSI + custom env colors produce correct entries |
| Directory output | `fs.writeFileSync` called with correct filenames when `directory` provided |

### `test/json-export.test.js`

Input: constructed `MudletMap` object. `fs` is mocked for file write assertions.

| Test | What it validates |
|------|-------------------|
| Room exits | Standard + special exits converted correctly; weights/locks/doors omitted when default |
| Stub exits | Stubs converted with correct direction names |
| Custom lines | Coordinates, style, arrow, color all converted correctly |
| Map-level fields | `areaCount`, `roomCount`, font string, env colors present and correct |
| File write | `fs.writeFileSync` called with correct path and JSON content |

---

## TypeScript rewrite compatibility

- Fixture factories return plain objects — no dependency on JS module internals
- All tests call through the public API (`MudletMapReader.*`) or accept plain objects as input
- When rewritten in TS, only the fixture file needs updating to use TS types — test logic stays identical
- `ts-jest` handles compilation, so no separate build step is needed to run tests

---

## Out of scope

- Testing `qtdatastream` internals
- Testing binary format compatibility against real Mudlet `.dat` files (no fixtures available)
- The TypeScript rewrite itself (separate plan)
