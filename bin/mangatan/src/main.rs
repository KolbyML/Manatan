use std::{
    env,
    fs::{self},
    io::{self},
    path::PathBuf,
    process::Stdio,
    sync::mpsc::{self, Receiver, Sender},
    thread,
    time::Duration,
};

use anyhow::anyhow;
use axum::{
    Router,
    body::Body,
    extract::{Request, State},
    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
};
use directories::ProjectDirs;
use eframe::{
    egui::{self},
    icon_data,
};
use futures::TryStreamExt;
use mangatan_core::io::{extract_executable, extract_file, resolve_java};
use reqwest::Client;
use rust_embed::RustEmbed;
use tokio::process::Command;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

#[cfg(feature = "embed-jre")]
use mangatan_core::io::extract_zip;

static ICON_BYTES: &[u8] = include_bytes!("../resources/faviconlogo.png");
static JAR_BYTES: &[u8] = include_bytes!("../resources/Suwayomi-Server.jar");

#[cfg(feature = "embed-jre")]
static NATIVES_BYTES: &[u8] = include_bytes!("../resources/natives.zip");

#[cfg(target_os = "windows")]
static OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-win.exe");

#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
static OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-linux-arm64");

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
static OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-linux");

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
static OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-macos-arm64");

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
static OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-macos-x64");

#[derive(RustEmbed)]
#[folder = "resources/suwayomi-webui"]
struct FrontendAssets;

fn main() -> eframe::Result<()> {
    let rust_log = env::var(EnvFilter::DEFAULT_ENV).unwrap_or_default();
    let env_filter = match rust_log.is_empty() {
        true => EnvFilter::builder().parse_lossy("info"),
        false => EnvFilter::builder().parse_lossy(rust_log),
    };
    tracing_subscriber::fmt().with_env_filter(env_filter).init();

    let proj_dirs =
        ProjectDirs::from("", "", "mangatan").expect("Could not determine home directory");
    let data_dir = proj_dirs.data_dir().to_path_buf();

    let server_data_dir = data_dir.clone();
    let gui_data_dir = data_dir.clone();

    let (shutdown_tx, mut shutdown_rx) = tokio::sync::mpsc::channel::<()>(1);
    let (server_stopped_tx, server_stopped_rx) = mpsc::channel::<()>();

    thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async {
            let _guard = ServerGuard {
                tx: server_stopped_tx,
            };

            if let Err(err) = run_server(&mut shutdown_rx, &server_data_dir).await {
                error!("Server crashed: {err}");
            }
        });
    });

    let icon = icon_data::from_png_bytes(ICON_BYTES).expect("The icon data must be valid");
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([300.0, 150.0])
            .with_icon(icon)
            .with_title("Mangatan")
            .with_resizable(false)
            .with_maximize_button(false),
        ..Default::default()
    };

    info!("🎨 Attempting to open GUI window...");
    let result = eframe::run_native(
        "Mangatan",
        options,
        Box::new(|_cc| {
            Ok(Box::new(MyApp::new(
                shutdown_tx,
                server_stopped_rx,
                gui_data_dir,
            )))
        }),
    );

    if let Err(err) = &result {
        error!("❌ CRITICAL GUI ERROR: Failed to start eframe: {err}");
        std::thread::sleep(Duration::from_secs(5));
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
}

impl MyApp {
    fn new(
        shutdown_tx: tokio::sync::mpsc::Sender<()>,
        server_stopped_rx: Receiver<()>,
        data_dir: PathBuf,
    ) -> Self {
        Self {
            shutdown_tx,
            server_stopped_rx,
            is_shutting_down: false,
            data_dir,
        }
    }
}

impl eframe::App for MyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if ctx.input(|i| i.viewport().close_requested()) {
            if !self.is_shutting_down {
                self.is_shutting_down = true;
                info!("❌ Close requested. Signaling server to stop...");
                let _ = self.shutdown_tx.try_send(());
            }
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
        }

        if self.is_shutting_down {
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(50.0);
                    ui.heading("Stopping Servers...");
                    ui.add_space(10.0);
                    ui.spinner();
                    ui.label("Cleaning up child processes. Please wait.");
                });
            });

            if self.server_stopped_rx.try_recv().is_ok() {
                info!("✅ Server cleanup complete. Exiting.");
                std::process::exit(0);
            }
            ctx.request_repaint();
        } else {
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(20.0);
                    ui.heading("Mangatan Launcher");
                    ui.add_space(20.0);
                    if ui.button("Open Web UI").clicked() {
                        let _ = open::that("http://localhost:4568");
                    }

                    ui.add_space(10.0);

                    if ui.button("Open Data Folder").clicked() {
                        if !self.data_dir.exists() {
                            let _ = std::fs::create_dir_all(&self.data_dir);
                        }

                        if let Err(e) = open::that(&self.data_dir) {
                            error!("Failed to open data folder: {}", e);
                        }
                    }
                });
            });
        }
    }
}

