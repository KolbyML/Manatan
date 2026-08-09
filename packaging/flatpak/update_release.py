#!/usr/bin/env python3
"""Pin the Flatpak manifest and AppStream metadata to a public Manatan release."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path


REPOSITORY = "KolbyML/Manatan"
USER_AGENT = "Manatan Flatpak release updater"
UPDATE_MANIFEST = "manatan-desktop-update-manifest.json"
RUNTIME_ENTRYPOINTS = {
    "jre": "bin/java",
    "extension-server": "Extension-Server.jar",
    "webui": "index.html",
}


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


def desktop_update_manifest(assets: dict[str, str]) -> dict[str, object]:
    try:
        manifest = json.loads(fetch(assets[UPDATE_MANIFEST]))
    except KeyError as error:
        raise ValueError(f"release is missing {UPDATE_MANIFEST}") from error
    if not isinstance(manifest, dict) or manifest.get("schema") != 2:
        raise ValueError("desktop update manifest has an unsupported schema")
    return manifest


def linux_app_asset(
    update_manifest: dict[str, object], arch: str, version: str
) -> dict[str, object]:
    app_assets = update_manifest.get("app_assets")
    if not isinstance(app_assets, list):
        raise ValueError("desktop update manifest has no app assets")
    matches = [
        asset
        for asset in app_assets
        if isinstance(asset, dict)
        and asset.get("platform") == "linux"
        and asset.get("arch") == arch
        and asset.get("version") == version
    ]
    if len(matches) != 1:
        raise ValueError(
            f"desktop update manifest must have exactly one linux/{arch} app asset"
        )
    return matches[0]


def verified_runtime_assets(
    app_asset: dict[str, object],
    assets: dict[str, str],
    sums: dict[str, str],
    label: str,
) -> dict[str, dict[str, object]]:
    runtimes = app_asset.get("runtimes")
    if not isinstance(runtimes, list):
        raise ValueError(f"{label} app asset has no runtime requirements")
    result: dict[str, dict[str, object]] = {}
    for runtime in runtimes:
        if not isinstance(runtime, dict):
            raise ValueError(f"{label} has an invalid runtime requirement")
        kind = runtime.get("kind")
        if not isinstance(kind, str) or kind not in RUNTIME_ENTRYPOINTS:
            raise ValueError(f"{label} requires unsupported runtime kind {kind!r}")
        if kind in result:
            raise ValueError(f"{label} has duplicate {kind} runtime requirements")
        runtime_id = runtime.get("id")
        sha256 = runtime.get("sha256")
        url = runtime.get("URL")
        if not isinstance(runtime_id, str) or not re.fullmatch(r"[0-9a-f]{64}", runtime_id):
            raise ValueError(f"{label} {kind} runtime has an invalid ID")
        if not isinstance(sha256, str) or not re.fullmatch(r"[0-9a-f]{64}", sha256):
            raise ValueError(f"{label} {kind} runtime has an invalid checksum")
        if not isinstance(url, str):
            raise ValueError(f"{label} {kind} runtime has no URL")
        name = Path(urllib.parse.urlparse(url).path).name
        if runtime_id not in name:
            raise ValueError(f"{label} {kind} runtime filename does not contain its ID")
        if assets.get(name) != url or sums.get(name) != sha256:
            raise ValueError(
                f"{label} {kind} runtime does not match the signed release assets"
            )
        if runtime.get("entrypoint") != RUNTIME_ENTRYPOINTS[kind]:
            raise ValueError(f"{label} {kind} runtime has an invalid entrypoint")
        result[kind] = runtime
    if set(result) != set(RUNTIME_ENTRYPOINTS):
        missing = sorted(set(RUNTIME_ENTRYPOINTS) - set(result))
        raise ValueError(f"{label} app asset is missing runtimes: {', '.join(missing)}")
    return result


def verified_app_asset(
    app_asset: dict[str, object],
    name: str,
    assets: dict[str, str],
    sums: dict[str, str],
) -> None:
    if app_asset.get("URL") != assets.get(name):
        raise ValueError(f"desktop update manifest URL does not match {name}")
    if app_asset.get("sha256") != sums.get(name):
        raise ValueError(f"desktop update manifest checksum does not match {name}")


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


def update_runtime_environment(text: str, webui_id: str) -> str:
    updated, count = re.subn(
        r"^MANATAN_WEBUI_RUNTIME_ID=[0-9a-f]{64}$",
        f"MANATAN_WEBUI_RUNTIME_ID={webui_id}",
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if count != 1:
        raise ValueError("Flatpak runtime environment has no WebUI runtime ID")
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
    runtime_environment_path = directory / "manatan-flatpak-runtimes.sh"

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
    update_manifest = desktop_update_manifest(assets)
    manifest = manifest_path.read_text(encoding="utf-8")
    runtime_assets_by_arch: dict[str, dict[str, dict[str, object]]] = {}
    for release_arch, update_arch, flatpak_arch in (
        ("amd64", "x64", "x86_64"),
        ("arm64", "arm64", "aarch64"),
    ):
        name = f"manatan-app-linux-{release_arch}-{version}.tar.gz"
        if name not in assets or name not in sums:
            raise ValueError(f"release is missing {name} or its checksum")
        app_asset = linux_app_asset(update_manifest, update_arch, version)
        verified_app_asset(app_asset, name, assets, sums)
        runtime_assets = verified_runtime_assets(
            app_asset, assets, sums, f"linux/{update_arch}"
        )
        runtime_assets_by_arch[release_arch] = runtime_assets
        old_fragment = f"manatan-app-linux-{release_arch}-"
        manifest = replace_source(manifest, old_fragment, name, assets[name], sums[name])
        jre = runtime_assets["jre"]
        jre_url = str(jre["URL"])
        jre_name = Path(urllib.parse.urlparse(jre_url).path).name
        manifest = replace_source(
            manifest,
            f"manatan-runtime-jre-linux-{release_arch}-",
            jre_name,
            jre_url,
            str(jre["sha256"]),
        )
        if f"only-arches:\n          - {flatpak_arch}" not in manifest:
            raise ValueError(f"manifest lost its {flatpak_arch} architecture guard")

    amd64_runtimes = runtime_assets_by_arch["amd64"]
    arm64_runtimes = runtime_assets_by_arch["arm64"]
    for kind in ("extension-server", "webui"):
        if amd64_runtimes[kind] != arm64_runtimes[kind]:
            raise ValueError(f"linux architectures disagree on the {kind} runtime")
        runtime = amd64_runtimes[kind]
        runtime_url = str(runtime["URL"])
        runtime_name = Path(urllib.parse.urlparse(runtime_url).path).name
        manifest = replace_source(
            manifest,
            f"manatan-runtime-{kind}-",
            runtime_name,
            runtime_url,
            str(runtime["sha256"]),
        )

    runtime_environment = update_runtime_environment(
        runtime_environment_path.read_text(encoding="utf-8"),
        str(amd64_runtimes["webui"]["id"]),
    )

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
    if runtime_environment != runtime_environment_path.read_text(encoding="utf-8"):
        stale.append(runtime_environment_path)
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
    runtime_environment_path.write_text(runtime_environment, encoding="utf-8")
    print(f"Pinned Flatpak packaging to {tag}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, urllib.error.URLError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
