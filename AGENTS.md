# Repository Guidelines

## Project Structure & Module Organization
The repository is a Rust workspace with a bundled Web UI.
- `bin/manatan`: desktop launcher/binary entrypoint.
- `bin/manatan_android`: Android app wrapper and assets packaging.
- `crates/audio-server`, `crates/ocr-server`, `crates/sync-server`, `crates/yomitan-server`: core backend services.
- `WebUI/src`: React + TypeScript frontend code.
- `WebUI/public`: static assets and localization files.
- `docs/build`: platform-specific build setup docs.

Keep backend logic in `crates/*`; keep UI feature code under `WebUI/src/features/*`.

## Build, Test, and Development Commands
- `make dev-embedded`: recommended full local run (builds WebUI/resources, bundles JRE, runs app).
- `make dev-embedded-jar`: runs backend while pointing to WebUI dev server (`localhost:5173`) for frontend iteration.
- `make test`: runs `cargo test --workspace -- --nocapture`.
- `make lint`: runs Rust format, clippy, and dependency sorting checks.
- `make build_webui` / `make desktop_webui`: build WebUI and copy output into desktop resources.
- `cd WebUI && yarn dev`: frontend-only dev server.

Use Node `22.12.0` (`WebUI/.nvmrc`) and Rust toolchain compatible with workspace settings.

## Coding Style & Naming Conventions
- Rust: format with `cargo +nightly fmt --all`; clippy must pass with `--deny warnings`.
- Rust naming: `snake_case` for functions/modules, `PascalCase` for types.
- TypeScript/React: Prettier rules are enforced (`tabWidth: 4`, `singleQuote: true`, `printWidth: 120`, trailing commas).
- ESLint disallows default exports and enforces `@/...` imports from `WebUI/src` instead of deep relative paths.

## Testing Guidelines
- Primary tests run via `cargo test --release --workspace -- --nocapture` (CI baseline).
- Add crate-level tests in `crates/<crate>/tests/*.rs` for integration behavior.
- For OCR logic changes, run `make test-ocr-merge` and update regression fixtures deliberately.
- Name tests descriptively in `snake_case` (e.g., `merge_regression.rs`, `validate_submission.rs`).

## Commit & Pull Request Guidelines
- Follow current history style: short, imperative subjects (`Fix migration page`, `fix: ... (#171)`).
- Keep commits focused by subsystem (backend crate, WebUI feature, packaging).
- Reference issues in commit/PR text when relevant (`#123`).
- PRs should include: what changed, why, test steps run, and screenshots/video for UI changes.
- Never commit secrets or tokens; treat sync/auth keys as sensitive config.
