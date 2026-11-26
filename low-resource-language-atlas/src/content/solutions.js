/**
 * The solution landscape. Each entry: what it is, its scale with a date, and
 * its licence, because "open" and "non-commercial" decide who can build on it.
 * Counts are in each project's own unit (languages, varieties, labels); they
 * are not comparable across projects and the site says so.
 */
export const SOLUTION_GROUPS = [
  {
    id: "models",
    title: "Build models",
    blurb: "Massively multilingual systems, and regional models built close to their languages.",
    items: [
      { name: "Omnilingual ASR", org: "Meta", scale: "1,600+ languages, ~500 never before transcribed by AI", date: "Nov 2025", license: "Apache 2.0 models, CC-BY data", url: "https://ai.meta.com/blog/omnilingual-asr-advancing-automatic-speech-recognition/" },
      { name: "NLLB-200", org: "Meta", scale: "200 languages, 55 African", date: "Jul 2022", license: "CC-BY-NC 4.0", url: "https://ai.meta.com/research/no-language-left-behind/" },
      { name: "Massively Multilingual Speech", org: "Meta", scale: "Speech recognition and synthesis in 1,107 languages, identification in 4,017", date: "May 2023", license: "CC-BY-NC 4.0", url: "https://arxiv.org/abs/2305.13516" },
      { name: "1,000 Languages Initiative", org: "Google", scale: "Translate covers 250+ languages; 110 added in 2024", date: "Sep 2026", license: "Mostly closed; WAXAL data and TranslateGemma open", url: "https://blog.google/innovation-and-ai/technology/ai/ai-for-every-language/" },
      { name: "MADLAD-400", org: "Google", scale: "Audited web corpus in 419 languages, MT for 450+", date: "Sep 2023", license: "Open data (licence metadata conflicts)", url: "https://arxiv.org/abs/2309.04662" },
      { name: "Aya 101", org: "Cohere Labs", scale: "101 languages, over half lower-resourced", date: "Feb 2024", license: "Apache 2.0", url: "https://huggingface.co/CohereLabs/aya-101" },
      { name: "GlotLID", org: "LMU Munich", scale: "Language identification for ~1,900 languages", date: "v4, 2026", license: "Apache 2.0", url: "https://github.com/cisnlp/GlotLID" },
      { name: "IndicTrans2", org: "AI4Bharat", scale: "All 22 scheduled languages of India", date: "2023", license: "MIT", url: "https://github.com/AI4Bharat/IndicTrans2" },
      { name: "InkubaLM", org: "Lelapa AI", scale: "Small model for 5 African languages", date: "Aug 2024", license: "CC-BY-NC 4.0", url: "https://huggingface.co/lelapa/InkubaLM-0.4B" },
    ],
  },
  {
    id: "data",
    title: "Build data",
    blurb: "Speech, text and labels, often gathered by the communities themselves.",
    items: [
      { name: "Common Voice", org: "Mozilla", scale: "29,295 validated hours in 295 languages; Kinyarwanda alone has 2,003", date: "v27, Sep 2026", license: "CC0 (via Mozilla Data Collective)", url: "https://github.com/common-voice/cv-dataset" },
      { name: "Lacuna Fund", org: "Funder collaborative", scale: "90 open datasets funded for underserved communities", date: "Nov 2026", license: "Open, varies by dataset", url: "https://lacunafund.org/" },
      { name: "Tatoeba", org: "Volunteers", scale: "13.7 million sentences in 432 languages", date: "Nov 2026", license: "Creative Commons", url: "https://tatoeba.org/en/stats/sentences_by_language" },
      { name: "eBible corpus", org: "eBible.org", scale: "1,009 translations in 833 languages", date: "2023", license: "Permissive per translation; religious domain only", url: "https://arxiv.org/abs/2304.09919" },
    ],
  },
  {
    id: "community",
    title: "Communities and governance",
    blurb: "Who decides what gets built, and who benefits from it.",
    items: [
      { name: "Masakhane", org: "Grassroots, pan-African", scale: "1,000+ participants from 30 African countries", date: "Nov 2026", license: "Mostly open", url: "https://www.masakhane.io/" },
      { name: "Te Hiku Media", org: "Māori-led, Aotearoa", scale: "300+ hours of te reo Māori collected in 10 days; Māori data sovereignty", date: "2018–", license: "Kaitiakitanga License", url: "https://tehiku.nz/te-hiku-tech/te-hiku-dev-korero/25141/data-sovereignty-and-the-kaitiakitanga-license" },
      { name: "AmericasNLP", org: "Workshop", scale: "Shared tasks on 14 Indigenous languages of the Americas", date: "2025", license: "Open", url: "https://turing.iimas.unam.mx/americasnlp/2025_st.html" },
      { name: "Ghana NLP", org: "Open-source initiative", scale: "Speech data in 42 Ghanaian languages; Khaya translator", date: "Nov 2026", license: "Open", url: "https://ghananlp.org/" },
      { name: "CARE Principles", org: "Global Indigenous Data Alliance", scale: "Collective benefit, Authority to control, Responsibility, Ethics", date: "2020", license: "CC-BY 4.0", url: "https://doi.org/10.5334/dsj-2020-043" },
    ],
  },
  {
    id: "archive",
    title: "Document and archive",
    blurb: "Recordings, dictionaries and grammars, kept for the long term.",
    items: [
      { name: "ELDP", org: "Arcadia-funded, Berlin", scale: "617 grants, 770+ languages documented, $33.9M awarded", date: "2002–2026", license: "Deposited in ELAR", url: "https://arcadiafund.org.uk/grants/endangered-languages-documentation-programme-eldp" },
      { name: "PARADISEC", org: "Australia", scale: "~20,500 hours of audio in 1,460 languages", date: "Nov 2026", license: "Open with access conditions", url: "https://www.paradisec.org.au/" },
      { name: "Living Dictionaries", org: "Living Tongues Institute", scale: "210+ language communities, 250,000+ entries", date: "Nov 2026", license: "Community-controlled", url: "https://livingtongues.org/about-us/" },
      { name: "Wikitongues", org: "Volunteers", scale: "Oral histories in 820 languages", date: "Oct 2024", license: "Chosen per video", url: "https://wikitongues.org/about/faq/" },
      { name: "FirstVoices", org: "First Peoples' Cultural Council", scale: "Keyboards for 100+ Indigenous languages", date: "Nov 2026", license: "Communities own their data", url: "https://fpcc.ca/firstvoices/" },
    ],
  },
  {
    id: "infra",
    title: "Infrastructure",
    blurb: "The unglamorous layer: scripts, keyboards, grammars, treebanks.",
    items: [
      { name: "Unicode 17.0", org: "Unicode Consortium", scale: "172 scripts encoded; over 170 still are not", date: "Sep 2025", license: "Open standard", url: "https://www.unicode.org/versions/Unicode17.0.0/" },
      { name: "Keyman", org: "SIL Global", scale: "Keyboards for 2,500+ languages", date: "Nov 2026", license: "MIT", url: "https://keyman.com/" },
      { name: "GiellaLT", org: "UiT Arctic University of Norway", scale: "Rule-based tools for 150 languages, Sámi first", date: "Nov 2026", license: "Open source", url: "https://giellalt.github.io/" },
      { name: "Universal Dependencies", org: "600+ contributors", scale: "200+ treebanks in 150+ languages", date: "v2.19, Nov 2026", license: "Per treebank, mostly CC", url: "https://universaldependencies.org/" },
      { name: "Glottolog", org: "MPI EVA", scale: "8,243 languages, 471,399 references", date: "v5.4, Nov 2026", license: "CC-BY 4.0", url: "https://glottolog.org/" },
      { name: "Grambank", org: "MPI EVA and partners", scale: "195 grammatical features for 2,467 varieties", date: "2023", license: "CC-BY 4.0", url: "https://grambank.clld.org/" },
    ],
  },
  {
    id: "measure",
    title: "Measure",
    blurb: "You cannot close a gap you do not measure in the languages themselves.",
    items: [
      { name: "FLORES+", org: "Open Language Data Initiative", scale: "Parallel test sentences in 231 varieties", date: "v5, Nov 2026", license: "CC-BY-SA 4.0", url: "https://huggingface.co/datasets/openlanguagedata/flores_plus" },
      { name: "Belebele", org: "Meta", scale: "Reading comprehension in 122 language variants", date: "2024", license: "CC-BY-SA 4.0", url: "https://github.com/facebookresearch/belebele" },
      { name: "IrokoBench", org: "Masakhane and partners", scale: "Reasoning and knowledge in 17 African languages", date: "2025", license: "Open", url: "https://arxiv.org/abs/2406.03368" },
      { name: "Global MMLU", org: "Cohere Labs", scale: "42 languages, with culturally sensitive questions marked", date: "Dec 2024", license: "Apache 2.0", url: "https://huggingface.co/datasets/CohereLabs/Global-MMLU" },
      { name: "AmericasNLI", org: "AmericasNLP", scale: "Inference in 10 Indigenous languages", date: "2022", license: "Open", url: "https://arxiv.org/abs/2104.08726" },
    ],
  },
];

export const CRITIQUES = [
  { source: "bird2020", text: "Treating Indigenous languages as data to collect can sideline the people who hold them, and repeat the processes that endangered them." },
  { source: "schwartz2022", text: "Indigenous languages are not simply under-resourced: colonialism shapes every interaction with outside researchers. Adopt an ethics framework first." },
  { source: "liu2022", text: "Build what the community asks for. Partnerships with teachers, elders and Master Speakers come before models." },
  { source: "bird2024", text: "About 6,500 languages are mainly oral. They may need non-extractive, relational technology, not machine translation." },
];
