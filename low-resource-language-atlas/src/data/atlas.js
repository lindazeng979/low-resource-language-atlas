/**
 * The one place that knows how data reaches the app (from the July rebuild's
 * datasource.js). The wire format's short keys stop here; everything else
 * reads full field names. Absent means unknown, uniformly.
 */

const BASE = import.meta.env.BASE_URL;

let cache = null;

export function loadAtlas() {
  if (!cache) cache = fetchAtlas();
  return cache;
}

async function fetchAtlas() {
  const [bundle, littauer] = await Promise.all([
    fetchJson(`${BASE}data/atlas.json`),
    fetchJson(`${BASE}data/littauer.json`),
  ]);
  const k = bundle.keys;
  const languages = bundle.languages.map((r) => {
    const familyId = r[k.family_id] ?? null;
    return {
      glottocode: r[k.glottocode],
      name: r[k.name],
      iso639_3: r[k.iso639_3] ?? null,
      latitude: r[k.latitude] ?? null,
      longitude: r[k.longitude] ?? null,
      familyId,
      familyName: familyId ? bundle.families[familyId] ?? null : null,
      macroareas: r[k.macroareas] ?? [],
      countries: r[k.countries] ?? [],
      category: r[k.category] ?? null,
      classification: r[k.classification] ?? [],
      isIsolate: r[k.is_isolate] === 1,
      endangerment: r[k.aes] ?? null,
      documentation: r[k.med] ?? null,
      speakers: r[k.speakers] ?? null,
      speakersYear: r[k.speakers_year] ?? null,
      speakersSource: r[k.speakers_source] ?? null,
      wikidata: r[k.wikidata] ?? null,
      resourceClass: r[k.resource_class] ?? null,
      wikipedia: r[k.wikipedia] ?? null, // { code, articles }
      coverage: new Set(r[k.coverage] ?? []),
      littauer: r[k.littauer] ?? [],
    };
  });
  const byGlottocode = new Map(languages.map((l) => [l.glottocode, l]));
  return { meta: bundle, languages, byGlottocode, littauer };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json();
}

export function familyPath(atlas, language) {
  return language.classification.map((id) => atlas.meta.families[id] ?? id);
}

export const fmt = new Intl.NumberFormat("en-US");
export const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const regions = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code) {
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}
