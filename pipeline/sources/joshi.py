"""Joshi et al. (2020), "The State and Fate of Linguistic Diversity and
Inclusion in the NLP World" (ACL). https://aclanthology.org/2020.acl-main.560/

Their taxonomy sorts ~2,500 languages into six classes by how much labelled
and unlabelled data existed in 2020: 0 "The Left-Behinds" to 5 "The Winners".

The file is keyed on lower-case English *names*, not codes, and the original
GitHub repository has been deleted; the GitHub Pages copy still serves it.
Names are matched through SIL's ISO 639-3 name index, then Glottolog's own
names. A name that maps to more than one code is left unmatched rather than
guessed, and the match rate is reported in the build output and on the site.
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

URL = "https://microsoft.github.io/linguisticdiversity/assets/lang2tax.txt"
FILE = "joshi-lang2tax.txt"

# Names in the file that neither index resolves unambiguously, checked by hand
# against the paper's data and the ISO registry.
MANUAL = {
    "chinese": "cmn", "mandarin": "cmn", "arabic": "arb", "persian": "pes", "farsi": "pes",
    "swahili": "swh", "malay": "zsm", "nepali": "npi", "oriya": "ory", "odia": "ory",
    "pashto": "pbt", "uzbek": "uzn", "azerbaijani": "azj", "estonian": "ekk", "latvian": "lvs",
    "kurdish": "kmr", "mongolian": "khk", "albanian": "als", "norwegian": "nob", "konkani": "gom",
    "quechua": "quy", "guarani": "gug", "oromo": "gaz", "malagasy": "plt", "yiddish": "ydd",
    "greek": "ell", "slovenian": "slv", "punjabi": "pan", "panjabi": "pan", "sinhala": "sin",
    "sinhalese": "sin", "tagalog": "tgl", "filipino": "fil", "haitian": "hat", "scottish gaelic": "gla",
    "gaelic": "gla", "irish": "gle", "cantonese": "yue", "javanese": "jav", "sundanese": "sun",
    "bengali": "ben", "bangla": "ben", "hausa": "hau", "yoruba": "yor", "igbo": "ibo", "zulu": "zul",
    "xhosa": "xho", "amharic": "amh", "tigrinya": "tir", "somali": "som", "wolof": "wol",
}


def download(raw_dir: Path, *, force: bool = False) -> None:
    dest = raw_dir / FILE
    if dest.exists() and not force:
        return
    request = urllib.request.Request(URL, headers={"User-Agent": "low-resource-language-atlas-pipeline/0.2"})
    with urllib.request.urlopen(request, timeout=60) as response:
        dest.write_bytes(response.read())


def load(raw_dir: Path) -> list[tuple[str, int]]:
    rows = []
    for line in (raw_dir / FILE).read_text(encoding="utf-8").splitlines():
        if "," not in line:
            continue
        name, _, cls = line.rpartition(",")
        if cls.strip().isdigit():
            rows.append((name.strip().lower(), int(cls)))
    return rows


def match(
    rows: list[tuple[str, int]],
    sil_names: dict[str, set[str]],
    glottolog_names: dict[str, set[str]],
    iso_to_glottocodes,
    to_language,
) -> tuple[dict[str, int], list[str]]:
    """``({glottocode: class}, [unmatched names])``.

    Order: the hand-checked table, then SIL's name index (via ISO codes), then
    Glottolog's alternate names. ``to_language`` lifts a dialect to its
    language. A name is matched only when it resolves to exactly one language.
    """
    classes: dict[str, int] = {}
    unmatched = []
    for name, cls in rows:
        found: set[str] = set()
        if name in MANUAL:
            found = set(iso_to_glottocodes(MANUAL[name]))
        if not found:
            for code in sil_names.get(name, set()):
                found |= set(iso_to_glottocodes(code))
            if len(found) != 1:
                found = set()
        if not found:
            found = {g for g in (to_language(c) for c in glottolog_names.get(name, set())) if g}
        if len(found) != 1:
            unmatched.append(name)
            continue
        glottocode = next(iter(found))
        # Two names can land on one language; keep the higher class.
        classes[glottocode] = max(cls, classes.get(glottocode, -1))
    return classes, unmatched
