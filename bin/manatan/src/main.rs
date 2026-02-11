mod io;

use std::{
    env,
    fs::{self},
    net::{Ipv4Addr, TcpListener},
    path::{Path, PathBuf},
    process::Stdio,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc::{Receiver, Sender},
    },
    thread,
    time::Duration,
};

use anyhow::anyhow;
use axum::{
    Router,
    http::{StatusCode, Uri},
    response::IntoResponse,
    routing::any,
};
use clap::Parser;
use directories::{BaseDirs, ProjectDirs};
use eframe::{
    egui::{self},
    icon_data,
};
use manatan_server_public::{
    app::build_router_without_cors, build_state, config::Config as ManatanServerConfig,
};
use reqwest::{
    Client, Method,
    header::{
        ACCEPT, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_ORIGIN,
        ACCESS_CONTROL_REQUEST_METHOD, AUTHORIZATION, CONTENT_TYPE, ORIGIN,
    },
};
use rust_embed::RustEmbed;
use self_update::update::ReleaseUpdate;
use serde::Serialize;
use tokio::process::Command;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

#[cfg(feature = "embed-jre")]
use crate::io::extract_zip;
use crate::io::{extract_file, resolve_java};

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const APP_NAME: &str = "Manatan";
const REPO_OWNER: &str = "KolbyML";
const REPO_NAME: &str = "Manatan";
const LEGACY_REPO_NAME: &str = "Mangatan";
const LEGACY_DATA_DIR_NAME: &str = "mangatan";
const BIN_NAME: &str = "manatan";
const SUWAYOMI_HOST: &str = "127.0.0.1";
const SUWAYOMI_PORT: u16 = 4566;
const SUWAYOMI_HTTP_BASE_URL: &str = "http://127.0.0.1:4566";

static ICON_BYTES: &[u8] = include_bytes!("../resources/faviconlogo.png");
static JAR_BYTES: &[u8] = include_bytes!("../resources/Suwayomi-Server.jar");

#[cfg(feature = "embed-jre")]
static NATIVES_BYTES: &[u8] = include_bytes!("../resources/natives.zip");

#[derive(RustEmbed)]
#[folder = "resources/webui"]
struct FrontendAssets;

#[derive(Serialize)]
struct VersionResponse {
    version: String,
    variant: String,
}

#[derive(Clone, Debug, PartialEq)]
enum UpdateStatus {
    Idle,
    Checking,
    UpdateAvailable(String),
    UpToDate,
    Downloading,
    RestartRequired,
    Error(String),
}

#[derive(Parser, Debug, Clone)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Runs the server without the GUI (Fixes Docker/Server deployments)
    #[arg(long, env = "MANATAN_HEADLESS")]
    headless: bool,

    /// Opens the web interface in the default browser after server start (Requires --headless)
    #[arg(long, requires = "headless")]
    open_page: bool,

    /// Sets the IP address to bind the server to
    #[arg(long, default_value = "0.0.0.0", env = "MANATAN_HOST")]
    host: Ipv4Addr,

    /// Sets the Port to bind the server to
    #[arg(long, default_value_t = 4568, env = "MANATAN_PORT")]
    port: u16,

    /// Path to the Manatan SQLite database
    #[arg(long, env = "MANATAN_DB_PATH")]
    db_path: Option<PathBuf>,

    /// Optional migration directory/file path
    #[arg(long, env = "MANATAN_MIGRATE_PATH")]
    migrate_path: Option<PathBuf>,

    /// Run Suwayomi in runtime-only mode
    #[arg(
        long,
        env = "MANATAN_RUNTIME_ONLY",
        default_value_t = true,
        action = clap::ArgAction::Set,
        value_parser = parse_boolish,
        value_name = "BOOL"
    )]
    runtime_only: bool,

    /// Runtime bridge URL used by Manatan server
    #[arg(long, env = "MANATAN_JAVA_URL")]
    java_url: Option<String>,

    /// Enable remote tracker search
    #[arg(
        long,
        env = "MANATAN_TRACKER_REMOTE_SEARCH",
        default_value_t = true,
        action = clap::ArgAction::Set,
        value_parser = parse_boolish,
        value_name = "BOOL"
    )]
    tracker_remote_search: bool,

    /// Tracker search cache TTL in seconds
    #[arg(long, env = "MANATAN_TRACKER_SEARCH_TTL_SECONDS", default_value_t = 3600)]
    tracker_search_ttl_seconds: i64,

    /// Downloads directory (absolute or relative to data dir)
    #[arg(long, env = "MANATAN_DOWNLOADS_PATH")]
    downloads_path: Option<PathBuf>,

    /// Aidoku index URL
    #[arg(long, env = "MANATAN_AIDOKU_INDEX")]
    aidoku_index_url: Option<String>,

    /// Enable Aidoku integration
    #[arg(
        long,
        env = "MANATAN_AIDOKU_ENABLED",
        default_value_t = true,
        action = clap::ArgAction::Set,
        value_parser = parse_boolish,
        value_name = "BOOL"
    )]
    aidoku_enabled: bool,

    /// Aidoku cache directory (absolute or relative to data dir)
    #[arg(long, env = "MANATAN_AIDOKU_CACHE")]
    aidoku_cache_path: Option<PathBuf>,

    /// Local manga directory (absolute or relative to data dir)
    #[arg(long, env = "MANATAN_LOCAL_MANGA_PATH")]
    local_manga_path: Option<PathBuf>,

    /// Local anime directory (absolute or relative to data dir)
    #[arg(long, env = "MANATAN_LOCAL_ANIME_PATH")]
    local_anime_path: Option<PathBuf>,
}

fn parse_boolish(value: &str) -> Result<bool, String> {
    match value.to_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Ok(true),
        "0" | "false" | "no" | "off" => Ok(false),
        _ => Err(format!("Invalid boolean value: {value}")),
    }
}

