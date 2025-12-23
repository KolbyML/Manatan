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
    * Paste a valid Suwayomi `index.min.json` extension repository URL (search "mihon extension repos" on Google to find one) and click **OK**.
6.  **Installing Extensions:**
    * Go to **"Browse"** on the left sidebar, then the **"Extensions"** tab.
    * Click **"Install"** on your desired source.
7.  **Start Reading:**
    * Go to the **"Sources"** tab, click your installed source, and find a manga.
    * **OCR is automatically active!** You can use tools like Yomitan immediately.
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

We have detailed build instructions for each platform. Please refer to the specific documentation below to set up your environment:

* **Windows:** [Building on Windows (WSL2)](docs/build/windows.md)
* **macOS:** [Building on macOS](docs/build/mac.md)
* **Linux:** [Building on Linux](docs/build/linux.md)
* **Android:** [Building for Android](docs/build/android.md)

### Quick Start (General)

1.  **Clone the repository:**
    ```bash
    git clone --recursive https://github.com/KolbyML/Mangatan
    cd Mangatan
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
- https://github.com/Suwayomi/Suwayomi-WebUI

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KolbyML/Mangatan&type=date&legend=top-left)](https://www.star-history.com/#KolbyML/Mangatan&type=date&legend=top-left)
