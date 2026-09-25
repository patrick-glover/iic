// The single pattern state every view reads from (SPEC principle 2).
// Views derive the Pattern with toPattern(settings).

import { defaultSettings, type BuilderSettings } from './builder';

export const settings: BuilderSettings = $state(structuredClone(defaultSettings));
