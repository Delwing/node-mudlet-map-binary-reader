# CLAUDE.md

## Project overview

Node.js library for reading and writing Mudlet's binary map files (v20 format). Parses Qt QDataStream-serialized data into typed TypeScript models. Can export maps to JSON or to JS files for Mudlet Map Reader.

## Package manager

**Use `yarn`, not `npm`.** Never use `npm install`, `npm test`, or `npm run`.

- Install dependencies: `yarn`
- Add a dev dependency: `yarn add --dev <package>`
- Run scripts: `yarn <script>`

## Common commands

- `yarn build` — compile TypeScript (`tsc`, outputs to `dist/`)
- `yarn test` — run Jest tests
- `yarn lint` — run ESLint

## Project structure

```
src/
  index.ts              — public API (MudletMapReader namespace)
  types.ts              — exported TypeScript interfaces (MudletMap, MudletRoom, etc.)
  map-operations.ts     — readMap / writeMap (binary read/write via qtdatastream)
  json-export.ts        — export map to JSON
  reader-export.ts      — export map to JS files for Mudlet Map Reader
  models/
    mudlet-models.ts    — QUserType definitions mapping Qt types to Mudlet models
    mudlet-types.ts     — Mudlet-specific type readers/writers
    qstream-types.ts    — low-level Qt QDataStream type readers/writers
    qstream-containers.ts — Qt container (QList, QMap, etc.) readers/writers
  typings/
    qtdatastream.d.ts   — type declarations for the qtdatastream package
test/
  *.test.ts             — Jest tests
  fixtures.ts           — test fixture factory functions
```

## Tech stack

- TypeScript (strict mode, ES2022 target, CommonJS output)
- Jest with ts-jest for testing
- ESLint with typescript-eslint
- `qtdatastream` for Qt binary serialization

## Key conventions

- Tests live in `test/` and match `**/test/**/*.test.ts`
- Test config uses a separate `tsconfig.test.json`
- Published package includes only `dist/` (see `files` in package.json)
- The binary format is Qt QDataStream — types are registered in `src/models/mudlet-models.ts`
