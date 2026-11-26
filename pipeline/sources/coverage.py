"""Which languages do the big tools actually support?

Each fetcher returns the raw codes a system publishes; ``isocodes.Normaliser``
turns them into individual ISO 639-3 codes. Every list is fetched from the
system's own published artefact, never from a third-party summary:

* Google Translate — the NMT table on Google Cloud's official language page.
* NLLB-200 — the language tokens in the released model's tokenizer config.
* MMS speech recognition — Meta's published coverage table (ASR column).
* Common Voice — the versioned v27 release metadata (locales with validated hours).
* Wikipedia — wikistats' table of editions with article counts; codes are
  mapped to ISO through Wikidata (see wikidata.py).

Lists of supported languages are facts, but several come from CC-BY-NC
releases (NLLB, MMS); the site cites each one.
"""

from __future__ import annotations

import csv
import html
import io
import json
import re
import urllib.request
from pathlib import Path

UA = {"User-Agent": "low-resource-language-atlas-pipeline/0.2"}

SOURCES = {
    "gt": {
        "name": "Google Translate (Cloud Translation, NMT model)",
        "url": "https://docs.cloud.google.com/translate/docs/languages",
        "file": "google-translate-languages.html",
        "license": "Page text CC-BY-4.0",
    },
    "nllb": {
        "name": "NLLB-200 (Meta), tokenizer language tokens",
        "url": "https://huggingface.co/facebook/nllb-200-distilled-600M/raw/main/special_tokens_map.json",
        "file": "nllb-special-tokens.json",
        "license": "CC-BY-NC-4.0",
    },
    "mms_asr": {
        "name": "Massively Multilingual Speech (Meta), coverage table",
        "url": "https://dl.fbaipublicfiles.com/mms/misc/language_coverage_mms.html",
        "file": "mms-coverage.html",
        "license": "CC-BY-NC-4.0",
    },
    "cv": {
        "name": "Mozilla Common Voice 27.0 release metadata",
        "url": "https://raw.githubusercontent.com/common-voice/cv-dataset/main/datasets/scripted-speech/cv-corpus-27.0-2026-09-11.json",
        "file": "common-voice-27.json",
        "license": "Dataset CC0-1.0",
    },
    "wp": {
        "name": "Wikipedia editions with article counts (wikistats)",
        "url": "https://wikistats.wmcloud.org/api.php?action=dump&table=wikipedias&format=csv",
        "file": "wikistats-wikipedias.csv",
        "license": "Wikimedia data (CC0)",
    },
}


def download(raw_dir: Path, *, force: bool = False) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    for spec in SOURCES.values():
        dest = raw_dir / spec["file"]
        if dest.exists() and not force:
            continue
        request = urllib.request.Request(spec["url"], headers=UA)
        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read()
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.write_bytes(data)
        tmp.replace(dest)


def google(raw_dir: Path) -> list[str]:
    """Codes from the second table (NMT model) of Google's language page.

    Cells like "zh-CN or zh (BCP-47)" or "iw or he" carry alternatives; the
    first token is the code Google uses, and the normaliser knows the legacy ones.
    """
    page = (raw_dir / SOURCES["gt"]["file"]).read_text(encoding="utf-8")
    tables = re.findall(r"<table>(.*?)</table>", page, re.S)
    if len(tables) < 2:
        raise RuntimeError("Google's language page changed shape: NMT table not found")
    codes = []
    for row in re.findall(r"<tr>(.*?)</tr>", tables[1], re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) >= 2 and cells[1]:
            codes.append(cells[1].split()[0])
    return codes


def nllb(raw_dir: Path) -> list[str]:
    data = json.loads((raw_dir / SOURCES["nllb"]["file"]).read_text(encoding="utf-8"))
    tokens = data["additional_special_tokens"]
    return [t for t in tokens if re.fullmatch(r"[a-z]{3}_[A-Z][a-z]{3}", t)]


def mms_asr(raw_dir: Path) -> list[str]:
    """ISO codes whose ASR cell is ticked in Meta's coverage table."""
    page = (raw_dir / SOURCES["mms_asr"]["file"]).read_text(encoding="utf-8")
    header = re.search(r"<tr>(.*?)</tr>", page, re.S)
    columns = [re.sub(r"<[^>]+>", "", c).strip().lower() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", header[1], re.S)]
    asr = next(i for i, c in enumerate(columns) if "asr" in c)
    codes = []
    for row in re.findall(r"<tr>(.*?)</tr>", page, re.S)[1:]:
        cells = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) > asr and "✔" in cells[asr]:
            codes.append(cells[0])
    return codes


def common_voice(raw_dir: Path) -> dict[str, float]:
    """``{locale: validated hours}`` for locales with any validated speech."""
    data = json.loads((raw_dir / SOURCES["cv"]["file"]).read_text(encoding="utf-8"))
    return {
        locale: float(info.get("validHrs") or 0)
        for locale, info in data["locales"].items()
        if float(info.get("validHrs") or 0) > 0
    }


def wikipedia(raw_dir: Path) -> dict[str, int]:
    """``{wikimedia code: content articles}`` for open Wikipedias."""
    text = (raw_dir / SOURCES["wp"]["file"]).read_text(encoding="utf-8")
    counts = {}
    for row in csv.DictReader(io.StringIO(text)):
        prefix = (row.get("prefix") or "").strip()
        good = row.get("good") or "0"
        if prefix and good.isdigit() and int(good) > 0:
            counts[prefix] = int(good)
    return counts
