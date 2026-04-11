# Chord Identifier App

A simple React app built with **Vite**.

## Prerequisites

- Node.js (recommended: current LTS)
- npm (or your preferred package manager)

## Install

```bash
npm install
```

## Run locally (development)

Starts the Vite dev server with hot reloading:

```bash
npm run dev
```

Vite will print a local URL (commonly `http://localhost:5173`).

## Build for production

Creates an optimized production build in `dist/`:

```bash
npm run build
```

## Preview the production build

Serves the contents of `dist/` locally so you can verify the production build:

```bash
npm run preview
```

## Deployment

The app is hosted on **GitHub Pages** at [quiz.collins.lol](https://quiz.collins.lol).

Deployment is **automatic** — any push or merged PR to the `main` branch triggers the GitHub Actions workflow at `.github/workflows/deploy.yml`, which:

1. Installs dependencies
2. Runs `npm run build`
3. Injects a `CNAME` file (`quiz.collins.lol`) into the build output
4. Publishes the `dist/` folder to the `gh-pages` branch via [`peaceiris/actions-gh-pages`](https://github.com/peaceiris/actions-gh-pages)

GitHub Pages is then configured to serve from the `gh-pages` branch, with the custom domain pointing to it.

> **Note:** The workflow uses `npm install` (not `npm ci`) to regenerate the lockfile on Linux, which is required for Rollup's native Linux binary to resolve correctly in CI.
