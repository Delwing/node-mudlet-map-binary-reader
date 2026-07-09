import type { buffer } from 'qtdatastream-web';
import type { MudletMap, MudletMapHeader, MudletRoom } from '../types';

type ReadBufferInstance = InstanceType<typeof buffer.ReadBuffer>;

/**
 * A version-specific Mudlet map model: it knows how to deserialize and
 * serialize exactly one on-disk format version. The binary layout changes
 * between versions (fields added/removed, types reshaped), so each supported
 * version registers its own model here rather than sharing one global set of
 * type definitions.
 *
 * `MudletMap` is the library's canonical, version-agnostic model. A model is
 * an adapter: `read` normalizes a version's byte layout *into* `MudletMap`,
 * `write` serializes *out* of it. Consumers always work with `MudletMap` and
 * never branch on version. When adding a version, fill or default anything the
 * format doesn't carry, and keep `MudletMap` a superset every version can be
 * expressed in (version-only fields stay optional on the type — never split
 * into per-version types).
 */
export interface MapModel {
  readonly version: number;
  /** Deserialize a map of this version from a read buffer positioned at the start. */
  read(rb: ReadBufferInstance): MudletMap;
  /** Serialize a map of this version to a binary buffer. */
  write(map: MudletMap): Uint8Array;
  /**
   * Deserialize every top-level field except `rooms`, leaving the buffer
   * positioned at the start of the (unframed) rooms blob. Lets a caller
   * stream rooms one at a time instead of materializing the whole graph.
   */
  readHeader(rb: ReadBufferInstance): MudletMapHeader;
  /** Deserialize a single `[id, room]` pair from the rooms blob. */
  readRoom(rb: ReadBufferInstance): { id: number; room: MudletRoom };
}

const models = new Map<number, MapModel>();

/** Register the model for a format version. A later call for the same version wins. */
export function registerMapModel(model: MapModel): void {
  models.set(model.version, model);
}

/** Look up the model for a format version, or `undefined` if unsupported. */
export function getMapModel(version: number): MapModel | undefined {
  return models.get(version);
}

/** Every format version that currently has a registered model, ascending. */
export function getSupportedVersions(): number[] {
  return [...models.keys()].sort((a, b) => a - b);
}
