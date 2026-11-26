"""Richard Littauer's "Awesome Low Resource Languages" list, parsed.

https://github.com/RichardLitt/low-resource-languages — CC-BY-SA 4.0.

This is where the atlas started: the June 2026 prototype's seed list was the
list's language sections. Two things come out of it:

* **Per-language resources.** Each "Language Specific Projects" section names
  its ISO 639-3 code on the line under the heading (``_afr :: Afrikaans_``),
  so resources join on codes, not on names. The June prototype matched names
  fuzzily and 29 of its 74 matches came out wrong (Kurdish → Turkish,
  Greenlandic → Icelandic); codes avoid that whole class of error.
* **The landscape.** The generic sections (Software, Corpora, Organizations…)
  are counted and kept, so the site can show what kinds of tools exist.

The README is pinned to a commit so a build is reproducible; bump ``COMMIT``
deliberately to pick up new entries.

Because the list is CC-BY-SA, everything derived from it (the parsed JSON and
the pages that render it) is shared under CC-BY-SA 4.0 with attribution.
"""

from __future__ import annotations

import re
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

COMMIT = "66057f750594f1a4cffed9fb452179aa229e55f8"  # 2026-10-15
REPO = "https://github.com/RichardLitt/low-resource-languages"
RAW_URL = f"https://raw.githubusercontent.com/RichardLitt/low-resource-languages/{COMMIT}/README.md"
LICENSE = "CC-BY-SA-4.0"

# SIL's table of which individual languages make up each ISO macrolanguage.
MACRO_URL = "https://iso639-3.sil.org/sites/iso639-3/files/downloads/iso-639-3-macrolanguages.tab"

# Section codes that cannot be expanded mechanically. Each override is a
# judgement, so each carries its reason, and the site shows the reason.
#
# * ``msa`` (Malay) is a macrolanguage that also contains Indonesian, which the
#   list explicitly excludes as high-resource. Its one entry is Malay-specific.
# * ``sma`` is South Saami's code, but the section is about the Saami languages
#   as a group, and its text names seven of them.
# * ``urj`` is a collective code for the whole Uralic family, which includes
#   Finnish, Estonian and Hungarian. The list excludes those as high-resource
#   (Finnish aside, which it names among Giellatekno's languages), so the
#   section maps to the minority Uralic languages its text names instead.
SAAMI = ["sme", "smj", "sma", "smn", "sjd", "sje", "sms"]
MINORITY_URALIC = ["myv", "mrj", "izh", "kca", "fkv", "kpv", "liv", "mhr", "mdf", "yrk", "nio", "olo", "udm", "vep"]
OVERRIDES: dict[str, tuple[list[str], str]] = {
    "msa": (["zsm"], "Mapped to Standard Malay: the macrolanguage code also covers Indonesian, which the list excludes."),
    "sma": (SAAMI, "The section covers the Saami languages as a group; mapped to the seven it names."),
    "urj": (SAAMI + MINORITY_URALIC, "A collective code for the Uralic family; mapped to the minority Uralic languages the list names."),
}

# The Saami section lists the languages Giellatekno (UiT) builds tools for.
# Codes are ISO 639-3; Finnish and Russian are omitted as high-resource, as
# the list's own definitions section does for its other entries.
GIELLATEKNO = {
    "North Saami": "sme", "Lule Saami": "smj", "South Saami": "sma", "Inari Saami": "smn",
    "Kildin Saami": "sjd", "Pite Saami": "sje", "Skolt Saami": "sms", "Erzya": "myv",
    "Hill Mari": "mrj", "Ingrian": "izh", "Khanty": "kca", "Kven": "fkv", "Komi": "kpv",
    "Livonian": "liv", "Meadow Mari": "mhr", "Moksha": "mdf", "Nenets": "yrk",
    "Nganasan": "nio", "Olonetsian": "olo", "Udmurt": "udm", "Veps": "vep", "Buriat": "bxr",
    "Cornish": "cor", "Faroese": "fao", "Greenlandic": "kal", "Inupiaq": "esi",
    "Northern Haida": "hdn", "Ojibwe": "ojg", "Plains Cree": "crk",
}
GIELLATEKNO_URL = "https://giellalt.github.io/"

HEADING = re.compile(r"^(#{2,4})\s+(.*?)\s*$")
CODE_LINE = re.compile(r"^_([a-z]{3})\s*::\s*(.*?)_\s*$")
# "* [Title](url) - description" with -, —, – or nothing as the separator.
ENTRY = re.compile(r"^\*\s+\[(?P<title>[^\]]+)\]\((?P<url>[^)\s]+)\)\s*(?:[-—–:]\s*)?(?P<desc>.*)$")
BARE_ENTRY = re.compile(r"^\*\s+(?P<title>[^\[\s].*?)\s+[-—–]\s+(?P<desc>.*)$")


@dataclass(slots=True)
class Entry:
    title: str
    url: str | None
    description: str
    # "archived" — link swapped for a Wayback copy; "unrecoverable" — dead.
    status: str | None = None

    def to_json(self) -> dict:
        record = {"t": self.title, "d": self.description}
        if self.url:
            record["u"] = self.url
        if self.status:
            record["s"] = self.status
        return record