fn resolve_path_option(option: Option<&PathBuf>, data_dir: &Path, default_relative: &str) -> String {
    match option {
        Some(path) if path.is_absolute() => path.clone(),
        Some(path) => data_dir.join(path),
        None => data_dir.join(default_relative),
    }
    .to_string_lossy()
    .to_string()
}

fn resolve_data_dir() -> PathBuf {
    let new_proj_dirs =
        ProjectDirs::from("", "", APP_NAME).expect("Could not determine home directory");
    let legacy_proj_dirs = ProjectDirs::from("", "", LEGACY_DATA_DIR_NAME)
        .expect("Could not determine home directory");

    let new_dir = new_proj_dirs.data_dir().to_path_buf();
    let legacy_dir = legacy_proj_dirs.data_dir().to_path_buf();

    if new_dir == legacy_dir {
        return new_dir;
    }

    if new_dir.exists() {
        if legacy_dir.exists() && new_dir.is_dir() && is_dir_empty(&new_dir) {
            if let Err(err) = fs::remove_dir_all(&new_dir) {
                warn!(
                    "Failed to remove empty data dir {}: {err}",
                    new_dir.display()
                );
                return new_dir;
            }
            return migrate_legacy_data_dir(&legacy_dir, &new_dir);
        }

        if legacy_dir.exists() {
            warn!(
                "Legacy data dir still exists at {}. Using new data dir at {}.",
                legacy_dir.display(),
                new_dir.display()
            );
        }

        return new_dir;
    }

    if legacy_dir.exists() {
        return migrate_legacy_data_dir(&legacy_dir, &new_dir);
    }

    new_dir
}

fn migrate_legacy_data_dir(legacy_dir: &Path, new_dir: &Path) -> PathBuf {
    if let Some(parent) = new_dir.parent() {
        if let Err(err) = fs::create_dir_all(parent) {
            warn!(
                "Failed to create data dir parent {}: {err}",
                parent.display()
            );
            return legacy_dir.to_path_buf();
        }
    }

    match fs::rename(legacy_dir, new_dir) {
        Ok(()) => {
            info!(
                "Migrated data dir from {} to {}",
                legacy_dir.display(),
                new_dir.display()
            );
            new_dir.to_path_buf()
        }
        Err(err) => {
            warn!(
                "Failed to move legacy data dir ({} -> {}): {err}. Falling back to copy.",
                legacy_dir.display(),
                new_dir.display()
            );
            match copy_dir_recursive(legacy_dir, new_dir) {
                Ok(()) => {
                    info!(
                        "Copied legacy data dir from {} to {}",
                        legacy_dir.display(),
                        new_dir.display()
                    );
                    new_dir.to_path_buf()
                }
                Err(copy_err) => {
                    warn!(
                        "Failed to copy legacy data dir ({} -> {}): {copy_err}",
                        legacy_dir.display(),
                        new_dir.display()
                    );
                    legacy_dir.to_path_buf()
                }
            }
        }
    }
}

fn migrate_suwayomi_extensions(data_dir: &Path) {
    let base_dirs = match BaseDirs::new() {
        Some(base_dirs) => base_dirs,
        None => return,
    };

    let legacy_extensions_dir = base_dirs
        .data_local_dir()
        .join("Tachidesk")
        .join("extensions");
    if !legacy_extensions_dir.exists() {
        return;
    }

    let new_extensions_dir = data_dir.join("extensions");
    if new_extensions_dir.exists() && !is_dir_empty(&new_extensions_dir) {
        info!(
            "Manatan extensions already present at {}. Skipping Suwayomi extension migration.",
            new_extensions_dir.display()
        );
        return;
    }

    if new_extensions_dir.exists() && is_dir_empty(&new_extensions_dir) {
        if let Err(err) = fs::remove_dir_all(&new_extensions_dir) {
            warn!(
                "Failed to remove empty extensions dir {}: {err}",
                new_extensions_dir.display()
            );
        }
    }

    if let Some(parent) = new_extensions_dir.parent() {
        if let Err(err) = fs::create_dir_all(parent) {
            warn!(
                "Failed to create extensions parent dir {}: {err}",
                parent.display()
            );
        }
    }

    match fs::rename(&legacy_extensions_dir, &new_extensions_dir) {
        Ok(()) => {
            info!(
                "Moved Suwayomi extensions from {} to {}",
                legacy_extensions_dir.display(),
                new_extensions_dir.display()
            );
        }
        Err(err) => {
            warn!(
                "Failed to move Suwayomi extensions ({} -> {}): {err}. Falling back to copy.",
                legacy_extensions_dir.display(),
                new_extensions_dir.display()
            );
            match copy_dir_recursive(&legacy_extensions_dir, &new_extensions_dir) {
                Ok(()) => {
                    info!(
                        "Copied Suwayomi extensions from {} to {}",
                        legacy_extensions_dir.display(),
                        new_extensions_dir.display()
                    );
                    if let Err(remove_err) = fs::remove_dir_all(&legacy_extensions_dir) {
                        warn!(
                            "Failed to remove legacy extensions dir {}: {remove_err}",
                            legacy_extensions_dir.display()
                        );
                    }
                }
                Err(copy_err) => {
                    warn!(
                        "Failed to copy Suwayomi extensions ({} -> {}): {copy_err}",
                        legacy_extensions_dir.display(),
                        new_extensions_dir.display()
                    );
                }
            }
        }
    }
}

