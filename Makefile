SHELL := /bin/bash

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)
JOGAMP_TARGET := unknown

# Default Architecture Detection
DOCKER_ARCH := amd64
FAKE_ARCH := arm64

ifneq (,$(filter aarch64 arm64,$(UNAME_M)))
	DOCKER_ARCH := arm64
	FAKE_ARCH := amd64
endif

# JogAmp Target Detection
ifeq ($(UNAME_S),Linux)
	JOGAMP_TARGET := linux-amd64
	ifneq (,$(filter aarch64 arm64,$(UNAME_M)))
	    JOGAMP_TARGET := linux-aarch64
	endif
endif

ifeq ($(UNAME_S),Darwin)
	JOGAMP_TARGET := macosx-universal
endif

ifneq (,$(findstring MINGW,$(UNAME_S)))
	JOGAMP_TARGET := windows-amd64
endif
ifneq (,$(findstring MSYS,$(UNAME_S)))
	JOGAMP_TARGET := windows-amd64
endif
ifeq ($(OS),Windows_NT)
	JOGAMP_TARGET := windows-amd64
endif

.PHONY: test
test:
	cargo test --workspace -- --nocapture

.PHONY: fmt
fmt:
	cargo +nightly fmt --all

.PHONY: clippy
clippy:
	cargo clippy --all --all-targets --no-deps -- --deny warnings

.PHONY: lint
lint: fmt clippy sort

