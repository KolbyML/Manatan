
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
	@echo "Starting Mangatan in development mode..."
	mkdir -p Suwayomi-Server/server/src/main/resources/ocr-binaries
	cp ocr-server/dist/* Suwayomi-Server/server/src/main/resources/ocr-binaries/
	
	@echo "Starting Suwayomi-WebUI and Suwayomi-Server (Ctrl+C to stop both)..."
	@set -e; \
	trap 'echo ""; echo "Stopping dev services..."; kill $$WEBUI_PID $$SERVER_PID 2>/dev/null || true' INT TERM; \
	cd Suwayomi-Server && ./gradlew clean && cd ..; \
	( cd Suwayomi-Server && ./gradlew :server:run --stacktrace ) & \
	SERVER_PID=$$!; \
	echo "Waiting for server on http://localhost:4567..."; \
	while ! curl -sSf http://localhost:4567 >/dev/null 2>&1; do \
		sleep 1; \
	done; \
    sleep 15; \
	echo "Server is up on http://localhost:4567"; \
    . ${NVM_DIR}/nvm.sh && nvm use 22.12.0; \
	( cd Suwayomi-WebUI && yarn dev ) & \
	WEBUI_PID=$$!; \
    sleep 5; \
	open http://localhost:3000 || true; \
	wait $$WEBUI_PID $$SERVER_PID
