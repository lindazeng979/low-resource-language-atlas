# Low-Resource Language Atlas

**[lindazeng979.github.io/low-resource-language-atlas](https://lindazeng979.github.io/low-resource-language-atlas/)**

An interactive atlas of the world's languages, and the case for why the ones AI leaves out matter.
It builds on Richard Littauer's [Awesome Low Resource Languages](https://github.com/RichardLitt/low-resource-languages)
list. Every language in that list is joined to the rest of what is known about it: where it is
spoken, how endangered it is, how much data exists, and which tools support it.

The site is one long page you can present from. Each chapter has its own link, and → / ← (or j / k) step
between chapters:

| # | Chapter | Link |
|---|---|---|
| 00 | The map: 6,938 living languages, lit by what AI supports | `#top` |
| 01 | What "low-resource" means, and what it does not | `#what` |
| 02 | How low is low: Joshi et al.'s six classes, and what a "resource" looks like | `#how-low` |
| 03 | Speakers are not data | `#gap` |
| 04 | Who gets served, and how well | `#served` |
| 05 | What a language holds | `#knowledge` |
| 06 | What is at stake, and what has worked | `#stakes` |
| 07 | Answers to the usual objections | `#talk-back` |
| 08 | What is being done, including Littauer's list | `#solutions` |
| 09 | The explorer: layers, search, a panel per language, shareable links (`?lang=<glottocode>`) | `#explore` |

## What is in the data

| Source | What it gives | Licence |
|---|---|---|
| [Glottolog 5.4](https://glottolog.org) | 8,243 languages, coordinates, families, endangerment, documentation | CC-BY 4.0 |
| [Wikidata](https://www.wikidata.org/wiki/Property:P1098) | Speaker counts (1,726 languages), Wikipedia edition codes | CC0 |
| [Joshi et al. 2020](https://aclanthology.org/2020.acl-main.560) | NLP data class 0–5 (2,043 of 2,485 names matched, 82%) | cited |
| Google Cloud Translation, NLLB-200, MMS, Common Voice 27, Wikipedia | Published language lists of each tool | see `pipeline/sources/coverage.py` |
| [Littauer et al.](https://github.com/RichardLitt/low-resource-languages) | 37 language sections, 128 language resources, 366 general tools | CC-BY-SA 4.0 |

Every join goes through individual ISO 639-3 codes. Macrolanguages map to their principal member
(`msa` → Standard Malay), and codes Glottolog treats as dialects credit their parent language
(Bosnian, Croatian and Serbian → Serbian-Croatian-Bosnian). The build prints how much of each source
matched, so a silent drop shows up as a number. Ethnologue is not used: its data is proprietary.

## Repository

```
pipeline/                     Python data pipeline (stdlib only)
  sources/glottolog.py        Glottolog CLDF, pinned to v5.4
  sources/wikidata.py         speaker counts + Wikipedia codes (SPARQL, rate-limited)
  sources/joshi.py            Joshi et al. classes, name → Glottolog matching
  sources/coverage.py         Google, NLLB, MMS, Common Voice, Wikipedia language lists
  sources/littauer.py         parses Littauer's README, pinned to a commit
  sources/isocodes.py         one code normaliser for ISO 639-1/3, BCP-47, FLORES, Wikimedia
  enrich.py                   joins everything onto Glottolog, reports match rates
tests/                        pytest
low-resource-language-atlas/  the site (React + Vite + d3, canvas map)
  public/data/                built bundles, committed so the site deploys without the pipeline
prototype/                    the June 2026 prototype, unchanged
```

## Rebuild the data

```bash
python3 -m venv .venv && .venv/bin/pip install pytest
.venv/bin/python -m pipeline build     # downloads to data/raw/, writes the site's data bundles
.venv/bin/python -m pytest
```

Wikidata's query service allows about one query a minute, so a fresh build pauses for a minute
between its two queries. Downloads are cached in `data/raw/`; `python -m pipeline fetch --force`
refreshes them.

## Run the site

```bash
cd low-resource-language-atlas
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/, served under /low-resource-language-atlas/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Licences

Code: MIT (`LICENSE`). Site text and the generated data: CC-BY-SA 4.0 (`LICENSE-CONTENT.md`),
because they include material derived from Littauer's CC-BY-SA list. Glottolog data is CC-BY 4.0;
Wikidata is CC0.
