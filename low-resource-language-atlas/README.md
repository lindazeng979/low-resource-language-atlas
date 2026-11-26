# The site

React + Vite. The map is a canvas Equal Earth projection (d3-geo) with a quadtree for hit-testing,
so all 8,000 languages draw and respond quickly; the June prototype used Leaflet markers, which
do not scale to that many points. Data loads from `public/data/` (built by `../pipeline`).

- `src/App.jsx`: the chapters
- `src/components/Explorer.jsx`, `LanguagePanel.jsx`, `AtlasMap.jsx`: the explorer
- `src/map/LanguageMap.js`, `layers.js`: map rendering and layer colour scales
- `src/components/charts.jsx`: the charts
- `src/content/`: every cited source, and the solutions directory

`npm run dev` to work on it, `npm run build` for the static site.