fn migrate_suwayomi_database(data_dir: &Path) {
    let base_dirs = match BaseDirs::new() {
        Some(base_dirs) => base_dirs,
        None => return,
    };

    let legacy_dir = base_dirs.data_local_dir().join("Tachidesk");
    let legacy_mv = legacy_dir.join("database.mv.db");
    let legacy_h2 = legacy_dir.join("database.h2.db");
    if !legacy_mv.exists() && !legacy_h2.exists() {
        return;
    }

    let new_mv = data_dir.join("database.mv.db");
    let new_h2 = data_dir.join("database.h2.db");
    if new_mv.exists() || new_h2.exists() {
        info!(
            "Manatan database already present at {}. Skipping Suwayomi database migration.",
            data_dir.display()
        );
        return;
    }

    if let Err(err) = fs::create_dir_all(data_dir) {
        warn!("Failed to create data dir {}: {err}", data_dir.display());
        return;
    }

    for (legacy, new_path) in [(legacy_mv, new_mv), (legacy_h2, new_h2)] {
        if !legacy.exists() {
            continue;
        }
        match fs::rename(&legacy, &new_path) {
            Ok(()) => {
                info!(
                    "Moved Suwayomi database file from {} to {}",
                    legacy.display(),
                    new_path.display()
                );
            }
            Err(err) => {
                warn!(
                    "Failed to move Suwayomi database file ({} -> {}): {err}. Falling back to copy.",
                    legacy.display(),
                    new_path.display()
                );
                match fs::copy(&legacy, &new_path) {
                    Ok(_) => {
                        info!(
                            "Copied Suwayomi database file from {} to {}",
                            legacy.display(),
                            new_path.display()
                        );
                        if let Err(remove_err) = fs::remove_file(&legacy) {
                            warn!(
                                "Failed to remove legacy database file {}: {remove_err}",
                                legacy.display()
                            );
                        }
                    }
                    Err(copy_err) => {
                        warn!(
                            "Failed to copy Suwayomi database file ({} -> {}): {copy_err}",
                            legacy.display(),
                            new_path.display()
                        );
                    }
                }
            }
        }
    }
}

fn migrate_suwayomi_settings(data_dir: &Path) {
    let base_dirs = match BaseDirs::new() {
        Some(base_dirs) => base_dirs,
        None => return,
    };

    let legacy_settings_dir = base_dirs
        .data_local_dir()
        .join("Tachidesk")
        .join("settings");
    if !legacy_settings_dir.exists() {
        return;
    }

    let new_settings_dir = data_dir.join("settings");
    if new_settings_dir.exists() && !is_dir_empty(&new_settings_dir) {
        if let Err(err) = copy_missing_settings_files(&legacy_settings_dir, &new_settings_dir) {
            warn!(
                "Failed to merge Suwayomi settings ({} -> {}): {err}",
                legacy_settings_dir.display(),
                new_settings_dir.display()
            );
        } else {
            info!(
                "Merged Suwayomi settings into {}",
                new_settings_dir.display()
            );
        }
        return;
    }

    if new_settings_dir.exists() && is_dir_empty(&new_settings_dir) {
        if let Err(err) = fs::remove_dir_all(&new_settings_dir) {
            warn!(
                "Failed to remove empty settings dir {}: {err}",
                new_settings_dir.display()
            );
        }
    }

    if let Some(parent) = new_settings_dir.parent() {
        if let Err(err) = fs::create_dir_all(parent) {
            warn!(
                "Failed to create settings parent dir {}: {err}",
                parent.display()
            );
        }
    }

    match fs::rename(&legacy_settings_dir, &new_settings_dir) {
        Ok(()) => {
            info!(
                "Moved Suwayomi settings from {} to {}",
                legacy_settings_dir.display(),
                new_settings_dir.display()
            );
        }
        Err(err) => {
            warn!(
                "Failed to move Suwayomi settings ({} -> {}): {err}. Falling back to copy.",
                legacy_settings_dir.display(),
                new_settings_dir.display()
            );
            match copy_dir_recursive(&legacy_settings_dir, &new_settings_dir) {
                Ok(()) => {
                    info!(
                        "Copied Suwayomi settings from {} to {}",
                        legacy_settings_dir.display(),
                        new_settings_dir.display()
                    );
                    if let Err(remove_err) = fs::remove_dir_all(&legacy_settings_dir) {
                        warn!(
                            "Failed to remove legacy settings dir {}: {remove_err}",
                            legacy_settings_dir.display()
                        );
                    }
                }
                Err(copy_err) => {
                    warn!(
                        "Failed to copy Suwayomi settings ({} -> {}): {copy_err}",
                        legacy_settings_dir.display(),
                        new_settings_dir.display()
                    );
                }
            }
        }
    }
}

