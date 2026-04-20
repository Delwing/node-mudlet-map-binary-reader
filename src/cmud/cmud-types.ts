/**
 * Native cMUD map model.
 *
 * Mirrors cMUD's `.dbm` (SQLite) schema concepts as-is: percentage-based
 * direction vectors, paired-row exits, zones with their own scale, arbitrary
 * user-defined directions. No Mudlet-specific fields leak in here — this
 * module is self-contained so it can be extracted into its own package.
 */

/** Top-level cMUD map: zones, rooms, and the paired-row exit table. */
export interface CmudMap {
  zones: Record<number, CmudZone>;
  rooms: Record<number, CmudRoom>;
  exits: CmudExit[];
  directions: Record<number, CmudDirection>;
  notes: CmudNote[];
  styles: Record<number, CmudStyle>;
  labels: CmudLabel[];
  /** Columns seen in the source tables that we didn't map — for diagnostics. */
  unknownColumns: Record<string, string[]>;
}

/** A cMUD zone. `defSize`/`defSizeY` scale direction percentage vectors. */
export interface CmudZone {
  id: number;
  name: string;
  defSize: number;
  defSizeY: number;
}

/** A cMUD room. Coordinates are in zone-scale units (may be fractional). */
export interface CmudRoom {
  id: number;
  zoneId: number;
  name: string;
  description: string;
  x: number;
  y: number;
  z: number;
  styleId?: number;
  kindId?: number;
  flags: number;
  /**
   * Per-room color override in cMUD's BGR integer format (`0x00BBGGRR`).
   * When absent, cMUD falls back to the style/kind palette. `0x1FFFFFFF`
   * (536870911) is cMUD's sentinel for "no color — inherit".
   */
  color?: number;
}

/**
 * A single paired-row exit. In cMUD each logical link is two rows (one per
 * direction); `exitIdTo` points at the partner row.
 *
 * Unexplored exits: `exitIdTo === -1`, `toId === fromId`, `dirToType` names
 * the "None" direction.
 */
export interface CmudExit {
  exitId: number;
  exitIdTo: number;
  fromId: number;
  toId: number;
  dirType: number;
  dirToType: number;
  exitKindId?: number;
  /**
   * Optional exit label — cMUD uses `ExitTbl.Name` to store special-exit names
   * ("enter cave", "climb rope") when `DirType` is 0 (no canonical direction).
   */
  name?: string;
  /**
   * `ExitTbl.Flags` bitfield. Bit 0 (`1`) is typically "tested/verified".
   * Bit 1 (`2`) marks the exit as "render as a short stub, don't draw the
   * connecting line" — used when the target room is positioned too far away
   * to draw cleanly, or the user wants the pair visually disconnected.
   */
  flags?: number;
}

/** A direction entry from DirTbl. `dx`/`dy`/`dz` are percentages of zone scale. */
export interface CmudDirection {
  id: number;
  name: string;
  dx: number;
  dy: number;
  dz: number;
  revId: number;
}

/** A note attached to a room. Adapter folds these into Mudlet userData. */
export interface CmudNote {
  objectId: number;
  category: string;
  text: string;
}

/**
 * A free-floating text label placed on the map (cMUD's `DrawTbl`).
 *
 * Positioned in the zone's native coord system. `dx`/`dy` are an optional
 * explicit render size; when both are 0 cMUD auto-sizes to the text.
 */
export interface CmudLabel {
  id: number;
  zoneId: number;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  text: string;
  hint?: string;
  styleId?: number;
  flags: number;
}

/** A style entry. Colors are 0-255 RGB. */
export interface CmudStyle {
  id: number;
  fg?: { r: number; g: number; b: number };
  bg?: { r: number; g: number; b: number };
  font?: string;
}
