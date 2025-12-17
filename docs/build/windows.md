# Building on Windows (via WSL2)

These instructions detail how to set up a development environment and build the **Linux Desktop** version of Mangatan using the Windows Subsystem for Linux (WSL2).

## Prerequisites

* **Windows 10 (version 2004+) or Windows 11**
* **WSL2 Installed** (Ubuntu 22.04 or 24.04 recommended)
* *Tip: On Windows 11, GUI apps will launch natively via WSLg.*



## 1. System Dependencies

Open your WSL terminal and install the required build tools, libraries, and Java 21 (required for bundling the custom JRE).

```bash
sudo apt update
sudo apt install -y build-essential curl wget unzip zip p7zip-full git
sudo apt install -y libglib2.0-dev libgtk-3-dev libappindicator3-dev librsvg2-dev libxdo-dev fuse nasm
sudo apt install -y openjdk-21-jdk

```

## 2. Language Runtime Setup

The project requires specific versions of Rust and Node.js.

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

```

### Install Node.js (v22)

The build system enforces Node.js v22.12.0. Using `nvm` is recommended.

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install and use Node v22
nvm install 22
npm install --global yarn

```

## 3. Build Mangatan

Clone the repository (if you haven't already) and run the automated build commands.

```bash
git clone --recursive https://github.com/kolbyml/mangatan.git
cd mangatan

```

### Option A: Quick Dev Run

To download dependencies, bundle the JRE, and run the app in one command:

```bash
make dev-embedded

```

### Option B: Build Release Binary Manually

If you want to create the standalone binary artifact:

1. **Prepare Dependencies:** Downloads the WebUI, Server JAR, and native graphics libraries.
```bash
make setup-depends

```


2. **Bundle JRE:** Creates the custom stripped-down Java runtime.
```bash
make bundle_jre

```


3. **Compile Binary:** Builds the release version with the JRE embedded.
```bash
cargo build --release --features embed-jre

```



The final executable will be located at:
`target/release/mangatan`

## Troubleshooting

* **Missing Dependencies:** If the build fails on `sys` crates, ensure you ran the `apt install` command in Step 1 to get `libgtk-3-dev` and `nasm`.
* **Java Errors:** Ensure `java -version` returns OpenJDK 21. Older versions may fail the `jlink` step.
* **GUI Not Showing:** Ensure you are using WSL2. On Windows 10, you may need a third-party X Server (like VcXsrv). On Windows 11, it should work out of the box.
