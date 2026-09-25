<script lang="ts">
  import glossary from '../content/acns-2021.json';
  import { classify, type Category } from './acns/classify';
  import { reportedTerm } from './acns/term';
  import { formatDuration, prevalenceCategory } from './acns/timing';
  import type { Location, PatternType } from './acns/types';
  import { toPattern, type Shape } from './builder';
  import { settings } from './state.svelte';
  import Trace from './Trace.svelte';

  const pattern = $derived(toPattern(settings));
  const result = $derived(classify(pattern));
  const name = $derived(reportedTerm(pattern, result.category));
  const entry = (id: string) => glossary.entries.find((e) => e.id === id);

  const locations: [Location, string][] = [
    ['G', 'Generalized'],
    ['L', 'Lateralized'],
    ['BI', 'Bilateral independent'],
    ['UI', 'Unilateral independent'],
    ['Mf', 'Multifocal'],
  ];
  const types: [PatternType, string][] = [
    ['PD', 'Periodic discharges'],
    ['RDA', 'Rhythmic delta'],
    ['SW', 'Spike-and-wave'],
  ];
  const shapes: Shape[] = ['static', 'fluctuating', 'evolving'];
  const durations = [8, 15, 60, 300, 900, 3600];

  const categoryLabel: Record<Category, string> = {
    ESE: 'Status epilepticus',
    ESz: 'Seizure',
    IIC: 'IIC',
    RPP: 'Not IIC',
    'not-rpp': 'Not rhythmic or periodic',
    'birds-range': 'Possible BIRDs',
  };

  // The deciding reasons, without the "and not a seizure" check every IIC carries.
  const summary = $derived(
    result.reasons
      .filter((r) => r.ref !== 'iic-not-seizure')
      .map((r) => r.text)
      .join(' '),
  );
  let barHeight = $state(0);

  // Keep the settings valid for the chosen type: drop plus subtypes and
  // modifiers that don't apply, and hold RDA inside 0.5–4 Hz.
  function onTypeChange() {
    const t = settings.type;
    if (t === 'SW') settings.plus.F = false;
    if (t !== 'PD') settings.plus.R = false;
    if (t !== 'RDA') settings.plus.S = false;
    if (t === 'RDA') {
      settings.triphasic = false;
      settings.frequencyHz = Math.max(settings.frequencyHz, 0.5);
    }
  }
</script>

