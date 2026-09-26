<script lang="ts">
  import glossary from '../content/acns-2021.json';
  import type { Classification } from './acns/classify';

  let { result }: { result: Classification } = $props();

  const entry = (id: string) => glossary.entries.find((e) => e.id === id);
</script>

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

<style>
  .result {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1.25rem 1.5rem 1.5rem;
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
