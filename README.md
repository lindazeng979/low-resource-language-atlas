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