fn copy_missing_settings_files(source: &Path, dest: &Path) -> Result<(), std::io::Error> {
    if !source.exists() || !source.is_dir() {
        return Ok(());
    }
    if !dest.exists() {
        fs::create_dir_all(dest)?;
    }
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let file_name = entry.file_name();
        let dest_path = dest.join(file_name);
        if source_path.is_dir() {
            copy_missing_settings_files(&source_path, &dest_path)?;
            continue;
        }
        if dest_path.exists() {
            continue;
        }
        fs::copy(&source_path, &dest_path)?;
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

fn is_dir_empty(path: &Path) -> bool {
    match fs::read_dir(path) {
        Ok(mut entries) => entries.next().is_none(),
        Err(_) => false,
    }
}

fn main() -> eframe::Result<()> {
    if manatan_server_public::cef_app::try_handle_subprocess() {
        return Ok(());
    }

    let args = Cli::parse();

    let rust_log = env::var(EnvFilter::DEFAULT_ENV).unwrap_or_default();
    let env_filter = match rust_log.is_empty() {
        true => EnvFilter::builder().parse_lossy("info"),
        false => EnvFilter::builder().parse_lossy(rust_log),
    };
    tracing_subscriber::fmt().with_env_filter(env_filter).init();

    let data_dir = resolve_data_dir();

    let server_data_dir = data_dir.clone();
    let gui_data_dir = data_dir.clone();

    let host = args.host;
    let port = args.port;

    if args.headless {
        info!("👻 Starting in Headless Mode (No GUI)...");

        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

        rt.block_on(async {
            if args.open_page {
                tokio::spawn(async move { open_webpage_when_ready(host, port).await });
            }

            let (shutdown_tx, shutdown_rx) = tokio::sync::mpsc::channel::<()>(1);
            tokio::spawn(async move {
                wait_for_shutdown_signal().await;
                info!("🛑 Shutdown signal received, shutting down server...");
                let _ = shutdown_tx.send(()).await;
            });

            if let Err(err) = run_server(shutdown_rx, &server_data_dir, host, port, &args).await {
                error!("Server crashed: {err}");
            }
        });

        return Ok(());
    }

    let (shutdown_tx, shutdown_rx) = tokio::sync::mpsc::channel::<()>(1);
    let (server_stopped_tx, server_stopped_rx) = std::sync::mpsc::channel::<()>();
    let shutdown_requested = Arc::new(AtomicBool::new(false));

    let thread_host = host.clone();
    let thread_args = args.clone();
    thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async {
            let _guard = ServerGuard {
                tx: server_stopped_tx,
            };

            let h = thread_host.clone();
            tokio::spawn(async move { open_webpage_when_ready(h, port).await });

            if let Err(err) = run_server(
                shutdown_rx,
                &server_data_dir,
                thread_host,
                port,
                &thread_args,
            )
            .await
            {
                error!("Server crashed: {err}");
            }
        });
    });

    let signal_shutdown_flag = Arc::clone(&shutdown_requested);
    let signal_shutdown_tx = shutdown_tx.clone();
    thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async move {
            wait_for_shutdown_signal().await;
            signal_shutdown_flag.store(true, Ordering::SeqCst);
            let _ = signal_shutdown_tx.send(()).await;
        });
    });

    let icon = icon_data::from_png_bytes(ICON_BYTES).expect("The icon data must be valid");
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([320.0, 320.0])
            .with_icon(icon)
            .with_title(APP_NAME)
            .with_resizable(false)
            .with_maximize_button(false),
        ..Default::default()
    };

    info!("🎨 Attempting to open GUI window...");
    let result = eframe::run_native(
        APP_NAME,
        options,
        Box::new(move |_cc| {
            Ok(Box::new(MyApp::new(
                shutdown_tx,
                server_stopped_rx,
                gui_data_dir,
                shutdown_requested,
                host.clone(),
                port,
            )))
        }),
    );

    if let Err(err) = &result {
        error!("❌ CRITICAL GUI ERROR: Failed to start eframe: {err}");
        std::thread::sleep(std::time::Duration::from_secs(5));
    } else {
        info!("👋 GUI exited normally.");
    }

    result
}

struct ServerGuard {
    tx: Sender<()>,
}
impl Drop for ServerGuard {
    fn drop(&mut self) {
        let _ = self.tx.send(());
    }
}

struct MyApp {
    shutdown_tx: tokio::sync::mpsc::Sender<()>,
    server_stopped_rx: Receiver<()>,
    is_shutting_down: bool,
    data_dir: PathBuf,
    update_status: Arc<Mutex<UpdateStatus>>,
    shutdown_requested: Arc<AtomicBool>,
    host: Ipv4Addr,
    port: u16,
}

impl MyApp {
    fn new(
        shutdown_tx: tokio::sync::mpsc::Sender<()>,
        server_stopped_rx: Receiver<()>,
        data_dir: PathBuf,
        shutdown_requested: Arc<AtomicBool>,
        host: Ipv4Addr,
        port: u16,
    ) -> Self {
        // Initialize status
        let update_status = Arc::new(Mutex::new(UpdateStatus::Idle));

        // Optional: Trigger a check immediately on startup
        let status_clone = update_status.clone();
        std::thread::spawn(move || {
            if !is_flatpak() {
                check_for_updates(status_clone);
            }
        });

        Self {
            shutdown_tx,
            server_stopped_rx,
            is_shutting_down: false,
            data_dir,
            update_status,
            shutdown_requested,
            host,
            port,
        }
    }

    fn begin_shutdown(&mut self, message: &str) {
        if !self.is_shutting_down {
            self.is_shutting_down = true;
            tracing::info!("{message} Signaling server to stop...");
            let _ = self.shutdown_tx.try_send(());
        }
    }

    fn trigger_update(&self) {
        let status_clone = self.update_status.clone();

        *status_clone.lock().expect("lock shouldn't panic") = UpdateStatus::Downloading;

        std::thread::spawn(move || match perform_update() {
            Ok(_) => {
                *status_clone.lock().expect("lock shouldn't panic") = UpdateStatus::RestartRequired
            }
            Err(e) => {
                *status_clone.lock().expect("lock shouldn't panic") =
                    UpdateStatus::Error(e.to_string())
            }
        });
    }
}