.PHONY: clean
clean:
	rm -rf bin/mangatan/resources/mangatan-webui
	rm -rf bin/mangatan/resources/jre_bundle.zip
	rm -rf bin/mangatan/resources/Suwayomi-Server.jar
	rm -rf bin/mangatan/resources/natives.zip
	rm -rf bin/mangatan_android/assets/*
	rm -f bin/mangatan_android/mangatan-webui.tar
	# rm -rf bin/mangatan_ios/Mangatan/webui/*
	rm -rf bin/mangatan_ios/Mangatan/lib/*
	rm -rf bin/mangatan_ios/Mangatan/jar/suwayomi-server.jar
	rm -rf bin/mangatan_ios/frameworks/OpenJDK.xcframework
	rm -f jogamp.7z
	rm -rf temp_natives 
	rm -f mangatan-linux-*.tar.gz
	rm -rf jre_bundle
	rm -rf Mangatan-WebUI/build

.PHONY: clean_rust
clean_rust:
	cargo clean

.PHONY: sort
sort:
	cargo sort --grouped --workspace

.PHONY: pr
pr: lint clean-deps test

.PHONY: clean-deps
clean-deps:
	cargo +nightly udeps --workspace --tests --all-targets --release

# --- WebUI Targets ---

# Define all files that should trigger a rebuild (src, public, package.json, yarn.lock)
WEBUI_SOURCES := $(shell find Mangatan-WebUI/src Mangatan-WebUI/public -type f 2>/dev/null) Mangatan-WebUI/package.json Mangatan-WebUI/yarn.lock

# The Real Target: Only runs if sources are newer than build/index.html
Mangatan-WebUI/build/index.html: $(WEBUI_SOURCES)
	@echo "Building WebUI (Enforcing Node 22.12.0)..."
	@export NVM_DIR="$$HOME/.nvm"; \
	if [ -s "$$NVM_DIR/nvm.sh" ]; then \
	    . "$$NVM_DIR/nvm.sh"; \
	    nvm install 22.12.0; \
	    nvm use 22.12.0; \
	else \
	    echo "Warning: NVM not found. Using system node version:"; \
	    node -v; \
	fi; \
	cd Mangatan-WebUI && yarn install && yarn build
	@# "Touch" the output to update its timestamp, ensuring Make knows it's fresh
	touch Mangatan-WebUI/build/index.html

# Phony alias so your other targets (android_webui, etc.) still work
.PHONY: build_webui
build_webui: Mangatan-WebUI/build/index.html

.PHONY: desktop_webui
desktop_webui: build_webui
	@echo "Installing WebUI for Desktop..."
	rm -rf bin/mangatan/resources/mangatan-webui
	mkdir -p bin/mangatan/resources/mangatan-webui
	cp -r Mangatan-WebUI/build/* bin/mangatan/resources/mangatan-webui/

.PHONY: android_webui
android_webui: build_webui
	@echo "Packaging WebUI for Android..."
	rm -rf bin/mangatan_android/assets/mangatan-webui.tar
	mkdir -p bin/mangatan_android/assets
	tar -cf bin/mangatan_android/assets/mangatan-webui.tar -C Mangatan-WebUI/build .

# --- Android Icon Setup ---
.PHONY: android_icon
android_icon:
	@echo "Setting up Android Icon..."
	mkdir -p bin/mangatan_android/res/mipmap-xxxhdpi
	mkdir -p bin/mangatan_android/res/mipmap-xxhdpi
	mkdir -p bin/mangatan_android/res/mipmap-xhdpi
	mkdir -p bin/mangatan_android/res/mipmap-hdpi
	mkdir -p bin/mangatan_android/res/mipmap-mdpi
	cp bin/mangatan_ios/Mangatan/Assets.xcassets/AppIcon.appiconset/mangatanlogo11.png bin/mangatan_android/res/mipmap-xxxhdpi/ic_launcher.png
	cp bin/mangatan_ios/Mangatan/Assets.xcassets/AppIcon.appiconset/mangatanlogo11.png bin/mangatan_android/res/mipmap-xxhdpi/ic_launcher.png
	cp bin/mangatan_ios/Mangatan/Assets.xcassets/AppIcon.appiconset/mangatanlogo11.png bin/mangatan_android/res/mipmap-xhdpi/ic_launcher.png
	cp bin/mangatan_ios/Mangatan/Assets.xcassets/AppIcon.appiconset/mangatanlogo11.png bin/mangatan_android/res/mipmap-hdpi/ic_launcher.png
	cp bin/mangatan_ios/Mangatan/Assets.xcassets/AppIcon.appiconset/mangatanlogo11.png bin/mangatan_android/res/mipmap-mdpi/ic_launcher.png

bin/mangatan_ios/Mangatan/webui/index.html: Mangatan-WebUI/build/index.html
	@echo "Packaging WebUI for iOS..."
	@# Ensure directory exists
	mkdir -p bin/mangatan_ios/Mangatan/webui
	
	@# Delete everything in target except empty.txt
	@echo "Cleaning bin/mangatan_ios/Mangatan/webui..."
	find bin/mangatan_ios/Mangatan/webui -mindepth 1 -maxdepth 1 -not -name 'empty.txt' -exec rm -rf {} +
	
	@# Copy build artifacts
	@echo "Copying new files..."
	cp -r Mangatan-WebUI/build/* bin/mangatan_ios/Mangatan/webui/
	@echo "✅ iOS WebUI updated."

.PHONY: ios_webui
ios_webui: bin/mangatan_ios/Mangatan/webui/index.html

# ---------------------

bin/mangatan/resources/natives.zip:
	@echo "Preparing JogAmp natives for target: $(JOGAMP_TARGET)"
	@if [ "$(JOGAMP_TARGET)" = "unknown" ]; then \
	    echo "Error: Could not detect OS for JogAmp target."; \
	    exit 1; \
	fi
	mkdir -p bin/mangatan/resources
	rm -f jogamp.7z
	rm -rf temp_natives
	
	@echo "Downloading JogAmp..."
	curl -L "https://github.com/KolbyML/java_assets/releases/download/1/jogamp-all-platforms.7z" -o jogamp.7z
	
	@echo "Extracting libraries..."
	7z x jogamp.7z -otemp_natives "jogamp-all-platforms/lib/$(JOGAMP_TARGET)"
	
	@echo "Zipping structure..."
	cd temp_natives/jogamp-all-platforms/lib && zip -r "$(CURDIR)/bin/mangatan/resources/natives.zip" $(JOGAMP_TARGET)
	
	@echo "Cleanup..."
	rm jogamp.7z
	rm -rf temp_natives
	@echo "Natives ready at bin/mangatan/resources/natives.zip"

# Phony alias for backward compatibility
.PHONY: download_natives
download_natives: bin/mangatan/resources/natives.zip

# --- Android Downloads (Cached) ---

# 1. Android Natives
bin/mangatan_android/assets/natives.tar:
	@echo "Downloading Android Natives (JogAmp)..."
	mkdir -p bin/mangatan_android/assets
	rm -rf temp_android_natives
	
	@echo "Downloading JogAmp..."
	curl -L "https://github.com/KolbyML/java_assets/releases/download/1/jogamp-all-platforms.7z" -o jogamp_android.7z
	
	@echo "Extracting libraries (android-aarch64)..."
	# CHANGE 1: Use android-aarch64 instead of linux-aarch64
	7z x jogamp_android.7z -otemp_android_natives "jogamp-all-platforms/lib/android-aarch64"
	
	@echo "Packaging natives.tar..."
	# CHANGE 2: Update path here too, and use $(CURDIR) to fix the "open failed" error
	cd temp_android_natives/jogamp-all-platforms/lib/android-aarch64 && tar -cf "$(CURDIR)/bin/mangatan_android/assets/natives.tar" .
	
	@echo "Cleanup..."
	rm jogamp_android.7z
	rm -rf temp_android_natives

.PHONY: download_android_natives
download_android_natives: bin/mangatan_android/assets/natives.tar

# 2. Android JAR
bin/mangatan_android/assets/Suwayomi-Server.jar:
	@echo "Downloading Android Suwayomi Server JAR..."
	mkdir -p bin/mangatan_android/assets
	curl -L "https://github.com/KolbyML/Suwayomi-Server/releases/download/v1.0.4/Suwayomi-Server-v2.1.2062.jar" -o bin/mangatan_android/assets/Suwayomi-Server.jar

.PHONY: download_android_jar
download_android_jar: bin/mangatan_android/assets/Suwayomi-Server.jar

# 3. Android JRE
bin/mangatan_android/assets/jre.tar.gz:
	@echo "Downloading and Compressing Android JRE..."
	mkdir -p bin/mangatan_android/assets
	# Curl downloads to stdout (-), pipes to gzip, which writes to the file
	curl -L "https://github.com/KolbyML/java_assets/releases/download/1/android_jre_21.tar.gz" -o bin/mangatan_android/assets/jre.tar.gz

.PHONY: download_android_jre
download_android_jre: bin/mangatan_android/assets/jre.tar.gz

# -----------------------------------

.PHONY: setup-depends
setup-depends: desktop_webui download_jar download_natives

.PHONY: dev
dev: setup-depends
	cargo run --release -p mangatan

.PHONY: dev-embedded
dev-embedded: setup-depends bundle_jre
	cargo run --release -p mangatan --features embed-jre

.PHONY: dev-android
dev-android: android_webui download_android_jar download_android_jre download_android_natives android_icon
	cd bin/mangatan_android && cargo apk2 run

.PHONY: dev-android-native
dev-android-native: android_webui download_android_jar download_android_jre download_android_natives android_icon
	cd bin/mangatan_android && cargo apk2 run --features native_webview

jre_bundle:
	@echo "Building custom JDK with jlink..."
	rm -rf jre_bundle
	jlink --add-modules java.base,java.compiler,java.datatransfer,java.desktop,java.instrument,java.logging,java.management,java.naming,java.prefs,java.scripting,java.se,java.security.jgss,java.security.sasl,java.sql,java.transaction.xa,java.xml,jdk.attach,jdk.crypto.ec,jdk.jdi,jdk.management,jdk.net,jdk.unsupported,jdk.unsupported.desktop,jdk.zipfs,jdk.accessibility,jdk.charsets,jdk.localedata --bind-services --output jre_bundle --strip-debug --no-man-pages --no-header-files --compress=2

# Phony alias so 'make jlink' works in publish.yml
.PHONY: jlink
jlink: jre_bundle

# 2. The Zip File Target (Used by Local Dev)
bin/mangatan/resources/jre_bundle.zip: jre_bundle
	@echo "Bundling JRE with Mangatan..."
	mkdir -p bin/mangatan/resources
	cd jre_bundle && zip -r "$(CURDIR)/bin/mangatan/resources/jre_bundle.zip" ./*

# Phony alias for local dev
.PHONY: bundle_jre
bundle_jre: bin/mangatan/resources/jre_bundle.zip

bin/mangatan/resources/Suwayomi-Server.jar:
	@echo "Downloading Suwayomi Server JAR..."
	mkdir -p bin/mangatan/resources
	curl -L "https://github.com/Suwayomi/Suwayomi-Server-preview/releases/download/v2.1.2038/Suwayomi-Server-v2.1.2038.jar" -o $@

.PHONY: download_jar
download_jar: bin/mangatan/resources/Suwayomi-Server.jar

bin/mangatan_ios/Mangatan/jar/suwayomi-server.jar:
	@echo "Downloading iOS Suwayomi Server JAR..."
	mkdir -p bin/mangatan_ios/Mangatan/jar
	rm -f bin/mangatan_ios/Mangatan/jar/suwayomi-server.jar
	curl -L "https://github.com/KolbyML/Suwayomi-Server/releases/download/v1.0.14/Suwayomi-Server-v2.1.2062.jar" -o $@

.PHONY: download_ios_jar
download_ios_jar: bin/mangatan_ios/Mangatan/jar/suwayomi-server.jar


bin/mangatan_ios/frameworks/OpenJDK.xcframework:
	@echo "Preparing iOS Framework..."
	mkdir -p bin/mangatan_ios/frameworks
	rm -f ios_framework.zip
	# Clean previous version to prevent conflicts
	rm -rf bin/mangatan_ios/frameworks/OpenJDK.xcframework
	
	@echo "Downloading OpenJDK.xcframework..."
	curl -L "https://github.com/KolbyML/ios-tools/releases/download/snapshot/OpenJDK.xcframework.zip" -o ios_framework.zip
	
	@echo "Extracting..."
	unzip -o ios_framework.zip -d bin/mangatan_ios/frameworks
	
	@echo "Cleanup..."
	rm ios_framework.zip
	cd bin/mangatan_ios/frameworks/OpenJDK.xcframework/ios-arm64 && ar -d libdevice.a java_md_macosx.o
	@echo "✅ iOS Framework ready at bin/mangatan_ios/frameworks"

.PHONY: ios_framework
ios_framework: bin/mangatan_ios/frameworks/OpenJDK.xcframework

bin/mangatan_ios/Mangatan/lib/lib/modules:
	@echo "Downloading iOS JRE..."
	mkdir -p bin/mangatan_ios/Mangatan/lib
	# Clean destination to ensure no stale files
	rm -rf bin/mangatan_ios/Mangatan/lib/*
	rm -rf temp_ios_jre_extract
	rm -f ios_jre.zip

	@echo "Downloading..."
	curl -L "https://github.com/KolbyML/ios-tools/releases/download/snapshot/ios_jre.zip" -o ios_jre.zip

	@echo "Extracting..."
	unzip -q ios_jre.zip -d temp_ios_jre_extract

	@echo "Installing to bin/mangatan_ios/Mangatan/lib..."
	cd temp_ios_jre_extract && \
	if [ "$$(ls -1 | wc -l)" -eq "1" ] && [ -d "$$(ls -1)" ]; then \
		cd *; \
	fi && \
	cp -r . "$(CURDIR)/bin/mangatan_ios/Mangatan/lib/"

	@echo "Cleanup..."
	rm -rf temp_ios_jre_extract
	rm ios_jre.zip
	rm -rf bin/mangatan_ios/Mangatan/lib/__MACOSX
	
	# Touch the file to ensure timestamp is updated
	touch bin/mangatan_ios/Mangatan/lib/lib/modules
	@echo "✅ iOS JRE installed."

.PHONY: ios_jre
ios_jre: bin/mangatan_ios/Mangatan/lib/lib/modules


.PHONY: docker-build
docker-build: desktop_webui download_jar download_natives bundle_jre
	@echo "🐳 Building Docker image for local architecture: $(DOCKER_ARCH)"
	
	# 1. Build the Rust binary
	cargo build --release --bin mangatan --features embed-jre
	
	# 2. Create a FLAT tarball (Binary at root)
	tar -czf mangatan-linux-$(DOCKER_ARCH).tar.gz -C target/release mangatan
	
	# 3. Create a dummy file for the *other* architecture
	touch mangatan-linux-$(FAKE_ARCH).tar.gz
	
	# 4. Build the image
	docker build --build-arg TARGETARCH=$(DOCKER_ARCH) -t mangatan:local .
	# 5. Cleanup artifacts
	rm mangatan-linux-$(DOCKER_ARCH).tar.gz
	rm mangatan-linux-$(FAKE_ARCH).tar.gz
	@echo "✅ Docker image 'mangatan:local' built successfully."

# --- Testing ---

TEST_DATA_REPO := https://github.com/KolbyML/ocr-test-data.git
TEST_DATA_DIR := ocr-test-data

.PHONY: ensure-test-data
ensure-test-data:
	@if [ ! -d "$(TEST_DATA_DIR)" ]; then \
		echo "Cloning test data..."; \
		git clone $(TEST_DATA_REPO) $(TEST_DATA_DIR); \
	else \
		echo "Syncing test data..."; \
		cd $(TEST_DATA_DIR) && git fetch origin && git checkout master && git pull origin master; \
	fi

.PHONY: test-ocr-merge
test-ocr-merge: ensure-test-data
	@echo "Running Regression Tests..."
	cargo test --package mangatan-ocr-server --test merge_regression -- --nocapture

.PHONY: pr-ocr-data
pr-ocr-data:
	@echo "Tests Passed. Preparing PR for manual changes..."
	
	cd $(TEST_DATA_DIR) && \
	# --- STEP 1: Update .gitignore --- \
	if ! grep -q "*.raw.json" .gitignore 2>/dev/null; then \
		echo "*.raw.json" >> .gitignore; \
		echo "Added *.raw.json to .gitignore"; \
	fi && \
	# --------------------------------- \
	if [ -n "$$(git status --porcelain)" ]; then \
		BRANCH_NAME="update-data-$$(date +%s)"; \
		git checkout -b $$BRANCH_NAME; \
		git add .; \
		git commit -m "chore: manual update of expected OCR data"; \
		echo "Pushing branch $$BRANCH_NAME..."; \
		git push origin $$BRANCH_NAME; \
		echo "Creating PR..."; \
		if command -v gh >/dev/null 2>&1; then \
			gh pr create --title "Update Test Data $$(date +%Y-%m-%d)" --body "Manual updates to expected results." --repo KolbyML/ocr-test-data; \
		else \
			echo "GitHub CLI (gh) not found. Please create PR manually for branch: $$BRANCH_NAME"; \
		fi \
	else \
		echo "No changes detected in ocr-test-data. Nothing to PR."; \
	fi
