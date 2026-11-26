import { useEffect, useMemo, useState } from "react";
import AtlasMap from "./components/AtlasMap.jsx";
import Explorer from "./components/Explorer.jsx";
import { BarList, ClassLadder, LongTail, SpeakersVsData, StackBar } from "./components/charts.jsx";
import { Chapter, Mark, Rail, TopBar, useChapters } from "./components/Shell.jsx";
import { SOURCES } from "./content/sources.js";
import { CRITIQUES, SOLUTION_GROUPS } from "./content/solutions.js";
import { compact, fmt, loadAtlas } from "./data/atlas.js";
import { CLASS_LABELS, CLASS_RAMP, ENDANGER_RAMP, LIT, LITTAUER, SPEAKER } from "./map/layers.js";

const CHAPTERS = [
  { id: "top", title: "The atlas", night: true },
  { id: "what", title: "What “low-resource” means", nav: "Definitions" },
  { id: "how-low", title: "How low is low", nav: "How low" },
  { id: "gap", title: "Speakers are not data", nav: "Speakers vs data" },
  { id: "served", title: "Who gets served", nav: "Coverage" },
  { id: "knowledge", title: "What a language holds", nav: "Knowledge", night: true },
  { id: "stakes", title: "What is at stake", nav: "Stakes" },
  { id: "talk-back", title: "When someone says…", nav: "Talking points" },
  { id: "solutions", title: "What is being done", nav: "Solutions" },
  { id: "explore", title: "Explore the map", nav: "Explore", night: true, keep: true },
];

export default function App() {
  const [atlas, setAtlas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAtlas().then(setAtlas, (e) => setError(e.message));
  }, []);

  if (error) return <div className="loading">{error}</div>;
  if (!atlas) return <div className="loading">Loading 8,000 languages…</div>;
  return <Atlas atlas={atlas} />;
}

/** Living spoken and signed languages: what "a language today" means on this site. */
function isLiving(l) {
  return l.endangerment !== 6 && (l.category === "Spoken_L1_Language" || l.category === "Sign_Language");
}

function Atlas({ atlas }) {
  const current = useChapters(CHAPTERS);
  const stats = useMemo(() => computeStats(atlas), [atlas]);

  // A deep link to a language opens the explorer.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("lang") || location.hash) {
      const id = location.hash.slice(1) || "explore";
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
    }
  }, []);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <TopBar chapters={CHAPTERS} current={current} />
      <Rail chapters={CHAPTERS} current={current} />
      <main id="main">
        <Hero atlas={atlas} stats={stats} />
        <Definitions atlas={atlas} />
        <HowLow atlas={atlas} />
        <Gap atlas={atlas} />
        <Served stats={stats} />
        <Knowledge />
        <Stakes atlas={atlas} stats={stats} />
        <TalkBack stats={stats} />
        <Solutions atlas={atlas} />
        <section id="explore" className="explore" aria-labelledby="explore-h">
          <div className="wrap">
            <div className="chapter__head">
              <span className="chapter__num">09</span>
              <h2 id="explore-h">Explore every language</h2>
              <p className="lede">
                {fmt.format(stats.mapped)} languages, each with what is known about it and where. Switch layers, filter by family or country, search, and
                click any dot for its full record. Every language has a link you can share.
              </p>
            </div>
            <Explorer atlas={atlas} />
          </div>
        </section>
      </main>
      <Footer atlas={atlas} />
    </>
  );
}

function computeStats(atlas) {
  const living = atlas.languages.filter(isLiving);
  const has = (l, id) => l.coverage.has(id);
  const count = (pred) => living.filter(pred).length;
  const spoken = living.filter((l) => l.category === "Spoken_L1_Language" && l.endangerment != null);
  const aes = [1, 2, 3, 4, 5].map((e) => spoken.filter((l) => l.endangerment === e).length);
  return {
    living: living.length,
    mapped: atlas.languages.filter((l) => l.latitude != null).length,
    catalogued: atlas.languages.length,
    signed: count((l) => l.category === "Sign_Language"),
    mt: count((l) => has(l, "gt") || has(l, "nllb")),
    gt: count((l) => has(l, "gt")),
    nllb: count((l) => has(l, "nllb")),
    asr: count((l) => has(l, "mms_asr")),
    cv: count((l) => has(l, "cv")),
    wp: count((l) => has(l, "wp")),
    any: count((l) => l.coverage.size > 0),
    all5: count((l) => l.coverage.size === 5),
    none: count((l) => l.coverage.size === 0),
    spokenWithAes: spoken.length,
    aes,
    endangered: aes[1] + aes[2] + aes[3] + aes[4],
    shiftingOrWorse: aes[2] + aes[3] + aes[4],
    joshi: atlas.meta.coverage.sources.joshi,
    systems: atlas.meta.coverage.sources.systems,
    speakers: atlas.meta.coverage.with_speakers,
  };
}

const pct = (a, b, digits = 0) => `${((100 * a) / b).toFixed(digits)}%`;

