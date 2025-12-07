
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
clean: # Run `cargo clean`.
	cargo clean

.PHONY: sort
sort: # Run `cargo sort` on the entire workspace.
	cargo sort --grouped --workspace

.PHONY: clean-deps
clean-deps: # Run `cargo udeps`
	cargo +nightly udeps --workspace --tests --all-targets --release


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

.PHONY: dev
dev: build-ocr-binaries
	./dev.sh