impl eframe::App for MyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if self.shutdown_requested.load(Ordering::SeqCst) {
            self.begin_shutdown("🛑 Shutdown signal received.");
        }

        // Handle window close requests
        if ctx.input(|i| i.viewport().close_requested()) {
            self.begin_shutdown("❌ Close requested.");
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
        }

        if self.is_shutting_down {
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(80.0);
                    ui.spinner();
                    ui.add_space(10.0);
                    ui.heading("Stopping Servers...");
                    ui.label("Cleaning up child processes...");
                });
            });

            if self.server_stopped_rx.try_recv().is_ok() {
                std::process::exit(0);
            }
            ctx.request_repaint();
            return;
        }

        // --- NORMAL UI ---

        // 1. Version Footer (Floating)
        egui::Area::new("version_watermark".into())
            .anchor(egui::Align2::LEFT_BOTTOM, [8.0, -8.0])
            .order(egui::Order::Foreground)
            .show(ctx, |ui| {
                ui.weak(format!("v{APP_VERSION}"));
            });

        egui::CentralPanel::default().show(ctx, |ui| {
            // --- TOP HEADER: Title & Updates ---
            ui.horizontal(|ui| {
                ui.heading(APP_NAME);
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if is_flatpak() {
                        ui.weak(format!("Flatpak: v{APP_VERSION}"));
                    } else {
                        let status = self
                            .update_status
                            .lock()
                            .expect("lock shouldn't panic")
                            .clone();
                        match status {
                            UpdateStatus::Idle | UpdateStatus::UpToDate => {
                                if ui.small_button("🔄 Check Updates").clicked() {
                                    let status_clone = self.update_status.clone();
                                    std::thread::spawn(move || check_for_updates(status_clone));
                                }
                            }
                            UpdateStatus::Checking => {
                                ui.spinner();
                            }
                            _ => {} // Handle active updates in the main body
                        }
                    }
                });
            });

            ui.separator();
            ui.add_space(10.0);

            // --- UPDATE NOTIFICATIONS AREA ---
            let status = self
                .update_status
                .lock()
                .expect("lock shouldn't panic")
                .clone();
            match status {
                UpdateStatus::UpdateAvailable(ver) => {
                    ui.group(|ui| {
                        ui.vertical_centered(|ui| {
                            ui.colored_label(
                                egui::Color32::LIGHT_BLUE,
                                format!("✨ Update {ver} Available"),
                            );
                            ui.add_space(5.0);
                            if ui.button("⬇ Download & Install").clicked() {
                                self.trigger_update();
                            }
                        });
                    });
                    ui.add_space(10.0);
                }
                UpdateStatus::Downloading => {
                    ui.group(|ui| {
                        ui.vertical_centered(|ui| {
                            ui.spinner();
                            ui.label("Downloading update...");
                        });
                    });
                    ui.add_space(10.0);
                }
                UpdateStatus::RestartRequired => {
                    ui.group(|ui| {
                        ui.vertical_centered(|ui| {
                            ui.colored_label(egui::Color32::GREEN, "✔ Update Ready!");
                            ui.add_space(5.0);
                            if ui.button("🚀 Restart App").clicked() {
                                if let Ok(exe_path) = std::env::current_exe() {
                                    let mut exe_str = exe_path.to_string_lossy().to_string();
                                    if cfg!(target_os = "linux") && exe_str.ends_with(" (deleted)")
                                    {
                                        exe_str = exe_str.replace(" (deleted)", "");
                                    }
                                    let _ = std::process::Command::new(exe_str).spawn();
                                }
                                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                            }
                        });
                    });
                    ui.add_space(10.0);
                }
                UpdateStatus::Error(e) => {
                    ui.colored_label(egui::Color32::RED, "Update Failed");
                    ui.small(e.chars().take(40).collect::<String>());
                    if ui.button("Retry").clicked() {
                        *self.update_status.lock().expect("lock shouldn't panic") =
                            UpdateStatus::Idle;
                    }
                    ui.add_space(10.0);
                }
                _ => {}
            }

            // --- PRIMARY ACTION (THE "HERO" BUTTON) ---
            ui.vertical_centered(|ui| {
                ui.add_space(5.0);
                let btn_size = egui::vec2(ui.available_width() * 0.9, 45.0);
                let btn =
                    egui::Button::new(egui::RichText::new("🚀 OPEN WEB UI").size(18.0).strong())
                        .min_size(btn_size);

                if ui.add(btn).clicked() {
                    let host_target = if self.host == Ipv4Addr::new(0, 0, 0, 0) {
                        "localhost".to_string()
                    } else {
                        self.host.to_string()
                    };
                    let url = format!("http://{host_target}:{}", self.port);
                    let _ = open::that(url);
                }
            });

            ui.add_space(15.0);

            // --- SECONDARY ACTIONS (Community) ---
            ui.vertical_centered(|ui| {
                if ui.button("💬 Join Discord Community").clicked() {
                    let _ = open::that("https://discord.gg/tDAtpPN8KK");
                }
            });

            ui.add_space(15.0);
            ui.separator();

            // --- TERTIARY ACTIONS (Data Management) ---
            ui.add_space(5.0);
            ui.label("Data Management:");

            // Single action (keep spacing and avoid cramped bottom).
            if ui
                .add_sized([ui.available_width(), 30.0], egui::Button::new("📂 Manatan Data"))
                .clicked()
            {
                if !self.data_dir.exists() {
                    let _ = std::fs::create_dir_all(&self.data_dir);
                }
                let _ = open::that(&self.data_dir);
            }

            ui.add_space(12.0);
        });
    }
}

