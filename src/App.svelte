<script lang="ts">
  import Builder from './lib/Builder.svelte';
  import Quiz from './lib/Quiz.svelte';

  // The mode lives in the URL hash so a quiz link opens straight into the quiz.
  const fromHash = () => location.hash === '#quiz';
  let quiz = $state(fromHash());

  function setQuiz(on: boolean) {
    quiz = on;
    history.replaceState(null, '', on ? '#quiz' : location.pathname + location.search);
  }
</script>

<svelte:window onhashchange={() => (quiz = fromHash())} />

<main>
  <div class="mode">
    <span class:on={!quiz}>Compose</span>
    <button
      type="button"
      role="switch"
      aria-checked={quiz}
      aria-label="Quiz mode"
      class="switch"
      onclick={() => setQuiz(!quiz)}
    ><span class="knob"></span></button>
    <span class:on={quiz}>Name that pattern</span>
  </div>

  {#if quiz}
    <Quiz />
  {:else}
    <Builder />
  {/if}
</main>

<style>
  .mode {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.25rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .mode .on {
    color: var(--fg);
    font-weight: 600;
  }
  .switch {
    position: relative;
    width: 2.6rem;
    height: 1.45rem;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--line);
    cursor: pointer;
    transition: background 0.15s;
  }
  .switch[aria-checked='true'] {
    background: var(--accent);
  }
  .switch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .knob {
    position: absolute;
    top: 0.15rem;
    left: 0.15rem;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 50%;
    background: var(--panel);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
    transition: transform 0.15s;
  }
  .switch[aria-checked='true'] .knob {
    transform: translateX(1.15rem);
  }
</style>
