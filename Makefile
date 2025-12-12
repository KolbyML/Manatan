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
	rm -rf bin/mangatan/resources/suwayomi-webui
	rm -rf bin/mangatan/resources/jre_bundle.zip
	rm -rf bin/mangatan/resources/Suwayomi-Server.jar
	rm -rf bin/mangatan/resources/natives.zip
	rm -f jogamp.7z
	rm -rf temp_natives 
	rm -f mangatan-linux-*.tar.gz
	rm -rf jre_bundle

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

.PHONY: build_webui
build_webui:
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
	cd Suwayomi-WebUI && yarn install && yarn build
	rm -rf bin/mangatan/resources/suwayomi-webui
	mkdir -p bin/mangatan/resources/suwayomi-webui
	cp -r Suwayomi-WebUI/build/* bin/mangatan/resources/suwayomi-webui/
	rm -r Suwayomi-WebUI/build/

.PHONY: download_natives
download_natives:
	@echo "Preparing JogAmp natives for target: $(JOGAMP_TARGET)"
	@if [ "$(JOGAMP_TARGET)" = "unknown" ]; then \
		echo "Error: Could not detect OS for JogAmp target."; \
		exit 1; \
	fi
	mkdir -p bin/mangatan/resources
	rm -f jogamp.7z
	rm -rf temp_natives
	
	@echo "Downloading JogAmp..."
	curl -L "https://github.com/KolbyML/jogamp/releases/download/1/jogamp-all-platforms.7z" -o jogamp.7z
	
	@echo "Extracting libraries..."
	7z x jogamp.7z -otemp_natives "jogamp-all-platforms/lib/$(JOGAMP_TARGET)"
	
	@echo "Zipping structure..."
	# We zip ONLY the contents of the target folder, not the folder itself
	# This ensures extracting natives.zip creates 'linux-amd64' etc directly if needed, 
	# but usually we want the files directly available or structured as per your Rust code expectation.
	# Adjusted to match your CI workflow which zips the folder itself:
	cd temp_natives/jogamp-all-platforms/lib && zip -r "$(CURDIR)/bin/mangatan/resources/natives.zip" $(JOGAMP_TARGET)
	
	@echo "Cleanup..."
	rm jogamp.7z
	rm -rf temp_natives
	@echo "Natives ready at bin/mangatan/resources/natives.zip"

.PHONY: setup-depends
setup-depends: build_webui download_jar download_natives

.PHONY: dev
dev: setup-depends
	cargo run --release -p mangatan

.PHONY: dev-embedded
dev-embedded: setup-depends bundle_jre
	cargo run --release -p mangatan --features embed-jre

.PHONY: jlink
jlink:
	@echo "Building custom JDK with jlink..."
	rm -rf jre_bundle
	jlink --add-modules java.base,java.compiler,java.datatransfer,java.desktop,java.instrument,java.logging,java.management,java.naming,java.prefs,java.scripting,java.se,java.security.jgss,java.security.sasl,java.sql,java.transaction.xa,java.xml,jdk.attach,jdk.crypto.ec,jdk.jdi,jdk.management,jdk.net,jdk.unsupported,jdk.unsupported.desktop,jdk.zipfs,jdk.accessibility,jdk.charsets,jdk.localedata --bind-services --output jre_bundle --strip-debug --no-man-pages --no-header-files --compress=2

.PHONY: bundle_jre
bundle_jre: jlink
	@echo "Bundling JRE with Mangatan..."
	rm -f bin/mangatan/resources/jre_bundle.zip
	cd jre_bundle && zip -r ../bin/mangatan/resources/jre_bundle.zip ./*

.PHONY: download_jar
download_jar:
	@echo "Downloading Suwayomi Server JAR..."
	mkdir -p bin/mangatan/resources
	curl -L "https://github.com/Suwayomi/Suwayomi-Server-preview/releases/download/v2.1.2031/Suwayomi-Server-v2.1.2031.jar" -o bin/mangatan/resources/Suwayomi-Server.jar

.PHONY: docker-build
docker-build: build_webui download_jar download_natives bundle_jre
	@echo "🐳 Building Docker image for local architecture: $(DOCKER_ARCH)"
	
	# 1. Build the Rust binary
	cargo build --release --bin mangatan --features embed-jre
	
	# 2. Create a FLAT tarball (Binary at root)
	# -C target/release tells tar to switch to that dir before adding 'mangatan'
	tar -czf mangatan-linux-$(DOCKER_ARCH).tar.gz -C target/release mangatan
	
	# 3. Create a dummy file for the *other* architecture
	# This prevents the COPY instruction in the Dockerfile from failing
	touch mangatan-linux-$(FAKE_ARCH).tar.gz
	
	# 4. Build the image
	# The Dockerfile logic (if/elif) will ignore the empty dummy tarball
	docker build --build-arg TARGETARCH=$(DOCKER_ARCH) -t mangatan:local .
	
	# 5. Cleanup artifacts
	rm mangatan-linux-$(DOCKER_ARCH).tar.gz
	rm mangatan-linux-$(FAKE_ARCH).tar.gz
	@echo "✅ Docker image 'mangatan:local' built successfully."
