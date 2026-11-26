"""Join every non-Glottolog source onto the Glottolog language records.

All joins go through individual ISO 639-3 codes (``isocodes.Normaliser``).
Every source reports how much of it matched, because a silent drop in a join
is the easiest way for a map like this to say something false.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from pipeline.merge import Language
from pipeline.sources import coverage, glottolog, isocodes, joshi, littauer, wikidata

SYSTEM_ORDER = ["gt", "nllb", "mms_asr", "cv", "wp"]


@dataclass
class EnrichReport:
    lines: list[str] = field(default_factory=list)
    numbers: dict = field(default_factory=dict)

    def add(self, line: str) -> None:
        self.lines.append(line)


def enrich(languages: list[Language], languoids: dict, raw_dir: Path) -> tuple[EnrichReport, dict, dict]:
    report = EnrichReport()
    by_glottocode = {language.glottocode: language for language in languages}
    macros = littauer.load_macrolanguages(raw_dir)
    norm = isocodes.Normaliser(raw_dir, macros)
    by_iso = build_iso_index(languages, languoids, macros)

    # ---------------------------------------------------------- speakers
    speakers = wikidata.load_speakers(raw_dir)
    matched = 0
    for iso, info in speakers.items():
        for language in by_iso.get(iso, []):
            language.speakers = info["speakers"]
            language.speakers_year = info["year"]
            language.speakers_source = "wikidata"
            language.wikidata = info["qid"]
            matched += 1
    report.add(f"speakers (Wikidata P1098)  {len(speakers):>5} codes with a figure, {matched:>5} atlas languages filled")
    report.numbers["with_speakers"] = matched

    # ---------------------------------------------------------- tool coverage
    system_codes: dict[str, set[str]] = {}

    def normalise_all(codes, source):
        out = set()
        for code in codes:
            iso = norm.to_iso3(code, source=source)
            if iso:
                out.add(iso)
        return out

    raw_gt = coverage.google(raw_dir)
    system_codes["gt"] = normalise_all(raw_gt, "gt")
    raw_nllb = coverage.nllb(raw_dir)
    system_codes["nllb"] = normalise_all(raw_nllb, "nllb")
    raw_mms = coverage.mms_asr(raw_dir)
    system_codes["mms_asr"] = normalise_all(raw_mms, "mms_asr")
    cv_hours = coverage.common_voice(raw_dir)
    system_codes["cv"] = normalise_all(cv_hours, "cv")

    # Wikipedia: wikimedia code → ISO via Wikidata, then the normaliser.
    wp_counts = coverage.wikipedia(raw_dir)
    wiki_codes = wikidata.load_wiki_codes(raw_dir)
    wp_by_iso: dict[str, tuple[str, int]] = {}
    for wmcode, articles in wp_counts.items():
        isos = {c for c in wiki_codes.get(wmcode, set())}
        if not isos:
            iso = norm.to_iso3(wmcode, source="wp")
            isos = {iso} if iso else set()
        isos = {isocodes.PRINCIPAL.get(i, i) for i in isos}
        for iso in isos:
            # Two editions can share a language (e.g. simple English); keep the larger.
            if iso not in wp_by_iso or wp_by_iso[iso][1] < articles:
                wp_by_iso[iso] = (wmcode, articles)
    system_codes["wp"] = set(wp_by_iso)

    raw_counts = {"gt": len(raw_gt), "nllb": len(raw_nllb), "mms_asr": len(raw_mms), "cv": len(cv_hours), "wp": len(wp_counts)}
    report.numbers["systems"] = {}
    for system in SYSTEM_ORDER:
        hit = 0
        reached = {id(language): language for iso in system_codes[system] for language in by_iso.get(iso, [])}
        for language in reached.values():
            language.coverage.append(system)
        hit = len(reached)
        missing = sorted(system_codes[system] - set(by_iso))
        report.numbers["systems"][system] = {
            "published": raw_counts[system],
            "atlas_languages": hit,
        }
        report.add(
            f"{system:<8} published {raw_counts[system]:>5}  →  {hit:>5} atlas languages"
            + (f"   (no Glottolog language for: {', '.join(missing[:12])}{' …' if len(missing) > 12 else ''})" if missing else "")
        )
    for source, codes in sorted(norm.unmatched.items()):
        report.add(f"   unnormalised {source}: {', '.join(sorted(codes)[:20])}{' …' if len(codes) > 20 else ''}")

    # Several editions can reach one atlas language (Bokmål and Nynorsk both
    # reach Norwegian; Latvian and Latgalian both reach Latvian). Show the
    # largest, so a language is never represented by its smallest edition.
    for iso, (wmcode, articles) in wp_by_iso.items():
        for language in by_iso.get(iso, []):
            if language.wikipedia is None or language.wikipedia["articles"] < articles:
                language.wikipedia = {"code": wmcode, "articles": articles}

    # ---------------------------------------------------------- Joshi classes
    rows = joshi.load(raw_dir)
    def to_language(glottocode: str) -> str | None:
        row = languoids.get(glottocode)
        if row is None:
            return None
        if row["Level"] == "dialect":
            glottocode = row["Language_ID"]
        return glottocode if glottocode in by_glottocode else None

    classes, unmatched = joshi.match(
        rows,
        norm.name_index(raw_dir),
        glottolog.load_names(raw_dir),
        lambda iso: [language.glottocode for language in by_iso.get(iso, [])],
        to_language,
    )
    filled = 0
    for glottocode, cls in classes.items():
        by_glottocode[glottocode].resource_class = cls
        filled += 1
    per_class = Counter(cls for _, cls in rows)
    matched_per_class = Counter(classes.values())
    report.add(
        f"joshi    {len(rows):>5} names  →  {len(classes):>5} codes ({100 * len(classes) / len(rows):.1f}%), {filled} atlas languages"
    )
    report.add("         per class (file / matched): " + ", ".join(f"{c}: {per_class[c]}/{matched_per_class[c]}" for c in range(6)))
    report.numbers["joshi"] = {
        "names": len(rows),
        "matched": len(classes),
        "per_class": {c: per_class[c] for c in range(6)},
        "matched_per_class": {c: matched_per_class[c] for c in range(6)},
        "unmatched_sample": unmatched[:40],
    }

    # ---------------------------------------------------------- Littauer
    sections, categories = littauer.load(raw_dir)
    index = littauer.by_iso(sections)
    lt_hit = 0
    lt_codes_missing = []
    for iso, section_ids in index.items():
        if not section_ids:
            continue
        found = by_iso.get(iso, [])
        if not found:
            lt_codes_missing.append(iso)
        for language in found:
            language.littauer = sorted(set(language.littauer) | set(section_ids))
            lt_hit += 1
    report.add(
        f"littauer {len(sections):>5} sections, {sum(len(s.entries) for s in sections)} entries  →  {lt_hit} atlas languages"
        + (f"   (codes with no Glottolog language: {', '.join(lt_codes_missing)})" if lt_codes_missing else "")
    )
    report.numbers["littauer"] = {"sections": len(sections), "languages": lt_hit}

    littauer_bundle = {
        "source": {
            "name": "Awesome Low Resource Languages, by Richard Littauer and contributors",
            "url": littauer.REPO,
            "commit": littauer.COMMIT,
            "license": littauer.LICENSE,
        },
        "sections": [
            {
                "h": s.heading,
                "code": s.code,
                "autonym": s.autonym,
                "note": s.mapping_note,
                "applies_to": s.applies_to,
                "e": [e.to_json() for e in s.entries],
            }
            for s in sections
        ],
        "categories": [
            {"path": c.path, "n": len(c.entries), "e": [e.to_json() for e in c.entries]} for c in categories
        ],
    }

    extra_sources = {
        "wikidata": {"name": "Wikidata", "url": "https://www.wikidata.org/wiki/Property:P1098", "license": "CC0-1.0", "provides": ["speakers", "wikipedia_codes"]},
        "joshi2020": {
            "name": "Joshi et al. 2020, The State and Fate of Linguistic Diversity and Inclusion in the NLP World",
            "url": "https://aclanthology.org/2020.acl-main.560/",
            "data": joshi.URL,
            "license": "Cited; licence not stated",
            "provides": ["resource_class"],
        },
        "littauer": littauer_bundle["source"] | {"provides": ["littauer"]},
        **{f"coverage_{k}": {"name": v["name"], "url": v["url"], "license": v["license"], "provides": ["coverage"]} for k, v in coverage.SOURCES.items()},
    }
    return report, extra_sources, littauer_bundle


def build_iso_index(languages: list[Language], languoids: dict, macros: dict[str, list[str]]) -> dict[str, list[Language]]:
    """``{iso639_3: [atlas languages]}`` with two fallbacks.

    Glottolog gives some ISO codes to *dialects* (Bosnian, Croatian and Serbian
    are standard varieties of Serbian-Croatian-Bosnian; Bokmål and Nynorsk of
    Norwegian; Twi of Akan). A tool that supports Croatian supports that
    language, so dialect codes resolve to their parent language. And where an
    individual code is absent but its macrolanguage is a Glottolog language
    (lvs → Latvian ``lav``), the macrolanguage is used.
    """
    by_glottocode = {language.glottocode: language for language in languages}
    index: dict[str, list[Language]] = {}
    for language in languages:
        if language.iso639_3:
            index.setdefault(language.iso639_3, []).append(language)
    for row in languoids.values():
        code = row["ISO639P3code"]
        if code and code not in index and row["Level"] == "dialect":
            parent = by_glottocode.get(row["Language_ID"])
            if parent:
                index[code] = [parent]
    for macro, members in macros.items():
        if macro in index:
            for member in members:
                index.setdefault(member, index[macro])
    return index


def write_json(data, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    destination.write_text(payload, encoding="utf-8")
    return len(payload.encode("utf-8"))
