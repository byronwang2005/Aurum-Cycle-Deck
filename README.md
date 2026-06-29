# Precious Metals Research Deck

This workspace contains local structured research data and an interactive presentation-style web report for precious metals.

## Structure

- `json/` - Source structured research JSON files.
- `output/` - Generated research outputs, including the markdown report, viewpoint database, and evidence index.
- `scripts/` - Research report generation scripts.
- `dashboard/` - Vite + React interactive presentation.
  - `src/` - Application code and styles.
  - `scripts/build-data.mjs` - Converts `output/` artifacts into frontend data.
  - `public/assets/` - Static assets such as the JHSS logo.
  - `public/data/` - Generated frontend data. Rebuilt by `npm run build:data`.

## Dashboard Commands

Run from `dashboard/`:

```bash
npm install
npm run dev
npm run build
npm run preview
```

The dashboard treats market-stage conclusions as sample-based analysis only. It does not use real-time data after the local research sample boundary.
