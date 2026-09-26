import type { Category } from './acns/classify';

export const categoryLabel: Record<Category, string> = {
  ESE: 'Status epilepticus',
  ESz: 'Seizure',
  IIC: 'IIC',
  RPP: 'Not IIC',
  'not-rpp': 'Not rhythmic or periodic',
  'birds-range': 'Possible BIRDs',
};