@dataclass(slots=True)
class LanguageSection:
    heading: str
    code: str
    autonym: str
    entries: list[Entry] = field(default_factory=list)
    # Individual ISO 639-3 codes this section applies to, after expansion.
    applies_to: list[str] = field(default_factory=list)
    mapping_note: str | None = None


@dataclass(slots=True)
class Category:
    path: list[str]  # e.g. ["Organizations", "On GitHub"]
    entries: list[Entry] = field(default_factory=list)


def download(raw_dir: Path, *, force: bool = False) -> dict[str, Path]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    targets = {"littauer-README.md": RAW_URL, "iso-639-3-macrolanguages.tab": MACRO_URL}
    paths = {}
    for name, url in targets.items():
        dest = raw_dir / name
        paths[name] = dest
        if dest.exists() and not force:
            continue
        request = urllib.request.Request(url, headers={"User-Agent": "low-resource-language-atlas/0.2 (data pipeline)"})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        dest.with_suffix(".part").write_bytes(data)
        dest.with_suffix(".part").replace(dest)
    return paths


def load_macrolanguages(raw_dir: Path) -> dict[str, list[str]]:
    """``{macro code: [active individual member codes]}`` from SIL's table."""
    members: dict[str, list[str]] = {}
    lines = (raw_dir / "iso-639-3-macrolanguages.tab").read_text(encoding="utf-8").splitlines()
    for line in lines[1:]:
        parts = line.split("\t")
        if len(parts) >= 3 and parts[2].strip() == "A":
            members.setdefault(parts[0], []).append(parts[1])
    return members


def _parse_entry(line: str) -> Entry | None:
    status = None
    if "**[archived]**" in line:
        status = "archived"
    elif "**[unrecoverable]**" in line:
        status = "unrecoverable"
    clean = re.sub(r"\s*\*\*\[(archived|unrecoverable)\]\*\*", "", line)
    clean = re.sub(r"\s*<!--.*?-->", "", clean).rstrip()
    if match := ENTRY.match(clean):
        return Entry(match["title"].strip(), match["url"], _strip_md(match["desc"]), status)
    if match := BARE_ENTRY.match(clean):
        return Entry(match["title"].strip(), None, _strip_md(match["desc"]), status)
    return None


def _strip_md(text: str) -> str:
    """Flatten inline Markdown links and emphasis to plain text."""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_`]", "", text)
    return text.strip()


def parse(readme: str) -> tuple[list[LanguageSection], list[Category]]:
    """Split the README into per-language sections and generic categories."""
    sections: list[LanguageSection] = []
    categories: list[Category] = []
    stack: list[str] = []
    in_languages = False
    current_lang: LanguageSection | None = None
    current_cat: Category | None = None
    pending_heading: str | None = None
    skip = {"Contribute", "Table of Contents", "Definitions", "License"}

    for raw in readme.splitlines():
        line = raw.rstrip()
        if heading := HEADING.match(line):
            depth = len(heading[1])
            title = heading[2]
            stack = stack[: depth - 2] + [title]
            current_cat = None
            if depth == 2:
                in_languages = title == "Language Specific Projects"
                current_lang = None
            if in_languages and depth == 3:
                pending_heading = title
                current_lang = None
            elif not in_languages and stack[0] not in skip:
                current_cat = Category(path=list(stack))
                categories.append(current_cat)
            continue

        if in_languages and pending_heading and (code := CODE_LINE.match(line)):
            current_lang = LanguageSection(pending_heading, code[1], code[2].strip())
            sections.append(current_lang)
            pending_heading = None
            continue

        if not line.startswith("* "):
            continue
        entry = _parse_entry(line)
        if entry is None:
            continue
        if in_languages and current_lang is not None:
            current_lang.entries.append(entry)
        elif current_cat is not None:
            current_cat.entries.append(entry)

    return sections, [c for c in categories if c.entries]


def resolve(sections: list[LanguageSection], macros: dict[str, list[str]]) -> None:
    """Fill ``applies_to`` for every section: override, macro expansion, or itself."""
    for section in sections:
        if section.code in OVERRIDES:
            section.applies_to, section.mapping_note = OVERRIDES[section.code]
            section.applies_to = list(section.applies_to)
        elif section.code in macros:
            section.applies_to = list(macros[section.code])
            section.mapping_note = (
                f"{section.heading} is an ISO macrolanguage ({section.code}); "
                f"the list's resources are shown on each of its {len(section.applies_to)} member languages."
            )
        else:
            section.applies_to = [section.code]


def load(raw_dir: Path) -> tuple[list[LanguageSection], list[Category]]:
    sections, categories = parse((raw_dir / "littauer-README.md").read_text(encoding="utf-8"))
    resolve(sections, load_macrolanguages(raw_dir))
    return sections, categories


def by_iso(sections: list[LanguageSection]) -> dict[str, list[int]]:
    """``{individual ISO code: [section indexes]}`` — a language can sit in several."""
    index: dict[str, list[int]] = {}
    for i, section in enumerate(sections):
        for code in section.applies_to:
            index.setdefault(code, []).append(i)
    for code in GIELLATEKNO.values():
        index.setdefault(code, [])
    return index
