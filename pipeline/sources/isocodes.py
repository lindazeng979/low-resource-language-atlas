"""One normaliser for every language-code system the atlas meets.

Sources speak five dialects of "language code":
ISO 639-3 (Glottolog, MMS, Wikidata), ``iso3_Script`` (NLLB, FLORES),
ISO 639-1 and BCP-47 (Google, Common Voice), Wikimedia codes (Wikipedia) and
plain English names (Joshi et al.). The atlas maps individual languages, so
everything is normalised to **individual** ISO 639-3 codes:

1. take the base subtag (``hau_Latn`` → ``hau``, ``zh-CN`` → ``zh``);
2. map ISO 639-1 to 639-3 with SIL's code table (``ha`` → ``hau``);
3. map a macrolanguage to its principal member (``msa`` → ``zsm``) using the
   hand-checked table below, because a tool that "supports Malay" supports
   Standard Malay, not all 36 members of the macrolanguage;
4. apply a few explicit overrides for legacy or regional tags.

Everything that fails to normalise is returned, so the build can report it
instead of dropping it silently.
"""

from __future__ import annotations

import csv
import urllib.request
from pathlib import Path

SIL_BASE = "https://iso639-3.sil.org/sites/iso639-3/files/downloads"
TABLES = {
    "iso-639-3.tab": f"{SIL_BASE}/iso-639-3.tab",
    "iso-639-3_Name_Index.tab": f"{SIL_BASE}/iso-639-3_Name_Index.tab",
}

# Macrolanguage → the individual language that tools almost always mean.
# Each entry checked against SIL's macrolanguage table and the tools' own docs.
PRINCIPAL = {
    "ara": "arb", "aze": "azj", "est": "ekk", "fas": "pes", "grn": "gug", "iku": "ike",
    "kok": "gom", "kur": "kmr", "lav": "lvs", "mlg": "plt", "mon": "khk", "msa": "zsm",
    "nep": "npi", "nor": "nob", "ori": "ory", "orm": "gaz", "pus": "pbt", "que": "quy",
    "sqi": "als", "swa": "swh", "uzb": "uzn", "yid": "ydd", "zho": "cmn", "aym": "ayr",
    "kon": "kng", "lah": "pnb", "zza": "diq", "din": "dik", "kau": "knc", "tmh": "taq",
    "ful": "fuv", "bik": "bcl", "srd": "src", "zha": "zyb", "oji": "ojg", "cre": "crk",
    "gon": "gno", "man": "mnk", "bal": "bgp", "hmn": "hnj", "ipk": "esi", "syr": "aii",
    "chm": "mhr", "bua": "bxr", "doi": "dgo", "hbs": "hbs", "mwr": "mwr", "kln": "kln", "luy": "luy", "raj": "raj", "kpe": "kpe",
}
# Macrolanguages whose principal member is genuinely ambiguous map to themselves
# above (mwr, kln, luy, raj, kpe) and then fail to match a Glottolog language;
# the build report lists them rather than guessing.

# Tags that the steps above would get wrong.
OVERRIDES = {
    "iw": "heb", "jw": "jav", "in": "ind", "tl": "tgl", "fil": "fil", "mo": "ron",
    "zh-hk": "yue", "zh-yue": "yue", "yue": "yue", "zh-cn": "cmn", "zh-tw": "cmn", "zh": "cmn",
    "nb": "nob", "nn": "nno", "no": "nob", "sh": "hbs", "sr": "srp", "hr": "hrv", "bs": "bos",
    "ms-arab": "zsm", "pa-arab": "pnb", "mni-mtei": "mni", "ber-latn": "tzm", "bm-nkoo": "bam",
    "crh-latn": "crh", "ndc-zw": "ndc", "ckb": "ckb", "kmr": "kmr", "ku": "kmr",
    "rm-sursilv": "roh", "rm-vallader": "roh", "nan-tw": "nan", "sat-olck": "sat",
    # Wikimedia codes that are not ISO codes.
    "simple": None, "be-tarask": "bel", "bat-smg": "sgs", "fiu-vro": "vro", "roa-rup": "rup",
    "zh-min-nan": "nan", "zh-classical": "lzh", "map-bms": "jav", "nds-nl": "nds",
    "roa-tara": "nap", "eml": "egl", "nah": "nhe", "os": "oss", "cbk-zam": "cbk",
    "als": "gsw", "bh": "bho", "war": "war", "diq": "diq", "lij": "lij", "vec": "vec",
}


def download(raw_dir: Path, *, force: bool = False) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    for name, url in TABLES.items():
        dest = raw_dir / name
        if dest.exists() and not force:
            continue
        request = urllib.request.Request(url, headers={"User-Agent": "low-resource-language-atlas-pipeline/0.2"})
        with urllib.request.urlopen(request, timeout=60) as response:
            dest.write_bytes(response.read())


class Normaliser:
    def __init__(self, raw_dir: Path, macros: dict[str, list[str]]):
        self.part1: dict[str, str] = {}
        self.part2: dict[str, str] = {}
        self.individual: set[str] = set()
        self.names: dict[str, str] = {}
        with (raw_dir / "iso-639-3.tab").open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle, delimiter="\t"):
                code = row["Id"]
                if row["Part1"]:
                    self.part1[row["Part1"]] = code
                if row["Part2b"]:
                    self.part2[row["Part2b"]] = code
                if row["Scope"] == "I":
                    self.individual.add(code)
                self.names[code] = row["Ref_Name"]
        self.macros = macros
        self.unmatched: dict[str, set[str]] = {}

    def to_iso3(self, code: str, *, source: str) -> str | None:
        """Normalise one code to an individual ISO 639-3 code, or None."""
        raw = code.strip()
        key = raw.lower().replace("_", "-")
        if key in OVERRIDES:
            result = OVERRIDES[key]
            if result is None:
                return None
            return result
        base = key.split("-")[0]
        if base in OVERRIDES and OVERRIDES[base]:
            return OVERRIDES[base]
        if len(base) == 2:
            base = self.part1.get(base, base)
        elif base in self.part2 and base not in self.names:
            base = self.part2[base]
        if base in PRINCIPAL:
            base = PRINCIPAL[base]
        if base in self.individual or base in self.names:
            return base
        self.unmatched.setdefault(source, set()).add(raw)
        return None

    def name_index(self, raw_dir: Path) -> dict[str, set[str]]:
        """``{lowercased name: {iso codes}}`` from SIL's name index (print + inverted names)."""
        index: dict[str, set[str]] = {}
        with (raw_dir / "iso-639-3_Name_Index.tab").open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle, delimiter="\t"):
                for name in (row["Print_Name"], row["Inverted_Name"]):
                    index.setdefault(name.lower(), set()).add(row["Id"])
        return index
