"""Serialise merged records into the bundle the web app loads.

The whole dataset ships to the browser in one request, so the wire format uses
short keys and omits empty fields. That is the only reason it is terse — every
consumer goes through ``web/src/datasource.js``, which restores full names.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from pipeline.merge import Language, MergeStats

SCHEMA_VERSION = 1

SOURCES = {
    "glottolog": {
        "name": "Glottolog",
        "url": "https://glottolog.org",
        "cldf": "https://github.com/glottolog/glottolog-cldf",
        "license": "CC-BY-4.0",
        "provides": [
            "glottocode",
            "iso639_3",
            "coordinates",
            "family",
            "classification",
            "endangerment",
            "documentation",
        ],
    },
    # Further sources are registered by pipeline/enrich.py at build time,
    # each with its own licence and the fields it provides.
}

# Wire keys. Kept in one place so the JS side has a single thing to mirror.
KEYS = {
    "glottocode": "g",
    "name": "n",
    "iso639_3": "i",
    "latitude": "y",
    "longitude": "x",
    "family_id": "f",
    "macroareas": "m",
    "countries": "co",
    "category": "cat",
    "is_isolate": "il",
    "classification": "cl",
    "aes": "ae",
    "med": "md",
    "speakers": "s",
    "speakers_year": "sy",
    "speakers_source": "sp",
    "wikidata": "wd",
    "resource_class": "rc",
    "wikipedia": "wp",
    "coverage": "cv",
    "littauer": "lt",
}


def language_to_wire(language: Language) -> dict[str, Any]:
    """Convert one record to its wire form, omitting anything empty.

    Omission rather than ``null`` because across ~8,000 records the difference
    is a meaningful slice of the payload, and absent-means-unknown is a rule
    the client applies uniformly anyway.
    """
    record: dict[str, Any] = {KEYS["glottocode"]: language.glottocode, KEYS["name"]: language.name}

    optional = (
        ("iso639_3", language.iso639_3),
        ("latitude", language.latitude),
        ("longitude", language.longitude),
        ("family_id", language.family_id),
        ("macroareas", language.macroareas),
        ("countries", language.countries),
        ("category", language.category),
        ("classification", language.classification),
        ("aes", language.aes),
        ("med", language.med),
        ("speakers", language.speakers),
        ("speakers_year", language.speakers_year),
        ("speakers_source", language.speakers_source),
        ("wikidata", language.wikidata),
        ("resource_class", language.resource_class),
        ("wikipedia", language.wikipedia),
        ("coverage", language.coverage),
        ("littauer", language.littauer),
    )
    for name, value in optional:
        if value not in (None, [], ""):
            record[KEYS[name]] = value

    # Only ~180 languages are isolates, so the flag is cheaper as a presence
    # marker than as a boolean on every record.
    if language.is_isolate:
        record[KEYS["is_isolate"]] = 1

    return record


def collect_labels(languages: list[Language]) -> dict[str, dict[int, str]]:
    """Derive ordinal-to-label maps for the categorical scales.

    Built from the records themselves rather than re-reading codes.csv, so the
    bundle can only ever describe values it actually contains.
    """
    labels: dict[str, dict[int, str]] = {"aes": {}, "med": {}}
    for language in languages:
        if language.aes is not None and language.aes_label:
            labels["aes"][language.aes] = language.aes_label
        if language.med is not None and language.med_label:
            labels["med"][language.med] = language.med_label
    return {scale: dict(sorted(values.items())) for scale, values in labels.items()}


def collect_definitions(languages: list[Language]) -> dict[str, dict[int, str]]:
    """Derive ordinal-to-definition maps, in Glottolog's own words.

    A label names a level; a definition says what qualifies as one. "Grammar
    sketch" is not self-explanatory and neither is "phonology/text", so the UI
    can show what the catalogue actually means by them instead of leaving the
    reader to guess at a colour.
    """
    definitions: dict[str, dict[int, str]] = {"aes": {}, "med": {}}
    for language in languages:
        if language.aes is not None and language.aes_description:
            definitions["aes"][language.aes] = language.aes_description
        if language.med is not None and language.med_description:
            definitions["med"][language.med] = language.med_description
    return {scale: dict(sorted(values.items())) for scale, values in definitions.items()}


def build_bundle(
    languages: list[Language],
    families: dict[str, str],
    stats: MergeStats,
    extra_sources: dict[str, Any] | None = None,
    enrichment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Assemble the full bundle, coverage numbers included.

    Coverage ships *inside* the data so the UI can state what it does not know
    without a second file to keep in sync.
    """
    return {
        "schema_version": SCHEMA_VERSION,
        "generated": date.today().isoformat(),
        "sources": {**SOURCES, **(extra_sources or {})},
        "keys": KEYS,
        "scales": {
            # MED runs the opposite way to intuition; say so where a client can read it.
            "med": {"direction": "lower_is_better_documented", "range": [0, 4]},
            "aes": {"direction": "higher_is_more_endangered", "range": [1, 6]},
        },
        "labels": collect_labels(languages),
        "definitions": collect_definitions(languages),
        "coverage": {
            "languages": stats.kept,
            "with_coordinates": stats.with_coordinates,
            "with_iso639_3": stats.with_iso,
            "with_family": stats.with_family,
            "with_endangerment": stats.with_aes,
            "with_documentation": stats.with_med,
            "with_speakers": stats.with_speakers,
            "excluded_artifacts": stats.excluded_artifacts,
            **(enrichment or {}),
        },
        "families": families,
        "languages": [language_to_wire(language) for language in languages],
    }


def write_bundle(bundle: dict[str, Any], destination: Path) -> int:
    """Write the bundle as compact JSON. Returns bytes written."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    destination.write_text(payload, encoding="utf-8")
    return len(payload.encode("utf-8"))
