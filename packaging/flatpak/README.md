# Manatan Flatpak packaging

This packages Manatan's signed-off public Linux payloads without compiling
Manatan itself. Flatpak Builder verifies the pinned release archive for the
current architecture, installs the immutable payload under `/app/lib/manatan`,
and supplies the sandbox-specific CEF and MPV runtimes around it.

## Runtime design

- Flathub/Flatpak owns application updates. The Manatan bootstrapper is not
  installed and `MANATAN_DISABLE_BOOTSTRAP=1` disables in-app replacement of
  the read-only payload.
- CEF is pinned to the version used by `vendor/webview_cef` and installed in
  `/app/lib/cef`, avoiding a first-run runtime download.
- A Flatpak-owned libmpv is built against the Freedesktop codec extension for
  payloads that use system MPV on ordinary Linux distributions.
- Manatan's custom `libfftools-ffi` and its sibling FFmpeg libraries remain in
  the public payload. Mining continues to resolve those files relative to the
  Manatan runner and does not use the Flatpak MPV build for final encodes.
- Local media access is portal-first. The manifest deliberately does not grant
  unrestricted home or host filesystem access.
- Desktop metadata, AppStream metadata, the icon, and the license are installed
  from this public packaging directory. Newer binary payloads may provide the
  same files, but the checked-in copies remain the authoritative fallback.

## Signed update repository

`.github/workflows/flatpak-repository.yml` builds the public release on native
`x86_64` and `aarch64` GitHub-hosted runners, signs both architecture commits,
merges them into one OSTree repository, and deploys it to GitHub Pages. It runs
when a GitHub release is published and can also be started manually.

Users install its signed `.flatpakref` with:

```sh
flatpak install --user https://kolbyml.github.io/Manatan/io.github.kolbyml.Manatan.flatpakref
```

That adds the `manatan` remote. Subsequent workflow deployments are discovered
by graphical software centers and `flatpak update`.

The repository public key is `manatan-flatpak.gpg`. Its private half is stored
in the GitHub Actions secret `FLATPAK_GPG_PRIVATE_KEY`; never commit it. The
maintainer backup created with this packaging lives outside the repository at
`~/.config/manatan/flatpak-repository-private-key.asc` and must be protected.
Rotating or losing this key prevents existing installations from trusting new
updates, so include the encrypted backup in the project's normal secret backup
process.

## Validate

Run the host-independent checks from the repository root:

```sh
python3 packaging/flatpak/validate.py
python3 packaging/flatpak/update_release.py --check
```

On Linux, install `flatpak-builder`, the GNOME 50 SDK/runtime, and the official
Flathub linter. Build both supported architectures in native CI runners. The
AppStream mirror flags are required for a repository-lint-clean local export;
Flathub's own build infrastructure supplies the same media-mirroring step.

```sh
cd packaging/flatpak
flatpak-builder --force-clean --user \
  --install-deps-from=flathub \
  --mirror-screenshots-url=https://dl.flathub.org/media \
  --compose-url-policy=full \
  --repo=repo \
  build io.github.kolbyml.Manatan.yml

podman run --rm -v "$PWD:/mnt:ro,z" \
  ghcr.io/flathub/flatpak-builder-lint:latest \
  manifest /mnt/io.github.kolbyml.Manatan.yml
podman run --rm -v "$PWD:/mnt:ro,z" \
  ghcr.io/flathub/flatpak-builder-lint:latest \
  repo /mnt/repo
desktop-file-validate io.github.kolbyml.Manatan.desktop
appstreamcli validate --pedantic io.github.kolbyml.Manatan.metainfo.xml

flatpak build-bundle repo Manatan.flatpak io.github.kolbyml.Manatan
flatpak install --user --reinstall Manatan.flatpak
flatpak run io.github.kolbyml.Manatan
```

The manifest supports `x86_64` and `aarch64`. A build on one architecture does
not validate the other architecture's ELF binaries, so release qualification
must run the complete build, repository lint, launch, playback, and mining
matrix on both native architectures.

Test these workflows before publishing a new Flatpak build:

1. Start Manatan twice and confirm the embedded backend shuts down cleanly.
2. Import local anime, manga, and EPUB files through the native file picker.
3. Play H.264, H.265, AV1, and subtitle-bearing MKV files.
4. Mine a card with screenshot, sentence audio, and multiple subtitle segments.
5. Exercise manga OCR and the CEF-backed dictionary view.
6. Connect to AnkiConnect on localhost and create a card.
7. Open an external URL and the `manatan:` URI handler.
8. Confirm the update UI reports the Flatpak installation as up to date.

## Update to a public release

Stable release assets and their SHA-256 values are read from GitHub:

```sh
python3 packaging/flatpak/update_release.py
```

Use `--tag vX.Y.Z` to pin a particular stable release. Prereleases are refused
unless `--allow-prerelease` is explicitly supplied. If the pinned CEF version
changes, update both architecture-specific CEF URLs and checksums in the
manifest at the same time, then repeat the complete Linux build and mining
test matrix.
