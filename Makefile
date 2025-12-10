SHELL := /bin/bash

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)
JOGAMP_TARGET := unknown

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
test: # Run all tests.
	cargo test --workspace -- --nocapture

.PHONY: fmt
fmt: # Run `rustfmt` on the entire workspace
	cargo +nightly fmt --all

.PHONY: clippy
clippy: # Run `clippy` on the entire workspace.
	cargo clippy --all --all-targets --no-deps -- --deny warnings

.PHONY: lint
lint: fmt clippy sort # Run all linters.

.PHONY: clean
clean: # Run `clean mangatan resources`.
	rm -rf bin/mangatan/resources/suwayomi-webui
	rm -rf bin/mangatan/resources/jre_bundle.zip
	rm -rf bin/mangatan/resources/Suwayomi-Server.jar
	rm -rf bin/mangatan/resources/natives.zip
	rm -f jogamp.7z
	rm -rf temp_natives 

.PHONY: clean_rust
clean_rust: # Run `cargo clean`.
	cargo clean

.PHONY: sort
sort: # Run `cargo sort` on the entire workspace.
	cargo sort --grouped --workspace

.PHONY: clean-deps
clean-deps: # Run `cargo udeps`
	cargo +nightly udeps --workspace --tests --all-targets --release

.PHONY: build_webui
build_webui:
	@echo "Building WebUI (Enforcing Node 22.12.0)..."
	# 1. Try to source NVM and use Node 22.12.0. 
	#    This setup assumes standard NVM installation path.
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
	curl -L "https://jogamp.org/deployment/jogamp-current/archive/jogamp-all-platforms.7z" -o jogamp.7z
	
	@echo "Extracting libraries..."
	# Extract only the specific architecture folder
	7z x jogamp.7z -otemp_natives "jogamp-all-platforms/lib/$(JOGAMP_TARGET)"
	
	@echo "Zipping structure..."
	# Change directory to the parent 'lib' folder so we can zip the folder 'linux-amd64' (or similar)
	# This ensures natives.zip contains the folder structure: <arch>/file.so
	cd temp_natives/jogamp-all-platforms/lib && zip -r "$(CURDIR)/bin/mangatan/resources/natives.zip" $(JOGAMP_TARGET)
	
	@echo "Cleanup..."
	rm jogamp.7z
	rm -rf temp_natives
	@echo "Natives ready at bin/mangatan/resources/natives.zip"

.PHONY: dev
dev: build_webui download_jar download_natives
	cargo run --release -p mangatan

.PHONY: dev-embedded
dev-embedded: build_webui download_jar bundle_jre download_natives
	cargo run --release -p mangatan --features embed-jre

.PHONY: jlink
jlink:
	@echo "Building custom JDK with jlink..."

	# Ensure the output directory is clean
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