async fn run_server(
    mut shutdown_signal: tokio::sync::mpsc::Receiver<()>,
    data_dir: &PathBuf,
    host: Ipv4Addr,
    port: u16,
    cli: &Cli,
) -> Result<(), Box<anyhow::Error>> {
    info!("🚀 Initializing Manatan Launcher...");
    info!("📂 Data Directory: {}", data_dir.display());

    if !data_dir.exists() {
        fs::create_dir_all(data_dir).map_err(|err| anyhow!("Failed to create data dir {err:?}"))?;
    }
    let local_manga_dir = data_dir.join("local-manga");
    if !local_manga_dir.exists() {
        if let Err(err) = fs::create_dir_all(&local_manga_dir) {
            warn!(
                "Failed to create local manga dir {}: {err}",
                local_manga_dir.display()
            );
        }
    }
    let local_anime_dir = data_dir.join("local-anime");
    if !local_anime_dir.exists() {
        if let Err(err) = fs::create_dir_all(&local_anime_dir) {
            warn!(
                "Failed to create local anime dir {}: {err}",
                local_anime_dir.display()
            );
        }
    }
    let bin_dir = data_dir.join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|err| anyhow!("Failed to create bin dir {err:?}"))?;
    }

    migrate_suwayomi_extensions(data_dir);
    migrate_suwayomi_database(data_dir);
    migrate_suwayomi_settings(data_dir);

    info!("📦 Extracting assets...");
    let jar_name = "Suwayomi-Server.jar";
    let _ = extract_file(&bin_dir, jar_name, JAR_BYTES)
        .map_err(|err| anyhow!("Failed to extract {jar_name} {err:?}"))?;
    let jar_rel_path = PathBuf::from("bin").join(jar_name);

    #[cfg(feature = "embed-jre")]
    {
        let natives_dir = data_dir.join("natives");
        if !natives_dir.exists() {
            info!("📦 Extracting Native Libraries (JogAmp)...");
            fs::create_dir_all(&natives_dir)
                .map_err(|e| anyhow!("Failed to create natives dir: {e}"))?;

            extract_zip(NATIVES_BYTES, &natives_dir)
                .map_err(|e| anyhow!("Failed to extract natives: {e}"))?;
        }
    }

    info!("🔍 Resolving Java...");
    let java_exec =
        resolve_java(data_dir).map_err(|err| anyhow!("Failed to resolve java install {err:?}"))?;
    let java_home = java_exec
        .parent()
        .and_then(|p| p.parent())
        .unwrap_or(data_dir);

    info!("☕ Spawning Suwayomi...");
    let manatan_db_path = resolve_path_option(cli.db_path.as_ref(), data_dir, "manatan.sqlite");
    let manatan_migrate_path = cli
        .migrate_path
        .as_ref()
        .map(|path| path.to_string_lossy().to_string());
    let runtime_only = cli.runtime_only;
    if runtime_only {
        info!("Suwayomi runtime-only mode enabled");
    }

    let suwayomi_pid_path = data_dir.join("suwayomi.pid");
    cleanup_orphan_suwayomi(&suwayomi_pid_path);
    ensure_suwayomi_port_available(SUWAYOMI_HOST, SUWAYOMI_PORT)?;

    let mut suwayomi_proc = Command::new(&java_exec)
        .current_dir(data_dir)
        .env("JAVA_HOME", java_home)
        .env(
            "SUWAYOMI_RUNTIME_ONLY",
            if runtime_only { "true" } else { "false" },
        )
        .arg("-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false")
        .arg("-Dsuwayomi.tachidesk.config.server.webUIEnabled=false")
        .arg("-Dsuwayomi.tachidesk.config.server.enableCookieApi=true")
        .arg(format!("-Dsuwayomi.runtimeOnly={}", runtime_only))
        .arg(format!(
            "-Dsuwayomi.tachidesk.config.server.rootDir={}",
            data_dir.display()
        ))
        .arg(format!(
            "-Dsuwayomi.tachidesk.config.server.ip={}",
            SUWAYOMI_HOST
        ))
        .arg(format!(
            "-Dsuwayomi.tachidesk.config.server.port={}",
            SUWAYOMI_PORT
        ))
        .arg(format!(
            "-Dsuwayomi.tachidesk.config.server.localAnimeSourcePath={}",
            local_anime_dir.display()
        ))
        .arg("-XX:+ExitOnOutOfMemoryError")
        .arg("--enable-native-access=ALL-UNNAMED")
        .arg("--add-opens=java.desktop/sun.awt=ALL-UNNAMED")
        .arg("--add-opens=java.desktop/javax.swing=ALL-UNNAMED")
        .arg("-jar")
        .arg(&jar_rel_path)
        .kill_on_drop(true)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|err| anyhow!("Failed to launch suwayomi {err:?}"))?;

    if let Some(pid) = suwayomi_proc.id() {
        if let Err(err) = fs::write(&suwayomi_pid_path, pid.to_string()) {
            warn!(
                "Failed to write Suwayomi pid file {}: {err}",
                suwayomi_pid_path.display()
            );
        }
    } else {
        warn!(
            "Suwayomi PID unavailable; skipping pid file at {}",
            suwayomi_pid_path.display()
        );
    }

    let manatan_runtime_url = if runtime_only {
        if let Some(value) = cli.java_url.as_deref()
            && value != SUWAYOMI_HTTP_BASE_URL
        {
            warn!(
                "Ignoring MANATAN_JAVA_URL={} while runtime-only is enabled; using {}",
                value, SUWAYOMI_HTTP_BASE_URL
            );
        }
        SUWAYOMI_HTTP_BASE_URL.to_string()
    } else {
        cli.java_url
            .clone()
            .unwrap_or_else(|| SUWAYOMI_HTTP_BASE_URL.to_string())
    };
    let tracker_remote_search = cli.tracker_remote_search;
    let tracker_search_ttl_seconds = cli.tracker_search_ttl_seconds;
    let downloads_path = resolve_path_option(cli.downloads_path.as_ref(), data_dir, "downloads");
    let aidoku_index_url = cli.aidoku_index_url.clone().unwrap_or_default();
    let aidoku_enabled = cli.aidoku_enabled;
    let aidoku_cache_path = resolve_path_option(cli.aidoku_cache_path.as_ref(), data_dir, "aidoku");
    let local_manga_path = resolve_path_option(cli.local_manga_path.as_ref(), data_dir, "local-manga");
    let local_anime_path = resolve_path_option(cli.local_anime_path.as_ref(), data_dir, "local-anime");
    let manatan_config = ManatanServerConfig {
        host: host.to_string(),
        port,
        java_runtime_url: manatan_runtime_url.clone(),
        webview_enabled: true,
        aidoku_index_url,
        aidoku_enabled,
        aidoku_cache_path,
        db_path: manatan_db_path,
        migrate_path: manatan_migrate_path,
        tracker_remote_search,
        tracker_search_ttl_seconds,
        downloads_path,
        local_manga_path,
        local_anime_path,
    };
    let manatan_state = build_state(manatan_config)
        .await
        .map_err(|err| anyhow!("Failed to init Manatan server: {err}"))?;
    ensure_runtime_bridge_available(&manatan_runtime_url)
        .await
        .map_err(|err| anyhow!("Failed runtime bridge preflight: {err}"))?;
    let manatan_router = build_router_without_cors(manatan_state);

    info!("🌍 Starting Web Interface at http://{}:{}", host, port);

    let ocr_router = manatan_ocr_server::create_router(data_dir.clone());
    let yomitan_router = manatan_yomitan_server::create_router(data_dir.clone());
    let audio_router = manatan_audio_server::create_router(data_dir.clone());
    let sync_router = manatan_sync_server::create_router(data_dir.clone());
    let system_router = Router::new().route("/version", any(current_version_handler));

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::mirror_request())
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            AUTHORIZATION,
            CONTENT_TYPE,
            ACCEPT,
            ORIGIN,
            ACCESS_CONTROL_ALLOW_ORIGIN,
            ACCESS_CONTROL_ALLOW_HEADERS,
            ACCESS_CONTROL_REQUEST_METHOD,
        ])
        .allow_credentials(true);

    let app = Router::new()
        .nest("/api/ocr", ocr_router)
        .nest("/api/audio", audio_router)
        .nest("/api/sync", sync_router)
        .nest("/api/system", system_router)
        .nest("/api/yomitan", yomitan_router)
        .merge(manatan_router)
        .fallback(serve_react_app)
        .layer(cors);

    let listener_addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&listener_addr)
        .await
        .map_err(|err| anyhow!("Failed to create main server socket: {err:?}"))?;

    let server_future = axum::serve(listener, app).with_graceful_shutdown(async move {
        let _ = shutdown_signal.recv().await;
        info!("🛑 Shutdown signal received.");
    });

    info!("✅ Unified Server Running.");

    tokio::select! {
        _ = suwayomi_proc.wait() => { error!("❌ Suwayomi exited unexpectedly"); }
        _ = server_future => { info!("✅ Web server shutdown complete."); }
    }

    info!("🛑 terminating child processes...");

    if let Err(err) = suwayomi_proc.kill().await {
        error!("Error killing Suwayomi: {err}");
    }
    let _ = suwayomi_proc.wait().await;
    let _ = fs::remove_file(&suwayomi_pid_path);
    info!("   Suwayomi terminated.");

    Ok(())
}

