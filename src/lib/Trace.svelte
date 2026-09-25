<script lang="ts">
  import type { Pattern } from './acns/types';
  import { formatDuration } from './acns/timing';
  import { LEAD_SEC, recordDuration, segmentMarks, synthesize } from './eeg/synth';

  let { pattern }: { pattern: Pattern } = $props();

  const pageLengths = [10, 20, 30];
  let pageSec = $state(20);
  let requestedStart = $state(0);

  const total = $derived(recordDuration(pattern));
  const maxStart = $derived(Math.max(0, total - pageSec));
  const start = $derived(Math.min(requestedStart, maxStart));
  const end = $derived(Math.min(start + pageSec, total));
  const trace = $derived(synthesize(pattern, start, end));
  const marks = $derived(segmentMarks(pattern));
  const onset = LEAD_SEC;
  const offset = $derived(total - LEAD_SEC);

  // Layout, in pixels. Rows are grouped by chain with a gap between chains.
  const ROW = 26;
  const CHAIN_GAP = 8;
  const GAIN = 12;
  const PAD = 10;
  const rowY = $derived(
    trace.channels.map((c, i) => {
      let gaps = 0;
      for (let j = 1; j <= i; j++) if (trace.channels[j].chain !== trace.channels[j - 1].chain) gaps++;
      return PAD + i * ROW + gaps * CHAIN_GAP + ROW / 2;
    }),
  );
  const height = $derived(rowY[rowY.length - 1] + ROW / 2 + PAD);

  // Horizontal units are 100 per second; the SVG stretches to the column width.
  const X = 100;
  const width = $derived(pageSec * X);
  const xOf = (t: number) => (t - start) * X;
  const pct = (t: number) => `${((t - start) / pageSec) * 100}%`;
  const inView = (t: number) => t >= start && t <= end;

  const paths = $derived(
    trace.channels.map((c, i) => {
      const y0 = rowY[i];
      const step = X / trace.fs;
      let d = '';
      for (let k = 0; k < c.samples.length; k++) {
        d += `${k ? 'L' : 'M'}${(k * step).toFixed(1)} ${(y0 - c.samples[k] * GAIN).toFixed(1)}`;
      }
      return d;
    }),
  );

  const seconds = $derived(Array.from({ length: Math.floor(end) - Math.ceil(start) + 1 }, (_, i) => Math.ceil(start) + i));

  // Minimap: frequency over the whole record, with the current page boxed.
  const MAP_H = 64;
  const MAP_MAX_HZ = 4.5;
  const mapY = (hz: number) => MAP_H - 6 - (hz / MAP_MAX_HZ) * (MAP_H - 12);
  const mapX = (t: number) => (t / total) * 1000;
  const mapPath = $derived.by(() => {
    let t = LEAD_SEC;
    let d = '';
    for (const s of pattern.segments) {
      const y = mapY(s.frequencyHz).toFixed(1);
      d += `${d ? 'L' : 'M'}${mapX(t).toFixed(2)} ${y}L${mapX(t + s.durationSec).toFixed(2)} ${y}`;
      t += s.durationSec;
    }
    return d;
  });

  function jumpTo(e: MouseEvent) {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = ((e.clientX - box.left) / box.width) * total;
    requestedStart = Math.max(0, Math.min(maxStart, t - pageSec / 2));
  }
  const step = (dir: number) => (requestedStart = Math.max(0, Math.min(maxStart, start + dir * pageSec)));

  /** Clock time from pattern onset; the lead-in reads as negative. */
  const clock = (t: number) => {
    const s = Math.round(t - onset);
    const sign = s < 0 ? '−' : '';
    const a = Math.abs(s);
    return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
  };

  const summary = $derived(
    `Schematic longitudinal bipolar EEG, ${clock(start)} to ${clock(end)} from pattern onset. ` +
      marks.map((m) => `${m.frequencyHz} Hz from ${clock(m.t)}`).join(', ') +
      '.',
  );
</script>

