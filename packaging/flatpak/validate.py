#!/usr/bin/env python3
"""Fast host-independent checks for Manatan's Flatpak packaging."""

from __future__ import annotations

import configparser
import json
import re
import struct
import subprocess
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

APP_ID = "io.github.kolbyml.Manatan"


def fail(message: str) -> None:
    raise ValueError(message)


def png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as image:
        header = image.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        fail(f"{path.name} is not a PNG with an IHDR header")
    return struct.unpack(">II", header[16:24])


def manifest_module(text: str, name: str) -> str:
    match = re.search(
        rf"^  - name: {re.escape(name)}\n(?P<body>.*?)(?=^  - name: |\Z)",
        text,
        flags=re.MULTILINE | re.DOTALL,
    )
    if not match:
        fail(f"manifest is missing the {name} module")
    return match.group("body")


def validate_manifest(directory: Path) -> None:
    path = directory / f"{APP_ID}.yml"
    text = path.read_text(encoding="utf-8")
    if not re.search(rf"^app-id: {re.escape(APP_ID)}$", text, re.MULTILINE):
        fail("manifest app-id does not match")
    if not re.search(r"^runtime: org\.gnome\.Platform$", text, re.MULTILINE) or not re.search(
        r"^runtime-version: ['\"]?50['\"]?$", text, re.MULTILINE
    ):
        fail("manifest must use the current GNOME 50 runtime")
    if not re.search(r"^command: manatan$", text, re.MULTILINE):
        fail("manifest command must be manatan")
    if text.count("      - --libdir=lib\n") != 2:
        fail("libplacebo and libmpv must install in /app/lib on every architecture")

    finish_match = re.search(r"^finish-args:\n(?P<body>.*?)(?=^modules:)", text, re.MULTILINE | re.DOTALL)
    if not finish_match:
        fail("manifest has no finish-args")
    finish_args = re.findall(r"^  - (.+)$", finish_match.group("body"), re.MULTILINE)
    forbidden = ("--filesystem=host", "--filesystem=home", "--device=all", "--socket=system-bus")
    for argument in finish_args:
        if isinstance(argument, str) and argument.startswith(forbidden):
            fail(f"overly broad sandbox permission: {argument}")
    for required in ("--share=network", "--socket=wayland", "--socket=fallback-x11", "--device=dri"):
        if required not in finish_args:
            fail(f"required sandbox permission is missing: {required}")

    cef = manifest_module(text, "cef-runtime")
    cef_sources = re.findall(r"^      - type: archive$", cef, re.MULTILINE)
    if len(cef_sources) != 2:
        fail("CEF must have exactly two architecture-specific sources")
    app = manifest_module(text, "manatan")
    if "    sources:\n" not in app:
        fail("Manatan module has no sources")

    urls = re.findall(r"^        url: (\S+)$", text, re.MULTILINE)
    hashes = re.findall(r"^        sha256: (\S+)$", text, re.MULTILINE)
    if len(urls) != len(hashes):
        fail("every remote source must have exactly one SHA-256")
    for url, sha in zip(urls, hashes, strict=True):
        if urllib.parse.urlparse(url).scheme != "https":
            fail(f"remote source does not use HTTPS: {url!r}")
        if not re.fullmatch(r"[0-9a-f]{64}", sha):
            fail(f"remote source has an invalid SHA-256: {url}")

    arches = set(re.findall(r"^\s+- (x86_64|aarch64)$", text, re.MULTILINE))
    if not {"x86_64", "aarch64"}.issubset(arches):
        fail("both x86_64 and aarch64 sources are required")

    local_sources = re.findall(r"^      - type: file\n        path: (\S+)$", app, re.MULTILINE)
    for local in local_sources:
        if not (directory / local).is_file():
            fail(f"local manifest source is missing: {local!r}")

    cef_config = directory.parent.parent / "vendor/webview_cef/third/download.cmake"
    if cef_config.is_file():
        match = re.search(r'set\(CEF_VERSION\s+"([^"]+)"\)', cef_config.read_text(encoding="utf-8"))
        if not match:
            fail("could not read the pinned CEF version")
        encoded = urllib.parse.quote(match.group(1), safe=".-_")
        if encoded not in text:
            fail(f"manifest CEF does not match webview_cef {match.group(1)}")


def validate_metadata(directory: Path) -> None:
    metainfo_path = directory / f"{APP_ID}.metainfo.xml"
    root = ET.parse(metainfo_path).getroot()
    if root.tag != "component" or root.get("type") != "desktop-application":
        fail("AppStream component type is invalid")
    if root.findtext("id") != APP_ID:
        fail("AppStream id does not match")
    if root.findtext("metadata_license") != "CC0-1.0":
        fail("AppStream metadata license must be CC0-1.0")
    if not root.findtext("project_license"):
        fail("AppStream project license is missing")
    if root.findtext("launchable") != f"{APP_ID}.desktop":
        fail("AppStream launchable does not match the desktop file")
    screenshots = root.findall("./screenshots/screenshot")
    if len(screenshots) < 3 or screenshots[0].get("type") != "default":
        fail("AppStream needs a default screenshot and at least three screenshots")
    for screenshot in screenshots:
        image = screenshot.findtext("image")
        if not image or urllib.parse.urlparse(image).scheme != "https":
            fail("every AppStream screenshot must have an HTTPS image")
    if root.find("content_rating") is None:
        fail("AppStream OARS content rating is missing")

    desktop_path = directory / f"{APP_ID}.desktop"
    parser = configparser.ConfigParser(interpolation=None, strict=True)
    parser.optionxform = str
    parser.read(desktop_path, encoding="utf-8")
    entry = parser["Desktop Entry"]
    if entry.get("Type") != "Application" or entry.get("Exec") != "manatan %u":
        fail("desktop entry Type or Exec is invalid")
    if entry.get("Icon") != APP_ID:
        fail("desktop entry icon does not match the app id")
    if not entry.get("Categories", "").endswith(";"):
        fail("desktop categories must end with a semicolon")

    icon = directory / f"{APP_ID}.png"
    if png_dimensions(icon) != (512, 512):
        fail("application icon must be exactly 512x512")
    json.loads((directory / "flathub.json").read_text(encoding="utf-8"))


def run_external_validators(directory: Path) -> None:
    commands = (
        ("desktop-file-validate", str(directory / f"{APP_ID}.desktop")),
        ("appstreamcli", "validate", "--no-net", str(directory / f"{APP_ID}.metainfo.xml")),
    )
    for command in commands:
        try:
            result = subprocess.run(command, check=False)
        except FileNotFoundError:
            continue
        if result.returncode:
            fail(f"{' '.join(command)} failed with {result.returncode}")


def main() -> int:
    directory = Path(__file__).resolve().parent
    validate_manifest(directory)
    validate_metadata(directory)
    run_external_validators(directory)
    print("Flatpak manifest, metadata, permissions, architecture pins, and local sources are valid")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