<div class="page" style:--bar-height="{barHeight}px">
  <section class="bar" aria-live="polite" bind:clientHeight={barHeight}>
    <p class="badge {result.category}">{categoryLabel[result.category]}</p>
    <div class="bar-text">
      <p class="kicker">Official ACNS 2021 name</p>
      <h2>{name}</h2>
      <p class="why">{summary}</p>
    </div>
  </section>

  <div class="builder">
    <form class="controls" onsubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>Location <span class="hint">main term 1</span></legend>
        <div class="seg">
          {#each locations as [value, label]}
            <label title={label}><input type="radio" bind:group={settings.location} {value} /><span>{value}</span></label>
          {/each}
        </div>
        <p class="sub">{locations.find(([v]) => v === settings.location)?.[1]}</p>
      </fieldset>

      <fieldset>
        <legend>Type <span class="hint">main term 2</span></legend>
        <div class="seg">
          {#each types as [value, label]}
            <label title={label}>
              <input type="radio" bind:group={settings.type} {value} onchange={onTypeChange} /><span>{value === 'PD' ? 'PDs' : value}</span>
            </label>
          {/each}
        </div>
        <p class="sub">{types.find(([v]) => v === settings.type)?.[1]}</p>
      </fieldset>

      <fieldset>
        <legend>Frequency <output>{settings.frequencyHz} Hz</output></legend>
        <input
          type="range"
          min={settings.type === 'RDA' ? 0.5 : 0.25}
          max="4"
          step="0.25"
          bind:value={settings.frequencyHz}
          aria-label="Frequency in Hz"
        />
        {#if settings.shape === 'evolving'}<p class="sub">Starting frequency; evolution steps 0.5 Hz twice.</p>{/if}
        {#if settings.shape === 'fluctuating'}<p class="sub">Alternates with a frequency 0.5 Hz away.</p>{/if}
      </fieldset>

      <fieldset>
        <legend>Duration</legend>
        <div class="seg">
          {#each durations as value}
            <label><input type="radio" bind:group={settings.durationSec} {value} /><span>{formatDuration(value)}</span></label>
          {/each}
        </div>
      </fieldset>

      <fieldset>
        <legend>Over time</legend>
        <div class="seg">
          {#each shapes as value}
            <label><input type="radio" bind:group={settings.shape} {value} /><span>{value}</span></label>
          {/each}
        </div>
      </fieldset>

      <fieldset>
        <legend>Plus <span class="hint">more ictal-appearing</span></legend>
        <div class="checks">
          <label class:off={settings.type === 'SW'}>
            <input type="checkbox" bind:checked={settings.plus.F} disabled={settings.type === 'SW'} />
            +F <span class="hint">fast activity · PDs, RDA</span>
          </label>
          <label class:off={settings.type !== 'PD'}>
            <input type="checkbox" bind:checked={settings.plus.R} disabled={settings.type !== 'PD'} />
            +R <span class="hint">rhythmic delta · PDs only</span>
          </label>
          <label class:off={settings.type !== 'RDA'}>
            <input type="checkbox" bind:checked={settings.plus.S} disabled={settings.type !== 'RDA'} />
            +S <span class="hint">sharp waves or spikes · RDA only</span>
          </label>
        </div>
        {#if settings.type === 'SW'}<p class="sub">Plus modifiers do not apply to SW.</p>{/if}
      </fieldset>

      <fieldset>
        <legend>Prevalence <output>{settings.prevalencePct}% · {prevalenceCategory(settings.prevalencePct)}</output></legend>
        <input type="range" min="0" max="100" step="1" bind:value={settings.prevalencePct} aria-label="Prevalence percent" />
        <p class="sub">Share of the hour the pattern is present.</p>
      </fieldset>

      <fieldset>
        <legend>Other modifiers</legend>
        <div class="checks">
          <label><input type="checkbox" bind:checked={settings.stimulusInduced} /> Stimulus-induced (SI-)</label>
          <label class:off={settings.type === 'RDA'}>
            <input type="checkbox" bind:checked={settings.triphasic} disabled={settings.type === 'RDA'} />
            Triphasic morphology <span class="hint">PDs, SW</span>
          </label>
        </div>
      </fieldset>
    </form>

    <div class="output">
      <Trace {pattern} />

      <section class="result">
        <h3>Why, by ACNS 2021</h3>
        <ul class="reasons">
          {#each result.reasons as r}
            {@const e = entry(r.ref)}
            <li>
              <p>{r.text}</p>
              {#if e}
                <figure>
                  <blockquote>{e.quote}</blockquote>
                  <figcaption>ACNS 2021 §{e.section}: {e.term}</figcaption>
                </figure>
              {/if}
            </li>
          {/each}
        </ul>

        {#if result.possibleECSEIfTrialPositive}
          {@const e = entry('possible-ecse')}
          <aside>
            <p>
              <strong>Long enough to matter for a treatment trial.</strong> If an IV antiseizure medication improves the EEG but
              not the patient, this becomes possible electroclinical status epilepticus.
            </p>
            {#if e}
              <figure>
                <blockquote>{e.quote}</blockquote>
                <figcaption>ACNS 2021 §{e.section}: {e.term}</figcaption>
              </figure>
            {/if}
          </aside>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    gap: 1rem;
    align-items: center;
    margin: 0 0 1.5rem;
    padding: 0.75rem 0;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }
  .bar-text {
    min-width: 0;
  }
  .bar h2 {
    margin: 0.1rem 0 0.15rem;
  }
  .why {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .builder {
    display: grid;
    gap: 2rem;
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 860px) {
    .builder {
      grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
    }
    .output {
      position: sticky;
      top: calc(var(--bar-height) + 1rem);
      align-self: start;
      max-height: calc(100vh - var(--bar-height) - 4rem);
      overflow-y: auto;
    }
  }

  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 1.25rem;
  }
  legend {
    font-weight: 600;
    margin-bottom: 0.4rem;
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    width: 100%;
  }
  legend output {
    margin-left: auto;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .hint {
    color: var(--muted);
    font-weight: 400;
    font-size: 0.85em;
  }
  .sub {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0.35rem 0 0;
  }

  .seg {
    display: flex;
    flex-wrap: wrap;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg label {
    flex: 1 1 auto;
    text-align: center;
  }
  .seg input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .seg span {
    display: block;
    padding: 0.45rem 0.6rem;
    cursor: pointer;
    font-size: 0.9rem;
    border-left: 1px solid var(--line);
  }
  .seg label:first-child span {
    border-left: 0;
  }
  .seg input:checked + span {
    background: var(--fg);
    color: var(--bg);
  }
  .seg input:focus-visible + span {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .checks {
    display: grid;
    gap: 0.35rem;
  }
  .checks label {
    cursor: pointer;
  }
  .checks .off {
    opacity: 0.45;
    cursor: default;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--fg);
  }

  .output {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .result {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1.25rem 1.5rem 1.5rem;
  }
  .kicker {
    color: var(--muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }
  h2 {
    font-size: 1.4rem;
    line-height: 1.3;
    margin: 0.3rem 0 0.75rem;
  }
  .badge {
    flex: 0 0 auto;
    padding: 0.55rem 1rem;
    border-radius: 8px;
    font-weight: 700;
    font-size: 1.05rem;
    white-space: nowrap;
    margin: 0;
    background: var(--tint-none);
  }
  .badge.ESz,
  .badge.ESE {
    background: var(--tint-seizure);
    color: var(--on-seizure);
  }
  .badge.IIC {
    background: var(--tint-iic);
    color: var(--on-iic);
  }
  h3 {
    font-size: 0.95rem;
    margin: 0 0 0.5rem;
  }
  .reasons {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.75rem;
  }
  .reasons p {
    margin: 0;
  }
  figure {
    margin: 0.35rem 0 0;
    padding-left: 0.75rem;
    border-left: 3px solid var(--line);
    font-size: 0.85rem;
  }
  blockquote {
    margin: 0;
  }
  figcaption {
    color: var(--muted);
    margin-top: 0.15rem;
  }
  aside {
    margin-top: 1.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    background: var(--tint-iic);
    color: var(--on-iic);
  }
  aside p {
    margin: 0;
  }
</style>
