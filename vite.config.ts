import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  // Served from patrickglover.io/iic/ by GitHub Pages.
  base: command === 'build' ? '/iic/' : '/',
  // Node resolves "localhost" to IPv6 only; Firefox tries IPv4 first.
  server: { host: '127.0.0.1' },
}))
