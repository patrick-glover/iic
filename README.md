# IIC — ictal-interictal continuum

## Goal

A teaching tool that helps rotating neurology residents understand the
ictal-interictal continuum (IIC) well enough to reason through it on inpatient
cEEG, not just recite the terms.

## Problem

IIC is at the center of inpatient epilepsy work. Residents meet periodic and
rhythmic patterns (LPDs, GPDs, LRDA, GRDA, BIPDs, BIRDs, and their modifiers)
on every cEEG read, and IIC terms get used constantly on rounds. Understanding
still lags behind the vocabulary. Residents can name a pattern without knowing
what it implies, how its modifiers change that, or how it connects to the
decision in front of them.

The standard teaching figure (`Screenshot 2026-09-25 at 1.26.03 PM.png`,
combining Johnson & Kaplan 2017 and Rodriguez Ruiz et al. 2017) is widely shared
and useful, but it's static. Residents tend to memorize its positions rather
than build an understanding they can apply to a pattern it doesn't show.

The existing figure is a starting point, not a constraint. The conceptualization
is open.

## Audience and bar

- **Who:** neurology residents on inpatient epilepsy / cEEG rotations; attendings
  teaching them.
- **Bar:** covers concepts residents apply daily and that chalk talks struggle to
  convey. Elegant physiology that doesn't change a bedside decision is out of
  scope.
- **Accuracy:** this is a clinical reference. Definitions should match the ACNS
  2021 terminology, and any risk figure should trace to a cited source.

## Sources so far

- Johnson EL, Kaplan PW. *Population of the ictal-interictal zone: the
  significance of periodic and rhythmic activity.* Clin Neurophysiol Pract 2017.
  PMID 30214982 (open access, PMC6123860).
- Rodriguez Ruiz A, et al. *Association of periodic and rhythmic
  electroencephalographic patterns with seizures in critically ill patients.*
  JAMA Neurol 2017. PMID 27992625.
- Hirsch LJ, et al. *ACNS Standardized Critical Care EEG Terminology: 2021
  Version.* J Clin Neurophysiol 2021.

## Open input

Patrick is asking epilepsy attendings which IIC concepts they find hardest to
teach. Their answers should shape the scope.

## Spec

See `SPEC.md` for the architecture, module list, and build order.
