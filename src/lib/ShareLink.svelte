<script lang="ts">
  // Copies a quiz link (#quiz/<code>) for the composer and the quiz alike.
  let { code, label }: { code: string; label: string } = $props();

  let status = $state('');
  async function copy() {
    const url = `${location.origin}${location.pathname}#quiz/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      status = 'Link copied';
    } catch {
      status = url;
    }
    setTimeout(() => (status = ''), 2500);
  }
</script>

<div class="share">
  <button type="button" onclick={copy} title="Copy a quiz link to this pattern">{label} <code>{code}</code></button>
  {#if status}<output>{status}</output>{/if}
</div>

<style>
  .share {
    margin-left: auto;
    flex: 0 0 auto;
    display: grid;
    justify-items: end;
    gap: 0.2rem;
  }
  button {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.35rem 0.7rem;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
    white-space: nowrap;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  code {
    color: var(--muted);
    font-size: 0.8rem;
  }
  output {
    max-width: 16rem;
    font-size: 0.75rem;
    color: var(--muted);
    overflow-wrap: anywhere;
    user-select: all;
  }
</style>
