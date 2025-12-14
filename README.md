# Mangatan

**The easiest way to read manga with instant OCR lookup.** *No scripts, no complex setup—just download and read.*

Discord Server: https://discord.gg/tDAtpPN8KK

## ✨ Why Mangatan?

Traditional setups for reading manga with Japanese lookup (OCR) can be complicated, often requiring users to install Python scripts, browser extensions (like userscripts), and configure local servers manually.

**Mangatan simplifies everything into a single app:**
* **Zero Configuration:** No need to install "Monkey scripts," configure Optical Character Recognition (OCR) tools, or mess with command lines.
* **Built-in OCR:** Just hover over Japanese text to get selectable text for dictionary lookups.
* **Cross-Platform:** Run the exact same interface on your PC, Mac, or Android phone.
* **Browser Interface:** Uses the familiar [Suwayomi](https://github.com/Suwayomi/Suwayomi-Server) interface in your favorite web browser.

### 🖥️ Supported Platforms
| Windows | Linux | macOS | Android | iOS |
| :---: | :---: | :---: | :---: | :---: |
| ✅ | ✅ | ✅ | ✅ | 🚧 (Coming Soon) |

## 🚀 Getting Started

Download the latest release for your platform from the [Releases](https://github.com/KolbyML/Mangatan/releases) page.

Run the executable, then visit `http://127.0.0.1:4568/` in your web browser to access the Mangatan web interface.

https://github.com/user-attachments/assets/38c63c86-289d-45a4-ba85-e29f1b812ceb

## Setup (Windows)

1.  Download the `.zip` file for `windows-x86` from the [releases](https://github.com/KolbyML/Mangatan/releases) page.
2.  Extract the `.zip`, and inside it launch `mangatan.exe`.
    * *Note: If prompted by Windows Defender SmartScreen, click **More info** > **Run anyway**. If it doesn't run on double-click, right-click the file > **Properties** > **Unblock**.*
3.  A "Mangatan Launcher" window will appear. Click "**Open Web UI**".
4.  Allow Windows Firewall connections if prompted. The Suwayomi web interface (`127.0.0.1:4568/`) should open in a new browser tab.
    * *Please wait ~30 seconds for the initial setup to finish. Reload the page to access the library.*
5.  **Adding Sources:**
    * Go to **Settings** > **Browse** > **Extension repositories** > **Add Repository**.
    * Paste a valid Suwayomi `index.min.json` extension repository URL (search "Suwayomi extension repos" on Google to find one) and click **OK**.
6.  **Installing Extensions:**
    * Go to **"Browse"** on the left sidebar, then the **"Extensions"** tab.
    * Click **"Install"** on your desired source.
7.  **Start Reading:**
    * Go to the **"Sources"** tab, click your installed source, and find a manga.
    * **OCR is automatically active!** You can use tools like Yomitan immediately.

## Troubleshooting

To fully clear cache and data from previous installs, delete the following folders and try again:

* `mangatan-windows-x86` (Your extraction folder)
* `%LOCALAPPDATA%\Tachidesk`
* `%APPDATA%\mangatan`
* `%Temp%\Suwayomi*`
* `%Temp%\Tachidesk*`
* **Browser Data:** Clear Site data & cookies for `127.0.0.1`

## Roadmap

- [x] Package Mangatan, OCR Server, and Suwayomi into a single binary
- [x] Add Android Support https://github.com/KolbyML/Mangatan/issues/17
- [ ] Add iOS Support https://github.com/KolbyML/Mangatan/issues/19
- [ ] Add Manga Immersion Stats page https://github.com/KolbyML/Mangatan/issues/1
- [ ] Suggest more features https://github.com/KolbyML/Mangatan/issues/new

## Development

### Prerequisites

#### Windows
```ps
winget install Microsoft.OpenJDK.21 DenoLand.Deno Rustlang.Rustup
```

#### MacOS

```bash
brew install deno nvm yarn java rustup
nvm install 22.12.0
nvm use 22.12.0
rustup update
```

### Android APK Development

```bash
rustup target add aarch64-linux-android
cargo install cargo-apk
```

Install Android Studio to get Android SDK https://developer.android.com/studio

Mark sure you install
- Android 11 SDK
- NDK


#### Log App

```bash
adb logcat RustJRE RustStdoutStderr '*:S'
```

#### Run App in debug mode (will reset your Mangatan data)

```bash
make dev-android
```

#### See local files

```
adb shell run-as com.mangatan.app ls -la files
```

#### Forward Ports so accessible on desktop
```
adb forward tcp:4567 tcp:4567
```

adb forward --remove-all

### Setup Environment

To clone the repo with all submodules:
```
git clone --recursive https://github.com/KolbyML/Mangatan.git
```

#### If you clone without --recursive
```
git submodule update --init --recursive
```

### Run dev mode
    
```bash
make dev
```

## 📚 References and acknowledgements
The following links, repos, companies and projects have been important in the development of this repo, we have learned a lot from them and want to thank and acknowledge them.
- https://github.com/kaihouguide/Mangatan
- https://github.com/exn251/Mangatan/
- https://github.com/Suwayomi/Suwayomi-Server
- https://github.com/Suwayomi/Suwayomi-WebUI

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KolbyML/Mangatan&type=date&legend=top-left)](https://www.star-history.com/#KolbyML/Mangatan&type=date&legend=top-left)