<section class="trace">
  <header>
    <div>
      <p class="kicker">Synthetic EEG</p>
      <p class="montage">Longitudinal bipolar · <span class="schematic">schematic, not recorded</span></p>
    </div>
    <div class="nav">
      <div class="seg" role="radiogroup" aria-label="Page length">
        {#each pageLengths as value}
          <label><input type="radio" bind:group={pageSec} {value} /><span>{value} s</span></label>
        {/each}
      </div>
      <button type="button" onclick={() => step(-1)} disabled={start <= 0} aria-label="Previous page">◀</button>
      <output>{clock(start)} – {clock(end)}</output>
      <button type="button" onclick={() => step(1)} disabled={start >= maxStart} aria-label="Next page">▶</button>
    </div>
  </header>

  <div class="plot">
    <div class="labels" style:height="{height}px">
      {#each trace.channels as c, i}
        <span style:top="{rowY[i]}px">{c.label}</span>
      {/each}
    </div>
    <div class="canvas">
      <svg viewBox="0 0 {width} {height}" preserveAspectRatio="none" style:height="{height}px" role="img" aria-label={summary}>
        {#each seconds as s}
          <line class="grid" x1={xOf(s)} x2={xOf(s)} y1="0" y2={height} />
        {/each}
        {#if start < onset}
          <rect class="lead" x="0" y="0" width={xOf(onset)} {height} />
        {/if}
        {#if end > offset}
          <rect class="lead" x={xOf(offset)} y="0" width={xOf(end) - xOf(offset)} {height} />
        {/if}
        {#each marks as m, i}
          {#if i > 0 && inView(m.t)}
            <line class="change" x1={xOf(m.t)} x2={xOf(m.t)} y1="0" y2={height} />
          {/if}
        {/each}
        {#each paths as d}
          <path {d} />
        {/each}
      </svg>
      <div class="overlay">
        {#if inView(onset)}
          <span class="tag" style:left={pct(onset)}><span class="edge">onset</span> {marks[0]?.frequencyHz} Hz</span>
        {/if}
        {#if inView(offset)}<span class="tag edge" style:left={pct(offset)}>end</span>{/if}
        {#each marks as m, i}
          {#if i > 0 && inView(m.t)}
            <span class="tag" style:left={pct(m.t)}>{m.frequencyHz} Hz</span>
          {/if}
        {/each}
        {#if marks.length && !inView(onset) && start > onset && start < offset}
          <span class="tag" style:left="0">{[...marks].reverse().find((m) => m.t <= start)?.frequencyHz} Hz</span>
        {/if}
      </div>
    </div>
  </div>
  <p class="foot">Gridlines 1 s. Shaded: background before and after the pattern. Voltages are relative, not to scale.</p>

  <div class="map">
    <p class="kicker">Frequency over the whole pattern · {formatDuration(total - 2 * LEAD_SEC)}</p>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="map-box" onclick={jumpTo} role="presentation">
      <svg viewBox="0 0 1000 {MAP_H}" preserveAspectRatio="none" style:height="{MAP_H}px" aria-hidden="true">
        <line class="thresh" x1="0" x2="1000" y1={mapY(1)} y2={mapY(1)} />
        <line class="thresh" x1="0" x2="1000" y1={mapY(2.5)} y2={mapY(2.5)} />
        <rect class="window" x={mapX(start)} y="1" width={Math.max(2, mapX(end) - mapX(start))} height={MAP_H - 2} />
        <path d={mapPath} />
      </svg>
      <span class="axis" style:top="{mapY(2.5)}px">2.5 Hz</span>
      <span class="axis" style:top="{mapY(1)}px">1 Hz</span>
    </div>
    <p class="foot">Click to jump. Lines mark the ACNS 1 Hz and 2.5 Hz frequency cutoffs.</p>
  </div>
</section>

<style>
  .trace {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1rem 1.25rem 1.1rem;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    align-items: end;
    margin-bottom: 0.6rem;
  }
  .kicker {
    color: var(--muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }
  .montage {
    margin: 0.15rem 0 0;
    font-weight: 600;
  }
  .schematic {
    font-weight: 500;
    color: var(--accent);
  }
  .nav {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .nav output {
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
    min-width: 7.5em;
    text-align: center;
  }
  button {
    font: inherit;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .seg {
    display: flex;
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    margin-right: 0.4rem;
  }
  .seg input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .seg span {
    display: block;
    padding: 0.2rem 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
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

  .plot {
    display: flex;
  }
  .labels {
    position: relative;
    flex: 0 0 3.6rem;
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .labels span {
    position: absolute;
    right: 0.4rem;
    transform: translateY(-50%);
    white-space: nowrap;
  }
  .canvas {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  svg {
    display: block;
    width: 100%;
  }
  path {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .lead {
    fill: var(--tint-none);
    opacity: 0.6;
  }
  .change {
    stroke: var(--accent);
    stroke-dasharray: 3 3;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .tag {
    position: absolute;
    top: 0;
    margin-left: 3px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--accent);
    background: var(--panel);
    padding: 0 3px;
    border-radius: 3px;
    white-space: nowrap;
  }
  .edge {
    color: var(--muted);
  }
  .foot {
    color: var(--muted);
    font-size: 0.78rem;
    margin: 0.4rem 0 0;
  }

  .map {
    margin-top: 1rem;
  }
  .map-box {
    position: relative;
    margin-top: 0.3rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
    overflow: hidden;
  }
  .map path {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .thresh {
    stroke: var(--line);
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
  }
  .window {
    fill: var(--fg);
    opacity: 0.08;
    stroke: var(--fg);
    stroke-opacity: 0.4;
    vector-effect: non-scaling-stroke;
  }
  .axis {
    position: absolute;
    right: 4px;
    transform: translateY(-100%);
    font-size: 0.65rem;
    color: var(--muted);
  }
</style>
