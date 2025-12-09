# Mangatan
A 1 binary solution for https://github.com/kaihouguide/Mangatan

No monkey script or ocr setup required! Run the executable and start reading manga in your browser. For more instructions on how to use Suwayomi, please refer to their respective repo https://github.com/Suwayomi/Suwayomi-Server.

## 🚀 Getting Started

Download the latest release from the [Releases](https://github.com/KolbyML/Mangatan/releases) page.

Run the executable, then visit http://127.0.0.1:4568/ in your web browser to access the Mangatan web interface.

## Setup (Windows)

1. Download the .zip file for `windows-x86` from the [releases](https://github.com/KolbyML/Mangatan/releases) page.
2. Extract the .zip, and inside it launch `mangatan.exe`. Wait a few moments. Allow Windows Defender SmartScreen if prompted (More info > Run anyway).
3. A "Mangatan Launcher" window should pop up, here click "**Open Web UI**".
4. Allow Windows Firewall connections if prompted, and the Suwayomi web interface (`127.0.0.1:4568/`) should open in a new browser tab. Please wait a few moments while the initial setup is taking place. After ~30 seconds, reload the page to access the Suwayomi library (`127.0.0.1:4568/library`).
5. To get manga, you need to locate the correct `index.min.json` extension repository URL for Suwayomi on Google. Add this URL in **Settings** > **Browse** > **Extension repositories** > **Add Repository** > `[paste the URL]` and click **OK**
6. Go in **"Browse"** on the left sidebar, then go on the **"Extensions"** tab and click **"Install"** on your desired source.
7. Finally, to start reading go to the **"Sources"** tab, click on the installed source and find the manga you wish to read. Automatic OCR will be functional and you can use Yomitan just fine!

## Troubleshooting

To fully clear cache and data from previous installs, delete the following and try again:

- `mangatan-windows-x86`
- `%LOCALAPPDATA%\Tachidesk`
- `%APPDATA%\mangatan`
- `%Temp%\Suwayomi*`
- `%Temp%\Tachidesk*`
- Site data & cookies from `127.0.0.1`
## Roadmap

- [x] Package Mangatan, OCR Server, and Suwayomi into a single binary
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
