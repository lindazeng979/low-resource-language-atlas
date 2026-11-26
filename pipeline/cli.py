"""Command line entry point: ``python -m pipeline <command>``."""

from __future__ import annotations

import argparse
from pathlib import Path

from pipeline import emit, enrich, merge
from pipeline.sources import coverage, glottolog, isocodes, joshi, littauer, wikidata

DEFAULT_RAW = Path("data/raw")
DEFAULT_OUT = Path("low-resource-language-atlas/public/data/atlas.json")
LITTAUER_OUT = Path("low-resource-language-atlas/public/data/littauer.json")


def _percent(part: int, whole: int) -> str:
    return f"{100 * part / whole:.1f}%" if whole else "—"


def print_report(stats: merge.MergeStats, families: dict[str, str]) -> None:
    """Print coverage. These numbers belong in the README and the UI, so that
    a source changing shape shows up as a visible drop rather than silence."""
    kept = stats.kept
    print(f"\n  languoids in catalogue      {stats.languoids_total:>7,}")
    print(f"  of which languages          {stats.languages_total:>7,}")
    print(f"  excluded catalogue artifacts{stats.excluded_artifacts:>7,}")
    print(f"  kept                        {kept:>7,}")
    print(f"\n  families referenced         {len(families):>7,}")
    print("\n  field coverage")
    for label, count in (
        ("coordinates", stats.with_coordinates),
        ("ISO 639-3", stats.with_iso),
        ("family", stats.with_family),
        ("endangerment (AES)", stats.with_aes),
        ("documentation (MED)", stats.with_med),
    ):
        print(f"    {label:<26}{count:>7,}  {_percent(count, kept):>7}")

    if stats.by_category:
        print("\n  categories")
        for category, count in stats.by_category.most_common():
            print(f"    {category.replace('_', ' '):<22}{count:>7,}")


def load_and_merge(raw_dir: Path) -> tuple[list[merge.Language], dict[str, str], merge.MergeStats, dict]:
    languoids = glottolog.load_languoids(raw_dir)
    values = glottolog.load_values(raw_dir)
    code_labels = glottolog.load_code_labels(raw_dir)
    code_descriptions = glottolog.load_code_descriptions(raw_dir)
    languages, stats = merge.build_languages(languoids, values, code_labels, code_descriptions)
    families = merge.collect_families(languages, languoids)
    stats.families = len(families)
    return languages, families, stats, languoids


def download_all(raw_dir: Path, force: bool = False) -> None:
    glottolog.download(raw_dir, force=force)
    littauer.download(raw_dir, force=force)
    isocodes.download(raw_dir, force=force)
    coverage.download(raw_dir, force=force)
    joshi.download(raw_dir, force=force)
    wikidata.download(raw_dir, force=force)


def command_fetch(args: argparse.Namespace) -> int:
    download_all(args.raw_dir, force=args.force)
    for path in sorted(args.raw_dir.iterdir()):
        print(f"  {path.name:<36} {path.stat().st_size / 1e6:>7.2f} MB")
    return 0


def command_build(args: argparse.Namespace) -> int:
    download_all(args.raw_dir)
    languages, families, stats, languoids = load_and_merge(args.raw_dir)
    report, extra_sources, littauer_bundle = enrich.enrich(languages, languoids, args.raw_dir)
    stats.with_speakers = report.numbers["with_speakers"]
    bundle = emit.build_bundle(languages, families, stats, extra_sources, {"sources": report.numbers})
    written = emit.write_bundle(bundle, args.out)
    lt_written = enrich.write_json(littauer_bundle, LITTAUER_OUT)
    print_report(stats, families)
    print("\n  joins")
    for line in report.lines:
        print(f"    {line}")
    print(f"\n  wrote {args.out}  ({written / 1e6:.2f} MB uncompressed)")
    print(f"  wrote {LITTAUER_OUT}  ({lt_written / 1e3:.0f} KB)")
    return 0


def command_report(args: argparse.Namespace) -> int:
    _languages, families, stats, _ = load_and_merge(args.raw_dir)
    print_report(stats, families)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pipeline", description="Build the Low-Resource Language Atlas data bundles.")
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW, help="where source downloads live")
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch = subparsers.add_parser("fetch", help="download source data")
    fetch.add_argument("--force", action="store_true", help="re-download even if cached")
    fetch.set_defaults(handler=command_fetch)

    build = subparsers.add_parser("build", help="fetch if needed, then write the bundle")
    build.add_argument("--out", type=Path, default=DEFAULT_OUT)
    build.set_defaults(handler=command_build)

    report = subparsers.add_parser("report", help="print coverage without writing")
    report.set_defaults(handler=command_report)

    args = parser.parse_args(argv)
    return args.handler(args)
