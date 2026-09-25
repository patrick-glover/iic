# IIC Bible — loose spec

Working spec for the one-stop IIC teaching reference. Read `README.md` first
for goal, audience, and sources. This document is deliberately loose: it fixes
the architecture, the principles, and the build order, and leaves module
internals to whoever builds them.

## Principles

1. **Reasoning over lookup.** The classic figure hands residents the answer and
   they memorize positions. Every interactive view should have the resident
   produce something (a term, a placement, a decision) before it reveals.
2. **One pattern object drives every view.** A pattern is a point in modifier
   space that moves over time. All modules read from the same state; changing
   frequency in one place changes it everywhere.
3. **Clean before noisy.** Synthetic EEG is in scope and is the primary
   morphology teacher. Residents need the cleanest possible exemplar of each
   pattern before they can find it in real, noisy signal. Synthetic traces must
   be labeled as schematic. Real de-identified snippets can be added later as
   a "now find it" layer.
4. **Every number has a citation.** Measured values (Rodriguez Ruiz bins,
   2HELPS2B, Witsch thresholds) are shown with confidence intervals and a
   source. Expert models (Johnson & Kaplan) are visually distinguished from
   measured data. Never let the two look the same.
5. **Reference layer is first-class.** The static, citable text is what makes
   this a bible instead of a toy. It ships in phase 1.
6. **Risk is not a treatment decision.** The tool must carry the gap between
   "high seizure association" and "treat now," including the unsettled
   evidence on whether treating IIC patterns improves outcomes.

## Data model

A single `Pattern` state object. Every view is a pure function of it.

```
Pattern {
  location:     G | L | BI | UI | Mf     // ACNS main term 1
  type:         PD | RDA | SW            // ACNS main term 2
  plus:         { F, R, S }              // F: PD/RDA; R: PD only; S: RDA only; none for SW
  segments:     [{ durationSec, frequencyHz, morphology, electrodes[] }]
                                         // the pattern over time; one segment = static
  prevalencePct: number                  // % of epoch; category derived by ACNS cutoffs
  stimulusInduced: bool
  triphasic:    bool                     // PDs and SW only
  record: { sporadicEDs, BIRDs }         // EEG findings elsewhere; 2HELPS2B inputs
  clinical: { priorSeizure, etiology }
}
```

Evolution, fluctuation, duration, and the 10-second average frequency are
computed from `segments`, never stored. Implemented in `src/lib/acns/`
(`classify`, `dynamics`, `term`, `timing`), with tests built on the ACNS
worked examples.

Content (definitions, evidence bins, cases) lives in structured data files
(JSON or YAML) with a `source` field on every numeric value, so attendings can
edit without touching code.

## Layers

### Reference layer (static)

- **ACNS 2021 glossary.** Exact wording for main terms, modifiers,
  electrographic seizure, electroclinical seizure, ESE, IIC criteria, possible
  electroclinical SE, BIRDs, fluctuation, evolution, SIRPIDs, triphasic
  morphology.
- **Evidence table.** One row per claim the tool makes. Columns: claim,
  number, CI, population, source, caveat. Starts with Rodriguez Ruiz 2017,
  Struck 2017/2020 (2HELPS2B and time-dependent risk), Witsch 2017 (tissue
  hypoxia), Struck 2016 (PET), Vespa (microdialysis), Leitinger 2016
  (Salzburg), TELSTAR for the post-anoxic treatment question.
- **Decision text.** How to run and read a benzodiazepine trial, what counts
  as electrographic vs clinical response, escalation logic, when to stop cEEG.
- **Start-here path.** A 20-minute read for the resident starting tomorrow,
  linking into the interactive views.
- **Printable one-pager.** Replaces the screenshot on the reading-room wall.

### Interactive layer (views over the Pattern object)

**1. Pattern builder + synthetic EEG.**
Choose location, type, frequency, prevalence, plus features, fluctuation,
evolution. The ACNS term assembles itself as you go. A synthetic multichannel
trace redraws live. Design intent: the cleanest possible exemplar of each
pattern. Needs a small waveform library (spike, sharp, polyspike, delta wave,
superimposed fast, rhythmic delta) composed per channel according to location.
Fluctuation and evolution must be visibly different on the trace (see below).
Later addition: real de-identified snippets tagged with the same Pattern state.

**2. Definitions map.**
Frequency × duration plane with ACNS 2021 boundaries drawn: electrographic
seizure (PDs/SW >2.5 Hz for ≥10 s, or definite evolution for ≥10 s), the IIC
bands (PDs/SW >1 and ≤2.5 Hz; PDs/SW 0.5–1 Hz with plus or fluctuation;
lateralized RDA >1 Hz with plus or fluctuation, never GRDA), ESE (≥10
continuous min or ≥20% of any 60-min window). Boundaries depend on type and
location, so the map redraws for the current pattern: RDA has no frequency
route to seizure, and GRDA has no IIC band at all. ESE burden is a third input,
not a point on the duration axis. The current Pattern is a dot. Evolution is a
switch that jumps the dot across the seizure boundary regardless of frequency,
which is the point.

