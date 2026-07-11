#!/usr/bin/env python3
"""Pin the Flatpak manifest and AppStream metadata to a public Manatan release."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path


REPOSITORY = "KolbyML/Manatan"
USER_AGENT = "Manatan Flatpak release updater"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def release_json(tag: str | None) -> dict[str, object]:
    if tag:
        normalized = tag if tag.startswith("v") else f"v{tag}"
        endpoint = f"https://api.github.com/repos/{REPOSITORY}/releases/tags/{normalized}"
    else:
        endpoint = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
    return json.loads(fetch(endpoint))


def release_assets(release: dict[str, object]) -> dict[str, str]:
    assets = release.get("assets")
    if not isinstance(assets, list):
        raise ValueError("GitHub release has no assets")
    result: dict[str, str] = {}
    for asset in assets:
        if isinstance(asset, dict):
            name = asset.get("name")
            url = asset.get("browser_download_url")
            if isinstance(name, str) and isinstance(url, str):
                result[name] = url
    return result


def checksums(assets: dict[str, str]) -> dict[str, str]:
    try:
        contents = fetch(assets["Checksums.sha256"]).decode("utf-8")
    except KeyError as error:
        raise ValueError("release is missing Checksums.sha256") from error
    result: dict[str, str] = {}
    for line in contents.splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})\s+\*?(.+)", line.strip())
        if match:
            result[match.group(2)] = match.group(1)
    return result


def replace_source(text: str, old_asset_fragment: str, name: str, url: str, sha256: str) -> str:
    marker = f"/{old_asset_fragment}"
    marker_index = text.find(marker)
    if marker_index < 0:
        raise ValueError(f"manifest source for {old_asset_fragment} was not found")
    line_start = text.rfind("\n", 0, marker_index) + 1
    line_end = text.find("\n", marker_index)
    indentation = re.match(r"\s*", text[line_start:line_end]).group(0)
    text = text[:line_start] + f"{indentation}url: {url}" + text[line_end:]

    sha_start = text.find("sha256:", line_start)
    if sha_start < 0:
        raise ValueError(f"manifest checksum for {old_asset_fragment} was not found")
    sha_line_start = text.rfind("\n", 0, sha_start) + 1
    sha_line_end = text.find("\n", sha_start)
    sha_indentation = re.match(r"\s*", text[sha_line_start:sha_line_end]).group(0)
    return text[:sha_line_start] + f"{sha_indentation}sha256: {sha256}" + text[sha_line_end:]


def release_notes(body: object) -> list[str]:
    if not isinstance(body, str):
        return []
    notes: list[str] = []
    for line in body.splitlines():
        if line.startswith("### Downloads"):
            break
        if not line.startswith("- "):
            continue
        note = re.sub(r"\s+\([0-9a-fA-F]{7,40}\)$", "", line[2:].strip())
        if note:
            notes.append(note)
    return notes


def update_metainfo(text: str, version: str, date: str, notes: list[str]) -> str:
    items = notes or ["Updated Manatan to the latest stable release"]
    item_xml = "\n".join(f"          <li>{html.escape(item)}</li>" for item in items)
    release = (
        f'    <release version="{html.escape(version)}" date="{html.escape(date)}">\n'
        "      <description>\n"
        "        <ul>\n"
        f"{item_xml}\n"
        "        </ul>\n"
        "      </description>\n"
        f"      <url>https://github.com/{REPOSITORY}/releases/tag/v{html.escape(version)}</url>\n"
        "    </release>"
    )
    updated, count = re.subn(
        r"    <release\s+version=\"[^\"]+\"\s+date=\"[^\"]+\">.*?    </release>",
        release,
        text,
        count=1,
        flags=re.DOTALL,
    )
    if count != 1:
        raise ValueError("first AppStream release entry was not found")
    return updated


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", help="GitHub release tag; defaults to the latest stable release")
    parser.add_argument("--check", action="store_true", help="fail instead of writing when files are stale")
    parser.add_argument("--allow-prerelease", action="store_true")
    args = parser.parse_args()

    directory = Path(__file__).resolve().parent
    manifest_path = directory / "io.github.kolbyml.Manatan.yml"
    metainfo_path = directory / "io.github.kolbyml.Manatan.metainfo.xml"

    release = release_json(args.tag)
    if release.get("draft"):
        raise ValueError("draft releases cannot be packaged")
    if release.get("prerelease") and not args.allow_prerelease:
        raise ValueError("refusing to package a prerelease without --allow-prerelease")
    tag = release.get("tag_name")
    if not isinstance(tag, str) or not re.fullmatch(r"v\d+(?:\.\d+)+", tag):
        raise ValueError(f"unsupported release tag: {tag!r}")
    version = tag[1:]
    published = release.get("published_at")
    if not isinstance(published, str) or len(published) < 10:
        raise ValueError("release has no publication date")
    date = published[:10]

    assets = release_assets(release)
    sums = checksums(assets)
    manifest = manifest_path.read_text(encoding="utf-8")
    for release_arch, flatpak_arch in (("amd64", "x86_64"), ("arm64", "aarch64")):
        name = f"manatan-app-linux-{release_arch}-{version}.tar.gz"
        if name not in assets or name not in sums:
            raise ValueError(f"release is missing {name} or its checksum")
        old_fragment = f"manatan-app-linux-{release_arch}-"
        manifest = replace_source(manifest, old_fragment, name, assets[name], sums[name])
        if f"only-arches:\n          - {flatpak_arch}" not in manifest:
            raise ValueError(f"manifest lost its {flatpak_arch} architecture guard")

    metainfo = update_metainfo(
        metainfo_path.read_text(encoding="utf-8"),
        version,
        date,
        release_notes(release.get("body")),
    )

    stale = []
    if manifest != manifest_path.read_text(encoding="utf-8"):
        stale.append(manifest_path)
    if metainfo != metainfo_path.read_text(encoding="utf-8"):
        stale.append(metainfo_path)
    if args.check:
        if stale:
            print("Flatpak release pins are stale:", file=sys.stderr)
            for path in stale:
                print(f"  {path}", file=sys.stderr)
            return 1
        print(f"Flatpak release pins match {tag}")
        return 0

    manifest_path.write_text(manifest, encoding="utf-8")
    metainfo_path.write_text(metainfo, encoding="utf-8")
    print(f"Pinned Flatpak packaging to {tag}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, urllib.error.URLError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
