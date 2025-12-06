# Mangatan
A 1 binary solution for https://github.com/kaihouguide/Mangatan

No monkey script or ocr setup required! Run the executable and start reading manga in your browser. For more instructions on how to use Suwayomi, please refer to their respective repo https://github.com/Suwayomi/Suwayomi-Server.

## 🚀 Getting Started

Download the latest release from the [Releases](https://github.com/KolbyML/Mangatan/releases) page.

Run the executable, then visit `http://127.0.0.1:4567/` in your web browser to access the Mangatan web interface.

### Setup Instructions (for Windows)

1. Go to the [releases](https://github.com/KolbyML/Mangatan/releases) page and download the .zip file for `windows-x64`
2. Extract the .zip file and inside it, launch `Suwayomi Launcher.bat` and wait a few moments.
3. A new window "Suwayomi-Server Launcher" should appear, press "Launch" here on the bottom.
4. The Suwayomi web interface will launch in a new browser tab. Please wait a few moments for the initial setup, then reload the page to be redirected to the library.
5. You now need to add extension repositories to get manga on Suwayomi, you can do this by finding the correct index.min.json on Google 
6. Paste the link for this index.min.json into Settings > Browse > Extension repositories > Add Repository > `<paste the link>` and click OK
7. Go to the "Browse" section on the left, and then go to "Extensions" tab. Filter the list to only Japanese by clicking the 3-lines in the top right corner.
8. Filter by disabling "All" and "English", then enabling "日本語"
9. Locate an extension from the list you wish to install. 
10. Go to the "Sources" tab, and click the 3 lines in the top right corner. Filter the list by disabling "All", "English" and "Other" and only enable "日本語"
11. Click on the desired source to access and read your manga. Automatic OCR will be functional and you can use Yomitan just fine!

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