function Src({ id, children }) {
  const s = SOURCES[id];
  return (
    <a className="src" href={s.url} title={`${s.title}. ${s.venue}`}>
      {children ?? s.short}
    </a>
  );
}

function Cites({ ids }) {
  return (
    <p className="cite">
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && " · "}
          <Src id={id} />
        </span>
      ))}
    </p>
  );
}

/* ------------------------------------------------------------------ 00 hero */

const HERO_VIEWS = {
  mt: {
    label: "Machine translation",
    test: (l) => l.coverage.has("gt") || l.coverage.has("nllb"),
    color: LIT,
    caption: (s) => `${fmt.format(s.mt)} lit: supported by Google Translate or Meta's NLLB-200`,
  },
  asr: {
    label: "Speech recognition",
    test: (l) => l.coverage.has("mms_asr"),
    color: SPEAKER,
    caption: (s) => `${fmt.format(s.asr)} lit: supported by Meta's MMS speech recognition`,
  },
  endangered: {
    label: "Endangered",
    test: (l) => l.endangerment >= 3 && l.endangerment <= 5,
    color: ENDANGER_RAMP[4],
    caption: (s) => `${fmt.format(s.shiftingOrWorse)} lit: no longer fully passed on to children`,
  },
  littauer: {
    label: "Littauer's list",
    test: (l) => l.littauer.length > 0,
    color: LITTAUER,
    caption: () => "Lit: languages with tools in Richard Littauer's open-source list",
  },
};

