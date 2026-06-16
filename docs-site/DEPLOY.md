# DAWN WHALES Docs Site — Deployment Configuration

## R236-auto#2 / C5-final

This directory contains deployment configurations for the documentation site.

### Deployment Targets

| Target | Config File | URL |
|--------|------------|-----|
| GitHub Pages | `.github/workflows/docs-deploy.yml` | https://dawn-whales.github.io/dawn-whales/ |
| Vercel | `vercel.json` | https://docs.dawnwhales.app |

### Search

Starlight includes built-in Pagefind search (static, zero-config). To enable client-side search optimization:

1. **Pagefind (default)** — Enabled by default in Starlight. Automatically indexes all pages at build time.
2. **Algolia DocSearch** — If higher search quality is needed, apply at https://docsearch.algolia.com/

Search is configured in `astro.config.mjs`:

```js
starlight({
  // Pagefind is enabled by default — no extra config needed
  // For Algolia, add:
  // plugins: [starlightDocSearch({ appId: '...', apiKey: '...', indexName: '...' })],
})
```

### Build & Deploy

```bash
cd docs-site
pnpm install
pnpm build        # → dist/
pnpm preview      # local preview of built site
```
