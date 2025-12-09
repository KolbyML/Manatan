SHELL := /bin/bash

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
	rm -rf bin/mangatan/resources/ocr-server*
	rm -rf bin/mangatan/resources/Suwayomi-Server.jar

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

.PHONY: build-ocr-binaries
build-ocr-binaries:
	@echo "Building OCR binaries..."

	cd ocr-server && mkdir -p dist
	      
	# Linux x64
	cd ocr-server && deno compile --allow-net --allow-read --allow-write --allow-env --target x86_64-unknown-linux-gnu --output dist/ocr-server-linux server.ts
	
	# Windows x64
	cd ocr-server && deno compile --allow-net --allow-read --allow-write --allow-env --target x86_64-pc-windows-msvc --output dist/ocr-server-win.exe server.ts
	
	# macOS x64 (Intel)
	cd ocr-server && deno compile --allow-net --allow-read --allow-write --allow-env --target x86_64-apple-darwin --output dist/ocr-server-macos-x64 server.ts
	
	# macOS ARM64 (Apple Silicon) - Optional, can fallback to x64 via Rosetta or use specific binary if needed
	cd ocr-server && deno compile --allow-net --allow-read --allow-write --allow-env --target aarch64-apple-darwin --output dist/ocr-server-macos-arm64 server.ts
	cp ocr-server/dist/ocr-server* bin/mangatan/resources

.PHONY: dev
dev: build-ocr-binaries build_webui download_jar
	cargo run --release -p mangatan

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
	curl -L "https://github.com/Suwayomi/Suwayomi-Server-preview/releases/download/v2.1.2019/Suwayomi-Server-v2.1.2019.jar" -o bin/mangatan/resources/Suwayomi-Server.jar

.PHONY: release-notes
release-notes:
	@echo "---------------------------------------------------"
	@echo "Generating Release Description"
	@echo "---------------------------------------------------"
	@# 1. Try to get the latest tag. 
	@#    If command fails (no tags), PREV_TAG will be empty.
	@export PREV_TAG=$$(git describe --tags --abbrev=0 2>/dev/null); \
	if [ -z "$$PREV_TAG" ]; then \
		echo "### Initial Release"; \
		echo ""; \
		git log --no-merges --pretty=format:"- %s (%h)"; \
	else \
		echo "### Changes since $$PREV_TAG"; \
		echo ""; \
		git log $$PREV_TAG..HEAD --no-merges --pretty=format:"- %s (%h)"; \
	fi
	@echo ""
	@echo "---------------------------------------------------"
