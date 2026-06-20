import { QUserType } from 'qtdatastream-web/types';

// Importing a version module registers its types and its MapModel as a side
// effect. Add new versions here.
import './v20';

export { getMapModel, getSupportedVersions, registerMapModel } from './model-registry';
export type { MapModel } from './model-registry';
export { QUserType };
