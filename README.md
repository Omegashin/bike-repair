# Bike Repair Tracker

Repair ticket tracker for a small bike shop. See [decisions.md](decisions.md) for scope and design.

## Develop

Requires Node 24+.

```sh
npm install
npm run dev:api    # http://localhost:3000/api/health
npm run dev:web    # http://localhost:5173 (proxies /api to the API)
```

## Test

```sh
npm run check      # typecheck, lint, formatting and tests
```
