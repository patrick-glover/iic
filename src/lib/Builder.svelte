<script lang="ts">
  import { classify } from './acns/classify';
  import { reportedTerm } from './acns/term';
  import { formatDuration, prevalenceCategory } from './acns/timing';
  import type { Location, PatternType } from './acns/types';
  import { minPrevalencePct, toPattern, type Shape } from './builder';
  import { categoryLabel } from './labels';
  import { settings } from './state.svelte';
  import Trace from './Trace.svelte';
  import Why from './Why.svelte';

  const pattern = $derived(toPattern(settings));
  const result = $derived(classify(pattern));
  const name = $derived(reportedTerm(pattern, result.category));

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

  // The deciding reasons, without the "and not a seizure" check every IIC carries.
  const summary = $derived(
    result.reasons
      .filter((r) => r.ref !== 'iic-not-seizure')
      .map((r) => r.text)
      .join(' '),
  );
  let barHeight = $state(0);

  // One run is already this share of the hour, so prevalence can't go lower.
  function onDurationChange() {
    settings.prevalencePct = Math.max(settings.prevalencePct, minPrevalencePct(settings.durationSec));
  }

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
            <label><input type="radio" bind:group={settings.durationSec} {value} onchange={onDurationChange} /><span>{formatDuration(value)}</span></label>
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
        <input
          type="range"
          min={minPrevalencePct(settings.durationSec)}
          max="100"
          step="1"
          bind:value={settings.prevalencePct}
          aria-label="Prevalence percent"
        />
        <p class="sub">
          Share of the hour the pattern is present.
          {#if minPrevalencePct(settings.durationSec) > 0}At least {minPrevalencePct(settings.durationSec)}%, since one
            {formatDuration(settings.durationSec)} run is already that much.{/if}
        </p>
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

      <Why {result} />
    </div>
  </div>
</div>