async fn serve_react_app(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    if !path.is_empty()
        && let Some(content) = FrontendAssets::get(path)
    {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return (
            [(axum::http::header::CONTENT_TYPE, mime.as_ref())],
            content.data,
        )
            .into_response();
    }

    if let Some(index) = FrontendAssets::get("index.html")
        && let Ok(html_string) = std::str::from_utf8(index.data.as_ref())
    {
        let fixed_html = html_string.replace("<head>", "<head><base href=\"/\" />");

        return (
            [(axum::http::header::CONTENT_TYPE, "text/html")],
            fixed_html,
        )
            .into_response();
    }

    (StatusCode::NOT_FOUND, "404 - Index.html missing").into_response()
}

fn ensure_suwayomi_port_available(host: &str, port: u16) -> anyhow::Result<()> {
    match TcpListener::bind((host, port)) {
        Ok(listener) => {
            drop(listener);
            Ok(())
        }
        Err(err) => Err(anyhow!(
            "{}:{} is already in use ({err}). Stop any existing Suwayomi/Manatan process and try again.",
            host,
            port
        )),
    }
}

async fn ensure_runtime_bridge_available(base_url: &str) -> anyhow::Result<()> {
    let client = Client::new();
    let health_url = format!("{}/runtime/v1/health", base_url);
    let bridge_url = format!("{}/runtime/v1/bridge/manga/pages", base_url);

    for _ in 0..60 {
        if let Ok(resp) = client.get(&health_url).send().await
            && resp.status().is_success()
        {
            let bridge_resp = client
                .post(&bridge_url)
                .header("content-type", "application/json")
                .body("{}")
                .send()
                .await;

            return match bridge_resp {
                Ok(resp) if resp.status() == StatusCode::NOT_FOUND => {
                    let body = resp
                        .text()
                        .await
                        .unwrap_or_else(|_| "[failed to read body]".to_string());
                    Err(anyhow!(
                        "runtime bridge endpoint missing at {} (status 404, body={}). This usually means an outdated or wrong Suwayomi runtime is running.",
                        bridge_url,
                        body
                    ))
                }
                Ok(_) => Ok(()),
                Err(err) => Err(anyhow!("failed calling runtime bridge endpoint: {err}")),
            };
        }

        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    Err(anyhow!(
        "timed out waiting for runtime health endpoint {}",
        health_url
    ))
}

fn get_asset_target_string() -> &'static str {
    #[cfg(target_os = "windows")]
    return "Windows-x64";

    #[cfg(target_os = "macos")]
    {
        #[cfg(target_arch = "aarch64")]
        return "macOS-Silicon";
        #[cfg(target_arch = "x86_64")]
        return "macOS-Intel";
    }

    #[cfg(target_os = "linux")]
    {
        #[cfg(target_arch = "aarch64")]
        return "Linux-arm64.tar";

        #[cfg(target_arch = "x86_64")]
        return "Linux-amd64.tar";
    }
}

fn cleanup_orphan_suwayomi(pid_path: &Path) {
    let Some(pid) = read_pid_file(pid_path) else {
        return;
    };

    #[cfg(unix)]
    {
        if !is_suwayomi_process(pid) {
            warn!(
                "Stale pid file {} does not match Suwayomi process; removing.",
                pid_path.display()
            );
            let _ = fs::remove_file(pid_path);
            return;
        }

        if !is_process_alive(pid) {
            let _ = fs::remove_file(pid_path);
            return;
        }

        info!("Found leftover Suwayomi process (pid {pid}). Shutting it down...");
        terminate_process(pid, Duration::from_secs(5));
        let _ = fs::remove_file(pid_path);
    }

    #[cfg(not(unix))]
    {
        let _ = pid;
        let _ = fs::remove_file(pid_path);
    }
}

fn read_pid_file(pid_path: &Path) -> Option<i32> {
    let contents = fs::read_to_string(pid_path).ok()?;
    let trimmed = contents.trim();
    if trimmed.is_empty() {
        let _ = fs::remove_file(pid_path);
        return None;
    }
    match trimmed.parse::<i32>() {
        Ok(pid) => Some(pid),
        Err(_) => {
            let _ = fs::remove_file(pid_path);
            None
        }
    }
}

#[cfg(unix)]
fn is_process_alive(pid: i32) -> bool {
    let result = unsafe { libc::kill(pid, 0) };
    if result == 0 {
        return true;
    }
    let err = std::io::Error::last_os_error();
    err.raw_os_error() == Some(libc::EPERM)
}

#[cfg(unix)]
fn is_suwayomi_process(pid: i32) -> bool {
    let cmdline_path = format!("/proc/{pid}/cmdline");
    let Ok(bytes) = fs::read(cmdline_path) else {
        return false;
    };
    let text = String::from_utf8_lossy(&bytes).replace('\0', " ");
    text.contains("Suwayomi-Server.jar")
}

