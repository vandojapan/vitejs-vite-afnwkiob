# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Cloudflare Worker for OGP and Avatar Proxy

This project includes a Cloudflare Worker script at `cloudflare-worker.js`.

- `GET /api/profile?url=<PAGE_URL>`
  - Scrapes OGP metadata
  - Extracts user names from the page
  - Supports `nicovideo.jp` user pages
  - Returns JSON with `name`, `displayName`, and `avatar`
- `GET /api/avatar?target=<IDENTIFIER_OR_URL>`
  - Proxies `unavatar.io` image requests
  - Adds CORS headers
  - Caches responses on Cloudflare for faster repeat access

To use the Worker from the React app, set `VITE_WORKER_BASE` in `.env`:

```env
VITE_WORKER_BASE=https://your-worker-name.workers.dev
```

Then restart the Vite dev server.
