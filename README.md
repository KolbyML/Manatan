# Mangatan
A 1 binary solution for https://github.com/kaihouguide/Mangatan

No monkey script or ocr setup required! Run the executable and start reading manga in your browser. For more instructions on how to use Suwayomi, please refer to their respective repo https://github.com/Suwayomi/Suwayomi-Server.

## 🚀 Getting Started

Download the latest release from the [Releases](https://github.com/KolbyML/Mangatan/releases) page.

Run the executable, then visit `http://127.0.0.1:4567/` in your web browser to access the Mangatan web interface.

## Roadmap

- [x] Package Mangatan, OCR Server, and Suwayomi into a single binary
- [ ] Add Manga Immersion Stats page https://github.com/KolbyML/Mangatan/issues/1
- [ ] Suggest more features https://github.com/KolbyML/Mangatan/issues/new

## Development

### Prerequisites

#### MacOS

```bash
brew install deno nvm yarn java
nvm install 22.12.0
nvm use 22.12.0
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
