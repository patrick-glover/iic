import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Node resolves "localhost" to IPv6 only; Firefox tries IPv4 first.
  server: { host: '127.0.0.1' },
})