#[cfg(unix)]
fn terminate_process(pid: i32, timeout: Duration) {
    let _ = unsafe { libc::kill(pid, libc::SIGTERM) };
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        if !is_process_alive(pid) {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
    let _ = unsafe { libc::kill(pid, libc::SIGKILL) };
}

fn check_for_updates(status: Arc<Mutex<UpdateStatus>>) {
    *status.lock().expect("lock shouldn't panic") = UpdateStatus::Checking;

    // We use the same configuration for checking as we do for updating
    // This ensures we only "find" releases that actually match our custom asset naming
    let target_str = get_asset_target_string();

    let updater_result = build_updater(REPO_NAME, target_str);

    match updater_result {
        Ok(updater) => {
            match updater.get_latest_release() {
                Ok(release) => {
                    // Check if remote version > local version
                    let is_newer =
                        self_update::version::bump_is_greater(APP_VERSION, &release.version)
                            .unwrap_or(false);

                    if is_newer {
                        *status.lock().expect("lock shouldn't panic") =
                            UpdateStatus::UpdateAvailable(release.version);
                    } else {
                        *status.lock().expect("lock shouldn't panic") = UpdateStatus::UpToDate;
                    }
                }
                Err(e) => {
                    if let Ok(legacy_updater) = build_updater(LEGACY_REPO_NAME, target_str) {
                        match legacy_updater.get_latest_release() {
                            Ok(release) => {
                                let is_newer = self_update::version::bump_is_greater(
                                    APP_VERSION,
                                    &release.version,
                                )
                                .unwrap_or(false);

                                if is_newer {
                                    *status.lock().expect("lock shouldn't panic") =
                                        UpdateStatus::UpdateAvailable(release.version);
                                } else {
                                    *status.lock().expect("lock shouldn't panic") =
                                        UpdateStatus::UpToDate;
                                }
                            }
                            Err(err) => {
                                *status.lock().expect("lock shouldn't panic") =
                                    UpdateStatus::Error(err.to_string())
                            }
                        }
                    } else {
                        *status.lock().expect("lock shouldn't panic") =
                            UpdateStatus::Error(e.to_string())
                    }
                }
            }
        }
        Err(e) => {
            if let Ok(legacy_updater) = build_updater(LEGACY_REPO_NAME, target_str) {
                match legacy_updater.get_latest_release() {
                    Ok(release) => {
                        let is_newer =
                            self_update::version::bump_is_greater(APP_VERSION, &release.version)
                                .unwrap_or(false);

                        if is_newer {
                            *status.lock().expect("lock shouldn't panic") =
                                UpdateStatus::UpdateAvailable(release.version);
                        } else {
                            *status.lock().expect("lock shouldn't panic") = UpdateStatus::UpToDate;
                        }
                    }
                    Err(err) => {
                        *status.lock().expect("lock shouldn't panic") =
                            UpdateStatus::Error(err.to_string())
                    }
                }
            } else {
                *status.lock().expect("lock shouldn't panic") = UpdateStatus::Error(e.to_string())
            }
        }
    }
}

fn perform_update() -> Result<(), Box<dyn std::error::Error>> {
    let target_str = get_asset_target_string();

    if let Ok(updater) = build_updater_with_download(REPO_NAME, target_str) {
        if updater.update().is_ok() {
            return Ok(());
        }
    }

    build_updater_with_download(LEGACY_REPO_NAME, target_str)?.update()?;

    Ok(())
}

fn build_updater(
    repo_name: &str,
    target_str: &str,
) -> Result<Box<dyn ReleaseUpdate>, self_update::errors::Error> {
    self_update::backends::github::Update::configure()
        .repo_owner(REPO_OWNER)
        .repo_name(repo_name)
        .bin_name(BIN_NAME)
        .target(target_str)
        .current_version(APP_VERSION)
        .build()
}

fn build_updater_with_download(
    repo_name: &str,
    target_str: &str,
) -> Result<Box<dyn ReleaseUpdate>, self_update::errors::Error> {
    self_update::backends::github::Update::configure()
        .repo_owner(REPO_OWNER)
        .repo_name(repo_name)
        .bin_name(BIN_NAME)
        .target(target_str)
        .show_download_progress(true)
        .current_version(APP_VERSION)
        .no_confirm(true)
        .build()
}

async fn open_webpage_when_ready(host: Ipv4Addr, port: u16) {
    let client = Client::new();

    let host_target = if host == Ipv4Addr::new(0, 0, 0, 0) {
        "localhost".to_string()
    } else {
        host.to_string()
    };
    let url = format!("http://{host_target}:{port}");
    let health_url = format!("http://{host_target}:{port}/health");

    info!("⏳ Polling health endpoint for readiness (timeout 10s)...");

    // Define the polling task
    let polling_task = async {
        loop {
            match client.get(&health_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    info!("✅ Server is responsive! Opening browser...");
                    if let Err(e) = open::that(&url) {
                        error!("❌ Failed to open browser: {}", e);
                    }
                    return;
                }
                err => {
                    warn!("Failed to poll health to open webpage: {err:?}");
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            }
        }
    };

    if tokio::time::timeout(Duration::from_secs(10), polling_task)
        .await
        .is_err()
    {
        error!("❌ Timed out waiting for server readiness (10s). Browser open cancelled.");
    }
}

async fn wait_for_shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};

        let mut sigterm = signal(SignalKind::terminate()).ok();
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {},
            _ = async {
                if let Some(sigterm) = &mut sigterm {
                    sigterm.recv().await;
                } else {
                    std::future::pending::<()>().await;
                }
            } => {},
        }
    }

    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

async fn current_version_handler() -> impl IntoResponse {
    axum::Json(VersionResponse {
        version: APP_VERSION.to_string(),
        variant: "desktop".to_string(), // Frontend will see 'desktop' and HIDE the button
    })
}

fn is_flatpak() -> bool {
    std::env::var("FLATPAK_ID").is_ok()
}
