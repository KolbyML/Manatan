# Building on macOS

These instructions detail how to set up a development environment and build the **macOS Desktop** version of Mangatan.

## Prerequisites

* **macOS 12+** (Intel or Apple Silicon)
* **Command Line Tools** (xcode-select)
* **Homebrew** installed

## 1. System Dependencies

Open your terminal and install the required tools. You need `p7zip` for archiving and handling resources.

```bash
# Install Command Line Tools
xcode-select --install

# Install p7zip and other utilities via Homebrew
brew install p7zip

```

## 2. Language Runtime Setup

The project requires specific versions of Java (JDK 21), Rust, and Node.js.

### Install Java (JDK 21)

The build system uses JDK 21 to create a custom Java runtime (JRE). We recommend using **Zulu JDK 21** or **OpenJDK 21**.

```bash
# Using Homebrew to install OpenJDK 21
brew install openjdk@21

# Link it so the system can find it
sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk

```

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

```

### Install Node.js (v22)

The project strictly requires Node.js v22.12.0 for the WebUI. We recommend using `nvm` to manage this.

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc

# Install and use Node v22
nvm install 22
npm install --global yarn

```

## 3. Build Mangatan

Clone the repository and enter the directory:

```bash
git clone --recursive https://github.com/kolbyml/mangatan.git
cd mangatan

```

### Option A: Quick Dev Run

The `Makefile` automates the entire process: downloading dependencies, building the WebUI, bundling the JRE, and running the app.

```bash
make dev-embedded

```

### Option B: Manual Release Build

If you want to build the standalone application binary manually:

1. **Prepare Dependencies:** Downloads the WebUI, Server JAR, and the correct `macosx-universal` natives.
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

* **"JLink not found" or Java Errors:** Ensure `java -version` reports version 21. If you have multiple Java versions, set `JAVA_HOME` explicitly before running `make`:
`export JAVA_HOME=$(/usr/libexec/java_home -v 21)`
* **Permissions:** If you encounter permission errors when running the binary, you may need to grant it execution rights: `chmod +x target/release/mangatan`.
* **Apple Silicon vs Intel:** The build script automatically detects your architecture (`aarch64` vs `x86_64`) and uses the correct JogAmp graphics libraries via the `macosx-universal` target.
