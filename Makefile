
.PHONY: build-ocr-binaries
build-ocr-binaries:
	@echo "Building OCR binaries..."

	cd ocr-server && mkdir -p dist
          
	# Linux x64
	cd ocr-server && deno compile --allow-net --allow-read --allow-write --allow-env --target x86_64-unknown-linux-gnu --output dist/ocr-server-linux server.ts
	
	# Windows x64
	cd ocr-server && deno compile --allow-net --allow-read --allow-write --allow-env --target x86_64-pc-windows-msvc --output dist/ocr-server-win.exe server.ts
	
	# macOS x64 (Intel)
	cd ocr-server && deno compile --allow-net --allow-read --allow-write --allow-env --target x86_64-apple-darwin --output dist/ocr-server-macos server.ts
	
	# macOS ARM64 (Apple Silicon) - Optional, can fallback to x64 via Rosetta or use specific binary if needed
	cd ocr-server && deno compile --allow-net --allow-read --allow-write --allow-env --target aarch64-apple-darwin --output dist/ocr-server-macos-arm64 server.ts

.PHONY: dev
dev: build-ocr-binaries
	./dev.sh
