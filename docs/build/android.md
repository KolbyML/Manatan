### 1. Install System Dependencies

You need Java (JDK 17 specifically, as used in the CI), Node.js (for WebUI), and build tools.

```bash
# Update and install basic tools
sudo apt update
sudo apt install -y git curl wget unzip build-essential

# Install OpenJDK 17
sudo apt install -y openjdk-17-jdk

# Verify Java version
java -version

```

### 2. Install Node.js & Yarn

The `build_android` job requires Node.js 22 and Yarn to build the WebUI assets.

```bash
# Install NVM (Node Version Manager) - Optional but recommended
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install Node 22
nvm install 22

# Install Yarn
npm install --global yarn

```

### 3. Setup Android SDK & NDK

The CI uses specific versions (`android-30`, NDK `26.1.10909125`). You need to match these to ensure compilation works.

1. **Download Command Line Tools:**
Download the "Command line tools only" from [Android Developer](https://www.google.com/search?q=https://developer.android.com/studio%23command-tools) or use the command below:
```bash
mkdir -p ~/android-sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
unzip cmdline-tools.zip -d ~/android-sdk/cmdline-tools
mv ~/android-sdk/cmdline-tools/cmdline-tools ~/android-sdk/cmdline-tools/latest

```


2. **Set Environment Variables:**
Add these to your shell config (`~/.bashrc` or `~/.zshrc`):
```bash
export ANDROID_HOME=$HOME/android-sdk
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/26.1.10909125
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

```


*Reload your shell (`source ~/.bashrc`).*
3. **Install SDK Components:**
Run this command to accept licenses and install the specific versions from the CI:
```bash
yes | sdkmanager --licenses
sdkmanager "platforms;android-30" "build-tools;30.0.3" "ndk;26.1.10909125"

```



### 4. Setup Rust & cargo-apk2

1. **Install Rust** (if you haven't already):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

```


2. **Add Android Target:**
The CI targets `aarch64` (typical for modern phones). If you are running on an emulator, you might need `x86_64-linux-android` as well.
```bash
rustup target add aarch64-linux-android

```


3. **Install cargo-apk2:**
**Important:** The CI installs a specific fork/version from git. You should do the same to avoid compatibility issues.
```bash
cargo install --git https://github.com/kolbyml/cargo-apk2

```


### 6. Build and Run

Now you can switch to the Android crate directory and run it.

1. **Connect your Device:**
* Enable **Developer Options** and **USB Debugging** on your Android phone.
* Connect via USB.
* Verify connection: `adb devices`


2. **Run the App:**
```bash
make android_webui
make download_android_jar
make download_android_jre
cd bin/mangatan_android && cargo apk2 run

```



**Troubleshooting Notes:**

* **Emulator:** If using an emulator, it likely uses x86_64 architecture. You must run `rustup target add x86_64-linux-android` and run with `--target x86_64-linux-android`.
* **Signing:** `cargo apk2 run` automatically uses a debug keystore. You do **not** need to perform the "Dummy Keystore" steps from the CI (those are for creating a signed Release APK).
* **NDK Errors:** If `cargo-apk2` complains about the NDK, ensure `ANDROID_NDK_HOME` is set correctly to the *exact* folder version (e.g., `.../ndk/26.1.10909125`).

#### Log App

```bash
adb logcat RustJRE RustStdoutStderr '*:S'
```

#### See local files

```
adb shell run-as com.mangatan.app ls -la files
```

#### Forward Ports so accessible on desktop
```
adb forward tcp:4567 tcp:4567
```

Remove the forwards
```
adb forward --remove-all
```
