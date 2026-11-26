"""Tests for the data pipeline.

These build tiny CLDF tables in a temp directory rather than checking in
fixture files, so a test reads as a complete statement of the case it covers.
The upstream-shape tests at the bottom run only when real data has been
fetched — they are the ones that fail loudly if Glottolog changes format.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from pipeline import emit, merge
from pipeline.sources import glottolog, joshi, littauer, wikidata

LANGUAGE_COLUMNS = [
    "ID", "Name", "Macroarea", "Latitude", "Longitude", "Glottocode", "ISO639P3code",
    "Level", "Countries", "Family_ID", "Language_ID", "Closest_ISO369P3code",
    "First_Year_Of_Documentation", "Last_Year_Of_Documentation", "Is_Isolate",
]


def _write_csv(path: Path, columns: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in columns})


def _languoid(id: str, name: str, level: str, **overrides: str) -> dict[str, str]:
    return {"ID": id, "Name": name, "Level": level, "Glottocode": id, **overrides}


@pytest.fixture
def raw_dir(tmp_path: Path) -> Path:
    """A miniature Glottolog: one family, one language, one dialect, one artifact."""
    _write_csv(
        tmp_path / "languages.csv",
        LANGUAGE_COLUMNS,
        [
            _languoid("fami1234", "Testic", "family"),
            _languoid("subf1234", "Sub-Testic", "family"),
            _languoid(
                "good1234", "Goodlang", "language",
                Latitude="10.5", Longitude="-20.25", ISO639P3code="gdl",
                Family_ID="fami1234", Macroarea="Africa;Eurasia",
                Countries="KE;TZ", Is_Isolate="false",
            ),
            _languoid(
                "lone1234", "Lonelang", "language",
                Latitude="1.0", Longitude="2.0", Is_Isolate="true",
            ),
            _languoid(
                "wide1234", "Widelang", "language",
                Latitude="3.0", Longitude="4.0", ISO639P3code="swh",
            ),
            _languoid("dial1234", "Dialect", "dialect", Language_ID="good1234"),
            _languoid("junk1234", "Retired Thing", "language", ISO639P3code="ret"),
        ],
    )
    _write_csv(
        tmp_path / "values.csv",
        ["ID", "Language_ID", "Parameter_ID", "Value", "Code_ID"],
        [
            {"ID": "1", "Language_ID": "good1234", "Parameter_ID": "aes", "Value": "3", "Code_ID": "aes-shifting"},
            {"ID": "2", "Language_ID": "good1234", "Parameter_ID": "med", "Value": "1", "Code_ID": "med-grammar"},
            {"ID": "3", "Language_ID": "good1234", "Parameter_ID": "classification", "Value": "fami1234/subf1234/"},
            {"ID": "4", "Language_ID": "good1234", "Parameter_ID": "category", "Value": "Spoken_L1_Language", "Code_ID": "category-Spoken_L1_Language"},
            {"ID": "5", "Language_ID": "junk1234", "Parameter_ID": "category", "Value": "Bookkeeping", "Code_ID": "category-Bookkeeping"},
            {"ID": "6", "Language_ID": "good1234", "Parameter_ID": "bib", "Value": "ignored"},
        ],
    )
    _write_csv(
        tmp_path / "codes.csv",
        ["ID", "Parameter_ID", "Name", "Description", "numerical_value"],
        [
            {"ID": "aes-shifting", "Parameter_ID": "aes", "Name": "shifting",
             "Description": "Most children speak it, but only some of the time", "numerical_value": "3"},
            {"ID": "med-grammar", "Parameter_ID": "med", "Name": "grammar",
             "Description": "Grammar with less than 300 pages", "numerical_value": "1"},
        ],
    )
    return tmp_path


@pytest.fixture
def merged(raw_dir: Path):
    languoids = glottolog.load_languoids(raw_dir)
    values = glottolog.load_values(raw_dir)
    labels = glottolog.load_code_labels(raw_dir)
    descriptions = glottolog.load_code_descriptions(raw_dir)
    languages, stats = merge.build_languages(languoids, values, labels, descriptions)
    return languages, stats, languoids


class TestParsing:
    def test_only_wanted_parameters_are_streamed(self, raw_dir: Path) -> None:
        values = glottolog.load_values(raw_dir)
        assert "bib" not in values["good1234"], "bib is huge and unused; it must not be carried"

    def test_code_labels_key_on_code_id(self, raw_dir: Path) -> None:
        # values.csv references codes by Code_ID, so keying on anything else
        # silently yields no labels at all.
        assert glottolog.load_code_labels(raw_dir)["aes-shifting"] == "shifting"


class TestMerge:
    def test_keeps_only_language_level(self, merged) -> None:
        languages, _stats, _ = merged
        assert {language.glottocode for language in languages} == {
            "good1234", "lone1234", "wide1234",
        }

    def test_excludes_catalogue_artifacts(self, merged) -> None:
        languages, stats, _ = merged
        assert stats.excluded_artifacts == 1
        assert all(language.glottocode != "junk1234" for language in languages)

    def test_parses_fields(self, merged) -> None:
        languages, _stats, _ = merged
        good = next(language for language in languages if language.glottocode == "good1234")
        assert good.latitude == 10.5 and good.longitude == -20.25
        assert good.iso639_3 == "gdl"
        assert good.macroareas == ["Africa", "Eurasia"], "multi-valued cells split on ';'"
        assert good.countries == ["KE", "TZ"]
        assert good.classification == ["fami1234", "subf1234"], "trailing empty segment dropped"
        assert good.aes == 3 and good.aes_label == "shifting"
        assert good.med == 1 and good.med_label == "grammar"
        assert good.is_isolate is False

    def test_carries_glottologs_own_definitions(self, merged) -> None:
        # The UI quotes these verbatim. If they stop arriving, the explanation
        # of what "grammar sketch" means silently becomes an empty string.
        languages, _stats, _ = merged
        good = next(language for language in languages if language.glottocode == "good1234")
        assert good.med_description == "Grammar with less than 300 pages"
        assert good.aes_description == "Most children speak it, but only some of the time"

    def test_missing_fields_become_none_not_empty_string(self, merged) -> None:
        languages, _stats, _ = merged
        lone = next(language for language in languages if language.glottocode == "lone1234")
        assert lone.iso639_3 is None and lone.family_id is None
        assert lone.aes is None and lone.med is None
        assert lone.is_isolate is True

    def test_stats_count_every_kept_record(self, merged) -> None:
        _languages, stats, _ = merged
        assert stats.kept == 3 and stats.with_coordinates == 3
        assert stats.with_iso == 2 and stats.with_aes == 1

    def test_families_resolve_at_every_depth(self, merged) -> None:
        languages, _stats, languoids = merged
        families = merge.collect_families(languages, languoids)
        # Both the top-level family and the intermediate node must be labelled,
        # otherwise the tree renders with bare glottocodes partway down.
        assert families == {"fami1234": "Testic", "subf1234": "Sub-Testic"}


class TestEmit:
    def test_empty_fields_are_omitted_not_nulled(self, merged) -> None:
        languages, _stats, _ = merged
        lone = next(language for language in languages if language.glottocode == "lone1234")
        wire = emit.language_to_wire(lone)
        assert emit.KEYS["iso639_3"] not in wire
        assert wire[emit.KEYS["is_isolate"]] == 1

    def test_bundle_round_trips_as_json(self, merged) -> None:
        languages, stats, languoids = merged
        families = merge.collect_families(languages, languoids)
        bundle = emit.build_bundle(languages, families, stats)
        restored = json.loads(json.dumps(bundle))
        assert restored["schema_version"] == emit.SCHEMA_VERSION
        assert restored["coverage"]["languages"] == 3
        assert restored["labels"]["aes"] == {"3": "shifting"}

    def test_scale_direction_is_documented(self, merged) -> None:
        # MED is inverted relative to every other measure in the bundle. If this
        # is ever dropped, the map will encode "well documented" as "at risk".
        languages, stats, languoids = merged
        bundle = emit.build_bundle(languages, merge.collect_families(languages, languoids), stats)
        assert bundle["scales"]["med"]["direction"] == "lower_is_better_documented"

    def test_definitions_reach_the_bundle(self, merged) -> None:
        languages, stats, languoids = merged
        bundle = emit.build_bundle(languages, merge.collect_families(languages, languoids), stats)
        assert bundle["definitions"]["med"] == {1: "Grammar with less than 300 pages"}

class TestLittauer:
    README = """