async fn run_server(
    shutdown_signal: &mut tokio::sync::mpsc::Receiver<()>,
    data_dir: &PathBuf,
) -> Result<(), Box<anyhow::Error>> {
    info!("🚀 Initializing Mangatan Launcher...");
    info!("📂 Data Directory: {}", data_dir.display());

    if data_dir.exists()
        && let Err(err) = fs::remove_dir_all(data_dir)
    {
        error!("⚠️ Warning: Could not fully clear data directory: {err}");
        error!("   (This usually means an old process is still running. Check Task Manager.)");
    }

    if !data_dir.exists() {
        fs::create_dir_all(data_dir).map_err(|err| anyhow!("Failed to create data dir {err:?}"))?;
    }
    let bin_dir = data_dir.join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|err| anyhow!("Failed to create bin dir {err:?}"))?;
    }

    info!("📦 Extracting assets...");
    let jar_name = "Suwayomi-Server.jar";
    let jar_path = extract_file(&bin_dir, jar_name, JAR_BYTES)
        .map_err(|err| anyhow!("Failed to extract {jar_name} {err:?}"))?;

    let ocr_bin_name = if cfg!(target_os = "windows") {
        "ocr-server.exe"
    } else {
        "ocr-server"
    };
    info!("Extracting OCR server binary: {ocr_bin_name}");
    let ocr_path = extract_executable(&bin_dir, ocr_bin_name, OCR_BYTES)
        .map_err(|err| anyhow!("Failed to extract ocr server {err:?}"))?;

    #[cfg(feature = "embed-jre")]
    {
        let natives_dir = data_dir.join("natives");
        if !natives_dir.exists() {
            info!("📦 Extracting Native Libraries (JogAmp)...");
            fs::create_dir_all(&natives_dir)
                .map_err(|e| anyhow!("Failed to create natives dir: {e}"))?;

            // Reusing the existing extract_zip function
            extract_zip(NATIVES_BYTES, &natives_dir)
                .map_err(|e| anyhow!("Failed to extract natives: {e}"))?;
        }
    }

    info!("🔍 Resolving Java...");
    let java_exec =
        resolve_java(data_dir).map_err(|err| anyhow!("Failed to resolve java install {err:?}"))?;

    info!("👁️ Spawning OCR...");
    let mut ocr_proc = Command::new(&ocr_path)
        .arg("--port")
        .arg("3033")
        .kill_on_drop(true)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|err| anyhow!("Failed to launch ocr server {err:?}"))?;

    info!("☕ Spawning Suwayomi...");
    let mut suwayomi_proc = Command::new(&java_exec)
        .current_dir(data_dir)
        .arg("-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false")
        .arg("-Dsuwayomi.tachidesk.config.server.webUIChannel=BUNDLED")
        .arg("-XX:+ExitOnOutOfMemoryError")
        .arg("--enable-native-access=ALL-UNNAMED")
        .arg("--add-opens=java.desktop/sun.awt=ALL-UNNAMED")
        .arg("--add-opens=java.desktop/javax.swing=ALL-UNNAMED")
        .arg("-jar")
        .arg(&jar_path)
        .kill_on_drop(true)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|err| anyhow!("Failed to launch suwayomi {err:?}"))?;

    info!("🌍 Starting Web Interface at http://localhost:4568");
    let client = Client::new();
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/ocr", any(proxy_ocr_handler))
        .route("/api/ocr/", any(proxy_ocr_handler))
        .route("/api/ocr/{*path}", any(proxy_ocr_handler))
        .route("/api/{*path}", any(proxy_suwayomi_handler))
        .fallback(serve_react_app)
        .layer(cors)
        .with_state(client);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:4568")
        .await
        .map_err(|err| anyhow!("Failed create proxies socket: {err:?}"))?;

    let server_future = axum::serve(listener, app).into_future();

    info!("✅ Servers Running. Waiting for shutdown signal...");

    tokio::select! {
        _ = suwayomi_proc.wait() => { error!("❌ Suwayomi exited unexpectedly"); }
        _ = ocr_proc.wait() => { error!("❌ OCR exited unexpectedly"); }
        _ = server_future => { error!("❌ Web server exited unexpectedly"); }
        _ = shutdown_signal.recv() => {
            info!("🛑 Shutdown signal received via GUI.");
        }
    }

    info!("🛑 terminating child processes...");

    if let Err(err) = suwayomi_proc.kill().await {
        error!("Error killing Suwayomi: {err}");
    }
    let _ = suwayomi_proc.wait().await;
    info!("   Suwayomi terminated.");

    if let Err(err) = ocr_proc.kill().await {
        error!("Error killing OCR: {err}");
    }
    let _ = ocr_proc.wait().await;
    info!("   OCR terminated.");

    Ok(())
}

async fn proxy_ocr_handler(State(client): State<Client>, req: Request) -> impl IntoResponse {
    proxy_request(client, req, "http://127.0.0.1:3033", "/api/ocr").await
}

async fn proxy_suwayomi_handler(State(client): State<Client>, req: Request) -> impl IntoResponse {
    proxy_request(client, req, "http://127.0.0.1:4567", "").await
}

async fn proxy_request(
    client: Client,
    req: Request,
    base_url: &str,
    strip_prefix: &str,
) -> Response {
    let path_query = req
        .uri()
        .path_and_query()
        .map(|v| v.as_str())
        .unwrap_or(req.uri().path());

    let target_path = if !strip_prefix.is_empty() && path_query.starts_with(strip_prefix) {
        &path_query[strip_prefix.len()..]
    } else {
        path_query
    };

    let target_url = format!("{base_url}{target_path}");

    let method = req.method().clone();
    let headers = req.headers().clone();
    let body = reqwest::Body::wrap_stream(req.into_body().into_data_stream());

    let mut builder = client.request(method, &target_url).body(body);

    for (key, value) in headers.iter() {
        if key.as_str() != "host" {
            builder = builder.header(key, value);
        }
    }

    match builder.send().await {
        Ok(resp) => {
            let status = resp.status();
            let mut response_builder = Response::builder().status(status);
            for (key, value) in resp.headers() {
                response_builder = response_builder.header(key, value);
            }
            let stream = resp.bytes_stream().map_err(io::Error::other);
            response_builder
                .body(Body::from_stream(stream))
                .expect("Failed to build proxied response")
        }
        Err(err) => {
            info!("Proxy Error to {target_url}: {err}");
            Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::empty())
                .expect("Failed to build error response")
        }
    }
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
