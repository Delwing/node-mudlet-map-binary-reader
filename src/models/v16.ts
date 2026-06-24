import { registerLegacyMapModel } from './legacy';

// Mudlet map format, version 16 (read-only). See legacy.ts for the per-version
// layout deltas relative to v20.
registerLegacyMapModel(16);
