conda activate lrl

Run website:
```bash
cd low-resource-language-atlas
npm run dev
```

`glottolog_languoid`: all language, family, etc. data from glottolog
`languages_seed`: original languages focusing on as test of concept
`languages_enriched_all`: unfiltered, none, fuzzy, and exact matches with seed + glottolog
`languages_enriched_exact`: exact + manually approved matches with seed + glottolog
`languages_needs_review`: post-review bad matches with seed + glottolog
`languages_enriched_with_families`: `languages_enriched_exact` with family and parent names found
`languages.json`: json version of ^
---

**Moved here on 2026-11-26.** This is the June 2026 prototype, kept as it was. The scripts expect
`glottolog_languoid.csv` (Glottolog's languoid table) in the working directory; that file is not
committed. The live atlas is built by `pipeline/` instead, which replaces the name-based fuzzy
matching here with joins on ISO 639-3 codes. See the main README.
