/**
 * Map layers: each turns a language into a mark style plus a legend.
 *
 * Colour rules (validated with the dataviz skill's validate_palette.js against
 * the map's dark land, #172133):
 *  - each layer is one ordinal, one-hue ramp, brightest = "most" of the thing
 *    the layer is about, so on a dark map the eye goes where the story is;
 *  - missing data is always its own mark (a hollow ring), never the faint end
 *    of a ramp, so "unknown" never reads as "small" or "safe".
 */

const DIM = "#56647c";
const RING = "#6f7d94";

export const DOC_RAMP = ["#b6d5f8", "#6aabf1", "#338ced", "#2370cd", "#1757ac"]; // MED 0 (long grammar) .. 4
export const ENDANGER_RAMP = { 2: "#a8402b", 3: "#d4553a", 4: "#f2734f", 5: "#ffa184" };
export const CLASS_RAMP = ["#9a6514", "#c27f1a", "#e09b26", "#f2b33d", "#f8cf78", "#fdebc0"]; // Joshi 0..5
export const LIT = "#f5b942";
export const SPEAKER = "#7cc4ff";
export const LITTAUER = "#4fd1a5";

export const SYSTEMS = [
  { id: "gt", short: "Google Translate", long: "Google Translate" },
  { id: "nllb", short: "NLLB-200", long: "Meta's No Language Left Behind (NLLB-200) translation model" },
  { id: "mms_asr", short: "MMS speech recognition", long: "Meta's Massively Multilingual Speech (MMS) speech recognition" },
  { id: "cv", short: "Common Voice", long: "Mozilla Common Voice speech dataset" },
  { id: "wp", short: "Wikipedia", long: "A Wikipedia edition in the language" },
];

export const DOC_LABELS = ["Long grammar", "Grammar", "Grammar sketch", "Phonology or texts", "Wordlist or less"];
export const AES_LABELS = { 1: "Not endangered", 2: "Threatened", 3: "Shifting", 4: "Moribund", 5: "Nearly extinct", 6: "Extinct" };
export const CLASS_LABELS = ["The Left-Behinds", "The Scraping-Bys", "The Hopefuls", "The Rising Stars", "The Underdogs", "The Winners"];

const dim = { fill: DIM, r: 1.6, alpha: 0.55, z: 0 };
const ring = { fill: RING, r: 2, alpha: 0.7, ring: true, z: 0 };

export const LAYERS = {
  coverage: {
    label: "Machine translation",
    blurb: "Lit: languages Google Translate or NLLB-200 can translate. Everything else is dark.",
    style(l) {
      return l.coverage.has("gt") || l.coverage.has("nllb") ? { fill: LIT, r: 2.8, alpha: 0.95, z: 2 } : dim;
    },
    legend: () => [
      { swatch: LIT, label: "Machine translation available" },
      { swatch: DIM, label: "Not supported" },
    ],
  },
  tools: {
    label: "Digital support",
    blurb: "How many of five major tools support each language: Google Translate, NLLB-200, MMS speech recognition, Common Voice and Wikipedia.",
    style(l) {
      const n = SYSTEMS.reduce((sum, s) => sum + (l.coverage.has(s.id) ? 1 : 0), 0);
      if (n === 0) return dim;
      return { fill: CLASS_RAMP[Math.min(5, n)], r: 1.6 + n * 0.45, alpha: 0.95, z: n };
    },
    legend: () => [
      ...[5, 4, 3, 2, 1].map((n) => ({ swatch: CLASS_RAMP[n], label: `${n} of 5` })),
      { swatch: DIM, label: "None" },
    ],
  },
  documentation: {
    label: "Documentation",
    blurb: "Glottolog's most extensive description of each language, from a long reference grammar down to a wordlist.",
    style(l) {
      if (l.documentation == null) return ring;
      return { fill: DOC_RAMP[l.documentation], r: 2.1, alpha: 0.9, z: 4 - l.documentation };
    },
    legend: () => [
      ...DOC_LABELS.map((label, i) => ({ swatch: DOC_RAMP[i], label })),
      { swatch: RING, ring: true, label: "Not assessed" },
    ],
  },
  endangerment: {
    label: "Endangerment",
    blurb: "Glottolog's agglomerated endangerment status, which combines UNESCO, ElCat and Ethnologue's EGIDS.",
    style(l) {
      const e = l.endangerment;
      if (e == null) return ring;
      if (e === 1) return dim;
      if (e === 6) return { fill: RING, r: 1.8, alpha: 0.6, ring: true, z: 0 };
      return { fill: ENDANGER_RAMP[e], r: 2.2, alpha: 0.92, z: e };
    },
    legend: () => [
      ...[5, 4, 3, 2].map((e) => ({ swatch: ENDANGER_RAMP[e], label: AES_LABELS[e] })),
      { swatch: DIM, label: "Not endangered" },
      { swatch: RING, ring: true, label: "Extinct or unknown" },
    ],
  },
  speakers: {
    label: "Speakers",
    blurb: "Dot area grows with the number of speakers reported on Wikidata. A ring means no figure was found.",
    style(l) {
      if (!l.speakers) return { ...ring, r: 1.4, alpha: 0.45 };
      const r = Math.max(1.4, Math.min(16, Math.sqrt(l.speakers) / 260));
      return { fill: SPEAKER, r, alpha: 0.55, z: -r };
    },
    legend: () => [
      { swatch: SPEAKER, label: "Speakers (area)" },
      { swatch: RING, ring: true, label: "No figure on Wikidata" },
    ],
  },
  resourceClass: {
    label: "NLP resource class",
    blurb: "Joshi et al. (2020) sorted ~2,500 languages into six classes by how much labelled and unlabelled data exists. Everything they did not reach is a ring.",
    style(l) {
      if (l.resourceClass == null) return { ...ring, r: 1.5, alpha: 0.4 };
      return { fill: CLASS_RAMP[l.resourceClass], r: 1.8 + l.resourceClass * 0.45, alpha: 0.95, z: l.resourceClass };
    },
    legend: () => [
      ...[5, 4, 3, 2, 1, 0].map((c) => ({ swatch: CLASS_RAMP[c], label: `${c} · ${CLASS_LABELS[c]}` })),
      { swatch: RING, ring: true, label: "Not in the study" },
    ],
  },
  littauer: {
    label: "Littauer's list",
    blurb: "Languages with a section in Richard Littauer's curated list of open-source tools for low-resource languages.",
    style(l) {
      return l.littauer.length ? { fill: LITTAUER, r: 3.2, alpha: 0.95, z: 2 } : dim;
    },
    legend: () => [
      { swatch: LITTAUER, label: "Has tools in the list" },
      { swatch: DIM, label: "Not listed" },
    ],
  },
};
