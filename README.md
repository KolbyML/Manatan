# Manatan
<div align="center">

[![Github All Releases](https://img.shields.io/github/downloads/kolbyml/manatan/total.svg)](https://github.com/kolbyml/manatan/releases)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/kolbyml)](https://github.com/sponsors/kolbyml)
[![Static Badge](https://img.shields.io/badge/donate-ko--fi-ed6760?label=donate)](https://ko-fi.com/kolbyml)
[![Static Badge](https://img.shields.io/badge/donate-patreon-f96854?label=donate)](https://www.patreon.com/cw/Manatan)
[![GitHub License](https://img.shields.io/github/license/kolbyml/manatan)](https://github.com/kolbyml/manatan?tab=MIT-1-ov-file)
[![Discord](https://img.shields.io/discord/1448140648950530182?color=%237785cc)](https://discord.gg/tDAtpPN8KK)

</div>

**The easiest way to watch anime or read manga with instant OCR/subtitle lookup.** *No scripts, no complex setup—just download and go.*

Discord Server: https://discord.gg/tDAtpPN8KK

## ✨ Why Manatan?

Traditional setups for watching anime or reading manga with Japanese lookup can be complicated, often requiring users to install Python scripts, browser extensions (like userscripts), and configure local servers manually.

**Manatan simplifies everything into a single app:**
* **Zero Configuration:** No need to install "Monkey scripts," configure Optical Character Recognition (OCR) tools, or mess with command lines.
* **Universal Language Support:** Manatan supports every language.
* **Built-in OCR:** Just hover over text to get selectable text for dictionary lookups.
* **Anime Support:** Subtitle parsing with popup dictionary lookups while you watch.
* **Cross-Platform:** Run the exact same interface on your PC, Mac, Android, or iOS device.
* **Browser Interface:** Uses the familiar [Suwayomi](https://github.com/Suwayomi/Suwayomi-Server) interface in your favorite web browser.

### 🖥️ Supported Platforms
| Windows | Linux | macOS | Android | iOS |
| :---: | :---: | :---: | :---: | :---: |
| ✅ | ✅ | ✅ | ✅ | ✅ |

> **📱 iOS Users:** The iOS app is currently in **Public Beta**. Please join our [Discord Server](https://discord.gg/tDAtpPN8KK) to find the TestFlight invite link.

## 🚀 Getting Started

Download the latest release for your platform from the [Releases](https://github.com/KolbyML/Manatan/releases) page.

Run the executable, then visit `http://127.0.0.1:4568/` in your web browser to access the Manatan web interface.

https://github.com/user-attachments/assets/38c63c86-289d-45a4-ba85-e29f1b812ceb

## Setup

1.  Download the latest release for your platform from the [releases](https://github.com/KolbyML/Manatan/releases) page.
    * **Windows:** Download the `.zip` file for `windows-x86`, extract it, then launch `manatan.exe`.
      * *Note: If prompted by Windows Defender SmartScreen, click **More info** > **Run anyway**. If it doesn't run on double-click, right-click the file > **Properties** > **Unblock**.*
    * **macOS:** Download the macOS build, unzip it, then open `Manatan.app`.
      * *If macOS blocks the app because it is unsigned, go to **System Settings** > **Privacy & Security** and click **Open Anyway** for Manatan, then reopen the app.*
2.  A "Manatan Launcher" window will appear. Click "**Open Web UI**".
3.  **Windows:** Allow Windows Firewall connections if prompted.
4.  The Manatan web interface (`127.0.0.1:4568/`) should open in a new browser tab.
    * *Please wait ~30 seconds for the initial setup to finish. Reload the page to access the library.*
5.  **Adding Sources:**
    * Go to **Settings** > **Browse** > **Extension repositories** > **Add Repository**.
    * Paste a valid Mihon `index.min.json` extension repository URL (search "mihon extension repos" on Google to find one) and click **OK**.
6.  **Installing Extensions:**
    * Go to **"Browse"** on the left sidebar, then the **"Extensions"** tab.
    * Click **"Install"** on your desired source.
7.  **Start Watching or Reading:**
    * Go to the **"Sources"** tab, click your installed source, and find an anime or manga.
    * **OCR and subtitle lookup are automatically active!** You can use tools like Yomitan immediately.
* For Yomitan Users:
   * To ensure sentences are parsed correctly for Anki cards, go to Text parsing in Yomitan's settings (enable Advanced), and set Sentence Termination to "Custom, No New Lines". This prevents OCR line breaks from being treated as sentence endings.
   * Disabling ellipsis `…` as a sentence terminator is also recommended.

## Local Manga
You can also read manga files stored locally on your device. To set up local manga:  
1. Set your local manga directory in Settings → Browse → "Local source location"
2. Use one of these paths depending on your platform:
* Android Internal Storage: Use paths like `/storage/emulated/0/YourFolder/`
* Android SD Cards: Use `/storage/[SD_CARD_ID]/YourFolder/` where [SD_CARD_ID] is the unique identifier Android assigned to your SD card (you can find this using file manager apps like X-plore)
* Windows: The default local manga directory is at C:\Users\[YourUsername]\AppData\Local\Tachidesk\local)
3. You will then be able to find your local manga under **Browse → Sources → Local source**
### Important : Your manga must follow a specific folder structure to be detected properly.
Refer to the [Suwayomi Local Source documentation](https://github.com/Suwayomi/Suwayomi-Server/wiki/Local-Source#folder-structure) for details on how to structure your folders.
## Troubleshooting

To fully clear cache and data from previous installs, delete the following folders and try again:

* `manatan-windows-x86` (Your extraction folder)
* `%LOCALAPPDATA%\Tachidesk`
* `%APPDATA%\manatan`
* `%Temp%\Suwayomi*`
* `%Temp%\Tachidesk*`
* **Browser Data:** Clear Site data & cookies for `127.0.0.1`

## Roadmap

- [x] Package Manatan, OCR Server, and Suwayomi into a single binary
- [x] Add Android Support https://github.com/KolbyML/Manatan/issues/17
- [x] Add iOS Support https://github.com/KolbyML/Manatan/issues/19
- [ ] Add Manga Immersion Stats page https://github.com/KolbyML/Manatan/issues/1
- [ ] Suggest more features https://github.com/KolbyML/Manatan/issues/new

## 🤝 Help Improve OCR Accuracy

Manatan's text overlay precision relies on a robust set of test cases. We are crowdsourcing data to fine-tune our engine, fix merging errors, and ensure text detection works perfectly across all manga styles.

**We need your help!**
If you have examples of complex text bubbles, or just want to help us prevent future bugs, please contribute to our test suite:

👉 **[Contribute to KolbyML/ocr-test-data](https://github.com/KolbyML/ocr-test-data)**

Your submissions directly help us improve the reading experience for everyone.

## Development

We have detailed build instructions for each platform. Please refer to the specific documentation below to set up your environment:

* **Windows:** [Building on Windows (WSL2)](docs/build/windows.md)
* **macOS:** [Building on macOS](docs/build/mac.md)
* **Linux:** [Building on Linux](docs/build/linux.md)
* **Android:** [Building for Android](docs/build/android.md)

### Quick Start (General)

1.  **Clone the repository:**
    ```bash
    git clone --recursive https://github.com/KolbyML/Manatan
    cd Manatan
    ```

2.  **Run in Development Mode:**
    Assuming you have the [prerequisites installed](docs/build/linux.md), you can use the Makefile to setup dependencies and run the app:
    ```bash
    make dev-embedded
    ```

## 📚 References and acknowledgements
The following links, repos, companies and projects have been important in the development of this repo, we have learned a lot from them and want to thank and acknowledge them.
- https://github.com/kaihouguide/Mangatan
- https://github.com/exn251/Mangatan/
- https://github.com/Suwayomi/Suwayomi-Server
- https://github.com/KolbyML/Manatan-WebUI

## Privacy Policy

Manatan does not collect, transmit, or share any user data. All data including imported comics, reading progress, bookmarks, and saved vocabulary words are stored locally on your device and never leave it.

The only external communication occurs during OCR which is optional and uses Google Cloud Vision API. When enabled, selected image regions are sent over HTTPS for text recognition only. No user accounts are used, and images are not linked to personal identity. OCR can be disabled at any time in Settings.

No analytics, tracking, or telemetry data is collected.

Last updated: 12/23/2025

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KolbyML/Manatan&type=date&legend=top-left)](https://www.star-history.com/#KolbyML/Manatan&type=date&legend=top-left)