**3. Seizure-risk view (the redesigned figure).**
One plane. X axis is frequency, extended past 2.5 Hz into seizure territory so
the IIC band is a stretch of one axis. Y axis is absolute seizure percentage
with the no-pattern baseline drawn, so GRDA visibly sits on it. Each pattern
family is a ribbon of measured bins with CIs, not a curve. Toggles: plus
(shifts up), prevalence (shifts up), stimulus-induced (shifts nothing, if the
data supports that; verify before building). The flat LPD ribbon next to the
rising GPD/LRDA ribbons is the lesson. Predict-then-reveal mode: resident
places the dot, then the bin appears. A 2HELPS2B panel computes from the
Pattern plus clinical fields and shows the time-dependent risk decay from
Struck 2020, answering "can we stop cEEG?"

**4. Harm view.**
Evidence that the pattern itself injures the brain: tissue oxygenation,
perfusion, metabolic demand, with the ~2 Hz threshold from Witsch lined up
against the risk view's axis. Etiology overlay: the same GPDs mean something
different after arrest than in septic encephalopathy. Mortality lives here,
stratified by etiology, labeled as a prognostic marker and not a treatment
target.

**5. Action view.**
Benzo trial: dose, what to watch on EEG, what to watch clinically, what counts
as positive, and what a positive means (possible electroclinical SE per ACNS
2021). Escalation ladder. Tied to the Pattern: the view reads the current
state and says what the decision space is.

**6. Cases.**
Scenarios that play out over time. The Pattern evolves at checkpoints and the
resident chooses treat / trial / watch / extend monitoring / stop. Feedback
compares reasoning step by step to an attending's. Counterfactual prompts:
"what single change would make this a seizure?" Cases are authored as data.
Hold case content until the attending survey comes back.

## Fluctuation vs evolution

Called out because residents conflate them and the distinction decides IIC vs
seizure. Per ACNS 2021: evolution is a sequential, unequivocal change in
frequency, morphology, or location in one direction, with defined step sizes
and minimum cycles; fluctuation is change that does not meet evolution
criteria (three or more changes, no more than one minute apart, not
unidirectional). The tool should show the same trace both ways in the builder,
and the definitions map should make evolution the switch that crosses the
seizure line. Pull the exact ACNS thresholds into the glossary before
implementing the trace logic.

## Build order

- **Phase 1 (usable bible):** reference layer, pattern builder with term
  assembler and synthetic EEG, definitions map, risk view. Ships alone.
- **Phase 2 (judgment):** 2HELPS2B decay panel, harm view, action view.
- **Phase 3 (practice):** cases, counterfactuals, real snippets.

## Technical

Single static site, no backend. Works on the reading-room workstation and on a
phone. Content in structured data files. Synthetic EEG rendered client-side
(canvas or SVG) from the Pattern object. Attending mode strips feedback and
turns each view into a chalk-talk prompt for rounds.

## Verify before building

- Rodriguez Ruiz 2017 bin values and CIs, by pattern, frequency, plus, and
  prevalence. Take them from the paper's tables, not from memory.
- Whether stimulus induction changes seizure association in any dataset.
  If unsupported, drop the "toggle does nothing" device.
- ~~Exact ACNS 2021 wording and thresholds for evolution, fluctuation, BIRDs,
  IIC criteria, and possible electroclinical SE.~~ Done 2026-09-25:
  `src/content/acns-2021.json`, checked verbatim against the paper by test.
  The paper is an NIH author manuscript without an open license, so the
  glossary quotes operative sentences only. Full text lives in `sources/`
  (gitignored).
- Risk-view Y axis: Rodriguez Ruiz reports mostly odds ratios. Confirm absolute
  seizure percentages and a no-pattern baseline exist before committing to an
  absolute axis. PDs have no bins above 2.5 Hz (those are seizures by
  definition), so ribbons stop at the boundary.
- Struck 2020 monitoring-duration recommendations by 2HELPS2B score.
- Witsch 2017 frequency threshold and outcome measures.

## ACNS interpretations (need attending sign-off)

Places where the text leaves room and the code had to pick one reading:

- **Evolution "lasting ≥10 s"** is measured as the whole pattern's duration,
  not only the stretch where the changes happen.
- **Five-minute rule:** only the level *between* two changes must be under
  5 min. A long static run before evolution starts does not block it
  (matches the paper's 3 Hz / 7 min / 1.5 Hz counterexample).
- **Morphology evolution** needs three distinct morphologies in a row
  (A → B → C). A → B → A is fluctuation.
- **Location evolution** means the electrode set strictly grows twice or
  strictly shrinks twice. Any other set change counts toward fluctuation.
- **Frequency steps under 0.5 Hz** are not changes; drift is measured from the
  last counted level.
- **IIC criteria A and B** ("averages ... over 10 seconds") use the densest
  10-second window and require the pattern to last ≥10 s.
- **ESE by burden** treats `prevalencePct` as the share of the worst hour.
- **SW with fluctuation at 0.5–1 Hz** can reach the IIC by criterion B, since
  plus never applies to SW.

## Open

- Attending survey on hardest-to-teach concepts (shapes phase 3 and the
  start-here path). Current guess: plus modifiers, frequency thresholds,
  LPD vs GPD behavior, fluctuation vs evolution, the risk-to-treatment gap.
- Source for real EEG snippets, if any.
