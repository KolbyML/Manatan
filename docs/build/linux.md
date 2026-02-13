# Building on Linux

These instructions detail how to set up a development environment and build the **Linux Desktop** version of Manatan.

## Prerequisites

* **Linux Distribution** (Ubuntu 22.04+, Fedora, Arch, etc.)
* **Build Tools** (GCC, Make, etc.)

## 1. System Dependencies

You need to install development headers for GTK, WebKit, and other system libraries.

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y cmake build-essential curl wget unzip zip p7zip-full git
sudo apt install -y libglib2.0-dev libgtk-3-dev libappindicator3-dev librsvg2-dev libxdo-dev libbz2-dev libfontconfig1-dev libfreetype-dev fuse yasm nasm
sudo apt install -y openjdk-21-jdk

```

### Fedora

```bash
sudo dnf install -y @development-tools p7zip p7zip-plugins nasm
sudo dnf install -y gtk3-devel libappindicator-gtk3-devel librsvg2-devel libX11-devel libXtst-devel fuse
sudo dnf install -y java-21-openjdk-devel

```

### Arch Linux

```bash
sudo pacman -S base-devel p7zip nasm git curl wget unzip zip
sudo pacman -S gtk3 libappindicator-gtk3 librsvg libxtst fuse2
sudo pacman -S jdk21-openjdk

```

## 2. Language Runtime Setup

The project requires specific versions of Rust and Node.js.

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

```

### Install Node.js (v22)

The build system enforces Node.js v22.12.0. Using `nvm` is highly recommended to avoid conflicts with system packages.

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install and use Node v22
nvm install 22
npm install --global yarn

```

## 3. Build Manatan

Clone the repository and enter the directory:

```bash
git clone --recursive https://github.com/kolbyml/manatan.git
cd manatan

```

### Option A: Quick Dev Run

The `Makefile` automates the entire process: downloading dependencies, building the WebUI, bundling the JRE, and running the app.

```bash
make dev-embedded

```

### Option B: Manual Release Build

If you want to build the standalone application binary manually:

1. **Prepare Dependencies:** Downloads the WebUI, Server JAR, and the correct `linux-amd64` (or `linux-aarch64`) natives.
```bash
make setup-depends

```


2. **Bundle JRE:** Creates the custom stripped-down Java runtime using `jlink`.
```bash
make bundle_jre

```


3. **Compile Binary:** Builds the release binary with the JRE embedded.
```bash
cargo build --release --features embed-jre

```



The final executable will be located at: `target/release/mangatan`

## Troubleshooting

* **"Pkg-config" Errors:** If the build fails saying it cannot find `gtk+-3.0` or `glib-2.0`, ensure you have installed the `-dev` (Debian/Ubuntu) or `-devel` (Fedora) packages listed in Step 1.
* **Wayland Issues:** Manatan uses X11 libraries (libxdo). It generally runs fine on Wayland via XWayland, but if you encounter windowing issues, try running with `GDK_BACKEND=x11`.
* **AppIndicator:** If the tray icon is missing, ensure `libappindicator3` is installed. GNOME users may need the "AppIndicator Support" extension.
