import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// IMPORTANT (GitHub Pages):
// - If you deploy to https://<user>.github.io/<repo>/, the app is served from a sub-path.
// - If you attach a custom domain, the app is usually served from the domain root.
//
// Using a *relative* base for production makes the built asset URLs work in both cases
// (root domain or repo sub-path), avoiding the "blank page" symptom caused by 404 JS/CSS.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? './' : '/',
}))
