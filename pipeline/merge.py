"""Merge source tables into the atlas's unified language records.

Every field carries its origin, because the sources disagree in coverage and
recency and the UI promises to show where each number came from. Right now all
fields originate in Glottolog; speaker counts (Wikidata) and NLP resource
classes (Joshi et al.) join here in later phases.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from pipeline.sources.glottolog import Value

# Glottolog's "Bookkeeping" category holds catalogue artifacts rather than
# languages: retired ISO codes, spurious entries, and duplicates kept only so
# old identifiers keep resolving. They are excluded from the atlas by default
# and counted in the build report so the exclusion stays visible.
ARTIFACT_CATEGORIES = frozenset({"Bookkeeping"})


@dataclass(slots=True)
class Language:
    """One mappable language, assembled from every source."""

    glottocode: str
    name: str
    iso639_3: str | None
    latitude: float | None
    longitude: float | None
    family_id: str | None
    macroareas: list[str]
    countries: list[str]
    category: str | None
    is_isolate: bool
    # Ancestry from family root down to (but excluding) this language.
    classification: list[str]
    # Agglomerated Endangerment Status: 1 (not endangered) .. 6 (extinct).
    aes: int | None = None
    aes_label: str | None = None
    aes_description: str | None = None
    # Most Extensive Description. NOTE the scale is inverted relative to every
    # other measure here: 0 is a long grammar, 4 is a wordlist or less. Lower
    # means *better* documented.
    med: int | None = None
    med_label: str | None = None
    med_description: str | None = None
    # Filled by pipeline/enrich.py from sources other than Glottolog.
    speakers: int | None = None
    speakers_year: int | None = None
    speakers_source: str | None = None
    wikidata: str | None = None
    resource_class: int | None = None
    wikipedia: dict | None = None  # {"code": "ha", "articles": 12345}
    coverage: list[str] = field(default_factory=list)  # system ids, see enrich.SYSTEMS
    littauer: list[int] = field(default_factory=list)  # indexes into littauer.json sections

    @property
    def is_mappable(self) -> bool:
        return self.latitude is not None and self.longitude is not None


@dataclass(slots=True)
class MergeStats:
    """Counts worth surfacing after a build, so data loss is never silent."""

    languoids_total: int = 0
    languages_total: int = 0
    excluded_artifacts: int = 0
    kept: int = 0
    with_coordinates: int = 0
    with_iso: int = 0
    with_family: int = 0
    with_aes: int = 0
    with_med: int = 0
    with_speakers: int = 0
    by_category: Counter[str] = field(default_factory=Counter)
    families: int = 0


def _split(cell: str, separator: str) -> list[str]:
    """Split a Glottolog multi-value cell, dropping empties."""
    return [part for part in cell.split(separator) if part]


def _to_float(cell: str) -> float | None:
    return float(cell) if cell else None


def _to_int(cell: str) -> int | None:
    return int(cell) if cell else None


def build_languages(
    languoids: dict[str, dict[str, str]],
    values: dict[str, dict[str, Value]],
    code_labels: dict[str, str],
    code_descriptions: dict[str, str] | None = None,
) -> tuple[list[Language], MergeStats]:
    """Assemble language records from the parsed Glottolog tables.

    Only ``Level == "language"`` rows become records — families are structure,
    dialects are sub-lects, and neither belongs as a point on the map. Both are
    still reachable: families through ``classification``, dialects through
    their parent's Glottocode.
    """
    stats = MergeStats(languoids_total=len(languoids))
    languages: list[Language] = []
    descriptions = code_descriptions or {}

    for glottocode, row in languoids.items():
        if row["Level"] != "language":
            continue
        stats.languages_total += 1

        parameters = values.get(glottocode, {})
        category = parameters["category"].value if "category" in parameters else None
        if category in ARTIFACT_CATEGORIES:
            stats.excluded_artifacts += 1
            continue

        aes = parameters.get("aes")
        med = parameters.get("med")
        classification = parameters.get("classification")

        iso639_3 = row["ISO639P3code"] or None

        language = Language(
            glottocode=glottocode,
            name=row["Name"],
            iso639_3=iso639_3,
            latitude=_to_float(row["Latitude"]),
            longitude=_to_float(row["Longitude"]),
            family_id=row["Family_ID"] or None,
            macroareas=_split(row["Macroarea"], ";"),
            countries=_split(row["Countries"], ";"),
            category=category,
            is_isolate=row["Is_Isolate"].lower() == "true",
            classification=_split(classification.value, "/") if classification else [],
            aes=_to_int(aes.value) if aes else None,
            aes_label=code_labels.get(aes.code_id) if aes else None,
            aes_description=descriptions.get(aes.code_id) if aes else None,
            med=_to_int(med.value) if med else None,
            med_label=code_labels.get(med.code_id) if med else None,
            med_description=descriptions.get(med.code_id) if med else None,
        )
        languages.append(language)

        stats.kept += 1
        stats.with_coordinates += language.is_mappable
        stats.with_iso += language.iso639_3 is not None
        stats.with_family += language.family_id is not None
        stats.with_aes += language.aes is not None
        stats.with_med += language.med is not None
        if category:
            stats.by_category[category] += 1

    languages.sort(key=lambda language: language.glottocode)
    return languages, stats


def collect_families(
    languages: list[Language], languoids: dict[str, dict[str, str]]
) -> dict[str, str]:
    """Map every family Glottocode referenced by a language to its name.

    Covers both the top-level ``family_id`` and every intermediate node in a
    language's ``classification`` path, so the tree can be labelled at any
    depth without another lookup table.
    """
    families: dict[str, str] = {}
    for language in languages:
        codes = list(language.classification)
        if language.family_id:
            codes.append(language.family_id)
        for code in codes:
            if code not in families and (row := languoids.get(code)):
                families[code] = row["Name"]
    return families
