import { qtype, Types as BaseTypes } from 'qtdatastream-web/types';
import { QColor, QPoint, QFont, QPixMap, QVector } from './qstream-types';

/**
 * Qt type IDs used across every map version. These are standard Qt
 * QMetaType ids (QPoint, QFont, QColor, …) and don't change between Mudlet
 * map versions, so they're registered once and shared by all version models.
 */
export const Types: Record<string, number> = {
  ...BaseTypes,
  POINT: 25,
  FONT: 64,
  PIXMAP: 65,
  COLOR: 67,
  VECTOR: 84,
};

let registered = false;

/** Register the version-independent Qt types. Idempotent. */
export function registerBaseTypes(): void {
  if (registered) return;
  registered = true;
  qtype(Types.POINT)(QPoint);
  qtype(Types.FONT)(QFont);
  qtype(Types.PIXMAP)(QPixMap);
  qtype(Types.COLOR)(QColor);
  qtype(Types.VECTOR)(QVector);
}
