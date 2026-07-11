#!/usr/bin/env python3
"""Render signed Flatpak remote descriptors for the published Pages repo."""

from __future__ import annotations

import argparse
import base64
from pathlib import Path


APP_ID = "io.github.kolbyml.Manatan"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--public-key", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/") + "/"
    key = base64.b64encode(args.public_key.read_bytes()).decode("ascii")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    flatpakref = f"""[Flatpak Ref]
Name={APP_ID}
Branch=master
Title=Manatan
Url={base_url}repo/
SuggestRemoteName=manatan
Homepage=https://manatan.com/
Icon={base_url}{APP_ID}.png
RuntimeRepo=https://flathub.org/repo/flathub.flatpakrepo
IsRuntime=false
GPGKey={key}
"""
    flatpakrepo = f"""[Flatpak Repo]
Title=Manatan
Url={base_url}repo/
Homepage=https://manatan.com/
Comment=Official Manatan Flatpak repository
Description=Signed stable releases of Manatan for Linux
Icon={base_url}{APP_ID}.png
GPGKey={key}
"""

    (args.output_dir / f"{APP_ID}.flatpakref").write_text(flatpakref)
    (args.output_dir / "manatan.flatpakrepo").write_text(flatpakrepo)


if __name__ == "__main__":
    main()
