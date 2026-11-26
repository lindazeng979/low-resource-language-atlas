"""Speaker counts and Wikipedia code mappings from Wikidata (CC0).

Glottolog has no speaker counts at all and Ethnologue is proprietary, so
Wikidata's P1098 ("number of speakers") is the only open source. It is uneven:
figures come from many references and years, some are first-language only,
some include second-language speakers. The atlas keeps one figure per
language, chosen by explicit rules (``pick``), and always shows its year and a
link to the statement.

The query service rate-limits bursts, so queries run one at a time with a
pause and a retry on HTTP 429. Results are cached in data/raw.
"""

from __future__ import annotations

import csv
import io
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENDPOINT = "https://query.wikidata.org/sparql"
UA = "low-resource-language-atlas-pipeline/0.2 (static site build; contact via repository issues)"

FIRST_LANGUAGE = "http://www.wikidata.org/entity/Q36870"
SECOND_LANGUAGE = "http://www.wikidata.org/entity/Q125421"
PREFERRED = "http://wikiba.se/ontology#PreferredRank"

SPEAKERS_QUERY = """
SELECT ?lang ?iso3 ?st ?speakers ?date ?appliesTo ?rank ?refURL ?statedIn WHERE {
  ?lang wdt:P220 ?iso3 ;
        p:P1098 ?st .
  ?st ps:P1098 ?speakers ;
      wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st pq:P585 ?date . }
  OPTIONAL { ?st pq:P518 ?appliesTo . }
  OPTIONAL { ?st prov:wasDerivedFrom/pr:P854 ?refURL . }
  OPTIONAL { ?st prov:wasDerivedFrom/pr:P248 ?statedIn . }
}
"""

WIKI_CODES_QUERY = """
SELECT ?wmcode ?iso3 WHERE {
  ?wiki wdt:P31 wd:Q10876391 ;
        wdt:P424 ?wmcode ;
        wdt:P407 ?lang .
  ?lang wdt:P220 ?iso3 .
}
"""

FILES = {"speakers": "wikidata-speakers.csv", "wiki_codes": "wikidata-wikipedia-codes.csv"}


def _run(query: str) -> str:
    body = urllib.parse.urlencode({"query": query}).encode()
    for attempt in range(5):
        request = urllib.request.Request(
            ENDPOINT,
            data=body,
            headers={"User-Agent": UA, "Accept": "text/csv", "Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            if error.code in (429, 503) and attempt < 4:
                wait = int(error.headers.get("Retry-After") or 65)
                print(f"    wikidata: HTTP {error.code}, waiting {wait}s")
                time.sleep(wait)
                continue
            raise
    raise RuntimeError("unreachable")


def download(raw_dir: Path, *, force: bool = False) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    first = True
    for key, query in (("speakers", SPEAKERS_QUERY), ("wiki_codes", WIKI_CODES_QUERY)):
        dest = raw_dir / FILES[key]
        if dest.exists() and not force:
            continue
        if not first:
            time.sleep(65)  # the service allowed ~1 query/minute in Nov 2026
        first = False
        print(f"    wikidata: querying {key}")
        dest.write_text(_run(query), encoding="utf-8")


def _year(date: str) -> int | None:
    return int(date[:4]) if date[:4].isdigit() else None


def pick(rows: list[dict]) -> dict | None:
    """Choose one speaker figure from a language's statements.

    Rules, in order: drop second-language-only figures; prefer statements the
    community marked preferred; prefer first-language or unqualified figures
    over ones that apply to a part (a single country, say); prefer the most
    recent date; prefer referenced statements; then the larger value.
    """
    candidates = [r for r in rows if r["appliesTo"] != SECOND_LANGUAGE]
    if not candidates:
        return None

    def key(r: dict):
        return (
            r["rank"] == PREFERRED,
            r["appliesTo"] in ("", FIRST_LANGUAGE),
            _year(r["date"]) or 0,
            bool(r["refURL"] or r["statedIn"]),
            float(r["speakers"]),
        )

    return max(candidates, key=key)


def load_speakers(raw_dir: Path) -> dict[str, dict]:
    """``{iso639_3: {speakers, year, qid}}``."""
    text = (raw_dir / FILES["speakers"]).read_text(encoding="utf-8")
    statements: dict[str, dict[str, dict]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        try:
            float(row["speakers"])
        except ValueError:
            continue
        # One row per statement × reference: dedupe on the statement.
        statements.setdefault(row["iso3"], {}).setdefault(row["st"], row)
    result = {}
    for iso, by_statement in statements.items():
        chosen = pick(list(by_statement.values()))
        if chosen is None:
            continue
        speakers = int(float(chosen["speakers"]))
        if speakers <= 0:
            continue
        result[iso] = {
            "speakers": speakers,
            "year": _year(chosen["date"]),
            "qid": chosen["lang"].rsplit("/", 1)[-1],
        }
    return result


def load_wiki_codes(raw_dir: Path) -> dict[str, set[str]]:
    """``{wikimedia code: {iso639_3}}``."""
    text = (raw_dir / FILES["wiki_codes"]).read_text(encoding="utf-8")
    mapping: dict[str, set[str]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        mapping.setdefault(row["wmcode"], set()).add(row["iso3"])
    return mapping
