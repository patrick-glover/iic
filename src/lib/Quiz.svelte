<script lang="ts">
  import { tick } from 'svelte';
  import { classify } from './acns/classify';
  import type { Dynamic } from './acns/dynamics';
  import { reportedTerm } from './acns/term';
  import type { DurationCategory } from './acns/timing';
  import type { Location, PatternType, Prevalence } from './acns/types';
  import { categoryLabel } from './labels';
  import { blankAnswer, grade, nextCode, patternFromCode, type QuizCategory } from './quiz';
  import { randomSeed } from './seed';
  import { encodeSeed } from './share';
  import ShareLink from './ShareLink.svelte';
  import Trace from './Trace.svelte';
  import Why from './Why.svelte';

  // The pattern comes from a code kept in the URL (#quiz/<code>): a random
  // seed, or a pattern made in the composer. A copied link opens the same
  // pattern, and Next leads everyone to the same one after.
  const codeFromHash = () => {
    const c = location.hash.replace(/^#quiz\/?/, '');
    return patternFromCode(c) ? c : null;
  };
  let code = $state(codeFromHash() ?? encodeSeed(randomSeed()));
  const pattern = $derived(patternFromCode(code)!);
  $effect(() => history.replaceState(null, '', `#quiz/${code}`));

  let answer = $state(blankAnswer());
  let checked = $state(false);
  let tally = $state({ named: 0, seen: 0 });

  const result = $derived(classify(pattern));
  const name = $derived(reportedTerm(pattern, result.category));
  const marks = $derived(checked ? grade(pattern, answer) : []);
  const score = $derived(marks.filter((m) => m.correct).length);
  const summary = $derived(
    result.reasons
      .filter((r) => r.ref !== 'iic-not-seizure')
      .map((r) => r.text)
      .join(' '),
  );
  let barHeight = $state(0);

  const prevalences: Prevalence[] = ['rare', 'occasional', 'frequent', 'abundant', 'continuous'];
  const locations: Location[] = ['G', 'L', 'BI', 'UI', 'Mf'];
  const types: PatternType[] = ['PD', 'RDA', 'SW'];
  const durations: [DurationCategory, string][] = [
    ['very brief', '<10 s'],
    ['brief', '10–59 s'],
    ['intermediate duration', '1–9 min'],
    ['long', '10–59 min'],
    ['very long', '≥1 h'],
  ];
  const dynamics: Dynamic[] = ['static', 'fluctuating', 'evolving'];
  const categories: QuizCategory[] = ['ESz', 'ESE', 'IIC', 'RPP'];

  async function check() {
    checked = true;
    tally.seen++;
    if (grade(pattern, answer).every((m) => m.correct)) tally.named++;
    // The scorecard sits at the top; the Check button is at the bottom of the form.
    await tick();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function load(c: string) {
    code = c;
    answer = blankAnswer();
    checked = false;
  }

  const next = () => load(nextCode(code));

  // A quiz link pasted into this tab.
  function onHashChange() {
    const c = codeFromHash();
    if (c === null) history.replaceState(null, '', `#quiz/${code}`);
    else if (c !== code) load(c);
  }

  // Drop plus subtypes and modifiers the chosen type can't have, as the builder does.
  function onTypeChange() {
    const t = answer.type;
    if (t === 'SW') answer.plus.F = false;
    if (t !== 'PD') answer.plus.R = false;
    if (t !== 'RDA') answer.plus.S = false;
    if (t === 'RDA') answer.triphasic = false;
  }
</script>

<svelte:window onhashchange={onHashChange} />

<div class="page" style:--bar-height="{barHeight}px">
  <section class="bar" aria-live="polite" bind:clientHeight={barHeight}>
    {#if checked}
      <p class="badge {result.category}">{categoryLabel[result.category]}</p>
      <div class="bar-text">
        <p class="kicker">Official ACNS 2021 name · you got {score} of {marks.length}</p>
        <h2>{name}</h2>
        <p class="why">{summary}</p>
      </div>
    {:else}
      <p class="badge">?</p>
      <div class="bar-text">
        <p class="kicker">Name that pattern{#if tally.seen}&nbsp;· {tally.named} of {tally.seen} named fully{/if}</p>
        <h2>What is this, by ACNS 2021?</h2>
        <p class="why">Page through the run and read the hour strip, then name every part and classify it.</p>
      </div>
    {/if}
    <ShareLink {code} label="Share" />
  </section>

  {#if checked}
    <section class="score" aria-label="Your answer against the ACNS answer">
      <p class="key"><span>Your answer</span><span>ACNS 2021</span></p>
      <ol>
        {#each marks as m}
          <li class:ok={m.correct}>
            <span class="term">{m.label}</span>
            <span class="given">{m.given}</span>
            <span class="truth">{m.truth}</span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  <div class="builder">
    <form
      class="controls"
      onsubmit={(e) => {
        e.preventDefault();
        if (checked) next();
        else check();
      }}
    >
      <fieldset disabled={checked}>
        <legend>Prevalence</legend>
        <div class="seg">
          {#each prevalences as value}
            <label><input type="radio" bind:group={answer.prevalence} {value} /><span>{value}</span></label>
          {/each}
        </div>
      </fieldset>

      <fieldset disabled={checked}>
        <legend>Location</legend>
        <div class="seg">
          {#each locations as value}
            <label><input type="radio" bind:group={answer.location} {value} /><span>{value}</span></label>
          {/each}
        </div>
      </fieldset>

      <fieldset disabled={checked}>
        <legend>Type</legend>
        <div class="seg">
          {#each types as value}
            <label>
              <input type="radio" bind:group={answer.type} {value} onchange={onTypeChange} /><span>{value === 'PD' ? 'PDs' : value}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset disabled={checked}>
        <legend>Plus</legend>
        <div class="checks">
          <label class:off={answer.type === 'SW'}>
            <input type="checkbox" bind:checked={answer.plus.F} disabled={answer.type === 'SW'} /> +F <span class="hint">fast activity</span>
          </label>
          <label class:off={answer.type !== null && answer.type !== 'PD'}>
            <input type="checkbox" bind:checked={answer.plus.R} disabled={answer.type !== null && answer.type !== 'PD'} /> +R
            <span class="hint">rhythmic delta</span>
          </label>
          <label class:off={answer.type !== null && answer.type !== 'RDA'}>
            <input type="checkbox" bind:checked={answer.plus.S} disabled={answer.type !== null && answer.type !== 'RDA'} /> +S
            <span class="hint">sharp waves or spikes</span>
          </label>
        </div>
      </fieldset>

      <fieldset disabled={checked}>
        <legend>Frequency <output>{answer.frequencyHz} Hz</output></legend>
        <input type="range" min="0.25" max="4" step="0.25" bind:value={answer.frequencyHz} aria-label="Frequency in Hz" />
        <p class="sub">If it changes, any frequency it reaches counts.</p>
      </fieldset>

      <fieldset disabled={checked}>
        <legend>Duration <span class="hint">of one run</span></legend>
        <div class="seg">
          {#each durations as [value, label]}
            <label title={value}><input type="radio" bind:group={answer.duration} {value} /><span>{label}</span></label>
          {/each}
        </div>
      </fieldset>

      <fieldset disabled={checked}>
        <legend>Over time</legend>
        <div class="seg">
          {#each dynamics as value}
            <label><input type="radio" bind:group={answer.dynamic} {value} /><span>{value}</span></label>
          {/each}
        </div>
      </fieldset>

      <fieldset disabled={checked}>
        <legend>Other modifiers</legend>
        <div class="checks">
          <label class:off={answer.type === 'RDA'}>
            <input type="checkbox" bind:checked={answer.triphasic} disabled={answer.type === 'RDA'} /> Triphasic morphology
          </label>
        </div>
      </fieldset>

      <fieldset disabled={checked}>
        <legend>Classification</legend>
        <div class="seg">
          {#each categories as value}
            <label><input type="radio" bind:group={answer.category} {value} /><span>{categoryLabel[value]}</span></label>
          {/each}
        </div>
      </fieldset>

      <button type="submit" class="primary">{checked ? 'Next pattern' : 'Check'}</button>
    </form>

    <div class="output">
      {#key code}
        <Trace {pattern} blind={!checked} />
      {/key}

      {#if checked}
        <Why {result} />
      {/if}
    </div>
  </div>
</div>

<style>
  /* Single column: the EEG comes before the answer form. */
  @media (max-width: 859px) {
    .output {
      order: -1;
    }
  }
  .primary {
    font: inherit;
    font-weight: 600;
    width: 100%;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--fg);
    background: var(--fg);
    color: var(--bg);
    cursor: pointer;
  }
  .primary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  fieldset:disabled {
    opacity: 0.8;
  }
  .score {
    margin: -0.5rem 0 1.5rem;
  }
  .key {
    display: flex;
    gap: 1rem;
    margin: 0 0 0.4rem;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .key span:first-child::before {
    content: '↑ ';
  }
  .key span:last-child::before {
    content: '↓ ';
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
    grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  }
  li {
    display: grid;
    gap: 0.1rem;
    padding: 0.45rem 0.6rem 0.5rem;
    border-radius: 8px;
    background: var(--tint-wrong);
    color: var(--on-wrong);
  }
  li.ok {
    background: var(--tint-right);
    color: var(--on-right);
  }
  .term {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.75;
  }
  .given {
    font-size: 0.9rem;
  }
  li:not(.ok) .given {
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }
  .truth {
    font-size: 0.95rem;
    font-weight: 700;
    padding-top: 0.15rem;
    border-top: 1px solid currentColor;
    border-top-color: color-mix(in srgb, currentColor 25%, transparent);
  }
</style>