function Hero({ atlas, stats }) {
  const [view, setView] = useState("mt");
  const living = useMemo(() => atlas.languages.filter((l) => isLiving(l) && l.latitude != null), [atlas]);
  const v = HERO_VIEWS[view];
  const styleFor = useMemo(
    () => (l) => (v.test(l) ? { fill: v.color, r: 2.6, alpha: 0.95, z: 1 } : { fill: "#4b5872", r: 1.5, alpha: 0.5, z: 0 }),
    [v],
  );
  return (
    <section id="top" className="hero" aria-labelledby="hero-h">
      <div className="hero__map">
        <AtlasMap languages={living} styleFor={styleFor} interactive={false} tooltip={false} label={v.caption(stats)} />
      </div>
      <div className="hero__shade" aria-hidden="true" />
      <div className="wrap hero__copy" data-enter>
        <p className="eyebrow" style={{ color: "var(--night-ink-3)" }}>
          An atlas of the world's languages and the data behind them
        </p>
        <h1 id="hero-h">
          {fmt.format(stats.living)} languages. <em>Most are invisible to AI.</em>
        </h1>
        <ul className="hero__stats">
          <li>
            <b>{pct(stats.mt, stats.living, 1)}</b>
            <span>have machine translation</span>
          </li>
          <li>
            <b>{pct(stats.asr, stats.living)}</b>
            <span>have open speech recognition</span>
          </li>
          <li>
            <b>{pct(stats.endangered, stats.spokenWithAes)}</b>
            <span>are endangered to some degree</span>
          </li>
        </ul>
        <div className="hero__actions">
          <a className="btn btn--lit" href="#explore">
            Explore the map <span className="arrow">→</span>
          </a>
          <a className="btn btn--ghost" href="#what">
            Read the case
          </a>
        </div>
        <div className="hero__toggle" role="group" aria-label="Light up the map by">
          {Object.entries(HERO_VIEWS).map(([id, item]) => (
            <button key={id} aria-pressed={id === view} onClick={() => setView(id)}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="hero__caption">{v.caption(stats)}. Each dot is one living language.</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 01 definitions */

const TERMS = [
  { term: "Low-resource", about: "Data and tools", text: "Little text, speech, labelled data or software for building language technology. A statement about the digital record, not about the language or its speakers." },
  { term: "Endangered", about: "Transmission", text: "Children are no longer learning it at home. Measured on scales like UNESCO's six degrees or Ethnologue's EGIDS, not by data." },
  { term: "Minoritized", about: "Power", text: "Spoken by a group without political or institutional dominance in its state, whatever its size. Welsh in the UK; Kurdish in Turkey." },
  { term: "Indigenous", about: "People and land", text: "The language of a people with a prior relationship to a territory, often shaped by colonisation. Some are institutional: Kalaallisut is Greenland's official language." },
  { term: "Oral and signed", about: "Modality", text: "Most languages are mainly spoken, not written, so text-first technology misses them. Glottolog lists over 220 sign languages." },
];

const EXAMPLES = [
  { iso: "bho", note: "Tens of millions of speakers, no endangerment, little data." },
  { iso: "hau", note: "Among Africa's largest languages; 4.4 validated hours in Common Voice." },
  { iso: "ekk", note: "About a million speakers and a deep digital record." },
  { iso: "chr", note: "Endangered and Indigenous; around 2,000 speakers among 300,000 Cherokee people." },
  { iso: "kal", note: "Indigenous and institutional: Greenland's official language." },
  { iso: "cym", note: "Minoritized but data-rich: moves from class 1 to 3 once Hugging Face datasets are counted." },
];

function Definitions({ atlas }) {
  const byIso = useMemo(() => new Map(atlas.languages.filter((l) => l.iso639_3).map((l) => [l.iso639_3, l])), [atlas]);
  return (
    <Chapter
      id="what"
      num="01"
      title="“Low-resource” is not one thing"
      lede={
        <>
          The phrase describes data, not people. In 150 research papers that used it, the most common criterion, a lack of labelled data, appeared in only 39.8% of them (
          <Src id="nigatu2024" />
          ). Four other words are often used as if they meant the same thing. They do not.
        </>
      }
      takeaway="Low-resource describes the data, not the language. Bhojpuri has tens of millions of speakers and is low-resource. Estonian has about a million and is not."
    >
      <div className="terms">
        {TERMS.map((t) => (
          <div key={t.term} className="term">
            <p className="eyebrow">{t.about}</p>
            <h3>{t.term}</h3>
            <p>{t.text}</p>
          </div>
        ))}
      </div>

      <div className="examples">
        <table className="examples__table">
          <caption className="sr-only">Six languages compared on speakers, data class and endangerment</caption>
          <thead>
            <tr>
              <th>Language</th>
              <th className="num">Speakers</th>
              <th>NLP data class</th>
              <th>Endangerment</th>
              <th>Why it is interesting</th>
            </tr>
          </thead>
          <tbody>
            {EXAMPLES.map((ex) => {
              const l = byIso.get(ex.iso);
              if (!l) return null;
              return (
                <tr key={ex.iso}>
                  <td>
                    <a href={`?lang=${l.glottocode}#explore`}>{l.name}</a>
                  </td>
                  <td className="num">{l.speakers ? compact.format(l.speakers) : "—"}</td>
                  <td>
                    {l.resourceClass != null ? (
                      <span className="chip" style={{ "--chip": CLASS_RAMP[l.resourceClass] }}>
                        {l.resourceClass} · {CLASS_LABELS[l.resourceClass].replace("The ", "")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{["", "Not endangered", "Threatened", "Shifting", "Moribund", "Nearly extinct", "Extinct"][l.endangerment ?? 0] || "—"}</td>
                  <td className="muted">{ex.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="chart-src">
          Speakers: <Src id="wikidata" /> (first-language figures where marked; sources vary in year and method). Data class: <Src id="joshi2020" />. Endangerment:{" "}
          <Src id="glottolog" />. Notes: <Src id="nigatu2024" />, <Src id="ranathunga2022" />, <Src id="commonvoice" />.
        </p>
      </div>

      <blockquote className="pull">
        <p>
          “Low- or under-resourced languages … may be spoken by a large population but are under-represented digitally (for instance, Quechua).”
        </p>
        <footer>
          Richard Littauer, <Src id="littauer">Awesome Low Resource Languages</Src>
        </footer>
      </blockquote>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ 02 how low */

const JOSHI = [
  { cls: 0, languages: 2191, speakersShare: 15.5, examples: "Dahalo, Warlpiri, Popoloca, Wallisian, Bora" },
  { cls: 1, languages: 222, speakersShare: 0.4, examples: "Cherokee, Fijian, Greenlandic, Bhojpuri, Navajo" },
  { cls: 2, languages: 19, speakersShare: 0.1, examples: "Zulu, Konkani, Lao, Maltese, Irish" },
  { cls: 3, languages: 28, speakersShare: 23.3, examples: "Indonesian, Ukrainian, Cebuano, Afrikaans, Hebrew" },
  { cls: 4, languages: 18, speakersShare: 28.4, examples: "Russian, Hungarian, Vietnamese, Dutch, Korean" },
  { cls: 5, languages: 7, speakersShare: 32.3, examples: "English, Spanish, German, Japanese, French, Arabic, Mandarin" },
].map((c) => ({ ...c, name: CLASS_LABELS[c.cls], color: CLASS_RAMP[c.cls] }));

const SMALL = [
  { big: "3,001", text: "sentences per language in FLORES, the standard machine translation test set.", src: "flores" },
  { big: "810", text: "languages have a complete Bible, often their largest parallel text. 3,158 have no scripture at all.", src: "progressbible" },
  { big: "< 1M", text: "sentence pairs: NLLB's line for “low-resource”. 150 of its 200 languages fall below it.", src: "flores" },
  { big: "4.4 h", text: "of validated Hausa speech in Common Voice, against 2,806 hours of English.", src: "commonvoice" },
  { big: "87 of 205", text: "audited web corpora had under half usable sentences. 15 had none at all.", src: "kreutzer2022" },
  { big: "8.6×", text: "average multi-way parallelism of web text in the lowest-resource languages, against 4.0 in the highest: much of it is machine-translated.", src: "thompson2024" },
];

function HowLow({ atlas }) {
  const j = atlas.meta.coverage.sources.joshi;
  return (
    <Chapter
      id="how-low"
      num="02"
      title="How low is low?"
      lede={
        <>
          In 2020, Joshi and colleagues sorted 2,485 languages by how much labelled and unlabelled data existed for each. 2,191 landed in the bottom class. Seven are
          “Winners”, and those seven account for about a third of all the speakers the study counted.
        </>
      }
      takeaway="Of 2,485 languages ranked by available data, 2,191 are “Left-Behinds”. Only seven are “Winners”."
    >
      <div className="grid-2 howlow">
        <div>
          <p className="chart-title">Languages per data class, log scale</p>
          <p className="chart-sub">Class 5 is the top. Bar length is the number of languages in the class.</p>
          <ClassLadder classes={JOSHI} />
          <p className="chart-src">
            <Src id="joshi2020" />, Table 1 counts. The share of speakers is recomputed from the paper's counts; its printed percentage column does not match them. Classes
            reflect 2020 data: counting Hugging Face datasets moves 84 languages up a class (<Src id="ranathunga2022" />
            ). This atlas matches {fmt.format(j.matched)} of the 2,485 names to a Glottolog language ({pct(j.matched, j.names)}).
          </p>
        </div>
        <div>
          <p className="chart-title">How small is small</p>
          <p className="chart-sub">What a “resource” actually looks like at the bottom of the ladder.</p>
          <div className="small-grid">
            {SMALL.map((s) => (
              <div key={s.big} className="small-card">
                <b>{s.big}</b>
                <p>{s.text}</p>
                <Src id={s.src} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ 03 gap */

const LABELLED = [
  { iso: "hau", name: "Hausa", dx: 9, dy: -7 },
  { iso: "bho", name: "Bhojpuri", dx: 9, dy: 5 },
  { iso: "yor", name: "Yoruba", dx: -9, dy: 15, anchor: "end" },
  { iso: "jav", name: "Javanese", dx: 9, dy: 6 },
  { iso: "amh", name: "Amharic", dx: -9, dy: 5, anchor: "end" },
  { iso: "isl", name: "Icelandic", dx: -9, dy: 5, anchor: "end" },
  { iso: "ekk", name: "Estonian", dx: 9, dy: 5 },
  { iso: "eus", name: "Basque", dx: -9, dy: -6, anchor: "end" },
  { iso: "cym", name: "Welsh", dx: -9, dy: 15, anchor: "end" },
  { iso: "ceb", name: "Cebuano", dx: 9, dy: 5 },
  { iso: "eng", name: "English", dx: -9, dy: 5, anchor: "end" },
];

function Gap({ atlas }) {
  return (
    <Chapter
      id="gap"
      num="03"
      title="Speakers are not data"
      tone="tint"
      lede="If data followed people, this would be a tidy diagonal: more speakers, more text. Instead, languages with tens of millions of speakers sit next to languages with a few hundred thousand, and the smaller one often has more."
      takeaway="Estonian has about a million speakers. Hausa has tens of millions. Estonian has 39 times as many pages in the web crawl that trains AI."
    >
      <p className="chart-title">Speakers against Wikipedia articles, one dot per language</p>
      <p className="chart-sub">Both axes are logarithmic. Languages with no Wikipedia sit on the bottom line. Hover any dot.</p>
      <SpeakersVsData languages={atlas.languages} labelled={LABELLED} />
      <p className="chart-src">
        Speakers: <Src id="wikidata" />, {fmt.format(atlas.meta.coverage.with_speakers)} languages with a figure, at least 1,000 speakers, living. Articles: wikistats, November
        2026. Wikipedia size is a weak proxy: Cebuano's 6.1 million articles are mostly written by a bot.
      </p>
      <div className="grid-3 contrasts">
        <div className="card">
          <span className="big">
            <em>39×</em>
          </span>
          <h3>Estonian vs Hausa</h3>
          <p>Estonian: about 1.2 million speakers, 3.31 million pages in Common Crawl. Hausa: tens of millions of speakers, 85,000 pages.</p>
          <Cites ids={["commoncrawl"]} />
        </div>
        <div className="card">
          <span className="big">
            <em>≈</em>
          </span>
          <h3>Welsh vs Swahili</h3>
          <p>About the same number of crawled pages (255,000 vs 243,000), and Welsh has twice as many Wikipedia articles, with a small fraction of Swahili's speakers.</p>
          <Cites ids={["commoncrawl"]} />
        </div>
        <div className="card">
          <span className="big">
            <em>0</em>
          </span>
          <h3>Bhojpuri in the crawl</h3>
          <p>Common Crawl's language detector cannot recognise Bhojpuri, so its pages are not counted at all. Missing from a dataset is not the same as absent.</p>
          <Cites ids={["commoncrawl", "kreutzer2022"]} />
        </div>
      </div>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ 04 served */

function Served({ stats }) {
  const rows = [
    { label: "Meta MMS speech recognition", value: stats.asr },
    { label: "A Wikipedia edition", value: stats.wp },
    { label: "Mozilla Common Voice", value: stats.cv },
    { label: "Meta NLLB-200 translation", value: stats.nllb },
    { label: "Google Translate (API list)", value: stats.gt },
  ];
  return (
    <Chapter
      id="served"
      num="04"
      title="Who gets served"
      lede={`Of ${fmt.format(stats.living)} living languages, this is how many each widely used tool or dataset supports. ${fmt.format(stats.none)} languages (${pct(
        stats.none,
        stats.living,
      )}) are supported by none of them.`}
      takeaway="Fewer than one language in twenty has machine translation. Where AI does support a language, it is often much worse, costs more per word, and is easier to misuse."
    >
      <div className="grid-2">
        <div>
          <p className="chart-title">Living languages supported, by tool</p>
          <p className="chart-sub">Out of {fmt.format(stats.living)}. Each list is the tool's own published language list, matched to Glottolog by ISO 639-3 code.</p>
          <BarList rows={rows} total={stats.living} caption="Living languages supported by each tool" />
          <div className="supported-sum">
            <div>
              <b>{fmt.format(stats.any)}</b>
              <span>supported by at least one</span>
            </div>
            <div>
              <b>{fmt.format(stats.all5)}</b>
              <span>supported by all five</span>
            </div>
            <div>
              <b>{fmt.format(stats.none)}</b>
              <span>supported by none</span>
            </div>
          </div>
          <p className="chart-src">
            Google says its consumer Translate app reaches more than 250 languages (<Src id="google1000" />
            ); its published API list has 194. Meta's Omnilingual ASR (<Src id="omnilingual" />) reports 1,600+ languages and is not counted here. Even at the most generous count,
            machine translation reaches about 4% of living languages at most.
          </p>
        </div>
        <div>
          <p className="chart-title">Supported is not the same as good</p>
          <p className="chart-sub">Six measured gaps. Each is a specific model at a specific time; newer models narrow some of them.</p>
          <ul className="gaps-list">
            <li>
              <b>86.9 vs 59.0</b>
              <span>GPT-4o in English vs its average over 17 African languages on IrokoBench.</span>
              <Src id="iroko" />
            </li>
            <li>
              <b>169 of 201</b>
              <span>languages where Meta's NLLB translated better than ChatGPT (2023).</span>
              <Src id="robinson2023" />
            </li>
            <li>
              <b>87.7% vs 51.1%</b>
              <span>GPT-3.5 reading comprehension in English vs the average across 122 languages.</span>
              <Src id="belebele" />
            </li>
            <li>
              <b>78.0 vs 91.2</b>
              <span>o3-high on MMLU in Yoruba vs Italian. Yoruba is last for every OpenAI model tested.</span>
              <Src id="openaimmmlu" />
            </li>
            <li>
              <b>15×</b>
              <span>as many tokens for the same text in Shan as in English with GPT-4's 2023 tokenizer. Users pay per token.</span>
              <Src id="petrov2023" />
            </li>
            <li>
              <b>53% vs 1%</b>
              <span>of harmful requests got past GPT-4's 2023 safeguards when translated into Zulu, vs in English.</span>
              <Src id="yong2023" />
            </li>
          </ul>
        </div>
      </div>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ 05 knowledge */

const KNOWLEDGE = [
  {
    big: "75%",
    title: "Medicine",
    text: "Of 12,495 medicinal plant uses recorded across 236 Indigenous languages, over three quarters are known in only one language. Most of the plants are not threatened. Most of the languages are.",
    src: ["camaraleret2021"],
  },
  {
    big: "7,000+ years",
    title: "Memory",
    text: "Aboriginal Australian stories from 21 places on the coast describe the sea flooding land. Matched to sea-level records, they appear to recall the end of the last ice age.",
    src: ["nunn2016"],
  },
  {
    big: "7,700 years",
    title: "Geology",
    text: "Klamath oral tradition is widely interpreted as recalling the eruption of Mount Mazama, which formed Crater Lake. People were there: sandals lie under its ash.",
    src: ["cratelake"],
  },
  {
    big: "37.7%",
    title: "Climate",
    text: "Reinstating Aboriginal fire management over 28,000 km² of West Arnhem Land cut methane and nitrous oxide emissions by this much in seven years.",
    src: ["russellsmith2013"],
  },
  {
    big: "182",
    title: "Biology",
    text: "Fore names for vertebrates in the New Guinea Highlands match the species scientists recognise almost one to one.",
    src: ["diamond1966"],
  },
  {
    big: "N · S · E · W",
    title: "Thought",
    text: "Guugu Yimithirr speakers describe space by compass direction, not left and right, and remember layouts that way. In Pormpuraaw, people lay out time from east to west.",
    src: ["levinson1997", "boroditsky2010"],
  },
];

function Knowledge() {
  return (
    <Chapter
      id="knowledge"
      num="05"
      title="What a language holds"
      tone="night"
      lede="A language is not a different code for the same thoughts. It is where a community keeps what it has learned about its land, its medicine and its past, much of it written down nowhere else."
      takeaway="Three in four medicinal plant uses recorded among Indigenous peoples are known in only one language. When the language goes, that knowledge goes with it."
    >
      <div className="grid-3 knowledge">
        {KNOWLEDGE.map((k) => (
          <div key={k.title} className="card">
            <p className="eyebrow">{k.title}</p>
            <span className="big">{k.big}</span>
            <p>{k.text}</p>
            <Cites ids={k.src} />
          </div>
        ))}
      </div>
      <figure className="quote">
        <blockquote>
          “The extinction of each language results in the irrecoverable loss of unique cultural, historical, and ecological knowledge.”
        </blockquote>
        <figcaption>
          <Src id="unesco2003" />. Or, as the linguist Ken Hale put it: “When you lose a language, it's like dropping a bomb on a museum.” (<Src id="hale" />)
        </figcaption>
      </figure>
      <p className="note">
        These are correlations and interpretations, stated as their authors state them. “Unique” means unique in the recorded literature; the Crater Lake link is an
        interpretation; spatial language correlates with spatial memory but does not determine thought.
      </p>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ 06 stakes */

const REVIVALS = [
  { name: "Hebrew", line: "Revived as an everyday mother tongue from the late 1800s. By 2011, the native language of 49% of Israeli adults.", src: "hebrew" },
  { name: "Māori", line: "213,849 people could hold a conversation in te reo Māori in 2023, up from 185,955 in 2018. Language nests began in 1982.", src: "maori" },
  { name: "Hawaiian", line: "8,872 speakers in the 1990 census, after a 90-year ban on Hawaiian-medium schooling. 3,772 students in immersion schools in 2024–25.", src: "hawaiian" },
  { name: "Welsh", line: "Held at around half a million speakers for 40 years. The government's target is one million by 2050.", src: "welsh" },
  { name: "Myaamia", line: "The last speakers died by the early 1960s. Families are speaking it again, rebuilt from archival records.", src: "myaamia" },
];

function Stakes({ atlas, stats }) {
  const labels = ["Not endangered", "Threatened", "Shifting", "Moribund", "Nearly extinct"];
  // On paper, darker = more endangered (the map, on a dark ground, uses brighter = more).
  const colors = ["#c7ced9", "#ef9878", "#e26a47", "#c9472c", "#93301e"];
  const segments = stats.aes.map((value, i) => ({ label: labels[i], value, color: colors[i] }));
  return (
    <Chapter
      id="stakes"
      num="06"
      title="What is at stake"
      lede="Most languages are small, and many are no longer passed to children. Loss is not random: across 6,511 languages it tracks road density and years of schooling. And it can be reversed."
      takeaway="Language loss is not natural selection. It tracks roads and schooling, and it is reversible: Hebrew, Māori and Hawaiian came back because people chose to bring them back."
    >
      <p className="chart-title">Endangerment of {fmt.format(stats.spokenWithAes)} living spoken languages</p>
      <p className="chart-sub">
        {pct(stats.endangered, stats.spokenWithAes)} carry some degree of endangerment; {pct(stats.shiftingOrWorse, stats.spokenWithAes)} are “shifting” or worse, meaning children are no
        longer learning them at home.
      </p>
      <StackBar segments={segments} total={stats.spokenWithAes} caption="Living spoken languages by endangerment status" />
      <p className="chart-src">
        <Src id="glottolog" />, agglomerated endangerment status, which combines UNESCO, ElCat and Ethnologue's EGIDS.
      </p>

      <div className="stakes-tail">
        <p className="chart-title">Most languages are small</p>
        <p className="chart-sub">Every living language with a speaker figure on Wikidata, ranked from most speakers to fewest.</p>
        <LongTail languages={atlas.languages} />
      </div>

      <div className="grid-3 stakes-cards">
        <div className="card">
          <span className="big">
            <em>1 a month</em>
          </span>
          <h3>Loss could triple</h3>
          <p>
            Without intervention, at least one language a month could be lost, and over 1,500 could stop being spoken by 2100. A third of those have little or no documentation.
            Documented losses today run at about one every 1–3 months.
          </p>
          <Cites ids={["bromham2022", "simons2019", "boissonneault2026"]} />
        </div>
        <div className="card">
          <span className="big">
            <em>13 vs 97</em>
          </span>
          <h3>Wellbeing</h3>
          <p>
            Youth suicides per 100,000 in British Columbia First Nations communities where at least half the members could converse in their language, vs the rest. A
            correlation, and a striking one.
          </p>
          <Cites ids={["hallett2007"]} />
        </div>
        <div className="card">
          <span className="big">
            <em>37%</em>
          </span>
          <h3>Learning</h3>
          <p>
            Nearly 37% of students in low- and middle-income countries are taught in a language they do not understand. In northeast Nigeria, only 23% understood a simple written
            message in Hausa or Kanuri.
          </p>
          <Cites ids={["worldbank2021", "twb2018"]} />
        </div>
      </div>

      <div className="revivals">
        <p className="chart-title">It can be reversed</p>
        <ol>
          {REVIVALS.map((r) => (
            <li key={r.name}>
              <h3>{r.name}</h3>
              <p>{r.line}</p>
              <Src id={r.src} />
            </li>
          ))}
        </ol>
        <p className="chart-src">
          The UN declared 2022–2032 the International Decade of Indigenous Languages (<Src id="undecade" />
          ).
        </p>
      </div>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ 07 talk back */

function TalkBack({ stats }) {
  const cards = [
    {
      q: "“Low-resource just means a small language.”",
      a: "Bhojpuri and Hausa each have tens of millions of speakers and little data. Estonian has about a million speakers and 39 times Hausa's web pages.",
      to: "gap",
    },
    {
      q: "“AI translates everything now.”",
      a: `Machine translation covers ${fmt.format(stats.mt)} of ${fmt.format(stats.living)} living languages, about 4% at most even counting Google's 250+. Where it exists, GPT-4o scores 86.9 in English and 59.0 across African languages.`,
      to: "served",
    },
    {
      q: "“If a language mattered, it would survive on its own.”",
      a: "Across 6,511 languages, endangerment tracks road density and years of schooling. Contact with other languages alone does not predict loss. Survival is not a verdict on a language's worth.",
      to: "stakes",
    },
    {
      q: "“It's just different words for the same things.”",
      a: "Three quarters of 12,495 recorded medicinal plant uses are known in only one language. Some oral traditions appear to recall events 7,000 years old.",
      to: "knowledge",
    },
    {
      q: "“Everyone will speak English eventually. Why bother?”",
      a: "Nearly 37% of students in low- and middle-income countries are already taught in a language they do not understand, and they learn less. Language is how people get schooling, health care and news.",
      to: "stakes",
    },
    {
      q: "“A few thousand speakers can't matter.”",
      a: "In First Nations communities where at least half could converse in their language, youth suicide rates were about a seventh of the rest. The UN made 2022–2032 the Decade of Indigenous Languages.",
      to: "stakes",
    },
    {
      q: "“There's no data, so nothing can be done.”",
      a: "Communities make data. Kinyarwanda speakers recorded 2,003 hours for Common Voice. Te Hiku Media gathered 300 hours of te reo Māori in ten days. Masakhane has 1,000+ members.",
      to: "solutions",
    },
    {
      q: "“Just scrape more text and train a bigger model.”",
      a: "Much low-resource web text is mislabelled or machine-translated, and about 6,500 languages are mainly oral. What gets built, and who controls it, should be the community's call.",
      to: "solutions",
    },
  ];
  return (
    <Chapter
      id="talk-back"
      num="07"
      title="When someone says…"
      tone="tint"
      lede="The objections come up in the same forms every time. Here are short answers, each with its evidence one click away."
    >
      <div className="talk">
        {cards.map((c) => (
          <a key={c.q} className="card talk__card" href={`#${c.to}`}>
            <p className="talk__q">{c.q}</p>
            <p className="talk__a">{c.a}</p>
            <span className="talk__more">
              See the evidence <span className="arrow">→</span>
            </span>
          </a>
        ))}
      </div>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ 08 solutions */

function Solutions({ atlas }) {
  const lt = atlas.littauer;
  const ltLanguages = atlas.meta.coverage.sources.littauer.languages;
  const toolCount = lt.categories.reduce((s, c) => s + c.n, 0);
  const langEntries = lt.sections.reduce((s, x) => s + x.e.length, 0);
  const allEntries = [...lt.categories.flatMap((c) => c.e), ...lt.sections.flatMap((s) => s.e)];
  const archived = allEntries.filter((e) => e.s === "archived").length;
  const dead = allEntries.filter((e) => e.s === "unrecoverable").length;
  const topCats = [...lt.categories]
    .map((c) => ({ label: c.path.at(-1) === "Software" ? "Software" : c.path.join(" · "), value: c.n }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <Chapter
      id="solutions"
      num="08"
      title="What is being done"
      lede="A great deal, by companies, universities and, most effectively, by language communities themselves. The scale numbers below are each project's own, in its own units; they are not comparable across projects."
      takeaway="The most durable progress comes from communities who own their data: Masakhane, Te Hiku Media, the Kinyarwanda Common Voice volunteers. Technology helps when they decide what gets built."
    >
      <div className="solutions">
        {SOLUTION_GROUPS.map((g) => (
          <section key={g.id} className="solutions__group" aria-labelledby={`sol-${g.id}`}>
            <header>
              <h3 id={`sol-${g.id}`}>{g.title}</h3>
              <p className="muted">{g.blurb}</p>
            </header>
            <ul>
              {g.items.map((item) => (
                <li key={item.name}>
                  <a className="sol" href={item.url}>
                    <span className="sol__name">
                      {item.name} <span className="muted">· {item.org}</span>
                    </span>
                    <span className="sol__scale">{item.scale}</span>
                    <span className="sol__meta">
                      {item.date} · {item.license}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="critique">
        <h3>Read before you build</h3>
        <div className="grid-2">
          {CRITIQUES.map((c) => (
            <div key={c.source} className="critique__item">
              <p>{c.text}</p>
              <Src id={c.source} />
            </div>
          ))}
        </div>
        <p className="muted small">
          See also the <Src id="care">CARE Principles</Src> for Indigenous data governance and Te Hiku Media's <Src id="tehiku">Kaitiakitanga License</Src>.
        </p>
      </div>

      <div className="littauer">
        <div className="littauer__intro">
          <p className="eyebrow">Built on a community list</p>
          <h3>Richard Littauer's Awesome Low Resource Languages</h3>
          <p>
            Since 2014, Littauer and contributors have curated open-source tools for low-resource languages. This atlas started from that list. It parses all of it, joins its{" "}
            {lt.sections.length} language sections to {fmt.format(ltLanguages)} languages on the map by ISO code, and puts each tool next to that language's speakers, endangerment,
            data class and support. Click a green dot in the explorer's “Littauer's list” layer to see them.
          </p>
          <ul className="littauer__stats">
            <li>
              <b>{fmt.format(toolCount)}</b> general tools in {lt.categories.length} categories
            </li>
            <li>
              <b>{fmt.format(langEntries)}</b> language-specific resources
            </li>
            <li>
              <b>{fmt.format(archived + dead)}</b> links already archived or gone, a reminder that tools need maintainers
            </li>
          </ul>
          <p>
            <a className="btn btn--ink" href={lt.source.url}>
              Add a tool to the list <span className="arrow">→</span>
            </a>
          </p>
        </div>
        <div>
          <p className="chart-title">What the list contains</p>
          <p className="chart-sub">Largest categories of general tools.</p>
          <BarList rows={topCats} color={LITTAUER} caption="Largest categories in Littauer's list" unit="tools" />
        </div>
      </div>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer({ atlas }) {
  const sys = atlas.meta.coverage.sources.systems;
  return (
    <footer className="footer" id="sources">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <a className="brand" href="#top" style={{ color: "var(--night-ink)" }}>
              <Mark /> Low-Resource Language Atlas
            </a>
            <h2 style={{ marginTop: 20 }}>How this was made</h2>
            <p>
              Every language is a Glottolog 5.4 language (8,243, including 228 sign languages). Other sources join by ISO 639-3 code: speaker counts from Wikidata
              ({fmt.format(atlas.meta.coverage.with_speakers)} languages), NLP data classes from Joshi et al. 2020 (names matched to Glottolog), and the published language lists of
              Google Cloud Translation ({sys.gt.published} entries), NLLB-200 ({sys.nllb.published}), MMS ({sys.mms_asr.published}), Common Voice 27 ({sys.cv.published}) and Wikipedia (
              {sys.wp.published} editions). Macrolanguage codes map to their principal member; codes Glottolog treats as dialects credit their parent language.
            </p>
            <p>
              Speaker figures are uneven: they come from many references and years, and some include second-language speakers. Each one links to its Wikidata statement.
              Ethnologue is not used because its data is proprietary. The pipeline is open source and rebuilds everything from the original sources.
            </p>
            <p>Data generated {atlas.meta.generated}.</p>
          </div>
          <div>
            <h3>Sources</h3>
            <ul className="footer__sources">
              {Object.entries(SOURCES).map(([id, s]) => (
                <li key={id}>
                  <a href={s.url}>{s.short}</a>
                  <span>, {s.title}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Credits and licence</h3>
            <ul>
              <li>
                Language list and resources from <a href={atlas.littauer.source.url}>Awesome Low Resource Languages</a> by Richard Littauer and contributors, CC-BY-SA 4.0.
              </li>
              <li>
                Languages, endangerment and documentation from <a href="https://glottolog.org">Glottolog</a>, CC-BY 4.0.
              </li>
              <li>
                Speaker counts and Wikipedia codes from <a href="https://www.wikidata.org">Wikidata</a>, CC0.
              </li>
              <li>
                Borders from <a href="https://www.naturalearthdata.com">Natural Earth</a> via world-atlas, public domain.
              </li>
              <li>Site text and data are shared under CC-BY-SA 4.0. Code under the MIT licence.</li>
              <li>
                <a href="https://github.com/lindazeng979/low-resource-language-atlas">Source code and data pipeline</a>
              </li>
            </ul>
            <h3 style={{ marginTop: 24 }}>Presenting</h3>
            <p>
              Press → or j for the next chapter and ← or k for the previous one. Every chapter has its own link, for example <code>#gap</code>.
            </p>
          </div>
        </div>
        <p className="footer__legal">Made by Linda Zeng. Errors are mine; corrections welcome through GitHub issues.</p>
      </div>
    </footer>
  );
}
