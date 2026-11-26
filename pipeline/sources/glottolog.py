"""Download and parse the Glottolog CLDF dataset.

Glottolog (CC-BY-4.0) is the backbone of the atlas. It supplies the identifier
scheme (Glottocodes), coordinates, genealogy, endangerment status, and
documentation level for every languoid it catalogues.

It supplies no speaker counts at all — those come from Wikidata. See the
README for why Ethnologue, the comprehensive source for population figures,
cannot be used here.
"""

from __future__ import annotations

import csv
import sys
import urllib.request
from pathlib import Path
from typing import Iterator, NamedTuple

BASE_URL = "https://raw.githubusercontent.com/glottolog/glottolog-cldf/v5.4/cldf"  # pinned release, 2026-11-10

# values.csv is ~20 MB, so it is always streamed and filtered rather than
# loaded whole. The other two tables are small enough to read into memory.
TABLES = ("languages.csv", "values.csv", "codes.csv", "names.csv")

# Parameters worth carrying out of values.csv. The full table has eight; the
# rest (bib, medovertime, level, subclassification) are either huge or already
# represented as columns in languages.csv.
WANTED_PARAMETERS = ("aes", "med", "classification", "category")

# csv's default field-size limit is smaller than some Glottolog classification
# paths and Newick subtrees.
csv.field_size_limit(min(sys.maxsize, 2**31 - 1))


def download(raw_dir: Path, *, force: bool = False) -> dict[str, Path]:
    """Fetch the CLDF tables into ``raw_dir``, skipping any already present.

    Returns a mapping of table name to local path. Writes to a temporary file
    first so an interrupted download never leaves a truncated CSV that would
    parse as valid-but-incomplete data.
    """
    raw_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}

    for table in TABLES:
        dest = raw_dir / table
        paths[table] = dest
        if dest.exists() and not force:
            continue

        tmp = dest.with_suffix(dest.suffix + ".part")
        request = urllib.request.Request(
            f"{BASE_URL}/{table}",
            headers={"User-Agent": "language-atlas/0.1 (data pipeline)"},
        )
        with urllib.request.urlopen(request, timeout=120) as response, tmp.open("wb") as out:
            while chunk := response.read(1 << 20):
                out.write(chunk)
        tmp.replace(dest)

    return paths


def load_languoids(raw_dir: Path) -> dict[str, dict[str, str]]:
    """Read languages.csv into ``{glottocode: row}`` across every level.

    Families and dialects are kept here even though the atlas only maps
    languages: family rows supply the names used to label the tree, and dialect
    rows are needed to resolve a dialect's parent language.
    """
    with (raw_dir / "languages.csv").open(encoding="utf-8", newline="") as handle:
        return {row["ID"]: row for row in csv.DictReader(handle)}


class Value(NamedTuple):
    """One parameter value for one languoid.

    ``value`` is the raw cell: an ordinal for ``aes``/``med``, a slash-separated
    ancestry path for ``classification``, an underscored name for ``category``.
    ``code_id`` points into codes.csv for the parameters that are categorical,
    and is empty for the ones that are not.
    """

    value: str
    code_id: str


def stream_values(
    raw_dir: Path, parameters: tuple[str, ...] = WANTED_PARAMETERS
) -> Iterator[tuple[str, str, Value]]:
    """Yield ``(glottocode, parameter, Value)`` for wanted parameters.

    Streamed because values.csv is ~20 MB and roughly 95% of it is parameters
    the atlas does not use.
    """
    wanted = set(parameters)
    with (raw_dir / "values.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["Parameter_ID"] in wanted:
                yield row["Language_ID"], row["Parameter_ID"], Value(row["Value"], row["Code_ID"])


def load_values(
    raw_dir: Path, parameters: tuple[str, ...] = WANTED_PARAMETERS
) -> dict[str, dict[str, Value]]:
    """Collect wanted parameters into ``{glottocode: {parameter: Value}}``."""
    collected: dict[str, dict[str, Value]] = {}
    for glottocode, parameter, value in stream_values(raw_dir, parameters):
        collected.setdefault(glottocode, {})[parameter] = value
    return collected


def load_code_labels(raw_dir: Path) -> dict[str, str]:
    """Read codes.csv into ``{code_id: human label}``.

    Keyed on ``Code_ID`` because that is what values.csv references — the terse
    ordinal in a value cell (``aes`` 5) is only meaningful once resolved
    through its code (``aes-nearly_extinct`` → "nearly extinct").
    """
    with (raw_dir / "codes.csv").open(encoding="utf-8", newline="") as handle:
        return {row["ID"]: row["Name"] for row in csv.DictReader(handle)}


def load_code_descriptions(raw_dir: Path) -> dict[str, str]:
    """Read codes.csv into ``{code_id: Glottolog's own definition}``.

    A label like "grammar sketch" does not tell a reader what qualifies as one.
    Glottolog answers that in the ``Description`` column ("Grammar with more
    than 300 pages" and so on), so the atlas quotes it rather than paraphrasing
    — the definitions are the catalogue's, and inventing our own wording would
    quietly change what the map claims.
    """
    with (raw_dir / "codes.csv").open(encoding="utf-8", newline="") as handle:
        return {
            row["ID"]: row["Description"] for row in csv.DictReader(handle) if row["Description"]
        }


def load_names(raw_dir: Path) -> dict[str, set[str]]:
    """``{lower-cased name: {glottocode}}`` from Glottolog's 120k alternate names.

    Used to match sources that key on names (Joshi et al.) — older English
    names, endonyms and spelling variants all live here.
    """
    index: dict[str, set[str]] = {}
    with (raw_dir / "names.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            index.setdefault(row["Name"].strip().lower(), set()).add(row["Language_ID"])
    return index