## Software

* [Apertium](http://apertium.org/) - A free machine translation platform.

## Language Specific Projects

### Amharic

_amh :: Amarigna_

* [HornMorpho](https://example.org/hm) - morphological analysis. **[archived]**

### Høgnorsk

_nno :: Høgnorsk_

* hunspell-hn_NO - A beginning to a spellchecker. **[unrecoverable]** <!-- https://x -->

### Quechua

_que :: Runa Simi_

* [AntiMorfo](https://example.org/am) - Quechua morphology.

## License
"""

    def test_sections_join_on_the_code_line_not_the_heading(self) -> None:
        sections, categories = littauer.parse(self.README)
        assert [(s.heading, s.code) for s in sections] == [("Amharic", "amh"), ("Høgnorsk", "nno"), ("Quechua", "que")]
        assert categories[0].path == ["Software"] and len(categories[0].entries) == 1

    def test_link_status_and_bare_entries_survive(self) -> None:
        sections, _ = littauer.parse(self.README)
        assert sections[0].entries[0].status == "archived"
        bare = sections[1].entries[0]
        assert bare.title == "hunspell-hn_NO" and bare.url is None and bare.status == "unrecoverable"

    def test_macrolanguages_expand_and_overrides_win(self) -> None:
        sections, _ = littauer.parse(self.README)
        littauer.resolve(sections, {"que": ["quy", "quz"], "msa": ["zsm", "ind"]})
        assert sections[2].applies_to == ["quy", "quz"] and sections[2].mapping_note
        assert sections[0].applies_to == ["amh"] and sections[0].mapping_note is None


class TestWikidataPick:
    @staticmethod
    def _row(speakers, *, rank="normal", applies="", date="", ref=""):
        return {
            "speakers": str(speakers),
            "rank": wikidata.PREFERRED if rank == "preferred" else "http://wikiba.se/ontology#NormalRank",
            "appliesTo": {"l1": wikidata.FIRST_LANGUAGE, "l2": wikidata.SECOND_LANGUAGE}.get(applies, applies),
            "date": date,
            "refURL": ref,
            "statedIn": "",
        }

    def test_second_language_only_figures_never_win(self) -> None:
        assert wikidata.pick([self._row(90_000_000, applies="l2")]) is None

    def test_preferred_rank_beats_a_newer_figure(self) -> None:
        old_preferred = self._row(10, rank="preferred", date="2010-01-01")
        new_normal = self._row(20, date="2020-01-01")
        assert wikidata.pick([new_normal, old_preferred]) is old_preferred

    def test_newest_first_language_figure_wins_among_equals(self) -> None:
        old = self._row(10, applies="l1", date="2001-01-01")
        new = self._row(12, applies="l1", date="2019-01-01")
        assert wikidata.pick([old, new]) is new


class TestJoshiMatch:
    @staticmethod
    def _match(rows, sil=None, glotto=None, iso=None, parents=None):
        iso = iso or {}
        parents = parents or {}
        return joshi.match(rows, sil or {}, glotto or {}, lambda c: iso.get(c, []), lambda g: parents.get(g, g))

    def test_ambiguous_names_stay_unmatched(self) -> None:
        classes, unmatched = self._match(
            [("zarma", 1), ("twoway", 0)],
            sil={"zarma": {"dje"}, "twoway": {"aaa", "bbb"}},
            iso={"dje": ["zarm1239"], "aaa": ["aaaa1234"], "bbb": ["bbbb1234"]},
        )
        assert classes == {"zarm1239": 1} and unmatched == ["twoway"]

    def test_manual_table_beats_the_indexes(self) -> None:
        classes, _ = self._match([("swahili", 2)], sil={"swahili": {"swc"}}, iso={"swh": ["swah1253"], "swc": ["cong1236"]})
        assert classes == {"swah1253": 2}

    def test_glottolog_names_lift_dialects_to_their_language(self) -> None:
        classes, _ = self._match([("belorussian", 3)], glotto={"belorussian": {"bela1254dia"}}, parents={"bela1254dia": "bela1254"})
        assert classes == {"bela1254": 3}


REAL_DATA = Path("data/raw")
needs_real_data = pytest.mark.skipif(
    not (REAL_DATA / "languages.csv").exists(),
    reason="run `python -m pipeline fetch` to enable upstream-shape tests",
)


@needs_real_data
class TestUpstreamShape:
    """Guards against Glottolog changing format under us."""

    def test_expected_columns_still_present(self) -> None:
        with (REAL_DATA / "languages.csv").open(encoding="utf-8", newline="") as handle:
            columns = set(next(csv.reader(handle)))
        assert set(LANGUAGE_COLUMNS) <= columns

    def test_coverage_stays_above_floor(self) -> None:
        languoids = glottolog.load_languoids(REAL_DATA)
        values = glottolog.load_values(REAL_DATA)
        labels = glottolog.load_code_labels(REAL_DATA)
        languages, stats = merge.build_languages(languoids, values, labels)

        assert stats.kept > 8_000, "language count collapsed — check the level/category filters"
        assert stats.with_coordinates / stats.kept > 0.95
        assert stats.with_med / stats.kept > 0.95
        assert stats.excluded_artifacts > 0, "Bookkeeping filter matched nothing — category values changed?"

    def test_every_documentation_level_has_a_definition(self) -> None:
        # The UI shows one row per level. A level with no definition renders as
        # a colour and a name with nothing explaining it.
        descriptions = glottolog.load_code_descriptions(REAL_DATA)
        for level in ("long_grammar", "grammar", "grammar_sketch", "phonology_or_text", "wordlist_or_less"):
            assert descriptions.get(f"med-{level}"), f"med-{level} lost its Description"
