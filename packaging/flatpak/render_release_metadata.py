#!/usr/bin/env python3
"""Render release-specific AppStream metadata into a Linux payload."""

from __future__ import annotations

import argparse
import html
import re
from datetime import date
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--date", default=date.today().isoformat())
    args = parser.parse_args()
    if not re.fullmatch(r"\d+(?:\.\d+)+", args.version):
        parser.error("--version must contain only dot-separated numbers")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.date):
        parser.error("--date must use YYYY-MM-DD")

    source = Path(__file__).resolve().with_name("io.github.kolbyml.Manatan.metainfo.xml")
    text = source.read_text(encoding="utf-8")
    version = html.escape(args.version)
    release = (
        f'    <release version="{version}" date="{args.date}">\n'
        "      <description>\n"
        "        <p>Updated Manatan to the latest stable desktop release.</p>\n"
        "      </description>\n"
        f"      <url>https://github.com/KolbyML/Manatan/releases/tag/v{version}</url>\n"
        "    </release>"
    )
    text, count = re.subn(
        r"    <release\s+version=\"[^\"]+\"\s+date=\"[^\"]+\">.*?    </release>",
        release,
        text,
        count=1,
        flags=re.DOTALL,
    )
    if count != 1:
        raise ValueError("first AppStream release entry was not found")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
